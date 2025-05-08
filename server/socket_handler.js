/**
 * Manejador de WebSockets para la comunicación en tiempo real
 */

const rmiMiddleware = require('./rmi_middleware');

// Almacenamiento de conexiones activas
const activeConnections = new Map(); // userId -> WebSocket

/**
 * Inicializa el servidor WebSocket
 * @param {WebSocket.Server} wss - Servidor WebSocket
 */
function initialize(wss) {
  // Configurar suscripción a eventos del chat
  subscribeToEvents();
  
  // Manejar nuevas conexiones WebSocket
  wss.on('connection', handleConnection);
  
  console.log('Servidor WebSocket inicializado');
}

/**
 * Suscribirse a eventos del middleware RMI
 */
function subscribeToEvents() {
  rmiMiddleware.chatEvents.on('message', (message) => {
    // Convertir mensaje a XML
    const xmlMessage = rmiMiddleware.messageToXml(message);
    
    // Si es mensaje privado, enviarlo solo al destinatario
    if (message.type === 'PRIVATE') {
      sendPrivateMessage(xmlMessage, message.targetUserId, message.userId);
    } else {
      // Enviar a todos los clientes conectados
      broadcastMessage(xmlMessage);
    }
  });
}

/**
 * Maneja una nueva conexión WebSocket
 * @param {WebSocket} ws - Conexión WebSocket
 */
function handleConnection(ws) {
  console.log('Nueva conexión WebSocket');
  
  let userId = null;
  
  // Manejar mensajes entrantes
  ws.on('message', async (data) => {
    try {
      // Intentar parsear mensaje XML
      const message = await rmiMiddleware.xmlToMessage(data.toString());
      
      switch (message.type) {
        case 'JOIN':
          // Procesar registro del usuario
          await handleJoin(ws, message);
          userId = message.userId;
          break;
          
        case 'CHAT':
          // Procesar mensaje de chat
          await rmiMiddleware.sendMessage({
            userId: message.userId,
            content: message.content
          });
          break;
          
        case 'PRIVATE':
          // Procesar mensaje privado
          await rmiMiddleware.sendPrivateMessage({
            userId: message.userId,
            targetUserId: message.targetUserId,
            content: message.content
          });
          break;
          
        case 'LOGOUT':
          // Procesar cierre de sesión explícito
          if (userId) {
            await rmiMiddleware.disconnectUser(userId);
            activeConnections.delete(userId);
            userId = null;
          }
          break;
          
        default:
          console.warn(`Tipo de mensaje no manejado: ${message.type}`);
      }
    } catch (error) {
      console.error('Error al procesar mensaje WebSocket:', error);
      // Enviar mensaje de error al cliente
      ws.send(rmiMiddleware.messageToXml({
        userId: 'system',
        username: 'Sistema',
        content: `Error: ${error.message}`,
        timestamp: new Date().toISOString(),
        type: 'CHAT'
      }));
    }
  });
  
  // Manejar desconexiones
  ws.on('close', async () => {
    if (userId) {
      console.log(`WebSocket cerrado para usuario ${userId}`);
      
      // Eliminar conexión
      activeConnections.delete(userId);
      
      // Notificar desconexión del usuario
      await rmiMiddleware.disconnectUser(userId);
    }
  });
  
  // Manejar errores
  ws.on('error', (error) => {
    console.error('Error en WebSocket:', error);
  });
}

/**
 * Maneja el registro de un usuario a través de WebSocket
 * @param {WebSocket} ws - Conexión WebSocket
 * @param {Object} message - Mensaje de registro
 */
async function handleJoin(ws, message) {
  // Si el mensaje ya tiene userId, es un reconexión
  if (message.userId && message.userId !== 'system') {
    // Verificar si el usuario existe
    const users = await rmiMiddleware.getUsers();
    const userExists = users.some(user => user.userId === message.userId);
    
    if (!userExists) {
      // Registrar de nuevo
      const result = await rmiMiddleware.registerUser(message.username);
      message.userId = result.userId;
    }
  } else {
    // Verificar si el nombre de usuario ya existe
    const users = await rmiMiddleware.getUsers();
    const usernameExists = users.some(user => 
      user.username.toLowerCase() === message.username.toLowerCase()
    );
    
    if (usernameExists) {
      // Enviar error si el nombre ya existe
      const errorResponse = rmiMiddleware.messageToXml({
        userId: 'system',
        username: 'Sistema',
        content: 'Error: El nombre de usuario ya está en uso',
        timestamp: new Date().toISOString(),
        type: 'ERROR'
      });
      ws.send(errorResponse);
      return;
    }
    
    // Nuevo registro
    const result = await rmiMiddleware.registerUser(message.username);
    message.userId = result.userId;
  }
  
  // Almacenar conexión
  activeConnections.set(message.userId, ws);
  
  // Enviar confirmación al cliente
  const joinResponse = rmiMiddleware.messageToXml({
    userId: 'system',
    username: 'Sistema',
    content: 'Conexión establecida',
    timestamp: new Date().toISOString(),
    type: 'JOIN',
    // Incluir ID del usuario para que el cliente lo guarde
    clientId: message.userId
  });
  ws.send(joinResponse);
  
  // Enviar historial reciente de mensajes
  const history = await rmiMiddleware.getMessageHistory();
  for (const msg of history) {
    // No enviar mensajes privados que no son para este usuario
    if (msg.type === 'PRIVATE' && 
        msg.targetUserId !== message.userId && 
        msg.userId !== message.userId) {
      continue;
    }
    ws.send(rmiMiddleware.messageToXml(msg));
  }
  
  // Enviar lista actualizada de usuarios a todos
  sendUserListUpdate();
}

/**
 * Envía un mensaje a todos los clientes conectados
 * @param {string} xmlMessage - Mensaje en formato XML
 */
function broadcastMessage(xmlMessage) {
  for (const ws of activeConnections.values()) {
    if (ws.readyState === ws.OPEN) {
      ws.send(xmlMessage);
    }
  }
}

/**
 * Envía un mensaje privado a un usuario específico
 * @param {string} xmlMessage - Mensaje en formato XML
 * @param {string} targetUserId - ID del usuario destinatario
 * @param {string} senderUserId - ID del usuario remitente
 */
function sendPrivateMessage(xmlMessage, targetUserId, senderUserId) {
  // Enviar al destinatario
  const targetWs = activeConnections.get(targetUserId);
  if (targetWs && targetWs.readyState === targetWs.OPEN) {
    targetWs.send(xmlMessage);
  }
  
  // Enviar una copia al remitente (para que vea lo que envió)
  const senderWs = activeConnections.get(senderUserId);
  if (senderWs && senderWs.readyState === senderWs.OPEN && senderUserId !== targetUserId) {
    senderWs.send(xmlMessage);
  }
}

/**
 * Envía la lista actualizada de usuarios a todos los clientes
 */
async function sendUserListUpdate() {
  const users = await rmiMiddleware.getUsers();
  
  // Construir mensaje con la lista de usuarios
  const userListMessage = {
    userId: 'system',
    username: 'Sistema',
    content: JSON.stringify(users), // Empaquetar usuarios en el contenido
    timestamp: new Date().toISOString(),
    type: 'USER_LIST'
  };
  
  // Convertir a XML y enviar
  const xmlMessage = rmiMiddleware.messageToXml(userListMessage);
  broadcastMessage(xmlMessage);
}

module.exports = {
  initialize,
  broadcastMessage,
  sendUserListUpdate
};