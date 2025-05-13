/**
 * Aplicación principal del chat
 * Maneja la interfaz de usuario y coordina los componentes
 */

// Referencias a elementos DOM
const chatForm = document.getElementById('chat-form');
const messagesContainer = document.getElementById('messages');
const usersList = document.getElementById('users-list');
const loginForm = document.getElementById('login-form');
const loginArea = document.getElementById('login-area');
const chatArea = document.getElementById('chat-area');
const usernameInput = document.getElementById('username');
const messageInput = document.getElementById('msg');
const currentUserDisplay = document.getElementById('current-user');
const logoutBtn = document.getElementById('logout-btn');
const recipientSelect = document.getElementById('recipient-select'); // Nuevo selector de destinatario

// Estado de la aplicación
const appState = {
  userId: null,
  username: null,
  connected: false,
  users: [], // Lista de usuarios para mantener estado
  selectedRecipient: 'all' // Destinatario seleccionado (por defecto: todos)
};

// Al cargar documento
document.addEventListener('DOMContentLoaded', () => {
  // Comprobar si hay una sesión guardada - USAR sessionStorage en lugar de localStorage
  const savedUserId = sessionStorage.getItem('chatUserId');
  const savedUsername = sessionStorage.getItem('chatUsername');
  
  if (savedUserId && savedUsername) {
    // Auto-login con credenciales guardadas
    usernameInput.value = savedUsername;
    connectToChat(savedUsername, savedUserId);
  }
  
  // Configurar eventos
  setupEventListeners();
});

/**
 * Configura los listeners de eventos de la interfaz
 */
function setupEventListeners() {
  // Formulario de login
  loginForm.addEventListener('submit', handleLogin);
  
  // Formulario de chat
  chatForm.addEventListener('submit', handleSendMessage);
  
  // Botón de logout
  logoutBtn.addEventListener('click', handleLogout);
  
  // Selector de destinatario - nuevo evento
  recipientSelect.addEventListener('change', (e) => {
    appState.selectedRecipient = e.target.value;
    // Actualizar placeholder del input según el destinatario
    if (appState.selectedRecipient === 'all') {
      messageInput.placeholder = 'Escribe un mensaje...';
    } else {
      const recipientName = e.target.selectedOptions[0].text;
      messageInput.placeholder = `Mensaje privado para ${recipientName}...`;
    }
  });
  
  // Configurar callbacks de WebSocket
  socketClient.on('onMessage', handleIncomingMessage);
  socketClient.on('onUserListUpdate', updateUsersList);
  socketClient.on('onConnect', handleSuccessfulConnection);
  socketClient.on('onDisconnect', handleDisconnection);
  socketClient.on('onError', displayError);
  socketClient.on('onUsernameError', handleUsernameError); // Nuevo evento para errores de nombre
}

/**
 * Maneja el envío del formulario de login
 * @param {Event} e - Evento del formulario
 */
async function handleLogin(e) {
  e.preventDefault();
  
  const username = usernameInput.value.trim();
  if (!username) {
    displayError('Por favor ingresa un nombre de usuario');
    return;
  }
  
  // Mostrar indicador de carga
  usernameInput.disabled = true;
  loginForm.querySelector('button').disabled = true;
  loginForm.querySelector('button').textContent = 'Conectando...';
  
  try {
    await connectToChat(username);
  } catch (error) {
    console.error('Error al conectar al chat:', error);
    
    // Restaurar estado del formulario
    usernameInput.disabled = false;
    loginForm.querySelector('button').disabled = false;
    loginForm.querySelector('button').textContent = 'Entrar al Chat';
  }
}

/**
 * Maneja errores específicos de nombre de usuario
 * @param {string} errorMessage - Mensaje de error
 */
function handleUsernameError(errorMessage) {
  displayError(errorMessage);
  
  // Restaurar estado del formulario de login
  usernameInput.disabled = false;
  loginForm.querySelector('button').disabled = false;
  loginForm.querySelector('button').textContent = 'Entrar al Chat';
}

/**
 * Conecta al chat usando WebSocket
 * @param {string} username - Nombre de usuario
 * @param {string} existingUserId - ID de usuario existente (opcional)
 */
async function connectToChat(username, existingUserId = null) {
  try {
    // Conectar via WebSocket
    const result = await socketClient.connect(username, existingUserId);
    
    // Actualizar estado
    appState.userId = result.userId;
    appState.username = username;
    appState.connected = true;
    
    console.log('Conectado al chat como:', username, '(ID:', result.userId, ')');
    
    // Mostrar interfaz de chat
    showChatInterface();
    
    // Obtener la lista de usuarios vía RMI
    rmiClient.getUsers().then(updateUsersList);
  } catch (error) {
    console.error('Error de conexión:', error);
    throw error;
  }
}

/**
 * Muestra la interfaz de chat
 */
