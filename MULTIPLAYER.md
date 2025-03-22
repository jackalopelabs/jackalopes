# Jackalopes Multiplayer Implementation Plan

This document outlines the step-by-step plan for implementing multiplayer functionality in the Jackalopes FPS game, with the eventual goal of integrating it with a WordPress plugin in a LEMP stack environment.

> **How to use this checklist**: Mark items as completed by changing `[ ]` to `[x]` as you progress through implementation.

## Current Status

We have completed Phase 1 and Phase 2 of the implementation plan. The WordPress plugin for multiplayer has been created and is ready for use. Phase 3 (Game Integration with WordPress Backend) is the next step.

## Phase 1: Frontend Prototype (Testing Without Backend) ✅

Before integrating with WordPress, we'll build a prototype that works entirely on the frontend or with minimal backend dependencies.

### Mock Server Setup ✅
- [x] Create a simple Node.js WebSocket server for development testing
  ```bash
  npm install ws express cors
  ```
- [x] Implement basic room/lobby functionality in the test server
- [x] Add simulated latency options for realistic testing

### Frontend Connection Layer ✅
- [x] Create a connection manager class in the game
  ```typescript
  // src/network/ConnectionManager.ts
  export class ConnectionManager {
    // Implementation here
  }
  ```
- [x] Implement WebSocket connection handling with reconnection logic
- [x] Add event system for network events (connect, disconnect, message)

### Game State Synchronization (Client) ✅
- [x] Design network message protocol (JSON-based for development)
- [x] Create entity interpolation system for remote players
- [x] Implement client-side prediction for local player
- [x] Add reconciliation system to handle server corrections
- [x] Build snapshot system for game state updates

### Testing Tools ✅
- [x] Create network condition simulator (latency, packet loss)
- [x] Add debug visualization for network entities
- [x] Implement logging system for network messages

## Phase 2: WordPress Plugin for Multiplayer Server ✅

After the frontend prototype is working, we'll implement the backend server as a WordPress plugin while keeping the game separate. This allows us to maintain the game's development independently while providing a production-ready multiplayer backend.

### WordPress Plugin Architecture ✅
- [x] Create plugin boilerplate
  ```bash
  wp scaffold plugin jackalopes-server
  ```
- [x] Set up plugin activation/deactivation hooks
- [x] Create admin settings page for server configuration
- [x] Implement database tables for game state persistence

### WebSocket Server Integration ✅
- [x] Integrate Ratchet WebSocket server within the plugin
  ```bash
  composer require cboden/ratchet
  ```
- [x] Implement connection handling and message routing
- [x] Create room/lobby management system
- [x] Add authentication handlers (supporting both WP users and guest sessions)
- [x] Implement game session management

### Server Management Features ✅
- [x] Create server start/stop controls in WP admin
- [x] Add status monitoring for active connections
- [x] Implement logging system for diagnostics
- [x] Add configuration for server performance settings

### API Endpoints ✅
- [x] Create REST API endpoints for game statistics and session data
- [x] Implement endpoints for player authentication
- [x] Add endpoints for server status information

## WordPress Multiplayer Server Usage

### Installation Options

#### Option 1: Composer Installation (Recommended)

```bash
# Add to existing WordPress site
composer require jackalopes/jackalopes-server
```

#### Option 2: Manual Installation

1. Copy the `jackalopes-server` directory to your WordPress plugins directory
2. Run `composer install` within the plugin directory to install dependencies
3. Activate the plugin through the WordPress admin panel

### Running the Server

There are two ways to run the WebSocket server:

#### Method 1: Through WordPress Admin

1. Navigate to "Jackalopes" in the WordPress admin menu
2. Go to the "Server" tab
3. Configure server settings (port, max connections, etc.)
4. Click "Start Server"

#### Method 2: Standalone Command Line

```bash
# Navigate to plugin directory
cd wp-content/plugins/jackalopes-server

# Start server with default port (8080)
php bin/server.php

# Or specify a custom port
php bin/server.php 9000
```

### Connecting the Game to the Server

In your game's connection settings, set the WebSocket URL to:

```
ws://your-wordpress-site.com:8080
```

For local development:

```
ws://localhost:8080
```

### Server Configuration

Edit your `.env` file in the plugin directory to customize server behavior:

```
SERVER_PORT=8080
MAX_CONNECTIONS=100
LOG_LEVEL="info"
```

## Phase 3: Game Integration with WordPress Backend (In Progress)

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

## Phase 4: Advanced Features (Future)

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

### Option 1: Embedded WebSocket Server (Current Implementation)
The WebSocket server runs within the WordPress process:
- Easier to implement initially
- Uses WordPress hooks for access to WP functionality
- Limited scalability (tied to PHP execution)
- Requires special hosting setup for persistent connections

### Option 2: Separate WebSocket Service (Future Upgrade Path)
The WebSocket server runs as a separate service and communicates with WordPress:
- More complex initial setup
- Better performance and scalability
- Independent lifecycle from WordPress
- Requires additional server configuration

Our implementation allows for starting with Option 1 and migrating to Option 2 as needed for scaling.

## Current WordPress Plugin Structure

```
jackalopes-server/
├── admin/                       # Admin UI components
├── includes/                    # WordPress integration classes
├── src/                         # PSR-4 autoloaded classes
│   ├── Server.php               # Main WebSocket server implementation
│   └── Logger.php               # Logging utility
├── bin/                         # Command-line utilities
│   └── server.php               # Standalone server script
├── vendor/                      # Composer dependencies
├── .env.example                 # Environment configuration template
├── composer.json                # Composer package definition
├── jackalopes-server.php        # Main plugin file
├── wordpress-loader.php         # WordPress bootstrap for standalone mode
└── uninstall.php                # Cleanup on uninstall
```

## Frontend Testing Strategies

To test multiplayer functionality before backend integration:

### Option 1: Mock WebSocket Server
Use a simple Node.js WebSocket server for development:

```javascript
// server.js
const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080 });

// Server implementation details...
```

### Option 2: WebRTC Peer-to-Peer
For testing without any server, use WebRTC peer connections:

```bash
npm install simple-peer
```

### Option 3: Mocked Network Module
Create a network module that can switch between real and simulated connections:

```typescript
// src/network/NetworkManager.ts
export class NetworkManager {
  private useSimulation: boolean;
  
  constructor(useSimulation = false) {
    this.useSimulation = useSimulation;
  }
  
  // Implementation details...
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

## Moving Forward: Integration Strategy

1. Implement the WordPress-specific connection adapter
2. Add authentication using WordPress user accounts
3. Create environment detection for switching between development and production servers
4. Test with larger numbers of simultaneous players
5. Optimize performance for production use

This approach allows for incremental integration while maintaining a working system at each step.
