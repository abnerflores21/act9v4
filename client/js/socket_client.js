/**
 * Cliente de WebSocket para la comunicación en tiempo real
 */

class SocketClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.userId = null;
    this.username = null;
    this.callbacks = {
      onMessage: null,
      onPrivateMessage: null,
      onUserListUpdate: null,
      onConnect: null,
      onDisconnect: null,
      onError: null,
      onLoginError: null
    };
  }

  /**
   * Inicia la conexión WebSocket
   * @param {string} username - Nombre del usuario
   * @param {string} existingUserId - ID de usuario existente (opcional)
   * @returns {Promise} - Promesa que se resuelve cuando la conexión es establecida
   */
  connect(username, existingUserId = null) {
    return new Promise((resolve, reject) => {
      // Determinar el protocolo websocket (ws o wss)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      
      // Crear nueva conexión WebSocket
      this.socket = new WebSocket(wsUrl);
      this.username = username;
      
      // Configurar eventos de la conexión
      this.socket.onopen = () => {
        console.log('Conexión WebSocket establecida');
        
        // Enviar mensaje de unión al chat
        const joinMessage = {
          userId: existingUserId || '',
          username: username,
          content: 'Solicitando ingreso al chat',
          timestamp: new Date().toISOString(),
          type: 'JOIN'
        };
        
        this._sendXmlMessage(joinMessage);
      };
      
      // Manejar mensajes entrantes
      this.socket.onmessage = (event) => {
        try {
          const xmlString = event.data;
          const message = this._parseXmlMessage(xmlString);
          
          // Verificar si es un mensaje de error
          if (message.type === 'ERROR') {
            if (this.callbacks.onLoginError) {
              this.callbacks.onLoginError(message.content);
            }
            reject(new Error(message.content));
            return;
          }
          
          // Verificar si es respuesta a la conexión
          if (message.type === 'JOIN' && message.clientId) {
            this.userId = message.clientId;
            this.connected = true;
            
            // Guardar ID de usuario en sessionStorage (no localStorage) para reconexiones
            sessionStorage.setItem('chatUserId', this.userId);
            sessionStorage.setItem('chatUsername', this.username);
            
            if (this.callbacks.onConnect) {
              this.callbacks.onConnect(this.userId, this.username);
            }
            
            resolve({ userId: this.userId, username: this.username });
          }
          // Verificar si es actualización de lista de usuarios
          else if (message.type === 'USER_LIST') {
            try {
              const userList = JSON.parse(message.content);
              if (this.callbacks.onUserListUpdate) {
                this.callbacks.onUserListUpdate(userList);
              }
            } catch (error) {
              console.error('Error al procesar lista de usuarios:', error);
            }
          }
          // Verificar si es mensaje privado
          else if (message.type === 'PRIVATE') {
            if (this.callbacks.onPrivateMessage) {
              this.callbacks.onPrivateMessage(message);
            } else if (this.callbacks.onMessage) {
              // Si no hay callback específico para mensajes privados, usar el general
              this.callbacks.onMessage(message);
            }
          }
          // Procesar mensaje normal
          else if (this.callbacks.onMessage) {
            this.callbacks.onMessage(message);
          }
        } catch (error) {
          console.error('Error al procesar mensaje WebSocket:', error);
          if (this.callbacks.onError) {
            this.callbacks.onError('Error al procesar mensaje');
          }
        }
      };
      
      // Manejar cierre de conexión
      this.socket.onclose = () => {
        console.log('Conexión WebSocket cerrada');
        this.connected = false;
        
        if (this.callbacks.onDisconnect) {
          this.callbacks.onDisconnect();
        }
      };
      
      // Manejar errores
      this.socket.onerror = (error) => {
        console.error('Error en WebSocket:', error);
        reject(error);
        
        if (this.callbacks.onError) {
          this.callbacks.onError('Error en la conexión WebSocket');
        }
      };
    });
  }

  /**
   * Envía un mensaje al chat
   * @param {string} content - Contenido del mensaje
   * @returns {boolean} - Éxito del envío
   */
  sendMessage(content) {
    if (!this.connected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    
    const message = {
      userId: this.userId,
      username: this.username,
      content: content,
      timestamp: new Date().toISOString(),
      type: 'CHAT'
    };
    
    return this._sendXmlMessage(message);
  }
  
  /**
   * Envía un mensaje privado a un usuario específico
   * @param {string} content - Contenido del mensaje
   * @param {string} targetUserId - ID del usuario destinatario
   * @param {string} targetUsername - Nombre del usuario destinatario
   * @returns {boolean} - Éxito del envío
   */
  sendPrivateMessage(content, targetUserId, targetUsername) {
    if (!this.connected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    
    const message = {
      userId: this.userId,
      username: this.username,
      targetUserId: targetUserId,
      targetUsername: targetUsername,
      content: content,
      timestamp: new Date().toISOString(),
      type: 'PRIVATE'
    };
    
    return this._sendXmlMessage(message);
  }

  /**
   * Cierra la conexión WebSocket notificando al servidor
   */
  disconnect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      // Enviar mensaje de logout al servidor
      if (this.userId) {
        const logoutMessage = {
          userId: this.userId,
          username: this.username,
          content: 'Usuario cerrando sesión',
          timestamp: new Date().toISOString(),
          type: 'LOGOUT'
        };
        
        this._sendXmlMessage(logoutMessage);
      }
      
      // Cerrar socket después de un breve retraso para asegurar
      // que el mensaje de logout sea enviado
      setTimeout(() => {
        this.socket.close();
        this.socket = null;
        this.connected = false;
        this.userId = null;
        
        // Eliminar información de sesión
        sessionStorage.removeItem('chatUserId');
        sessionStorage.removeItem('chatUsername');
      }, 200);
    } else {
      // Si no hay conexión activa, limpiar directamente
      this.socket = null;
      this.connected = false;
      this.userId = null;
      
      // Eliminar información de sesión
      sessionStorage.removeItem('chatUserId');
      sessionStorage.removeItem('chatUsername');
    }
  }

  /**
   * Establece un callback para un evento específico
   * @param {string} event - Nombre del evento
   * @param {Function} callback - Función de callback
   */
  on(event, callback) {
    if (event in this.callbacks) {
      this.callbacks[event] = callback;
    }
  }

  /**
   * Convierte un objeto de mensaje a XML y lo envía
   * @param {Object} message - Mensaje a enviar
   * @returns {boolean} - Éxito del envío
   * @private
   */
  _sendXmlMessage(message) {
    try {
      const xmlString = this._objectToXml(message);
      this.socket.send(xmlString);
      return true;
    } catch (error) {
      console.error('Error al enviar mensaje XML:', error);
      return false;
    }
  }

  /**
   * Convierte un objeto a formato XML
   * @param {Object} obj - Objeto a convertir
   * @param {string} rootName - Nombre del elemento raíz
   * @returns {string} - Representación XML
   * @private
   */
  _objectToXml(obj, rootName = 'message') {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<${rootName}>`;
    
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        xml += `<${key}>${this._escapeXml(String(value))}</${key}>`;
      }
    }
    
    xml += `</${rootName}>`;
    return xml;
  }

  /**
   * Escapa caracteres especiales XML
   * @param {string} unsafe - Texto a escapar
   * @returns {string} - Texto escapado
   * @private
   */
  _escapeXml(unsafe) {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Parsea un mensaje XML a objeto
   * @param {string} xmlString - Mensaje XML
   * @returns {Object} - Objeto resultante
   * @private
   */
  _parseXmlMessage(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    
    // Comprobar si hay errores de parseo
    const errorNode = xmlDoc.querySelector('parsererror');
    if (errorNode) {
      throw new Error('XML inválido');
    }
    
    // Obtener el elemento raíz (generalmente 'message')
    const rootElement = xmlDoc.documentElement;
    
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
      // Si tiene hijos, procesarlos recursivamente
      if (child.children.length > 0 && !child.children[0].nodeValue) {
        obj[child.nodeName] = this._xmlElementToObject(child);
      } else {
        // Caso base: nodo con valor
        obj[child.nodeName] = child.textContent;
      }
    }
    
    return obj;
  }
}

// Exponer como variable global
window.socketClient = new SocketClient();