function showChatInterface() {
  // Ocultar área de login
  loginArea.classList.add('hidden');
  
  // Mostrar área de chat
  chatArea.classList.remove('hidden');
  
  // Habilitar envío de mensajes
  messageInput.disabled = false;
  chatForm.querySelector('button').disabled = false;
  
  // Actualizar información de usuario
  currentUserDisplay.textContent = appState.username;
  
  // Limpiar mensajes anteriores si los hubiera
  messagesContainer.innerHTML = '';
  
  // Enfocar input de mensaje
  messageInput.focus();
}

/**
 * Maneja el envío de mensajes
 * @param {Event} e - Evento del formulario
 */
function handleSendMessage(e) {
  e.preventDefault();
  
  const msg = messageInput.value.trim();
  if (!msg) return;
  
  // Determinar si es mensaje privado o público
  if (appState.selectedRecipient !== 'all') {
    // Obtener el nombre del destinatario
    const recipientUsername = recipientSelect.selectedOptions[0].text;
    // Enviar mensaje privado
    socketClient.sendPrivateMessage(msg, appState.selectedRecipient);
    
    // Mostrar inmediatamente en la interfaz para el remitente (habilitando este bloque de código brickea el proyecto)
    //const recipientUsername = recipientSelect.selectedOptions[0].text;
    //handleIncomingMessage({
      //userId: appState.userId,
      //username: appState.username,
      //content: msg,
      //timestamp: new Date().toISOString(),
      //type: 'PRIVATE',
      //recipient: appState.selectedRecipient,
      //recipientUsername: recipientUsername
    //});
  } else {
    // Enviar mensaje público
    socketClient.sendMessage(msg);
  }
  
  // Limpiar input
  messageInput.value = '';
  messageInput.focus();
}

/**
 * Maneja la salida del chat
 */
function handleLogout() {
  // Desconectar del socket
  socketClient.disconnect();
  
  // Limpiar estado
  appState.userId = null;
  appState.username = null;
  appState.connected = false;
  
  // Volver a mostrar login
  chatArea.classList.add('hidden');
  loginArea.classList.remove('hidden');
  
  // Resetear formularios
  usernameInput.disabled = false;
  usernameInput.value = '';
  loginForm.querySelector('button').disabled = false;
  loginForm.querySelector('button').textContent = 'Entrar al Chat';
  
  // Deshabilitar envío de mensajes
  messageInput.disabled = true;
  chatForm.querySelector('button').disabled = true;
  
  // Limpiar mensajes
  messagesContainer.innerHTML = '';
  usersList.innerHTML = '';
  
  // Limpiar selector de destinatarios
  recipientSelect.innerHTML = '<option value="all">Todos</option>';
}

/**
 * Maneja los mensajes entrantes
 * @param {Object} message - Mensaje recibido
 */
