# Jackalopes Multiplayer Debugging Strategy

## Problem Description
Players can't see each other's meshes or fired particles despite successful WebSocket connections. Console logs show clients connecting to `ws://staging.games.bonsai.so/websocket/`, authenticating, and sending `player_update` messages, but no `player_update` or `player_joined` messages are received back.

## Debugging Checklist

### 1. Server Implementation Analysis
- [ ] Identify which server implementation is active (`server.js` vs Ratchet)
- [ ] Confirm the active server port (likely 8082 based on Nginx configuration)
- [ ] Review server logs for errors or warnings
- [ ] Check if the WebSocket server is properly broadcasting messages

### 2. Connection Flow Analysis
- [ ] Verify client connection sequence (connect → auth → join_session)
- [x] Confirm WebSocket connection is established successfully
- [x] Verify authentication is working (`auth_success` messages received)
- [ ] Check if clients are joining a session (`join_session` message sent)

### 3. Message Format Analysis
- [ ] Compare message formats client sends vs. server expects
- [ ] Examine `player_update` message format discrepancies
- [ ] Verify `game_event` (shot) message structure compatibility

### 4. Root Cause Hypothesis
- [ ] Missing `join_session` message from client
- [ ] Message format incompatibilities
- [ ] Server not properly broadcasting to other clients
- [ ] Session management issues

### 5. Solutions Implementation
- [ ] Fix 1: Add session joining in client after authentication
  - [ ] Modify `ConnectionManager.ts` to send `join_session`
  - [ ] Update `MultiplayerManager.tsx` to handle `join_success`
  
- [ ] Fix 2: Align server message formats with client expectations
  - [ ] Update `handlePlayerUpdate` to match client format
  - [ ] Adjust `handleGameEvent` for shot broadcasting
  
- [ ] Fix 3: Add verbose server-side logging
  - [ ] Log session joining attempts
  - [ ] Log message broadcasting with recipient details
  - [ ] Track rejected messages and reasons

### 6. Verification
- [ ] Test with multiple browser windows
- [ ] Confirm `join_success` messages in logs
- [ ] Verify `player_joined` notifications received
- [ ] Check for `player_update` messages from other clients
- [ ] Confirm remote player meshes appear
- [ ] Verify shot visuals across clients

### 7. Server Configuration Clarification
- [ ] Document which server implementation is intended for production
- [ ] Update configuration if necessary
- [ ] Consider consolidating to a single server implementation
