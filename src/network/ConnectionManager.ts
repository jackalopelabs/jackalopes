import { EventEmitter } from 'events';

// Debug level enum
enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  VERBOSE = 5
}

type GameState = {
  players: Record<string, {
    position: [number, number, number];
    rotation: [number, number, number, number];
    health: number;
  }>;
};

// Game snapshot interface for state synchronization
interface GameSnapshot {
  timestamp: number;
  sequence: number;
  players: Record<string, PlayerSnapshot>;
  events: any[];
}

interface PlayerSnapshot {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number, number];
  velocity?: [number, number, number];
  health: number;
}

export class ConnectionManager extends EventEmitter {
  private socket: WebSocket | null = null;
  private playerId: string | null = null;
  private isConnected = false;
  private reconnectInterval: number = 1000;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private gameState: GameState = { players: {} };
  private reconnectTimeout: number | null = null;
  private keepAliveInterval: number | null = null;
  
  // Add latency tracking properties
  private pingInterval: number | null = null;
  private pingStartTime: number = 0;
  private latency: number = 100; // Start with a reasonable default
  private useServerPong: boolean = false; // Start with client-side estimation for compatibility
  private pongReceived: boolean = false;
  private offlineMode: boolean = false; // Track if we're in offline mode
  private connectionFailed: boolean = false; // Track if connection failed after attempts
  
  // Add test player properties
  private _testPlayers: Record<string, number> = {};
  
  // Reconciliation metrics for debugging
  private _reconciliationMetrics = {
    totalCorrections: 0,
    averageError: 0,
    lastError: 0,
    lastCorrection: 0,
    active: true
  };

  // Logging level control
  private logLevel: LogLevel = LogLevel.INFO; // Default to INFO level
  
  // Add playerCount to track connection order - initialize to -1 to make first player index 0
  private static playerCount = -1;
  private playerIndex = -1;
  
  // For shot event tracking
  private lastShotEvents: Record<string, number> = {};
  
  // For testing with simulated players
  private testPlayerIntervals: Record<string, number> = {};
  
  constructor(private serverUrl: string = 'ws://localhost:8082') {
    super();
    
    // Don't reset the static player count here - we'll use localStorage instead
    // for cross-browser coordination
    
    // Set up a storage event listener to detect changes from other tabs
    window.addEventListener('storage', (event) => {
      if (event.key === 'jackalopes_player_count') {
        console.error(`⭐ Detected player count change in another tab: ${event.oldValue} -> ${event.newValue}`);
        
        // Reset our playerIndex so we get a new assignment on next connection
        if (this.playerIndex !== -1) {
          this.playerIndex = -1;
          console.error(`⭐ Reset local player index due to change in another tab`);
        }
      }
    });
    
    // Listen for the custom reset event (fires in this tab)
    window.addEventListener('jackalopes_playercount_reset', (e: any) => {
      console.error('⭐ Detected player count reset in this tab');
      
      // Reset our player index
      this.playerIndex = -1;
      ConnectionManager.playerCount = -1;
      
      // Force refresh to get the new player type
      if (confirm('Player count has been reset. Reload now to get your new character assignment?')) {
        window.location.reload();
      }
    });
    
    // If the serverUrl contains staging.games.bonsai.so but doesn't have /websocket/ path, add it
    if (this.serverUrl.includes('staging.games.bonsai.so') && !this.serverUrl.includes('/websocket/')) {
      // Extract the protocol and host
      const urlParts = this.serverUrl.match(/^(ws:\/\/|wss:\/\/)(.*?)(?::(\d+))?$/);
      if (urlParts) {
        const [, protocol, host, port] = urlParts;
        // Rebuild the URL with the /websocket/ path
        this.serverUrl = `${protocol}${host}${port ? `:${port}` : ''}/websocket/`;
        this.log(LogLevel.INFO, 'Updated server URL to include websocket path:', this.serverUrl);
      }
    }
  }

  // Helper methods for logging with different levels
  private log(level: LogLevel, ...args: any[]): void {
    if (level <= this.logLevel) {
      switch (level) {
        case LogLevel.ERROR:
          console.error(...args);
          break;
        case LogLevel.WARN:
          console.warn(...args);
          break;
        case LogLevel.INFO:
          console.info(...args);
          break;
        case LogLevel.DEBUG:
        case LogLevel.VERBOSE:
          console.log(...args);
          break;
      }
    }
  }

