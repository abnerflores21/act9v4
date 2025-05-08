# act9v4

IMPORTANTE: Este proyecto fue desarrollado en Ubuntu. No ha sido testeado en un entorno de Windows.

# INSTALACIÓN
Es necesario instalar las siguientes librerías mediante el siguiente comando 'npm' en la terminal de cualquier versión que tengas de Linux:
```
$ npm install express http ws xml2js uuid fast-xml-parser
```
# ESTRUCTURA
```
Act9v4/
│
├── server/
│   ├── server.js             # Servidor principal (Node.js)
│   ├── rmi_middleware.js     # Middleware RMI para las operaciones del chat
│   ├── socket_handler.js     # Manejo de WebSockets
│
├── models/
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
# INICIAR SERVIDOR
```
$ node server/server_file.js
```
Cada cliente distinto se inicializará al abrir una pestaña de tu navegador con el sitio: 
```
http://localhost:3000
```
