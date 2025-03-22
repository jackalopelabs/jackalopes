const WebSocket = require('ws');

// Parse command line arguments
const args = process.argv.slice(2);
const useNetworkMode = args.includes('--network');

// Configure the server options
const serverOptions = {
    port: 8082
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
          // Extract sequence number if present for client prediction
          const sequence = data.sequence !== undefined ? data.sequence : 0;
          
          // Store the original submitted position for error calculation
          const originalPosition = data.position ? [...data.position] : null;
          
          // Get current server state for this player
          const currentServerState = gameState.players[id] ? 
            { position: [...gameState.players[id].position] } : 
            null;
          
          // Update player state in game state
          if (data.position) gameState.players[id].position = data.position;
          if (data.rotation) gameState.players[id].rotation = data.rotation;
          
          // Calculate position error if we have both states
          let positionError = 0;
          if (originalPosition && currentServerState) {
            positionError = Math.sqrt(
              Math.pow(originalPosition[0] - currentServerState.position[0], 2) +
              Math.pow(originalPosition[1] - currentServerState.position[1], 2) +
              Math.pow(originalPosition[2] - currentServerState.position[2], 2)
            );
          }
          
          // Server-side correction (optional)
          // Here you can implement server-side physics validation if needed
          // For example, check if the position change is physically possible
          
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
          
          // Send an authoritative update back to the sender with sequence number
          // This helps with client-side prediction reconciliation
          sendWithNetworkConditions(socket, {
            type: 'player_update',
            id: id,
            position: gameState.players[id].position,
            rotation: gameState.players[id].rotation,
            sequence: sequence,
            timestamp: Date.now(),
            positionError: positionError,
            serverCorrection: positionError > 0.5 // Indicate if server made a major correction
          });
          break;
          
        case 'shoot':
          // Log shot event
          console.log(`Shoot event from client ${id}:`, {
            shotId: data.shotId,
            origin: data.origin,
            direction: data.direction
          });
          
          // Create a standard shot message with consistent fields
          const shotMessage = {
            type: 'shoot',
            id: id,
            shotId: data.shotId || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            origin: data.origin,
            direction: data.direction,
            timestamp: Date.now()
          };
          
          // Log what we're broadcasting
          console.log(`Broadcasting shot to ${clients.size} clients:`, shotMessage);
          
          // Broadcast shooting event to ALL clients including sender (for shot verification)
          for (const [clientId, client] of clients.entries()) {
            try {
              if (client.readyState === WebSocket.OPEN) {
                console.log(`Sending shot event to client ${clientId}`);
                sendWithNetworkConditions(client, shotMessage);
              } else {
                console.log(`Client ${clientId} not ready, state: ${client.readyState}`);
              }
            } catch (error) {
              console.error(`Error sending shot event to client ${clientId}:`, error);
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