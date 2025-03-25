# Jackalopes Multiplayer Debugging Strategy

## Problem Description
Players can't see each other's meshes or fired particles despite successful WebSocket connections. Console logs show clients connecting to `ws://staging.games.bonsai.so/websocket/`, authenticating, and sending `player_update` messages, but no `player_update` or `player_joined` messages are received back.

## Debugging Checklist

### 1. Server Implementation Analysis
- [x] Identify which server implementation is active (`server.js` vs Ratchet)
- [x] Confirm the active server port (likely 8082 based on Nginx configuration)
- [x] Review server logs for errors or warnings
- [x] Check if the WebSocket server is properly broadcasting messages

### 2. Connection Flow Analysis
- [x] Verify client connection sequence (connect → auth → join_session)
- [x] Confirm WebSocket connection is established successfully
- [x] Verify authentication is working (`auth_success` messages received)
- [x] Check if clients are joining a session (`join_session` message sent)

### 3. Message Format Analysis
- [x] Compare message formats client sends vs. server expects
- [x] Examine `player_update` message format discrepancies
- [x] Verify `game_event` (shot) message structure compatibility

### 4. Root Cause Hypothesis
- [x] Missing `join_session` message from client
- [x] Message format incompatibilities
- [x] Server not properly broadcasting to other clients
- [x] Session management issues

### 5. Solutions Implementation
- [x] Fix 1: Add session joining in client after authentication
  - [x] Modify `ConnectionManager.ts` to send `join_session`
  - [x] Update `MultiplayerManager.tsx` to handle `join_success`
  
- [x] Fix 2: Align server message formats with client expectations
  - [x] Update `handlePlayerUpdate` to match client format
  - [x] Adjust `handleGameEvent` for shot broadcasting
  
- [x] Fix 3: Add verbose server-side logging
  - [x] Log session joining attempts
  - [x] Log message broadcasting with recipient details
  - [x] Track rejected messages and reasons

### 6. Verification
- [ ] Test with multiple browser windows
- [ ] Confirm `join_success` messages in logs
- [ ] Verify `player_joined` notifications received
- [ ] Check for `player_update` messages from other clients
- [ ] Confirm remote player meshes appear
- [ ] Verify shot visuals across clients

### 7. Server Configuration Clarification
- [x] Document which server implementation is intended for production
- [ ] Update configuration if necessary
- [ ] Consider consolidating to a single server implementation

## Findings
After analyzing the codebase, we've identified the root cause of the multiplayer visibility issue: 

1. The client successfully connects to the WebSocket server and authenticates.
2. The server responds with `auth_success` and assigns a player ID.
3. However, the client never sends a `join_session` message, which is required for:
   - Adding the player to a game session
   - Receiving broadcasts of other players' updates
   - Being included in broadcasts sent to other clients

According to the server implementation in `server.js`, the client must join a session before receiving any player updates or game events. The server's `handlePlayerUpdate` and `handleGameEvent` functions check for `client.sessionId` and return early if not set.

The client has a fallback mechanism in `initializeSession()` that tries to send `join_session` after 1 second if no player ID is received, but since authentication is working and a player ID is assigned, this fallback is never triggered.

## Solution Implemented
We've implemented the following fixes:

1. Updated `ConnectionManager.ts` to send a `join_session` message immediately after receiving `auth_success`.
2. Modified `MultiplayerManager.tsx` to only set `isConnected` after receiving a `join_success` message, ensuring the full connection flow is completed before sending player updates.
3. Enhanced the message format handling in the client to accommodate different variations of message formats from the server:
   - Added support for multiple ways of accessing player IDs (`message.id`, `message.player_id`, or `message.player`)
   - Improved position/rotation extraction from either direct properties or nested inside `state` object
   - Added better handling of shot events with more flexible parsing of event data structure

These changes should resolve the multiplayer visibility issues by ensuring:
- Players properly join a session before sending and receiving updates
- Different message formats from the server are correctly interpreted by the client

## Server-Side Debugging

For enhanced server-side debugging, the following modifications can be applied to the `server.js` file. These provide verbose logging to help identify connection and broadcasting issues.

### Improved Logging in handleJoinSession

```javascript
function handleJoinSession(clientId, data) {
    const client = clients.get(clientId);
    logMessage(`Join session request from client ${clientId}, authenticated: ${client.authenticated}`);
    
    if (!client.authenticated) {
        logMessage(`Rejecting join session: client ${clientId} not authenticated`);
        sendToClient(clientId, {
            type: 'error',
            message: 'You must authenticate before joining a session'
        });
        return;
    }
    
    // Rest of function...
    
    logMessage(`Session ${sessionId} players: ${Array.from(session.players.keys()).join(', ')}`);
}
```

