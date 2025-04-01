# Jackalopes Multiplayer Implementation Plan

This document outlines the step-by-step plan for implementing multiplayer functionality in the Jackalopes FPS game, with the eventual goal of integrating it with a WordPress plugin in a LEMP stack environment.

> **How to use this checklist**: Mark items as completed by changing `[ ]` to `[x]` as you progress through implementation.

## 🚨 Quick Implementation Tactic (12-Hour Plan)

Given our tight deadline, we're implementing a new entity state observer system to solve character representation and event synchronization issues. Here's our tactical plan:

### 1. Core Entity System (3 hours)
✅ **DONE:**
- Create EntityStateObserver singleton as central source of truth
- Implement MultiplayerSyncManager to bridge network and entity systems 
- Add SoundManager integrated with EntityStateObserver

### 2. Server Enhancements (1 hour)
- Add player type persistence in server's client records
- Always include player type with position updates
- Include player type with shot events

### 3. Testing (3 hours)
- Test with multiple browsers to verify character consistency
- Verify shot sounds reach all players
- Test character model consistency on reconnect

### 4. Fallback Options (2 hours)
If issues persist, implement:
- Manual type override using localStorage
- Forced character type assignment via url query params
- Enhanced shot event broadcasting via localStorage

### 5. Documentation (2 hours)
- Document systems and interaction with screenshots
- Create troubleshooting guide
- Update MULTIPLAYER.md with final status

This approach ensures our characters are correctly represented between all players and that shooting events reach every player with proper visual and audio feedback.

## Current Status

We have completed all three phases of the implementation plan: Frontend Prototype, WordPress Plugin, and Game Integration with WordPress Backend. However, we've identified critical issues with character representation and event broadcasting that need to be fixed.

### 🎉 Working Features
- [x] Real-time player position updates visible to other players
- [x] Remote players rendered with correct position and movement
- [x] Shooting events synchronized across clients (projectiles visible to all players)
- [x] WebSocket communication with server for state synchronization
- [x] Cross-browser communication for testing and fallback

These features are functional but still need optimization for smoothness and performance.

### 🎮 Character & Event Synchronization Issues
- [ ] Characters sometimes appear with the wrong model (jackalope shows as merc)
- [ ] Remote players are unable to hear shots fired by other players
- [ ] Jackalopes sometimes don't see mercs properly

### ✅ Phase 1: Frontend Prototype (Testing Without Backend)
All tasks have been completed in this phase.

### ✅ Phase 2: WordPress Plugin for Multiplayer Server
All tasks have been completed in this phase. The WordPress plugin is functional and deployed to staging.

### ✅ Phase 3: Game Integration with WordPress Backend
This phase is now complete:
- [x] Create a WordPress-specific connection adapter in the game
- [x] Add authentication methods for WordPress users
- [x] Implement automatic server discovery through WP endpoints
- [x] Document standalone game with WP multiplayer backend setup
- [x] Create configuration options for connecting to WP server
- [x] Add environment detection for development vs production

## WordPress Server Integration Guide

The game now successfully connects to the WordPress multiplayer server. Here's how to use and configure it:

### Connection Configuration

The game automatically connects to the appropriate server based on the environment:

```typescript
// For development (local testing)
const serverUrl = 'ws://localhost:8082';

// For staging/production
const serverUrl = 'ws://staging.games.bonsai.so/websocket/';
```

### Message Format Requirements

When sending messages to the WordPress server, the following formats must be used:

#### Player Authentication
```json
{
  "type": "auth",
  "playerName": "player-name"
}
```

#### Joining a Session
```json
{
  "type": "join_session",
  "playerName": "player-id",
  "sessionKey": "JACKALOPES-TEST-SESSION"
}
```

#### Player Position Updates
```json
{
  "type": "player_update",
  "state": {
    "position": [x, y, z],
    "rotation": [x, y, z, w],
    "sequence": 12345
  }
}
```

#### Game Events (Shooting)
```json
{
  "type": "game_event",
  "event": {
    "event_type": "player_shoot",
    "shotId": "unique-shot-id",
    "origin": [x, y, z],
    "direction": [x, y, z],
    "player_id": "player-id",
    "timestamp": 1234567890
  }
}
```

### Troubleshooting Common Issues

#### Session Assignment
- Problem: Players can't see each other despite being connected
- Solution: Ensure all players use the same `sessionKey` value in the `join_session` message

#### Player Updates Not Received
- Problem: Player movement not visible to other players
- Solution: Verify the `player_update` message includes a `state` object with position/rotation

