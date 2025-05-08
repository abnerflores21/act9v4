/**
 * Modelo de Usuario para la aplicación de chat
 * Representa la estructura de datos de un usuario en el sistema
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

// Emisor de eventos para cambios en los usuarios
const userEvents = new EventEmitter();

// Almacenamiento de usuarios activos
const activeUsers = new Map(); // userId -> User

/**
 * Clase que representa un usuario del chat
 */
class User {
  /**
   * Constructor del usuario
   * @param {string} username - Nombre del usuario
   * @param {string} userId - ID opcional del usuario (se genera uno si no se proporciona)
   */
  constructor(username, userId = null) {
    this.userId = userId || uuidv4();
    this.username = username;
    this.connected = true;
    this.lastActive = new Date();
    this.joinedAt = new Date();
  }

  /**
   * Actualiza la marca de tiempo de la última actividad
   * @returns {Date} - Nueva marca de tiempo
   */
  updateActivity() {
    this.lastActive = new Date();
    return this.lastActive;
  }

  /**
   * Serializa el usuario para transmisión
   * @returns {Object} - Objeto plano con datos del usuario
   */
  toJSON() {
    return {
      userId: this.userId,
      username: this.username,
      connected: this.connected,
      lastActive: this.lastActive.toISOString(),
      joinedAt: this.joinedAt.toISOString()
    };
  }

  /**
   * Serializa el usuario a formato XML
   * @returns {string} - Representación XML del usuario
   */
  toXML() {
    return `
      <user>
        <userId>${this.userId}</userId>
        <username>${this._escapeXml(this.username)}</username>
        <connected>${this.connected}</connected>
        <lastActive>${this.lastActive.toISOString()}</lastActive>
        <joinedAt>${this.joinedAt.toISOString()}</joinedAt>
      </user>
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
 * Verifica si un nombre de usuario ya está en uso
 * @param {string} username - Nombre de usuario a verificar
 * @returns {boolean} - true si el nombre ya está en uso, false si está disponible
 */
function isUsernameTaken(username) {
  const normalizedUsername = username.trim().toLowerCase();
  
  // Buscar si existe algún usuario con el mismo nombre (case insensitive)
  return Array.from(activeUsers.values()).some(
    user => user.username.toLowerCase() === normalizedUsername
  );
}

/**
 * Crea un nuevo usuario
 * @param {string} username - Nombre del usuario
 * @param {string} userId - ID opcional (se genera uno si no se proporciona)
 * @returns {User} - Instancia del usuario creado
 * @throws {Error} - Si el nombre está vacío o ya existe
 */
function createUser(username, userId = null) {
  // Sanitizar nombre de usuario
  const sanitizedUsername = username.trim();
  
  if (!sanitizedUsername) {
    throw new Error('El nombre de usuario no puede estar vacío');
  }
  
  // Verificar si el nombre ya está en uso
  if (isUsernameTaken(sanitizedUsername)) {
    throw new Error('Este nombre de usuario ya está en uso');
  }
  
  // Crear instancia
  const user = new User(sanitizedUsername, userId);
  
  // Almacenar en memoria
  activeUsers.set(user.userId, user);
  
  // Emitir evento de creación
  userEvents.emit('user-created', user);
  
  return user;
}

/**
 * Obtiene un usuario por su ID
 * @param {string} userId - ID del usuario
 * @returns {User|null} - Usuario encontrado o null
 */
function getUserById(userId) {
  return activeUsers.get(userId) || null;
}

/**
 * Obtiene un usuario por su nombre
 * @param {string} username - Nombre del usuario
 * @returns {User|null} - Usuario encontrado o null
 */
function getUserByUsername(username) {
  const normalizedUsername = username.trim().toLowerCase();
  return Array.from(activeUsers.values()).find(
    user => user.username.toLowerCase() === normalizedUsername
  ) || null;
}

/**
 * Obtiene todos los usuarios activos
 * @returns {Array<User>} - Lista de usuarios activos
 */
function getAllUsers() {
  return Array.from(activeUsers.values());
}

/**
 * Elimina un usuario
 * @param {string} userId - ID del usuario a eliminar
 * @returns {boolean} - true si se eliminó, false si no existía
 */
function removeUser(userId) {
  const user = activeUsers.get(userId);
  
  if (!user) {
    return false;
  }
  
  // Eliminar de memoria
  activeUsers.delete(userId);
  
  // Emitir evento de eliminación
  userEvents.emit('user-removed', user);
  
  return true;
}

/**
 * Actualiza el estado de conexión de un usuario
 * @param {string} userId - ID del usuario
 * @param {boolean} connected - Estado de conexión
 * @returns {User|null} - Usuario actualizado o null si no existe
 */
function updateUserConnection(userId, connected) {
  const user = activeUsers.get(userId);
  
  if (!user) {
    return null;
  }
  
  // Actualizar estado
  user.connected = connected;
  user.lastActive = new Date();
  
  // Emitir evento de actualización
  userEvents.emit('user-updated', user);
  
  return user;
}

module.exports = {
  User,
  createUser,
  getUserById,
  getUserByUsername,
  getAllUsers,
  removeUser,
  updateUserConnection,
  isUsernameTaken,
  userEvents
};