### Enhanced Logging in handlePlayerUpdate

```javascript
function handlePlayerUpdate(clientId, data) {
    const client = clients.get(clientId);
    
    if (!client || !client.authenticated || !client.sessionId) {
        logMessage(`Rejected player_update from ${clientId}: missing required state (auth: ${client?.authenticated}, sessionId: ${client?.sessionId})`);
        return;
    }
    
    const session = sessions.get(client.sessionId);
    if (!session) {
        logMessage(`Rejected player_update from ${clientId}: session ${client.sessionId} not found`);
        return;
    }
    
    // Log player update, but only occasionally to avoid spam
    if (Math.random() < 0.05) {
        logMessage(`Broadcasting player_update from ${clientId} to ${session.players.size - 1} other players`);
    }
    
    // Rest of function...
}
```

### Improved Game Event Handling

```javascript
function handleGameEvent(clientId, data) {
    const client = clients.get(clientId);
    
    if (!client || !client.authenticated || !client.sessionId) {
        logMessage(`Rejected game_event from ${clientId}: missing required state (auth: ${client?.authenticated}, sessionId: ${client?.sessionId})`);
        return;
    }
    
    const session = sessions.get(client.sessionId);
    if (!session) {
        logMessage(`Rejected game_event from ${clientId}: session ${client.sessionId} not found`);
        return;
    }
    
    logMessage(`Broadcasting game_event (${data.event.event_type}) from player ${client.playerId} to all players`);
    
    // Rest of function...
}
```

### Add Periodic Session Status Reports

```javascript
// Add this at the end of the file
// Report active sessions periodically
setInterval(() => {
    if (sessions.size > 0) {
        logMessage(`Active sessions: ${sessions.size}`);
        for (const [sessionId, session] of sessions.entries()) {
            logMessage(`Session ${sessionId}: ${session.players.size} players (${Array.from(session.players.keys()).join(', ')})`);
        }
    }
}, 60000); // Every minute
```

You can apply these logging enhancements to help diagnose any ongoing or future issues with the multiplayer system.

## Verifying the Fix

To verify the fixes are working properly, follow these steps:

1. Rebuild and deploy the game with the updated code
2. Open the browser console to monitor WebSocket communication
3. Open two browser windows pointing to the game URL
4. In both windows, check the console for:
   - Connection established
   - Authentication successful
   - `join_session` message being sent
   - `join_success` message being received
   - `player_joined` notifications when another player connects
5. Move your character in one window and verify:
   - `player_update` messages are being sent
   - The other window receives these updates
   - The remote player's mesh appears and moves correctly
6. Fire shots in one window and verify:
   - `game_event` messages with `player_shoot` are being sent
   - The other window receives these events
   - Shot particles appear in both windows

### Expected Console Messages

After the fix, you should see the following sequence in your console:

```
Connected to server
Initializing session...
Sending data to server (auth): {type: "auth", playerName: "player-1234"}
Received message from server (welcome): {type: "welcome", server: "Jackalopes WebSocket Server", timestamp: 1677823031450}
Received message from server (auth_success): {type: "auth_success", player: {id: "player_abc123", name: "player-1234"}}
📣 AUTH_SUCCESS: Set player ID to player_abc123
Auth successful, joining session...
Sending data to server (join_session): {type: "join_session", playerName: "player_abc123"}
Received message from server (join_success): {type: "join_success", session: {id: "session_xyz789", key: "ABC123"}}
Successfully joined session: session_xyz789
```

When a second player connects, you should see:

```
Received message from server (player_joined): {type: "player_joined", player: {id: "player_def456", name: "player-5678"}}
👤 Player joined: {id: "player_def456", name: "player-5678"}
Adding new remote player: player_def456
```

When player updates are received:

```
Received message from server (player_update): {type: "player_update", id: "player_def456", position: [1.2, 0, 3.4], rotation: [0, 0.707, 0, 0.707]}
📡 Remote player update for player_def456: {position: [1.2, 0, 3.4], rotation: [0, 0.707, 0, 0.707]}
```

## Next Steps

If issues persist after applying these fixes:

1. Check the server logs for any error messages or rejected messages
2. Apply the server-side debugging enhancements to get more detailed logs
3. Verify the WebSocket server is correctly receiving and broadcasting messages
4. Check if there are any firewalls or network restrictions blocking WebSocket communication
5. Verify the Nginx proxy configuration is correctly forwarding WebSocket connections

These fixes should address the root causes of the multiplayer visibility issues, but additional troubleshooting may be needed if specific edge cases are encountered.
