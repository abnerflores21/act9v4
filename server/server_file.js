const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const xml2js = require('xml2js');
const fs = require('fs');
const { XMLValidator } = require('fast-xml-parser');
const socketHandler = require('./socket_handler');
const rmiMiddleware = require('./rmi_middleware');

// Crear la aplicación Express
const app = express();
const server = http.createServer(app);

// Configurar middleware
app.use(express.static(path.join(__dirname, '../client')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cargar esquema XML
const messageSchemaXML = fs.readFileSync(path.join(__dirname, '../shared/message_schema.xml'), 'utf8');

// Configurar WebSocket server
const wss = new WebSocket.Server({ server });
socketHandler.initialize(wss);

// Configurar RMI middleware
rmiMiddleware.initialize();

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// API para registro de usuario (alternativa a WebSocket)
app.post('/api/users/register', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ success: false, message: 'Nombre de usuario requerido' });
    }

    const result = await rmiMiddleware.registerUser(username);
    
    // Construir respuesta XML
    const builder = new xml2js.Builder();
    const xmlResponse = builder.buildObject({
      registerResponse: {
        success: result.success,
        message: result.message,
        userId: result.userId
      }
    });

    // Enviar respuesta como XML
    res.set('Content-Type', 'application/xml');
    res.send(xmlResponse);
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// API para obtener lista de usuarios (alternativa a WebSocket)
app.get('/api/users', async (req, res) => {
  try {
    const users = await rmiMiddleware.getUsers();
    
    // Construir respuesta XML
    const builder = new xml2js.Builder();
    const xmlResponse = builder.buildObject({
      userList: {
        user: users.map(user => ({
          userId: user.userId,
          username: user.username
        }))
      }
    });

    // Enviar respuesta como XML
    res.set('Content-Type', 'application/xml');
    res.send(xmlResponse);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
