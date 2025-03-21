const WebSocket = require('ws');

// Parse command line arguments
const args = process.argv.slice(2);
const useNetworkMode = args.includes('--network');

// Configure the server options
const serverOptions = {
    port: 8081
};

// If network mode is enabled, listen on all interfaces
if (useNetworkMode) {
    serverOptions.host = '0.0.0.0';
    console.log('Network mode enabled - server accessible from other devices');
}

const server = new WebSocket.Server(serverOptions);

const clients = new Map();
let nextId = 0;

// Track basic game state
const gameState = {
  players: {}
};

// Configure simulated network conditions
const networkConditions = {
    latency: 0, // ms of artificial latency
    packetLoss: 0 // % chance of dropping a message (0-100)
};

// Helper function to send with simulated network conditions
function sendWithNetworkConditions(socket, data) {
    // Simulate packet loss
    if (Math.random() * 100 < networkConditions.packetLoss) {
        console.log('Simulating packet loss');
        return; // Drop this message
    }
    
    // Simulate latency
    if (networkConditions.latency > 0) {
        setTimeout(() => {
            socket.send(JSON.stringify(data));
        }, networkConditions.latency);
    } else {
        socket.send(JSON.stringify(data));
    }
}

server.on('connection', (socket) => {
  const id = nextId++;
  clients.set(id, socket);
  
  console.log(`Client ${id} connected`);
  
  // Create initial player state
  gameState.players[id] = {
    position: [0, 1, 0],
    rotation: [0, 0, 0, 1],
    health: 100
  };
  
  // Send initial state to new player
  sendWithNetworkConditions(socket, {
    type: 'connection',
    id: id,
    gameState: gameState
  });
  
  // Broadcast to all other clients that new player joined
  for (const [clientId, client] of clients.entries()) {
    if (clientId !== id && client.readyState === WebSocket.OPEN) {
      sendWithNetworkConditions(client, {
        type: 'player_joined',
        id: id,
        initialState: gameState.players[id]
      });
    }
  }
  
  socket.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      // Handle special commands
      if (data.type === 'admin_command') {
        if (data.command === 'set_latency' && typeof data.value === 'number') {
          networkConditions.latency = Math.max(0, data.value);
          console.log(`Set simulated latency to ${networkConditions.latency}ms`);
          return;
        }
        if (data.command === 'set_packet_loss' && typeof data.value === 'number') {
          networkConditions.packetLoss = Math.max(0, Math.min(100, data.value));
          console.log(`Set simulated packet loss to ${networkConditions.packetLoss}%`);
          return;
        }
      }
      
      // Log all received messages
      console.log(`Message from client ${id}:`, data);
      
      // Handle different message types
      switch(data.type) {
        case 'player_update':
          // Update player state
          if (data.position) gameState.players[id].position = data.position;
          if (data.rotation) gameState.players[id].rotation = data.rotation;
          
          // Broadcast to all other clients
          for (const [clientId, client] of clients.entries()) {
            if (clientId !== id && client.readyState === WebSocket.OPEN) {
              sendWithNetworkConditions(client, {
                type: 'player_update',
                id: id,
                position: gameState.players[id].position,
                rotation: gameState.players[id].rotation
              });
            }
          }
          break;
          
        case 'shoot':
          // Broadcast shooting event
          for (const [clientId, client] of clients.entries()) {
            if (clientId !== id && client.readyState === WebSocket.OPEN) {
              sendWithNetworkConditions(client, {
                type: 'shoot',
                id: id,
                origin: data.origin,
                direction: data.direction
              });
            }
          }
          break;
          
        case 'ping':
          // Response immediately with pong, sending back the client's timestamp
          sendWithNetworkConditions(socket, {
            type: 'pong',
            timestamp: data.timestamp
          });
          break;
      }
    } catch (err) {
      console.error('Error processing message:', err);
    }
  });
  
  socket.on('close', () => {
    clients.delete(id);
    delete gameState.players[id];
    console.log(`Client ${id} disconnected`);
    
    // Broadcast to all that player left
    for (const [clientId, client] of clients.entries()) {
      if (client.readyState === WebSocket.OPEN) {
        sendWithNetworkConditions(client, {
          type: 'player_left',
          id: id
        });
      }
    }
  });
});

// Log server IP and port
const os = require('os');
const getLocalIpAddress = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
};

const localIp = getLocalIpAddress();
console.log(`WebSocket server started on ${useNetworkMode ? localIp : 'localhost'}:${serverOptions.port}`);

// Print connection instructions
console.log(`
To connect from this device:
- Connect to: ws://localhost:${serverOptions.port}

${useNetworkMode ? `To connect from other devices:
- Connect to: ws://${localIp}:${serverOptions.port}
- Make sure your firewall allows connections on port ${serverOptions.port}` : `To enable network connections, restart with:
- node server.js --network`}

Server is running and waiting for connections...
`); 