/**
 * Cliente RMI para invocar métodos remotos en el servidor
 * Proporciona una interfaz alternativa o complementaria a los WebSockets
 */

class RmiClient {
  constructor() {
    this.apiBase = '/api';
    this.userId = null;
    this.username = null;
    
    // Almacena los IDs de mensajes procesados para evitar duplicados
    this.processedMessages = new Set();
    
    // Función de callback para procesar mensajes entrantes
    this.onMessageReceived = null;
  }
  
  /**
   * Almacena la información del usuario actual
   * @param {string} userId - ID del usuario
   * @param {string} username - Nombre del usuario
   */
  setCurrentUser(userId, username) {
    this.userId = userId;
    this.username = username;
  }
  
  /**
   * Registra un nuevo usuario usando HTTP en lugar de WebSocket
   * @param {string} username - Nombre de usuario
   * @returns {Promise<Object>} - Respuesta del registro
   */
  async registerUser(username) {
    try {
      const response = await fetch(`${this.apiBase}/users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error en el registro');
      }
      
      // Verificar si la respuesta es XML
      const contentType = response.headers.get('Content-Type');
      
      if (contentType && contentType.includes('application/xml')) {
        const xmlText = await response.text();
        const result = this._parseXmlResponse(xmlText, 'registerResponse');
        
        // Guardar información del usuario si el registro fue exitoso
        if (result.success) {
          this.setCurrentUser(result.userId, username);
        }
        
        return result;
      } 
      
      // Si no es XML, asumir JSON
      const jsonResult = await response.json();
      
      // Guardar información del usuario si el registro fue exitoso
      if (jsonResult.success) {
        this.setCurrentUser(jsonResult.userId, username);
      }
      
      return jsonResult;
    } catch (error) {
      console.error('Error al registrar usuario:', error);
      throw error;
    }
  }
  
  /**
   * Obtiene la lista de usuarios conectados
   * @returns {Promise<Array>} - Lista de usuarios
   */
  async getUsers() {
    try {
      const response = await fetch(`${this.apiBase}/users`);
      
      // Verificar si la respuesta es XML
      const contentType = response.headers.get('Content-Type');
      
      if (contentType && contentType.includes('application/xml')) {
        const xmlText = await response.text();
        const result = this._parseXmlResponse(xmlText, 'userList');
        
        // Convertir a formato de array si no lo es ya
        if (result.user) {
          return Array.isArray(result.user) ? result.user : [result.user];
        }
        return [];
      }
      
      // Si no es XML, asumir JSON
      return await response.json();
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      return [];
    }
  }
  
  /**
   * Envía un mensaje unicast a un usuario específico
   * @param {string} targetUserId - ID del usuario destinatario
   * @param {string} targetUsername - Nombre del usuario destinatario
   * @param {string} content - Contenido del mensaje
   * @param {boolean} localDisplay - Si el mensaje debe mostrarse localmente (por defecto true)
   * @returns {Promise<Object>} - Respuesta del envío
   */
  async sendUnicastMessage(targetUserId, targetUsername, content, localDisplay = true) {
    if (!this.userId || !this.username) {
      throw new Error('Usuario no registrado');
    }
    
    if (!targetUsername || targetUsername === 'undefined') {
      throw new Error('Nombre de destinatario no válido');
    }
    
    try {
      const message = {
        userId: this.userId,
        username: this.username,
        content: content,
        timestamp: new Date().toISOString(),
        type: 'UNICAST',
        targetUserId: targetUserId,
        targetUsername: targetUsername,
        // Flag para indicar al servidor si debe reenviar al remitente
        skipSender: localDisplay
      };
      
      const response = await fetch(`${this.apiBase}/messages/unicast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al enviar mensaje privado');
      }
      
      // Si queremos mostrar el mensaje localmente, devolver el mensaje para
      // que el frontend pueda añadirlo a la UI sin esperar respuesta del servidor
      if (localDisplay) {
        return {
          success: true,
          message: message
        };
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error al enviar mensaje unicast:', error);
      throw error;
    }
  }
  
  /**
   * Desconecta al usuario actual del chat
   * @returns {Promise<Object>} - Respuesta de la desconexión
   */
  async leaveChat() {
    if (!this.userId) {
      throw new Error('Usuario no registrado');
    }
    
    try {
      const response = await fetch(`${this.apiBase}/users/${this.userId}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al salir del chat');
      }
      
      // Limpiar datos del usuario actual
      this.userId = null;
      this.username = null;
      
      return await response.json();
    } catch (error) {
      console.error('Error al salir del chat:', error);
      throw error;
    }
  }
  
  /**
   * Parsea una respuesta XML
   * @param {string} xmlString - Texto XML
   * @param {string} rootName - Nombre del elemento raíz esperado
   * @returns {Object} - Objeto resultante
   * @private
   */
  _parseXmlResponse(xmlString, rootName) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    
    // Comprobar si hay errores de parseo
    const errorNode = xmlDoc.querySelector('parsererror');
    if (errorNode) {
      throw new Error('XML inválido en respuesta del servidor');
    }
    
    // Obtener el elemento raíz
    const rootElement = xmlDoc.querySelector(rootName);
    if (!rootElement) {
      throw new Error(`Elemento raíz '${rootName}' no encontrado`);
    }
    
    // Convertir a objeto
    return this._xmlElementToObject(rootElement);
  }
  
  /**
   * Convierte un elemento XML a objeto
   * @param {Element} element - Elemento XML
   * @returns {Object} - Objeto resultante
   * @private
   */
  _xmlElementToObject(element) {
    const obj = {};
    
    // Procesar nodos hijo
    for (const child of element.children) {
      const nodeName = child.nodeName;
      
      // Si tiene hijos que no son simples textos, procesarlos recursivamente
      if (child.children.length > 0 && ![...child.children].every(c => c.nodeType === 3)) {
        // Si hay múltiples elementos con el mismo nombre, tratarlos como array
        if (obj[nodeName]) {
          if (!Array.isArray(obj[nodeName])) {
            obj[nodeName] = [obj[nodeName]];
          }
          obj[nodeName].push(this._xmlElementToObject(child));
        } else {
          obj[nodeName] = this._xmlElementToObject(child);
        }
      } else {
        // Caso simple: nodo con valor
        const value = child.textContent;
        
        // Convertir a booleano si es 'true' o 'false'
        if (value === 'true' || value === 'false') {
          obj[nodeName] = value === 'true';
        } 
        // Intentar convertir a número si parece número
        else if (!isNaN(value) && value.trim() !== '') {
          obj[nodeName] = Number(value);
        } 
        // De lo contrario, mantener como string
        else {
          obj[nodeName] = value;
        }
        
        // Manejar arrays: si ya existe la propiedad, convertirla en array
        if (obj[nodeName] !== undefined && obj[nodeName] !== value) {
          if (!Array.isArray(obj[nodeName])) {
            obj[nodeName] = [obj[nodeName]];
          }
          obj[nodeName].push(value);
        }
      }
    }
    
    return obj;
  }
  
  /**
   * Registra una función de callback para procesar mensajes entrantes
   * @param {Function} callback - Función que recibe el mensaje y decide si procesarlo
   */
  setMessageHandler(callback) {
    this.onMessageReceived = callback;
  }
  
  /**
   * Procesa un mensaje entrante y evita duplicados
   * @param {Object} message - Mensaje a procesar
   * @returns {boolean} - true si el mensaje fue procesado, false si era duplicado
   */
  processIncomingMessage(message) {
    // Crear un ID único para el mensaje basado en su contenido
    const messageId = this._generateMessageId(message);
    
    // Verificar si ya hemos procesado este mensaje
    if (this.processedMessages.has(messageId)) {
      console.log('Mensaje duplicado detectado y omitido:', message);
      return false;
    }
    
    // Añadir a la lista de mensajes procesados
    this.processedMessages.add(messageId);
    
    // Limitar el tamaño del conjunto para evitar crecimiento ilimitado
    if (this.processedMessages.size > 1000) {
      const iterator = this.processedMessages.values();
      this.processedMessages.delete(iterator.next().value);
    }
    
    // Si hay un handler registrado, llamarlo
    if (this.onMessageReceived) {
      this.onMessageReceived(message);
    }
    
    return true;
  }
  
  /**
   * Genera un ID único para un mensaje basado en su contenido
   * @param {Object} message - Mensaje a identificar
   * @returns {string} - ID único del mensaje
   * @private
   */
  _generateMessageId(message) {
    // Crear un ID único basado en remitente, destinatario, contenido y timestamp
    const components = [
      message.userId,
      message.targetUserId || '',
      message.content,
      message.timestamp
    ];
    
    return components.join('|');
  }
}

// Exponer como variable global
window.rmiClient = new RmiClient();