#### Remote Player Jumpiness
- Problem: Remote players appear to jump or teleport
- Solution: Implement client-side interpolation between position updates
- Additional fix: Increase position update frequency for smoother movement
- Optimization: Filter unnecessary updates to reduce network traffic (e.g., only send updates when position changes significantly)

#### Shooting Synchronization Issues
- Problem: Shot events not appearing for all players
- Solution: Ensure shot events include unique IDs and validate processing logic to prevent duplicates
- Optimization: Add shotId tracking with window.__processedShots to deduplicate events

#### Performance Optimization Opportunities
- Problem: Console flooded with multiplayer debug logs
- Solution: Implement different log levels (debug, info, error) and conditionally show logs only when needed
- Recommendation: Add a global DEBUG_LEVEL setting that can be toggled in production vs development

## Hosting the WordPress Server

The WordPress plugin contains the WebSocket server that powers the multiplayer functionality. Some considerations for hosting:

### Server Requirements
- WordPress site running on a LEMP stack
- PHP 7.4+ for the WordPress plugin
- Node.js v16+ (included in the plugin bundle)
- Nginx/Apache configured to proxy WebSocket connections

### Nginx WebSocket Configuration
```nginx
# WebSocket proxy for Jackalopes Server
location /websocket/ {
    proxy_pass http://localhost:8082;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400; # 24 hours
    proxy_buffering off;
}
```

### Health Check Endpoint
A `/health-check` endpoint is planned for server monitoring. Currently, the server can be checked by establishing a WebSocket connection.

## Performance Considerations

For optimal multiplayer performance:

1. **Update Frequency**: The game sends position updates every 50ms (20 updates per second)
2. **Message Size**: Position/rotation updates are compact to minimize bandwidth usage
3. **Interpolation**: Client-side interpolation is recommended for smooth visuals
4. **Connection Quality**: The game adapts to varying connection speeds using ping measurements
5. **Fallback Mode**: Test player mode provides an offline fallback for development

## Future Development

Next steps for multiplayer enhancements:

1. **Enhanced Remote Player Rendering**: Improve the smoothness of remote player movements
2. **Advanced Session Management**: Implement better session discovery and joining
3. **Player Authentication**: Integrate with WordPress user accounts
4. **Admin Dashboard**: Create tools for monitoring and managing game sessions
5. **Scalability Testing**: Test with larger numbers of simultaneous players

## Phase 4: Entity State Observer System (Current Sprint)

Our solution involves creating a centralized entity state tracking system that ensures consistency between visual representation, audio events, and network communication.

### Core System Creation (PRIORITY)
- [x] Implement EntityStateObserver for tracking all entities
- [x] Create SoundManager that hooks into EntityStateObserver
- [x] Implement MultiplayerSyncManager to bridge network and entity states
- [ ] Add server-side hooks to maintain consistent character types

### Integration Tasks
- [ ] Refactor RemotePlayer to respect EntityStateObserver types
- [ ] Ensure player type is saved with player record on server
- [ ] Add entity type validation in ConnectionManager

### Testing Plan
1. **Character Representation Test**
   - Open two browsers simultaneously
   - Verify first player is jackalope and second is merc
   - Ensure they see each other with correct models
   - Take screenshots for documentation

2. **Shooting Event Test**
   - With both browsers open, shoot from merc character
   - Verify jackalope can see and hear shots
   - Take video capture if possible

3. **Full Multiplayer Session Test**
   - Open three browsers simultaneously
   - Verify character types alternate correctly (jackalope, merc, jackalope)
   - Test shooting events from all characters
   - Test movement audio (footsteps) for all character types

## Character Model and Animation Improvements

The character models have been significantly improved to enhance the multiplayer experience:

### GLB Model Integration

We've replaced the geometric models with proper GLB models:
- `src/assets/characters/merc.glb` - The humanoid mercenary character
- `src/assets/characters/jackalope.glb` - The rabbit-like jackalope character

These models provide:
- Higher visual fidelity for all players
- Support for animated movements
- Consistent character representation

### Animation System

The animation system now supports:
1. **Animation State Management**:
   - Each character state (idle, walking, running, etc.) maps to a specific animation
   - Remote players display animations matching their movement states

2. **Animation Synchronization**:
   - Player movements automatically trigger appropriate animations
   - Animation states are synchronized across the network
   - Remote players show the correct animations based on their actions

3. **Fallback Handling**:
   - If models fail to load, geometric fallbacks ensure players remain visible
   - Consistent visual identification (red for Merc, blue for Jackalope) even in fallback mode
   - Console logging of model loading issues for easier debugging

### Implementation

The animation implementation:
1. Uses THREE.js AnimationMixer for smooth animation blending
2. Supports animations embedded in GLB files
3. Has legacy support for external FBX animation files
4. Handles animation transitions with proper fade in/out

