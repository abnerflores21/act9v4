# Estructura del Proyecto de Chat Web

```
chat-app/
│
├── server/
│   ├── server.js             # Servidor principal (Node.js)
│   ├── rmi_middleware.js     # Middleware RMI para las operaciones del chat
│   ├── socket_handler.js     # Manejo de WebSockets
│   └── models/
│       ├── user.js           # Modelo de usuario
│       └── message.js        # Modelo de mensaje
│
├── client/
│   ├── index.html            # Página principal
│   ├── css/
│   │   └── style.css         # Estilos CSS
│   └── js/
│       ├── app.js            # Lógica principal del cliente
│       ├── socket_client.js  # Manejo de WebSockets en cliente
│       └── rmi_client.js     # Cliente RMI
│
└── shared/
    └── message_schema.xml    # Esquema XML para la validación de mensajes
```
