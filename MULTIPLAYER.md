# Jackalopes Multiplayer Implementation Plan

This document outlines the step-by-step plan for implementing multiplayer functionality in the Jackalopes FPS game, with the eventual goal of integrating it with a WordPress plugin in a LEMP stack environment.

> **How to use this checklist**: Mark items as completed by changing `[ ]` to `[x]` as you progress through implementation.

## Phase 1: Frontend Prototype (Testing Without Backend)

Before integrating with WordPress, we'll build a prototype that works entirely on the frontend or with minimal backend dependencies.

### Mock Server Setup
- [ ] Create a simple Node.js WebSocket server for development testing
  ```bash
  npm install ws express cors
  ```
- [ ] Implement basic room/lobby functionality in the test server
- [ ] Add simulated latency options for realistic testing

### Frontend Connection Layer
- [ ] Create a connection manager class in the game
  ```typescript
  // src/network/ConnectionManager.ts
  export class ConnectionManager {
    // Implementation here
  }
  ```
- [ ] Implement WebSocket connection handling with reconnection logic
- [ ] Add event system for network events (connect, disconnect, message)

### Game State Synchronization (Client)
- [ ] Design network message protocol (JSON-based for development)
- [ ] Create entity interpolation system for remote players
- [ ] Implement client-side prediction for local player
- [ ] Add reconciliation system to handle server corrections
- [ ] Build snapshot system for game state updates

### Testing Tools
- [ ] Create network condition simulator (latency, packet loss)
- [ ] Add debug visualization for network entities
- [ ] Implement logging system for network messages
- [ ] Create mock player bots for testing multiple connections

## Phase 2: Backend Development

After the frontend prototype is working, we'll implement the actual backend systems.

### PHP WebSocket Server (Ratchet)
- [ ] Set up Ratchet WebSocket server
  ```bash
  composer require cboden/ratchet
  ```
- [ ] Implement connection handling and message routing
- [ ] Create room/lobby management system
- [ ] Add authentication handlers (initially standalone, later WP integration)
- [ ] Implement game session management

### Game State Management (Server)
- [ ] Create authoritative game state on server
- [ ] Implement physics validation for important actions
- [ ] Add anti-cheat measures for basic security
- [ ] Create delta compression for network messages
- [ ] Implement server-side game logic for multiplayer interactions

### Database Design
- [ ] Design schema for player data
- [ ] Create tables for match history and statistics
- [ ] Implement persistence layer for game state
- [ ] Add caching strategies for frequently accessed data

## Phase 3: WordPress Integration

Once the standalone backend is working, we'll integrate it with WordPress.

### Plugin Structure
- [ ] Create basic plugin boilerplate compatible with Roots stack
- [ ] Implement activation/deactivation hooks
- [ ] Add admin settings page
- [ ] Create database migrations for WordPress

### Authentication Integration
- [ ] Connect WebSocket authentication with WordPress users
- [ ] Implement JWT or similar token system for secure connections
- [ ] Add permission checks for game actions

### API Endpoints
- [ ] Create REST API endpoints for game data
- [ ] Implement hooks into Sage/Bedrock systems
- [ ] Add AJAX handlers for non-realtime data

### Admin Features
- [ ] Build dashboard for game statistics
- [ ] Add player management features
- [ ] Implement game session controls (create, end, reset)
- [ ] Create moderation tools

## Phase 4: Advanced Features

After basic multiplayer is working, we'll add more sophisticated features.

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

### Deployment
- [ ] Configure Nginx for WebSocket proxying
- [ ] Set up SSL for secure connections
- [ ] Implement horizontal scaling strategy
- [ ] Create monitoring and alerting

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

When ready to move from frontend testing to backend integration:

1. Start with a minimal PHP WebSocket server using Ratchet
2. Implement the same protocol used in the mock server
3. Gradually add WordPress integration components
4. Use feature flags to switch between different server implementations

This approach allows for incremental integration while maintaining a working system at each step.