This animation system provides a more immersive multiplayer experience by making remote players' movements more realistic and responsive.

## Phase 5: Optimization and Polish (Future)

### Enhanced Gameplay
- [ ] Implement voice chat using WebRTC
- [ ] Add text chat functionality
- [ ] Create spectator mode
- [ ] Implement match replay system
- [x] **Jackalope Respawn Mechanic**: When a Merc's projectile hits a Jackalope, the Jackalope instantly vanishes and respawns

#### Jackalope Respawn Mechanic Implementation

This core gameplay feature establishes the asymmetric nature of the Merc vs. Jackalope dynamic:

1. **Hit Detection**:
   - Detect collision between Merc projectiles and Jackalope players
   - Validate hit on server to prevent client-side exploits
   - Broadcast hit event to all connected players

2. **Vanishing Effect**:
   - Create particle effect at Jackalope's position on hit
   - Play audio cue for successful hit
   - Remove Jackalope model from scene temporarily

3. **Respawn Logic**:
   - Server assigns new spawn position from designated spawn points
   - Apply brief invulnerability period after respawn
   - Notify all clients of respawn with new position data

4. **Scoring & Feedback**:
   - Award points to Merc player for successful hit
   - Update UI for all players showing score change
   - Play respawn animation at new location

5. **Implementation Approach**:
   - Use EntityStateObserver to track hit events
   - Leverage existing projectile collision system
   - Add specific handlers for Jackalope-hit-by-Merc events
   - Implement client-side prediction for responsive gameplay

This mechanic reinforces the game's asymmetric design, where Mercs hunt Jackalopes who must use movement and strategy to avoid being hit.

### Performance Optimization
- [ ] Switch to binary protocol for production
- [ ] Implement area of interest management
- [ ] Add bandwidth usage optimization
- [ ] Create adaptive quality based on connection

#### Character Models - Direct Geometry

We've improved the character models to use direct THREE.js geometry instead of trying to load external GLB files:

1. **Simplified Models**: Characters are now constructed directly with THREE.js primitives (boxes, cylinders) instead of loading GLB files. This ensures they always display properly without requiring external file downloads.

2. **Color Coding**: Characters maintain their distinctive appearance with:
   - Mercs: Red color scheme
   - Jackalopes: Blue color scheme

3. **Benefits**:
   - Reduced download size (no external model files needed)
   - Faster loading (no async file loading or parsing)
   - More reliable (no download failures or parsing errors)
   - Consistent experience for all players
   - Reduced console errors and warnings
   
4. **Implementation**:
   - `MercModel.tsx` and `JackalopeModel.tsx` use direct geometry components
   - Removed model loading code in `ModelLoader.tsx`
   - Kept model path constants for backward compatibility
   - Updated error handling in connection management

This change improves the multiplayer experience by ensuring player characters always display correctly, even in poor network conditions.

### Deployment in Different Environments
- [ ] Standard WordPress setup guide
- [ ] Specialized configuration for Roots LEMP stack
- [ ] Docker-based deployment option
- [ ] Serverless deployment option (where possible)

## Troubleshooting Guide

### Entity Type Consistency Issues
If characters are displaying with incorrect models:
1. Check browser console for EntityStateObserver logs
2. Verify character types are persistent on server
3. Try refreshing all browsers simultaneously

### Audio Synchronization Issues
If audio events aren't being heard:
1. Check browser console for SoundManager logs
2. Verify EntityStateObserver is receiving shot events
3. Test with different character combinations

### Connection Issues
1. Verify WebSocket server is running
2. Check for any CORS errors in browser console
3. Try restarting the server
4. Check firewall settings if on remote deployment

## Server Implementation Notes

The entity system additions require the following server-side changes:
1. The server now tracks player type with the player record
2. Each update message includes the consistent player type
3. Shot events include player type information

## Testing Environment

For local testing:
```bash
# Start the WebSocket server
cd jackalopes-server
node server.js

# In another terminal, start the game
cd ..
npm run dev
```

For production testing:
```bash
# The server is already running on the WordPress host
# Just open the game URL in multiple browsers
```

## What to Expect

When functioning correctly:
1. First player should be a jackalope in third person
2. Second player should be a merc in first person
3. Each should see the other with correct model and animations
4. When merc shoots, jackalope should hear the shot audio
5. Character types should persist between page refreshes

## Fallback Strategy

If the entity observer system doesn't fully resolve all issues:
1. We can implement a forced type system where player type is fixed by connection order
2. We can manually force shot event broadcasting via localStorage for development

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