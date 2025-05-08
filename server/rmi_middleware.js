/**
 * Middleware RMI (Remote Method Invocation) para el chat.
 * Proporciona una capa de abstracción para las operaciones del chat.
 */

const { EventEmitter } = require('events');
const xml2js = require('xml2js');
const { v4: uuidv4 } = require('uuid');

// Almacenamiento de datos
const users = new Map(); // userId -> {userId, username, lastActive}
const messageHistory = []; // Lista de mensajes recientes
const MAX_HISTORY = 100; // Número máximo de mensajes en historial

// Event emitter para notificaciones
const chatEvents = new EventEmitter();

// Parser y builder para XML
const parser = new xml2js.Parser({ explicitArray: false });
const builder = new xml2js.Builder();

/**
 * Inicializa el middleware RMI
 */
function initialize() {
  console.log('Middleware RMI inicializado');
}

/**
 * Registra un nuevo usuario
 * @param {string} username - Nombre de usuario
 * @returns {Promise<Object>} - Respuesta de registro
 */
async function registerUser(username) {
  // Validar que el nombre de usuario no esté vacío
  if (!username || !username.trim()) {
    throw new Error('El nombre de usuario no puede estar vacío');
  }
  
  // Verificar si el nombre de usuario ya existe
  const userExists = Array.from(users.values()).some(
    user => user.username.toLowerCase() === username.toLowerCase()
  );
  
  if (userExists) {
    throw new Error('El nombre de usuario ya está en uso');
  }
  
  // Generar ID único
  const userId = uuidv4();
  
  // Registrar usuario
  const user = {
    userId,
    username,
    lastActive: new Date()
  };
  
  users.set(userId, user);
  
  // Crear mensaje de unión
  const joinMessage = createSystemMessage(`${username} se ha unido al chat`, 'JOIN');
  
  // Guardar mensaje y notificar
  saveMessage(joinMessage);
  notifyAll(joinMessage);
  
  console.log(`Usuario registrado: ${username} (ID: ${userId})`);
  
  // Retornar respuesta
  return {
    success: true,
    message: 'Registro exitoso',
    userId
  };
}

/**
 * Obtiene la lista de usuarios conectados
 * @returns {Promise<Array>} - Lista de usuarios
 */
async function getUsers() {
  return Array.from(users.values());
}

/**
 * Envía un mensaje al chat
 * @param {Object} messageData - Datos del mensaje
 * @returns {Promise<Object>} - Mensaje procesado
 */
async function sendMessage(messageData) {
  // Validar datos mínimos
  if (!messageData.userId || !messageData.content) {
    throw new Error('Datos de mensaje incompletos');
  }
  
  // Buscar usuario
  const user = users.get(messageData.userId);
  if (!user) {
    throw new Error('Usuario no encontrado');
  }
  
  // Actualizar último acceso
  user.lastActive = new Date();
  
  // Crear mensaje completo
  const message = {
    userId: messageData.userId,
    username: user.username,
    content: messageData.content,
    timestamp: new Date().toISOString(),
    type: 'CHAT'
  };
  
  // Guardar mensaje
  saveMessage(message);
  
  // Notificar a todos los usuarios
  notifyAll(message);
  
  return message;
}

/**
 * Envía un mensaje privado a un usuario específico
 * @param {Object} messageData - Datos del mensaje
 * @returns {Promise<Object>} - Mensaje procesado
 */
async function sendPrivateMessage(messageData) {
  // Validar datos mínimos
  if (!messageData.userId || !messageData.targetUserId || !messageData.content) {
    throw new Error('Datos de mensaje privado incompletos');
  }
  
  // Buscar remitente
  const sender = users.get(messageData.userId);
  if (!sender) {
    throw new Error('Usuario remitente no encontrado');
  }
  
  // Buscar destinatario
  const target = users.get(messageData.targetUserId);
  if (!target) {
    throw new Error('Usuario destinatario no encontrado');
  }
  
  // Actualizar último acceso del remitente
  sender.lastActive = new Date();
  
  // Crear mensaje completo
  const message = {
    userId: messageData.userId,
    username: sender.username,
    targetUserId: messageData.targetUserId,
    targetUsername: target.username,
    content: messageData.content,
    timestamp: new Date().toISOString(),
    type: 'PRIVATE'
  };
  
  // Guardar mensaje
  saveMessage(message);
  
  // Notificar
  notifyAll(message);
  
  return message;
}

/**
 * Desconecta a un usuario
 * @param {string} userId - ID del usuario
 * @returns {Promise<boolean>} - Éxito de la operación
 */
async function disconnectUser(userId) {
  // Verificar que el usuario existe
  const user = users.get(userId);
  if (!user) {
    return false;
  }
  
  // Eliminar usuario
  users.delete(userId);
  
  // Crear mensaje de desconexión
  const leaveMessage = createSystemMessage(`${user.username} ha abandonado el chat`, 'LEAVE');
  
  // Guardar mensaje y notificar
  saveMessage(leaveMessage);
  notifyAll(leaveMessage);
  
  console.log(`Usuario desconectado: ${user.username} (ID: ${userId})`);
  
  return true;
}

/**
 * Obtiene el historial reciente de mensajes
 * @param {number} limit - Número máximo de mensajes a retornar
 * @returns {Promise<Array>} - Lista de mensajes
 */
async function getMessageHistory(limit = 20) {
  const count = Math.min(limit, messageHistory.length);
  return messageHistory.slice(-count);
}

/**
 * Convierte un objeto de mensaje a formato XML
 * @param {Object} message - Mensaje a convertir
 * @returns {string} - Mensaje en formato XML
 */
function messageToXml(message) {
  return builder.buildObject({ message });
}

/**
 * Convierte un mensaje XML a objeto
 * @param {string} xmlMessage - Mensaje XML
 * @returns {Promise<Object>} - Mensaje como objeto
 */
async function xmlToMessage(xmlMessage) {
  try {
    const result = await parser.parseStringPromise(xmlMessage);
    return result.message;
  } catch (error) {
    throw new Error('XML inválido: ' + error.message);
  }
}

/**
 * Crea un mensaje de sistema
 * @param {string} content - Contenido del mensaje
 * @param {string} type - Tipo de mensaje (JOIN, LEAVE)
 * @returns {Object} - Mensaje de sistema
 */
function createSystemMessage(content, type) {
  return {
    userId: 'system',
    username: 'Sistema',
    content,
    timestamp: new Date().toISOString(),
    type
  };
}

/**
 * Guarda un mensaje en el historial
 * @param {Object} message - Mensaje a guardar
 */
function saveMessage(message) {
  messageHistory.push(message);
  
  // Mantener tamaño máximo del historial
  if (messageHistory.length > MAX_HISTORY) {
    messageHistory.shift();
  }
}

/**
 * Notifica a todos los usuarios sobre un nuevo mensaje
 * @param {Object} message - Mensaje a enviar
 */
function notifyAll(message) {
  chatEvents.emit('message', message);
}

// Exportar funciones del middleware
module.exports = {
  initialize,
  registerUser,
  getUsers,
  sendMessage,
  sendPrivateMessage,
  disconnectUser,
  getMessageHistory,
  messageToXml,
  xmlToMessage,
  chatEvents
};