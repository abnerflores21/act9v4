/**
 * Modelo de Mensaje para la aplicación de chat
 * Representa la estructura de datos de un mensaje en el sistema
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const xml2js = require('xml2js');

// Emisor de eventos para cambios en los mensajes
const messageEvents = new EventEmitter();

// Almacenamiento de mensajes
const messages = [];
const MAX_HISTORY = 100; // Número máximo de mensajes a almacenar

// Esquema de mensaje (se cargará desde XML)
let messageSchema = null;

/**
 * Cargador del esquema XML para validación de mensajes
 */
async function loadMessageSchema() {
  try {
    const schemaPath = path.join(__dirname, '../../shared/message_schema.xml');
    const schemaXml = await fs.readFile(schemaPath, 'utf8');
    
    const parser = new xml2js.Parser({ explicitArray: false });
    messageSchema = await parser.parseStringPromise(schemaXml);
    
    console.log('Esquema de mensajes cargado correctamente');
    return messageSchema;
  } catch (error) {
    console.error('Error al cargar esquema de mensajes:', error);
    return null;
  }
}

/**
 * Tipos de mensajes soportados
 */
const MessageType = {
  CHAT: 'CHAT',   // Mensaje normal de chat
  PRIVATE:'PRIVATE',   //Mensaje normal a otro usuario
  JOIN: 'JOIN',   // Mensaje de unión al chat
  LEAVE: 'LEAVE', // Mensaje de salida del chat
  SYSTEM: 'SYSTEM', // Mensaje del sistema
  USER_LIST: 'USER_LIST' // Actualización de lista de usuarios
};

/**
 * Clase que representa un mensaje del chat
 */
class Message {
  /**
   * Constructor del mensaje
   * @param {Object} data - Datos del mensaje
   * @param {string} data.userId - ID del usuario que envía el mensaje
   * @param {string} data.username - Nombre del usuario
   * @param {string} data.content - Contenido del mensaje
   * @param {string} data.type - Tipo de mensaje (ver MessageType)
   */
  constructor(data) {
    this.messageId = uuidv4();
    this.userId = data.userId;
    this.username = data.username;
    this.content = data.content;
    this.timestamp = data.timestamp || new Date().toISOString();
    this.type = data.type || MessageType.CHAT;
  }

  /**
   * Valida que el mensaje cumpla con el esquema
   * @returns {Object} - Resultado de validación {valid: boolean, errors: Array}
   */
  validate() {
    // Si no hay esquema cargado, se considera válido
    if (!messageSchema) {
      return { valid: true, errors: [] };
    }
    
    const errors = [];
    
    // Validar campos requeridos
    if (!this.userId) errors.push('userId es requerido');
    if (!this.username) errors.push('username es requerido');
    if (!this.content) errors.push('content es requerido');
    if (!this.timestamp) errors.push('timestamp es requerido');
    if (!this.type) errors.push('type es requerido');
    
    // Validar tipo (debe ser uno de los definidos)
    if (!Object.values(MessageType).includes(this.type)) {
      errors.push(`type debe ser uno de: ${Object.values(MessageType).join(', ')}`);
    }
    
    // Validar formato de timestamp
    const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
    if (!timestampRegex.test(this.timestamp)) {
      errors.push('timestamp debe tener formato ISO (YYYY-MM-DDTHH:mm:ss.sssZ)');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Serializa el mensaje para transmisión
   * @returns {Object} - Objeto plano con datos del mensaje
   */
  toJSON() {
    return {
      messageId: this.messageId,
      userId: this.userId,
      username: this.username,
      content: this.content,
      timestamp: this.timestamp,
      type: this.type
    };
  }

  /**
   * Serializa el mensaje a formato XML
   * @returns {string} - Representación XML del mensaje
   */
  toXML() {
    return `
      <message>
        <messageId>${this.messageId}</messageId>
        <userId>${this.userId}</userId>
        <username>${this._escapeXml(this.username)}</username>
        <content>${this._escapeXml(this.content)}</content>
        <timestamp>${this.timestamp}</timestamp>
        <type>${this.type}</type>
      </message>
    `;
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
}

/**
 * Crea un nuevo mensaje
 * @param {Object} data - Datos del mensaje
 * @returns {Message} - Instancia del mensaje creado
 */
function createMessage(data) {
  // Crear instancia
  const message = new Message(data);
  
  // Validar mensaje
  const validation = message.validate();
  if (!validation.valid) {
    throw new Error(`Mensaje inválido: ${validation.errors.join(', ')}`);
  }
  
  // Añadir al historial
  addToHistory(message);
  
  // Emitir evento de creación
  messageEvents.emit('message-created', message);
  
  return message;
}

/**
 * Crea un mensaje del sistema
 * @param {string} content - Contenido del mensaje
 * @param {string} type - Tipo de mensaje (default: SYSTEM)
 * @returns {Message} - Mensaje del sistema
 */
function createSystemMessage(content, type = MessageType.SYSTEM) {
  return createMessage({
    userId: 'system',
    username: 'Sistema',
    content,
    type
  });
}

/**
 * Añade un mensaje al historial
 * @param {Message} message - Mensaje a añadir
 * @private
 */
function addToHistory(message) {
  messages.push(message);
  
  // Limitar tamaño del historial
  if (messages.length > MAX_HISTORY) {
    messages.shift();
  }
}

/**
 * Obtiene el historial de mensajes
 * @param {number} limit - Límite de mensajes (default: MAX_HISTORY)
 * @returns {Array<Message>} - Lista de mensajes
 */
function getMessageHistory(limit = MAX_HISTORY) {
  const count = Math.min(limit, messages.length);
  return messages.slice(-count);
}

/**
 * Convierte un objeto plano a instancia de Message
 * @param {Object} obj - Objeto con datos de mensaje
 * @returns {Message} - Instancia de Message
 */
function fromJSON(obj) {
  return new Message(obj);
}

/**
 * Convierte un XML a instancia de Message
 * @param {string} xml - Representación XML del mensaje
 * @returns {Promise<Message>} - Promesa con instancia de Message
 */
async function fromXML(xml) {
  try {
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xml);
    
    if (!result.message) {
      throw new Error('XML inválido: no contiene elemento message');
    }
    
    return new Message(result.message);
  } catch (error) {
    throw new Error(`Error al parsear XML: ${error.message}`);
  }
}

module.exports = {
  Message,
  MessageType,
  createMessage,
  createSystemMessage,
  getMessageHistory,
  fromJSON,
  fromXML,
  loadMessageSchema,
  messageEvents
};