  // Method to set log level
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.log(LogLevel.INFO, `Log level set to: ${LogLevel[level]}`);
  }
  
  connect(): void {
    try {
      this.log(LogLevel.INFO, 'Connecting to WebSocket server at', this.serverUrl);
      
      // Cleanup any existing socket first
      if (this.socket) {
        this.disconnect();
      }
      
      // Reset offline mode flag for new connection attempt
      this.offlineMode = false;
      this.connectionFailed = false;
      
      // For staging.games.bonsai.so, check if it's even reachable first
      if (this.serverUrl.includes('staging.games.bonsai.so')) {
        this.log(LogLevel.INFO, 'Trying to connect to staging server - checking availability first...');
        this.checkServerAvailability();
      } else {
        // For other servers, proceed with normal connection
        this.createWebSocketConnection();
      }
    } catch (error) {
      this.log(LogLevel.ERROR, 'Error connecting to WebSocket server:', error);
      // If we failed to connect, attempt reconnect
      this.handleDisconnect();
    }
  }
  
  private checkServerAvailability(): void {
    // Try a basic fetch to check if the domain is accessible
    // Extract domain from the serverUrl
    const urlMatch = this.serverUrl.match(/^(ws:\/\/|wss:\/\/)([^\/]*)/);
    if (!urlMatch) {
      this.log(LogLevel.ERROR, 'Invalid server URL format');
      this.handleDisconnect();
      return;
    }
    
    const domain = urlMatch[2]; // Extract the domain part
    const protocol = this.serverUrl.startsWith('wss://') ? 'https://' : 'http://';
    
    fetch(`${protocol}${domain}/health-check`, { 
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store'
    })
    .then(() => {
      // If we can reach the domain, try the WebSocket connection
      this.log(LogLevel.INFO, `Domain ${domain} is reachable, attempting WebSocket connection...`);
      this.createWebSocketConnection();
    })
    .catch((error) => {
      // If we can't reach the domain, go to offline mode immediately
      this.log(LogLevel.ERROR, `Cannot reach ${domain}, switching to offline mode:`, error);
      this.connectionFailed = true;
      this.offlineMode = true;
      this.emit('server_unreachable', { server: this.serverUrl });
      setTimeout(() => this.forceReady(), 500);
    });
    
    // Also set a short timeout in case fetch hangs
    setTimeout(() => {
      if (!this.isConnected && !this.offlineMode) {
        this.log(LogLevel.INFO, 'Server availability check timed out, creating WebSocket connection anyway...');
        this.createWebSocketConnection();
      }
    }, 3000);
  }
  
  private createWebSocketConnection(): void {
    // Try to create the WebSocket with a timeout to handle hanging connections
    this.socket = new WebSocket(this.serverUrl);
    
    // Set a timeout to handle cases where the connection hangs
    const connectionTimeout = setTimeout(() => {
      if (this.socket && this.socket.readyState !== WebSocket.OPEN) {
        this.log(LogLevel.INFO, 'Connection timeout after 5 seconds, closing socket');
        // Force close the socket
        if (this.socket.readyState === WebSocket.CONNECTING) {
          this.socket.close();
          this.handleDisconnect();
        }
      }
    }, 5000);
    
    this.socket.onopen = () => {
      clearTimeout(connectionTimeout);
      this.log(LogLevel.INFO, 'Connected to server');
      this.isConnected = true;
      this.reconnectAttempts = 0; // Reset reconnect counter on successful connection
      this.emit('connected');
      
      // Start keep-alive interval after connection
      this.startKeepAliveInterval();
      
      // Attempt to initialize session after connection
      this.initializeSession();
      
      // Start ping interval after connection
      this.startPingInterval();
    };
    
    this.socket.onclose = (event) => {
      clearTimeout(connectionTimeout);
      // Log close code and reason
      this.log(LogLevel.INFO, `WebSocket closed with code ${event.code}, reason: ${event.reason || 'No reason given'}`);
      
      // Use our improved handleDisconnect method
      this.handleDisconnect();
    };
    
    this.socket.onerror = (error) => {
      clearTimeout(connectionTimeout);
      this.handleError(error);
    };
    
    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        this.log(LogLevel.ERROR, 'Error parsing message:', error);
      }
    };
  }
  
  disconnect(): void {
    // Clear any pending reconnection attempts
    this.clearReconnectTimeout();
    
    // Stop ping interval
    this.stopPingInterval();
    
    // Stop keep-alive interval
    this.stopKeepAliveInterval();
    
    if (this.socket) {
      // Remove event listeners to prevent any callbacks after disconnect
      this.socket.onopen = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onmessage = null;
      
      // Only close if socket is not already closing or closed
      if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
        this.socket.close();
      }
      this.socket = null;
    }
    
    // Reset player index when disconnected - this ensures new character assignment on reconnect
    this.playerIndex = -1;
    
    this.isConnected = false;
    this.emit('disconnected');
    this.log(LogLevel.INFO, 'Disconnected from server');
  }
  
  // Starts a keep-alive interval to maintain the connection
  private startKeepAliveInterval(): void {
    this.stopKeepAliveInterval();
    
    // Send a small packet every 30 seconds to keep the connection alive
    this.keepAliveInterval = window.setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        // Send a minimal message that won't trigger errors
        this.send({
          type: 'keepalive',
          timestamp: Date.now()
        });
      }
    }, 30000); // 30 seconds
  }
  
  // Stops the keep-alive interval
  private stopKeepAliveInterval(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }
  
  // Start measuring ping every 2 seconds
  private startPingInterval(): void {
    this.stopPingInterval();
    
    this.pingInterval = window.setInterval(() => {
      if (this.isConnected) {
        this.sendPing();
        
        // Check if we've received a pong since the last ping
        if (!this.pongReceived && this.useServerPong) {
          this.log(LogLevel.INFO, 'No pong received from server, switching to client-side latency estimation');
          this.useServerPong = false;
        }
        
        this.pongReceived = false;
      }
    }, 2000); // Ping every 2 seconds
  }
  
  // Stop the ping interval
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  // Send a ping message to measure latency
  private sendPing(): void {
    this.pingStartTime = Date.now();
    
    if (this.useServerPong) {
      // Use a message that won't cause errors or side effects
      // and that the server definitely can handle
      this.send({
        type: 'game_event',
        event: 'ping',
        timestamp: this.pingStartTime,
        data: { type: 'ping' } // Include in a data field to avoid affecting game state
      });
    } else {
      // For client-side estimation, just measure time to next server message
      this.log(LogLevel.INFO, 'Using client-side latency estimation');
      
      // Simulate a pong response after a brief delay
      setTimeout(() => {
        if (this.isConnected) {
          // We don't have a real measurement but we can estimate
          // based on connection stability
          this.latency = 100; // Assume 100ms if we're connected
          this.emit('latency_update', this.latency);
          this.pongReceived = true;
        }
      }, 50);
    }
  }
  
  // Handle a pong message from server
  private handlePong(message: any): void {
    const now = Date.now();
    const roundTripTime = now - message.timestamp;
    
    // Calculate latency (half of round trip)
    this.latency = Math.round(roundTripTime / 2);
    this.pongReceived = true;
    
    // Only emit an update if we have a reasonable value
    if (this.latency > 0 && this.latency < 10000) { // Ignore unreasonable values
      this.emit('latency_update', this.latency);
    } else {
      // If we got an unreasonable value, use a fallback
      this.latency = 100; // Default reasonable value
      this.emit('latency_update', this.latency);
    }
  }
  
  // Get the current latency estimate
  getLatency(): number {
    return this.latency;
  }
  
  // Check if ready to send messages
  isReadyToSend(): boolean {
    // Can send if we're in offline mode or connected
    return this.offlineMode || 
      (this.isConnected && this.playerId !== null && 
       this.socket?.readyState === WebSocket.OPEN);
  }

  // Add a method to force the connection ready state (for testing)
  forceReady(): void {
    this.log(LogLevel.INFO, '⚠️ Forcing offline mode for cross-browser communication');
    this.offlineMode = true;
    
    // Generate a player index if not already assigned
    if (this.playerIndex === -1) {
      try {
        // Check if we need to reset the player count
        const shouldReset = this.shouldResetPlayerCount();
        
        if (shouldReset) {
          localStorage.setItem('jackalopes_player_count', '-1');
          console.error('⭐ Reset player count due to inactivity');
        }
        
        // Get the current highest player index from localStorage
        let globalPlayerCount = parseInt(localStorage.getItem('jackalopes_player_count') || '-1');
        
        // Increment the count for this player
        globalPlayerCount++;
        
        // Store the updated count back in localStorage
        localStorage.setItem('jackalopes_player_count', globalPlayerCount.toString());
        localStorage.setItem('jackalopes_last_activity', Date.now().toString());
        
        // Assign this player's index
        this.playerIndex = globalPlayerCount;
        
        // Also update the static count to match (for in-tab consistency)
        ConnectionManager.playerCount = globalPlayerCount;
        
        console.error(`⭐ FORCE READY: Assigned player index ${this.playerIndex} using localStorage coordination (assigned as ${this.playerIndex % 2 === 0 ? 'JACKALOPE' : 'MERC'})`);
      } catch (e) {
        // Fallback to static count if localStorage fails
        ConnectionManager.playerCount++;
        this.playerIndex = ConnectionManager.playerCount - 1;
        console.error(`⭐ FORCE READY: Assigned player index ${this.playerIndex} using static count (localStorage failed)`);
      }
    }
    
    if (!this.playerId) {
      // Generate a temporary player ID to allow sending
      this.playerId = `offline-player-${Date.now()}`;
      this.log(LogLevel.INFO, '⚠️ Forcing ready state with temporary player ID:', this.playerId);
    }
    
    if (!this.isConnected) {
      this.isConnected = true;
      this.log(LogLevel.INFO, '⚠️ Forcing connection state to connected');
      this.emit('connected');
    }
    
    // Emit initialized event to set up the game state
    this.emit('initialized', { 
      id: this.playerId, 
      gameState: this.gameState 
    });
  }
  
  // New version of sendPlayerUpdate that accepts a single updateData object
  sendPlayerUpdate(updateData: {
    position: [number, number, number],
    rotation: [number, number, number, number],
    velocity?: [number, number, number],
    sequence?: number
  }): void {
    if (!this.isReadyToSend()) {
      this.log(LogLevel.INFO, 'Cannot send player update: not connected to server or not authenticated yet');
      return;
    }
    
    if (!this.offlineMode) { 
      // For online mode, send to server
      this.send({
        type: 'player_update',
        state: {
          position: updateData.position,
          rotation: updateData.rotation,
          velocity: updateData.velocity || [0, 0, 0],
          sequence: updateData.sequence || Date.now()
        }
      });
    } else {
      // In offline mode, immediately update local game state and emit event
      if (this.playerId) {
        // Update our own player in the game state
        if (!this.gameState.players[this.playerId]) {
          this.gameState.players[this.playerId] = {
            position: updateData.position,
            rotation: updateData.rotation,
            health: 100
          };
        } else {
          this.gameState.players[this.playerId].position = updateData.position;
          this.gameState.players[this.playerId].rotation = updateData.rotation;
        }
      }
    }
  }
  
  // Update sendShootEvent to use a compatible message format with the staging server
  sendShootEvent(origin: [number, number, number], direction: [number, number, number]): void {
    if (!this.isReadyToSend()) {
      // First try localStorage fallback for cross-browser testing
      try {
        const shotId = `local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const shotData = {
          id: this.playerId || 'local-player',
          shotId: shotId,
          origin,
          direction,
          timestamp: Date.now()
        };
        
        // Store in localStorage for cross-browser communication
        localStorage.setItem('jackalopes_shot_events', JSON.stringify(shotData));
        this.log(LogLevel.INFO, 'Shot saved to localStorage as fallback:', shotData);
        
        // Broadcast the event locally
        this.emit('player_shoot', shotData);
        
        // No need to error here since we have a fallback mechanism
        return;
      } catch (e) {
        // Continue with normal error handling if localStorage fails
      }
      
      this.log(LogLevel.INFO, 'Cannot send shoot event: not connected to server or not authenticated yet');
      return;
    }
    
    // Generate a unique ID for this shot
    const shotId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    this.log(LogLevel.INFO, 'ConnectionManager sending shoot event to server:', { 
      shotId,
      origin, 
      direction,
      playerId: this.playerId
    });
    
    // The staging server doesn't support the 'shoot' message type
    // So we'll use 'game_event' instead, which is more likely to be supported
    this.send({
      type: 'game_event',  // Use 'game_event' instead of 'shoot'
      event: {             // Wrap in 'event' instead of event_type/data to match server expectations
        event_type: 'player_shoot',
        shotId: shotId,
        origin,
        direction,
        player_id: this.playerId,
        timestamp: Date.now()
      }
    });
    
    // Also emit the event locally to ensure it works even if the server doesn't process it
    this.emit('player_shoot', {
      id: this.playerId,
      shotId: shotId,
      origin,
      direction,
      timestamp: Date.now()
    });
  }
  
  private send(data: any): void {
    // Check if we're in offline mode
    if (this.offlineMode) {
      // Just emit the message locally without sending to server
      this.emit('message_sent', data);
      return;
    }
    
    // Check if socket exists and is in OPEN state
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        const jsonData = JSON.stringify(data);
        this.log(LogLevel.INFO, `Sending data to server (${data.type}):`, data);
        this.socket.send(jsonData);
        this.emit('message_sent', data);
      } catch (error) {
        this.log(LogLevel.ERROR, 'Error sending data to server:', error);
        
        // If send failed, check if socket is still open
        if (this.socket.readyState !== WebSocket.OPEN) {
          this.log(LogLevel.INFO, 'Socket state changed during send, reconnecting...');
          this.handleDisconnect();
        }
      }
    } else {
      const state = this.socket ? 
        ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][this.socket.readyState] : 
        'NO_SOCKET';
      
      this.log(LogLevel.WARN, `Cannot send data: socket not available or not in OPEN state (${state})`, {
        socketExists: !!this.socket,
        socketState: state,
        isConnected: this.isConnected
      });
      
      // If socket is closed but we think we're connected, try to reconnect
      if (this.socket && this.socket.readyState === WebSocket.CLOSED && this.isConnected) {
        this.log(LogLevel.INFO, 'Socket is closed but connection flag is true, reconnecting...');
        this.handleDisconnect();
      }
    }
  }
  
  private handleMessage(message: any): void {
    this.log(LogLevel.INFO, `Received message from server (${message.type}):`, message);
    this.emit('message_received', message);
    
    // Any message from the server is a sign that the connection is active,
    // even if it's an error message
    if (!this.isConnected) {
      this.log(LogLevel.INFO, 'Received message while disconnected - reconnecting state');
      this.isConnected = true;
      this.emit('connected');
    }
    
    // Use any server response for latency calculation if we're waiting for one
    // and we haven't already processed a pong recently
    if (this.pingStartTime > 0 && !this.pongReceived) {
      this.handlePong({ timestamp: this.pingStartTime });
      this.pingStartTime = 0;
    }
    
    switch (message.type) {
      case 'connection':
        this.playerId = message.id;
        this.gameState = message.gameState;
        this.log(LogLevel.INFO, '📣 CONNECTION: Set player ID to', this.playerId);
        this.emit('initialized', { id: this.playerId, gameState: this.gameState });
        break;
        
      case 'welcome':
        this.log(LogLevel.INFO, 'Received welcome message from server');
        // Server is up, but we still need to authenticate
        if (!this.playerId) {
          this.initializeSession();
        }
        break;
        
      case 'auth_success':
      case 'join_success':
        this.log(LogLevel.INFO, 'Authentication/join successful');
        if (message.player && message.player.id) {
          this.playerId = message.player.id;
          this.log(LogLevel.INFO, '📣 AUTH_SUCCESS: Set player ID to', this.playerId);
          if (message.session) {
            this.log(LogLevel.INFO, 'Joined session:', message.session.id);
            // Add more detailed session diagnostics
            this.log(LogLevel.INFO, '📊 Session diagnostics:', {
              requestedSession: 'JACKALOPES-TEST-SESSION',
              assignedSession: message.session.id,
              sessionKey: message.session.key,
              playerCount: message.playerCount || 'unknown'
            });
          }
          // Explicitly set connected state to true on successful auth
          this.isConnected = true;
          this.emit('initialized', { id: this.playerId, gameState: this.gameState });
          
          // After initialization, immediately log connection state for debugging
          this.log(LogLevel.INFO, '📣 Connection state after auth success:', this.isReadyToSend(), {
            isConnected: this.isConnected,
            playerId: this.playerId,
            socketReady: this.socket?.readyState === WebSocket.OPEN
          });
          
          // If we received auth_success but not join_success, send join_session
          if (message.type === 'auth_success') {
            this.log(LogLevel.INFO, 'Auth successful, joining session...');
            this.send({
              type: 'join_session',
              playerName: message.player.id, // Use player ID as name
              sessionKey: 'JACKALOPES-TEST-SESSION' // Fixed session key for all players
            });
          }
        }
        
        // Use any message response for latency measurement
        if (this.pingStartTime > 0) {
          this.handlePong({ timestamp: this.pingStartTime });
        }
        break;
        
      case 'player_joined':
        this.log(LogLevel.INFO, '👤 Player joined event received:', message);
        // Handle both formats the server might send
        const playerId = message.id || message.player_id;
        const playerState = message.initialState || {
          position: message.position || [0, 1, 0],
          rotation: message.rotation || [0, 0, 0, 1],
          health: 100
        };
        
        // Skip if this is our own player ID
        if (playerId === this.playerId) {
          this.log(LogLevel.INFO, 'Ignoring player_joined for our own player ID');
          break;
        }
        
        // Add to the game state
        this.gameState.players[playerId] = playerState;
        
        // Emit the event so the UI can update
        this.emit('player_joined', { id: playerId, state: playerState });
        this.log(LogLevel.INFO, '🎮 Updated player list - current players:', Object.keys(this.gameState.players));
        break;
        
      case 'player_list':
        // Some servers might send a complete player list instead of individual join/leave events
        this.log(LogLevel.INFO, 'Received player list from server:', message.players);
        if (message.players && typeof message.players === 'object') {
          // Update our game state with all players
          Object.entries(message.players).forEach(([id, playerData]: [string, any]) => {
            // Skip if this is our own player
            if (id === this.playerId) return;
            
            // Add or update this player in our game state
            this.gameState.players[id] = playerData;
            
            // Emit player_joined for any new players we didn't know about
            this.emit('player_joined', { id, state: playerData });
          });
          
          this.log(LogLevel.INFO, '🎮 Updated player list from server - current players:', Object.keys(this.gameState.players));
        }
        break;
        
      case 'player_left':
        delete this.gameState.players[message.id];
        this.emit('player_left', { id: message.id });
        break;
        
      case 'player_update':
        // Handle both our own updates and updates from other players
        const updatePlayerId = message.id || message.player_id || message.player;
        
        // Skip processing updates from ourselves
        if (updatePlayerId !== this.playerId) {
          // Extract position and rotation, handling different server formats
          const position = message.position || (message.state && message.state.position);
          const rotation = message.rotation || (message.state && message.state.rotation);
          
          // Debug potential rotation issues
          if (rotation && Math.random() < 0.01) {
            this.log(LogLevel.INFO, `ROTATION DATA FROM SERVER: ${JSON.stringify(rotation)}`);
          }
          
          // Only proceed if we have valid position data
          if (position) {
            // Check if this is a player we don't know about yet
            if (!this.gameState.players[updatePlayerId]) {
              this.log(LogLevel.INFO, `New player detected from player_update: ${updatePlayerId}`);
              // Create a player joined event for this new player
              const newPlayerState = {
                position: position,
                rotation: rotation || [0, 0, 0, 1], // Default quaternion if missing
                health: 100
              };
              
              // Add to our game state
              this.gameState.players[updatePlayerId] = newPlayerState;
              
              // Emit a player_joined event
              this.emit('player_joined', { 
                id: updatePlayerId, 
                state: newPlayerState
              });
            }
            
            // Get existing position/rotation
            const existingPlayer = this.gameState.players[updatePlayerId];
            const existingPos = existingPlayer.position;
            const existingRot = existingPlayer.rotation;
            
            // Calculate position change
            const positionChanged = !existingPos ||
              Math.abs(existingPos[0] - position[0]) > 0.001 ||
              Math.abs(existingPos[1] - position[1]) > 0.001 ||
              Math.abs(existingPos[2] - position[2]) > 0.001;
            
            // Calculate rotation change - looser check for testing
            const rotationChanged = !existingRot || !rotation || 
              Math.abs(existingRot[0] - rotation[0]) > 0.0001 ||
              Math.abs(existingRot[1] - rotation[1]) > 0.0001 ||
              Math.abs(existingRot[2] - rotation[2]) > 0.0001 ||
              Math.abs(existingRot[3] - rotation[3]) > 0.0001;
            
            // Update the player in our game state (always)
            this.gameState.players[updatePlayerId].position = position;
            if (rotation) {
              this.gameState.players[updatePlayerId].rotation = rotation;
              
              // Debug rotation updates periodically
              if (Math.random() < 0.01) {
                this.log(LogLevel.INFO, `Setting player rotation to: ${JSON.stringify(rotation)}`);
              }
            }
            
            // Only emit player_update if actual changes occurred
            if (positionChanged || rotationChanged) {
              this.emit('player_update', { 
                id: updatePlayerId, 
                position: position, 
                rotation: rotation || this.gameState.players[updatePlayerId].rotation 
              });
            }
          } else {
            this.log(LogLevel.WARN, 'Received player_update without position data:', message);
          }
        }
        // If message is for local player, emit server_state_update for reconciliation
        if (updatePlayerId === this.playerId) {
          this.emit('server_state_update', {
            position: message.position || (message.state && message.state.position),
            rotation: message.rotation || (message.state && message.state.rotation),
            timestamp: message.timestamp || Date.now(), // Use server timestamp if available
            sequence: message.sequence || (message.state && message.state.sequence),
            positionError: message.positionError, // Server reported error
            serverCorrection: message.serverCorrection // Whether server made a major correction
          });
        }
        break;
        
      case 'game_event':
        // Handle game events - could be various types including shots
        this.log(LogLevel.INFO, 'Game event received:', message);
        
        // Check for shot events
        if (message.event_type === 'player_shoot' || 
            (message.event && message.event.event_type === 'player_shoot') ||
            (message.data && message.data.event_type === 'player_shoot')) {
          
          // Handle different server formats
          const eventData = message.data || message.event || message;
          const shooterId = eventData.player_id || eventData.player || eventData.id;
          
          // Make sure we don't process our own shots
          if (shooterId !== this.playerId) {
            this.log(LogLevel.INFO, 'Emitting player_shoot event for shot from player:', shooterId);
            this.emit('player_shoot', {
              id: shooterId,
              shotId: eventData.shotId || 'server-' + Date.now(),
              origin: eventData.origin,
              direction: eventData.direction,
              timestamp: eventData.timestamp || Date.now()
            });
          } else {
            this.log(LogLevel.INFO, 'Ignoring our own shot event from server (player ID:', this.playerId, ')');
          }
        }
        break;
        
      case 'shoot':
        this.log(LogLevel.INFO, 'Received shot event:', message);
        // Make sure we don't process our own shots
        if (message.id !== this.playerId) {
          this.log(LogLevel.INFO, 'Emitting player_shoot event for shot from player:', message.id);
          this.emit('player_shoot', {
            id: message.id,
            shotId: message.shotId || 'no-id',
            origin: message.origin,
            direction: message.direction
          });
        } else {
          this.log(LogLevel.INFO, 'Ignoring our own shot event from server (player ID:', this.playerId, ')');
        }
        break;
        
      case 'pong':
        this.handlePong(message);
        break;
        
      case 'heartbeat':
        if (message.action === 'pong') {
          this.handlePong(message);
        }
        break;
        
      case 'error':
        this.log(LogLevel.ERROR, 'Error from server:', message.message);
        
        // If it's an unknown message type, don't consider it a connection error
        if (message.message && message.message.includes('Unknown message type')) {
          this.log(LogLevel.INFO, 'Server does not recognize a message type, but connection is still active');
          
          // Switch to client-side estimation if our ping attempts are failing
          this.useServerPong = false;
          this.log(LogLevel.INFO, 'Switching to client-side latency estimation due to server error');
        } else {
          // Some other error
          this.log(LogLevel.ERROR, 'Server error:', message.message);
          this.emit('server_error', message.message);
        }
        break;
    }
  }
  
  private handleClose(): void {
    this.log(LogLevel.INFO, 'Disconnected from server');
    this.isConnected = false;
    this.emit('disconnected');
    
    // Stop ping interval
    this.stopPingInterval();
    
    // Try to reconnect
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), this.reconnectInterval);
    }
  }
  
  private handleError(error: Event): void {
    this.log(LogLevel.ERROR, 'WebSocket error:', error);
    // Don't emit error if we're not connected yet - this is expected if server isn't running
    if (this.isConnected) {
      this.emit('error', error);
    } else {
      this.log(LogLevel.INFO, 'WebSocket connection failed - server might not be running');
    }
  }
  
  getGameState(): GameState {
    return this.gameState;
  }
  
  getPlayerId(): string | null {
    return this.playerId;
  }
  
  isPlayerConnected(): boolean {
    return this.isConnected;
  }
  
  // Add public method to get socket state
  getSocketState(): string {
    if (!this.socket) return 'NO_SOCKET';
    const stateMap = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
    return stateMap[this.socket.readyState];
  }
  
  // Get the server URL
  getServerUrl(): string {
    return this.serverUrl;
  }
  
  // Public wrapper for send method 
  sendMessage(data: any): void {
    // Call the private send method
    this.send(data);
  }
  
  private clearReconnectTimeout() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
  
  private handleDisconnect(): void {
    this.isConnected = false;
    this.emit('disconnected');
    this.log(LogLevel.INFO, 'Disconnected from server');
    
    // Stop ping interval
    this.stopPingInterval();
    
    // Stop keep-alive interval
    this.stopKeepAliveInterval();
    
    // Clear any existing reconnect timeout
    this.clearReconnectTimeout();
    
    // For staging server, switch to offline mode immediately after first attempt
    if (this.serverUrl.includes('staging.games.bonsai.so') && this.reconnectAttempts >= 2) {
      this.log(LogLevel.INFO, 'Staging server unreachable after attempt, switching to offline mode');
      this.connectionFailed = true;
      this.forceReady();
      return;
    }
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      // Implement exponential backoff with jitter for reconnection
      const baseDelay = this.reconnectInterval;
      const exponentialBackoff = baseDelay * Math.pow(1.5, this.reconnectAttempts - 1);
      const jitter = Math.random() * 1000; // Add up to 1 second of jitter
      const delay = Math.min(exponentialBackoff + jitter, 30000); // Cap at 30 seconds
      
      this.log(LogLevel.INFO, `Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${Math.round(delay)}ms`);
      this.reconnectTimeout = setTimeout(() => this.connect(), delay);
    } else {
      this.log(LogLevel.INFO, `Max reconnect attempts (${this.maxReconnectAttempts}) reached. Switching to offline mode.`);
      // Mark as failed
      this.connectionFailed = true;
      // Switch to offline mode after max reconnect attempts
      this.forceReady();
    }
  }
  
  // Add server-side game snapshot for state synchronization
  sendGameSnapshot(snapshot: GameSnapshot): void {
    if (!this.isConnected) {
      this.log(LogLevel.INFO, 'Cannot send game snapshot: not connected to server');
      return;
    }
    
    this.send({
      type: 'game_snapshot',
      snapshot
    });
  }
  
  // Expose snapshots and related methods for UI components
  get snapshots(): GameSnapshot[] {
    return [];  // Return empty array as a fallback
  }
  
  getSnapshotAtTime(timestamp: number): GameSnapshot | null {
    return null;  // Return null as a fallback
  }
  
  get reconciliationMetrics(): any {
    return this._reconciliationMetrics;
  }
  
  // Check if we're in offline mode
  isOfflineMode(): boolean {
    return this.offlineMode;
  }
  
  // Get current connection state for debugging
  getConnectionState(): string {
    if (this.offlineMode) {
      return "OFFLINE_MODE";
    }
    
    if (!this.socket) {
      return "NO_SOCKET";
    }
    
    const states = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
    return states[this.socket.readyState] || "UNKNOWN";
  }
  
  // Add a test player for development when no server is available
  addTestPlayer(): string {
    const testPlayerId = `test-player-${Math.floor(Math.random() * 10000)}`;
    
    this.log(LogLevel.INFO, 'Adding simulated test player for debugging:', testPlayerId);
    
    // Create initial position
    const startPosition: [number, number, number] = [
      (Math.random() * 10) - 5,  // Random x position between -5 and 5
      1,                          // Fixed height slightly above ground
      (Math.random() * 10) - 5    // Random z position between -5 and 5
    ];
    
    // Default rotation
    const rotation: [number, number, number, number] = [0, 0, 0, 1];
    
    // Create a fake player joined event
    this.emit('player_joined', {
      id: testPlayerId,
      state: {
        position: startPosition,
        rotation: rotation,
        health: 100
      }
    });
    
    // Add to game state
    this.gameState.players[testPlayerId] = {
      position: startPosition,
      rotation: rotation,
      health: 100
    };
    
    // Create animation loop for this test player
    let angle = 0;
    const radius = 3;
    const center = [...startPosition];
    
    // Store interval ID so we can clear it later
    const intervalId = setInterval(() => {
      // Move in a circle
      angle += 0.02;
      const newPosition: [number, number, number] = [
        center[0] + Math.cos(angle) * radius,
        center[1],
        center[2] + Math.sin(angle) * radius
      ];
      
      // Calculate rotation to face movement direction
      const facingAngle = angle + Math.PI/2;
      const newRotation: [number, number, number, number] = [
        0,
        Math.sin(facingAngle/2),
        0,
        Math.cos(facingAngle/2)
      ];
      
      // Update game state
      this.gameState.players[testPlayerId].position = newPosition;
      this.gameState.players[testPlayerId].rotation = newRotation;
      
      // Emit update event
      this.emit('player_update', {
        id: testPlayerId,
        position: newPosition,
        rotation: newRotation
      });
      
      // Occasionally emit a shot event from the test player
      if (Math.random() < 0.01) {
        const shotId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        
        // Calculate direction based on player rotation
        const direction: [number, number, number] = [
          Math.sin(angle),
          0,
          Math.cos(angle)
        ];
        
        // Emit shot event
        this.emit('player_shoot', {
          id: testPlayerId,
          shotId: shotId,
          origin: newPosition,
          direction: direction,
          timestamp: Date.now()
        });
      }
    }, 50); // 20 updates per second
    
    // Store test player data for cleanup
    this._testPlayers = this._testPlayers || {};
    this._testPlayers[testPlayerId] = intervalId;
    
    return testPlayerId;
  }
  
  // Remove test player
  removeTestPlayer(testPlayerId: string): void {
    // Check if this is a test player
    if (!this._testPlayers || !this._testPlayers[testPlayerId]) {
      this.log(LogLevel.WARN, `Not a test player: ${testPlayerId}`);
      return;
    }
    
    // Stop the animation interval
    clearInterval(this._testPlayers[testPlayerId]);
    
    // Remove from test players list
    delete this._testPlayers[testPlayerId];
    
    // Remove from game state
    delete this.gameState.players[testPlayerId];
    
    // Emit player left event
    this.emit('player_left', {
      id: testPlayerId
    });
    
    this.log(LogLevel.INFO, `Removed test player: ${testPlayerId}`);
  }
  
  // Remove all test players
  removeAllTestPlayers(): void {
    if (!this._testPlayers) return;
    
    // Remove each test player
    Object.keys(this._testPlayers).forEach(playerId => {
      this.removeTestPlayer(playerId);
    });
    
    // Reset test players object
    this._testPlayers = {};
  }
  
  // Initialize session with the server
  private initializeSession(): void {
    this.log(LogLevel.INFO, 'Initializing session...');
    
    // Generate a random player name if none exists
    const playerName = `player-${Math.floor(Math.random() * 10000)}`;
    
    // Use localStorage to assign player indices across browser tabs
    try {
      // Only assign a new player index if one hasn't been assigned yet
      if (this.playerIndex === -1) {
        // Check if we need to reset the player count
        const shouldReset = this.shouldResetPlayerCount();
        
        if (shouldReset) {
          localStorage.setItem('jackalopes_player_count', '-1');
          console.error('⭐ Reset player count due to inactivity');
        }
        
        // Get the current highest player index from localStorage
        let globalPlayerCount = parseInt(localStorage.getItem('jackalopes_player_count') || '-1');
        
        // Increment the count for this player
        globalPlayerCount++;
        
        // Store the updated count back in localStorage
        localStorage.setItem('jackalopes_player_count', globalPlayerCount.toString());
        localStorage.setItem('jackalopes_last_activity', Date.now().toString());
        
        // Assign this player's index
        this.playerIndex = globalPlayerCount;
        
        // Also update the static count to match (for in-tab consistency)
        ConnectionManager.playerCount = globalPlayerCount;
        
        console.error(`⭐ Assigned player index ${this.playerIndex} using localStorage coordination (assigned as ${this.playerIndex % 2 === 0 ? 'JACKALOPE' : 'MERC'})`);
      } else {
        console.error(`⭐ Using existing player index ${this.playerIndex} (already assigned)`);
      }
    } catch (e) {
      // Fallback to static count if localStorage fails
      if (this.playerIndex === -1) {
        ConnectionManager.playerCount++;
        this.playerIndex = ConnectionManager.playerCount - 1;
        console.error(`⭐ Assigned player index ${this.playerIndex} using static count (localStorage failed)`);
      }
    }
    
    this.log(LogLevel.INFO, `Player joining as index #${this.playerIndex} (${this.getPlayerCharacterType()})`);
    
    // Try auth first (most common WebSocket server pattern)
    this.send({
      type: 'auth',
      playerName: playerName
    });
    
    // As a fallback, also try join_session
    setTimeout(() => {
      // Only send if we're still connected but not authenticated
      if (this.socket && this.socket.readyState === WebSocket.OPEN && !this.playerId) {
        this.log(LogLevel.INFO, 'Auth not successful, trying join_session as fallback...');
        this.send({
          type: 'join_session',
          playerName: playerName,
          sessionKey: 'JACKALOPES-TEST-SESSION' // Fixed session key for all players
        });
      }
    }, 1000);
    
    // Check connection state after a delay
    setTimeout(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN && !this.playerId) {
        this.log(LogLevel.INFO, 'Still no player ID after auth attempts, connection may be partially broken');
        // Try to reset connection
        this.disconnect();
        setTimeout(() => this.connect(), 1000);
      }
    }, 5000);
  }

  // Add a public method to get player character type based on connection order
  getPlayerCharacterType(): { type: 'merc' | 'jackalope', thirdPerson: boolean } {
    // Log with high visibility
    console.error(`⭐ Getting character type for player index ${this.playerIndex}`);
    
    // Fallback to a valid index if somehow playerIndex is still -1
    const index = this.playerIndex >= 0 ? this.playerIndex : 0;
    
    // First player (index 0) = Jackalope in third-person
    // Second player (index 1) = Merc in first-person
    // Third player (index 2) = Jackalope in third-person
    // And so on...
    if (index % 2 === 0) {
      console.error(`⭐ Player #${index} (player ${index + 1}) assigned as JACKALOPE in 3rd-person view`);
      return { type: 'jackalope' as const, thirdPerson: true };
    } else {
      console.error(`⭐ Player #${index} (player ${index + 1}) assigned as MERC in 1st-person view`);
      return { type: 'merc' as const, thirdPerson: false };
    }
  }

  // Add a method to reset the localStorage player count (for testing)
  resetPlayerCount(): void {
    try {
      // Save the old value for logging
      const oldValue = localStorage.getItem('jackalopes_player_count');
      
      // Clear all localStorage keys related to player counts
      localStorage.removeItem('jackalopes_player_count');
      localStorage.removeItem('jackalopes_last_activity');
      
      // Force active sessions to use index 0 next time
      localStorage.setItem('jackalopes_player_count', '-1');
      
      // Reset internal counters
      ConnectionManager.playerCount = -1;
      this.playerIndex = -1;
      
      console.error('⭐ Reset player count in localStorage and static variable');
      console.error('⭐ Next player to join will be index 0 (JACKALOPE)');
      
      // Dispatch a custom event to trigger listeners in this tab
      // The 'storage' event only fires in other tabs, not the current one
      try {
        window.dispatchEvent(new CustomEvent('jackalopes_playercount_reset', {
          detail: { oldValue, newValue: '-1' }
        }));
      } catch (e) {
        console.error('Failed to dispatch custom event:', e);
      }
    } catch (e) {
      console.error('⭐ Failed to reset player count in localStorage:', e);
    }
  }

  // Add a method to check if we need to reset the player count
  private shouldResetPlayerCount(): boolean {
    const now = Date.now();
    const lastActivity = parseInt(localStorage.getItem('jackalopes_last_activity') || '0');
    const inactivityDuration = now - lastActivity;
    const resetDuration = 5 * 60 * 1000; // 5 minutes in milliseconds
    return inactivityDuration > resetDuration;
  }
} 