# Jackalopes Multiplayer Implementation Plan

This document outlines the step-by-step plan for implementing multiplayer functionality in the Jackalopes FPS game, with the eventual goal of integrating it with a WordPress plugin in a LEMP stack environment.

> **How to use this checklist**: Mark items as completed by changing `[ ]` to `[x]` as you progress through implementation.

## Phase 1: Frontend Prototype (Testing Without Backend)

Before integrating with WordPress, we'll build a prototype that works entirely on the frontend or with minimal backend dependencies.

### Mock Server Setup
- [x] Create a simple Node.js WebSocket server for development testing
  ```bash
  npm install ws express cors
  ```
- [x] Implement basic room/lobby functionality in the test server
- [x] Add simulated latency options for realistic testing

### Frontend Connection Layer
- [x] Create a connection manager class in the game
  ```typescript
  // src/network/ConnectionManager.ts
  export class ConnectionManager {
    // Implementation here
  }
  ```
- [x] Implement WebSocket connection handling with reconnection logic
- [x] Add event system for network events (connect, disconnect, message)

### Game State Synchronization (Client)
- [x] Design network message protocol (JSON-based for development)
- [x] Create entity interpolation system for remote players
- [x] Implement client-side prediction for local player
- [x] Add reconciliation system to handle server corrections
- [x] Build snapshot system for game state updates

### Testing Tools
- [x] Create network condition simulator (latency, packet loss)
- [x] Add debug visualization for network entities
- [x] Implement logging system for network messages

## Phase 2: WordPress Plugin for Multiplayer Server

After the frontend prototype is working, we'll implement the backend server as a WordPress plugin while keeping the game separate. This allows us to maintain the game's development independently while providing a production-ready multiplayer backend.

### WordPress Plugin Architecture (will be installed via composer)
- [ ] Create plugin boilerplate
  ```bash
  wp scaffold plugin jackalopes-server
  ```
- [ ] Set up plugin activation/deactivation hooks
- [ ] Create admin settings page for server configuration
- [ ] Implement database tables for game state persistence

### WebSocket Server Integration
- [ ] Integrate Ratchet WebSocket server within the plugin
  ```bash
  composer require cboden/ratchet
  ```
- [ ] Implement connection handling and message routing
- [ ] Create room/lobby management system
- [ ] Add authentication handlers (supporting both WP users and guest sessions)
- [ ] Implement game session management

### Server Management Features
- [ ] Create server start/stop controls in WP admin
- [ ] Add status monitoring for active connections
- [ ] Implement logging system for diagnostics
- [ ] Add configuration for server performance settings

### API Endpoints
- [ ] Create REST API endpoints for game statistics and session data
- [ ] Implement endpoints for player authentication
- [ ] Add endpoints for server status information

## Phase 3: Game Integration with WordPress Backend

Once the WordPress multiplayer server is stable, we can work on tighter integration options for the game.

### Connection Adapter
- [ ] Create a WordPress-specific connection adapter in the game
  ```typescript
  // src/network/WPConnectionAdapter.ts
  export class WPConnectionAdapter extends ConnectionManager {
    // WordPress-specific implementation
  }
  ```
- [ ] Add authentication methods for WordPress users
- [ ] Implement automatic server discovery through WP endpoints

### Deployment Options
- [ ] Document standalone game with WP multiplayer backend setup
- [ ] Create configuration options for connecting to WP server
- [ ] Add environment detection for development vs production

### Optional Full Integration
- [ ] Create options for embedding game in WordPress (iframe or direct integration)
- [ ] Develop shortcode for easy embedding: `[jackalopes]`
- [ ] Add customization options via shortcode attributes

## Phase 4: Advanced Features

After basic multiplayer is working with WordPress, we'll add more sophisticated features.

### Enhanced Gameplay
- [ ] Implement voice chat using WebRTC
- [ ] Add text chat functionality
- [ ] Create spectator mode
- [ ] Implement match replay system

### Performance Optimization
- [ ] Switch to binary protocol for production
- [ ] Implement area of interest management
- [ ] Add bandwidth usage optimization
- [ ] Create adaptive quality based on connection

### Deployment in Different Environments
- [ ] Standard WordPress setup guide
- [ ] Specialized configuration for Roots LEMP stack
- [ ] Docker-based deployment option
- [ ] Serverless deployment option (where possible)