function handleIncomingMessage(message) {
  // Procesar comandos del sistema
  if (message.type === 'SYSTEM_COMMAND') {
    // Comando para resetear el destinatario a "todos"
    if (message.content === 'RESET_RECIPIENT') {
      recipientSelect.value = 'all';
      recipientSelect.dispatchEvent(new Event('change'));
      return; // No mostrar este mensaje en el chat
    }
  }

  // Crear elemento de mensaje
  const div = document.createElement('div');
  
  // Determinar tipo de mensaje
  if (message.type === 'JOIN' || message.type === 'LEAVE') {
    div.classList.add('message', 'system', message.type.toLowerCase());
    div.innerHTML = `
      <p class="text">${message.content}</p>
      <p class="meta">${formatTime(message.timestamp)}</p>
    `;
  } else if (message.type === 'PRIVATE') {
    // Mensaje privado
    div.classList.add('message', 'private');
    
    // Asegurar que tengamos el nombre del destinatario
    const recipientName = message.recipientUsername || message.targetUsername || 'usuario';
    
    // Si es mensaje propio, añadir clase
    if (message.userId === appState.userId) {
      div.classList.add('self');
      div.innerHTML = `
        <p class="meta">
          <span>Mensaje privado para ${message.targetUsername || "undefined"}</span>
          <span class="time">${formatTime(message.timestamp)}</span>
        </p>
        <p class="text">${message.content}</p>
      `;
    } else {
      div.innerHTML = `
        <p class="meta">
          <span>Mensaje privado de ${message.username}</span>
          <span class="time">${formatTime(message.timestamp)}</span>
        </p>
        <p class="text">${message.content}</p>
      `;
    }
  } else if (message.type === 'ERROR') {
    // Mensaje de error
    div.classList.add('message', 'system', 'error');
    div.innerHTML = `
      <p class="text">${message.content}</p>
      <p class="meta">${formatTime(message.timestamp)}</p>
    `;
  } else {
    // Mensaje normal
    div.classList.add('message');
    
    // Si es mensaje propio, añadir clase
    if (message.userId === appState.userId) {
      div.classList.add('self');
    }
    
    div.innerHTML = `
      <p class="meta">
        <span>${message.username}</span> 
        <span class="time">${formatTime(message.timestamp)}</span>
      </p>
      <p class="text">${message.content}</p>
    `;
  }
  
  // Añadir mensaje al contenedor
  messagesContainer.appendChild(div);
  
  // Scroll al último mensaje
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Actualiza lista de usuarios
 * @param {Array} users - Lista de usuarios
 */
function updateUsersList(users) {
  // Actualizar estado global
  appState.users = users;
  
  // Limpiar lista
  usersList.innerHTML = '';
  
  // Actualizar selector de destinatario
  updateRecipientSelect(users);
  
  // Añadir cada usuario
  users.forEach(user => {
    const li = document.createElement('li');
    li.classList.add('user-item');
    li.dataset.userId = user.userId;
    
    // Determinar si es el usuario actual
    const isCurrentUser = user.userId === appState.userId;
    
    li.innerHTML = `
      <span class="user-status status-online"></span>
      ${user.username} ${isCurrentUser ? '(Tú)' : ''}
      ${!isCurrentUser ? '<button class="btn-send-private" title="Enviar mensaje privado"><i class="fas fa-comment"></i></button>' : ''}
    `;
    
    // Añadir evento para mensajes privados
    if (!isCurrentUser) {
      li.querySelector('.btn-send-private').addEventListener('click', () => {
        // Seleccionar al usuario en el dropdown
        recipientSelect.value = user.userId;
        // Disparar evento change manualmente
        recipientSelect.dispatchEvent(new Event('change'));
        // Enfocar el input de mensaje
        messageInput.focus();
      });
    }
    
    usersList.appendChild(li);
  });
}

/**
 * Actualiza el selector de destinatarios
 * @param {Array} users - Lista de usuarios
 */
function updateRecipientSelect(users) {
  // Guardar selección actual
  const currentSelection = recipientSelect.value;
  
  // Limpiar y añadir opción por defecto
  recipientSelect.innerHTML = '<option value="all">Todos</option>';
  
  // Añadir cada usuario que no sea el actual
  users.forEach(user => {
    if (user.userId !== appState.userId) {
      const option = document.createElement('option');
      option.value = user.userId;
      option.textContent = user.username;
      recipientSelect.appendChild(option);
    }
  });
  
  // Restaurar selección anterior si el usuario sigue disponible
  if (currentSelection !== 'all') {
    const userExists = users.some(user => user.userId === currentSelection);
    if (userExists) {
      recipientSelect.value = currentSelection;
    } else {
      recipientSelect.value = 'all';
      // Actualizar placeholder del mensaje
      messageInput.placeholder = 'Escribe un mensaje...';
    }
  }
}

/**
 * Maneja la conexión exitosa
 * @param {string} userId - ID de usuario
 * @param {string} username - Nombre de usuario
 */
function handleSuccessfulConnection(userId, username) {
  console.log('Conexión establecida para:', username);
  
  // Guardar datos de sesión en sessionStorage (no localStorage)
  sessionStorage.setItem('chatUserId', userId);
  sessionStorage.setItem('chatUsername', username);
}

/**
 * Maneja la desconexión
 */
function handleDisconnection() {
  console.log('Desconectado del chat');
  
  // Si no fue un logout voluntario, mostrar mensaje de error
  if (appState.connected) {
    displayError('Se perdió la conexión con el servidor. Reconectando...');
    
    // Intentar reconectar después de 3 segundos
    setTimeout(() => {
      if (appState.username) {
        connectToChat(appState.username, appState.userId)
          .catch(() => {
            displayError('No se pudo reconectar. Por favor, recarga la página.');
            handleLogout(); // Volver a login si falla reconexión
          });
      }
    }, 3000);
  }
}

/**
 * Muestra un mensaje de error
 * @param {string} message - Mensaje de error
 */
function displayError(message) {
  // Crear elemento de error
  const errorDiv = document.createElement('div');
  errorDiv.classList.add('message', 'system', 'error'); 
  errorDiv.innerHTML = `
    <p class="text">${message}</p>
  `;
  
  // Añadir a contenedor de mensajes si estamos en chat
  if (!chatArea.classList.contains('hidden')) {
    messagesContainer.appendChild(errorDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  } else {
    // O mostrar alerta si estamos en login
    alert(message);
  }
  
  // Auto-eliminar después de 5 segundos
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.parentNode.removeChild(errorDiv);
    }
  }, 5000);
}

/**
 * Formatea una marca de tiempo para mostrar
 * @param {string} timestamp - Marca de tiempo ISO
 * @returns {string} - Hora formateada
 */
function formatTime(timestamp) {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    return timestamp;
  }
}
