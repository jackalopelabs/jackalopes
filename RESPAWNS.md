# Jackalope Respawn Implementation Plan

## Problem
Currently, when a Merc shoots a Jackalope:
- From the Merc's perspective, the Jackalope respawns
- From the Jackalope's perspective, nothing happens (no respawn)

## Implementation To-Do List

1. **Create `sendRespawnRequest` method in ConnectionManager** ✅
   - Add method to send respawn event to server ✅
   - Handle respawn event on remote Jackalope players ✅

2. **Add respawn event handling in server.js** ✅
   - Implement a `player_respawn` message type ✅
   - Add player position reset logic ✅
   - Broadcast respawn event to all players ✅

3. **Update MultiplayerSyncManager component** ✅
   - Add listener for respawn events ✅
   - Process respawn event and update entity state ✅
   - Dispatch local events for the respawned player ✅

4. **Update RemotePlayer component** ✅
   - Add listener for respawn events ✅
   - Implement visual effects for respawning ✅
   - Add temporary invulnerability after respawn ✅

5. **Update local Jackalope handling** ✅
   - Add respawn logic for local Jackalope player ✅
   - Reset position to spawn point ✅
   - Add visual effects ✅

6. **Fix global communication** ✅
   - Ensure window.__networkManager is properly initialized ✅
   - Connect the hit detection system with the respawn system ✅

7. **Add additional visual feedback** ✅
   - Particle effects on respawn ✅
   - Temporary invulnerability indicator ✅

## Deployment Configuration

- **WebSocket Server**
  - Using secure WebSocket connection: `wss://staging.games.bonsai.so/websocket/`
  - Default connection updated in ConnectionManager.ts
  - ConnectionTest component updated to use secure WebSocket by default

## Testing Instructions

1. Open two browser windows side by side
2. One player should be a Merc, the other a Jackalope
3. Have the Merc shoot at the Jackalope
4. Verify both players see the Jackalope:
   - Disappear with particle explosion
   - Reappear in a new location with spawn effect
   - Show blue shield during invulnerability period

## Troubleshooting

If respawn isn't working:

1. Check browser console for error messages
2. Verify both `sendRespawnRequest` and `player_respawn` events are being sent/received
3. Make sure THREE_ROOT is properly initialized before particle effects
4. Verify the `player_respawned` event is being dispatched to the local player
5. Confirm connection to `wss://staging.games.bonsai.so/websocket/` is established
6. Check for "Connection refused" or CORS errors in the browser console