## Server Implementation Strategies

There are two main approaches for the WordPress server implementation:

### Option 1: Embedded WebSocket Server (Simpler)
The WebSocket server runs within the WordPress process:
- Easier to implement initially
- Uses WordPress hooks for access to WP functionality
- Limited scalability (tied to PHP execution)
- Requires special hosting setup for persistent connections

### Option 2: Separate WebSocket Service (More Scalable)
The WebSocket server runs as a separate service and communicates with WordPress:
- More complex initial setup
- Better performance and scalability
- Independent lifecycle from WordPress
- Requires additional server configuration

For initial implementation, we'll start with Option 1 for simplicity, with architecture allowing a later move to Option 2 if needed.

## WordPress Plugin Structure

```
jackalopes-server/
├── admin/
│   ├── class-admin.php            # Admin UI
│   ├── js/                        # Admin JavaScript
│   └── css/                       # Admin styles
├── includes/
│   ├── class-websocket-server.php # Ratchet WebSocket implementation
│   ├── class-game-state.php       # Game state management
│   ├── class-authentication.php   # WP authentication handler
│   └── class.database.php         # Database interactions
├── public/
│   ├── class-rest-api.php         # REST API endpoints
│   └── class-shortcodes.php       # Shortcodes (for future integration)
├── vendor/                        # Composer dependencies
├── jackalopes-server.php          # Main plugin file
└── uninstall.php                  # Cleanup on uninstall
```

## Frontend Testing Strategies

To test multiplayer functionality before backend integration:

### Option 1: Mock WebSocket Server
Use a simple Node.js WebSocket server for development:

```javascript
// server.js
const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080 });

const clients = new Map();
let nextId = 0;

server.on('connection', (socket) => {
  const id = nextId++;
  clients.set(id, socket);
  
  console.log(`Client ${id} connected`);
  
  // Send initial state
  socket.send(JSON.stringify({
    type: 'connection',
    id: id,
    players: Array.from(clients.keys())
  }));
  
  // Broadcast to all other clients that new player joined
  for (const [clientId, client] of clients.entries()) {
    if (clientId !== id && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'player_joined',
        id: id
      }));
    }
  }
  
  socket.on('message', (message) => {
    const data = JSON.parse(message);
    
    // Broadcast message to all other clients
    for (const [clientId, client] of clients.entries()) {
      if (clientId !== id && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          ...data,
          id: id
        }));
      }
    }
  });
  
  socket.on('close', () => {
    clients.delete(id);
    console.log(`Client ${id} disconnected`);
    
    // Broadcast to all that player left
    for (const [clientId, client] of clients.entries()) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'player_left',
          id: id
        }));
      }
    }
  });
});

console.log('WebSocket server started on port 8080');
```

### Option 2: WebRTC Peer-to-Peer
For testing without any server, use WebRTC peer connections:

```bash
npm install simple-peer
```

This allows direct browser-to-browser connections for testing with friends on the same network or using a simple signaling service.

### Option 3: Mocked Network Module
Create a network module that can switch between real and simulated connections:

```typescript
// src/network/NetworkManager.ts
export class NetworkManager {
  private useSimulation: boolean;
  
  constructor(useSimulation = false) {
    this.useSimulation = useSimulation;
  }
  
  connect() {
    if (this.useSimulation) {
      // Connect to simulated network
      this.setupSimulation();
    } else {
      // Connect to real WebSocket server
      this.connectToServer();
    }
  }
  
  // Rest of implementation
}
```

### Option 4: In-Memory Multiplayer Simulation
For single-device testing, create fake clients in multiple browser tabs with localStorage for communication:

```typescript
window.addEventListener('storage', (e) => {
  if (e.key === 'game_state') {
    // React to state changes from other tabs
    const state = JSON.parse(e.newValue);
    applyRemoteState(state);
  }
});

function broadcastState(state) {
  localStorage.setItem('game_state', JSON.stringify(state));
}
```

## Integration Testing Strategy

When ready to move from frontend testing to WordPress backend integration:

1. Start with the WordPress plugin's WebSocket server implementation
2. Implement the same protocol used in the mock server
3. Add configuration in the game to connect to either the mock server or WordPress server
4. Gradually integrate WordPress-specific features (authentication, persistence)

This approach allows for incremental integration while maintaining a working system at each step.
