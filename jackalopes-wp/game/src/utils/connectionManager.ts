// The top of the file, add import for the JackalopesGameSettings interface
import { JackalopesGameSettings } from '../types/wordpress';

/**
 * Connection Manager for Jackalopes game
 * 
 * Handles WebSocket connections for multiplayer functionality
 * with WordPress integration.
 */

// Define log levels for better control
export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  INFO = 3,
  VERBOSE = 5
}

// Define event types for the connection manager
export enum ConnectionEventType {
  Connected = 'connected',
  Disconnected = 'disconnected',
  PlayerUpdate = 'player_update',
  GameEvent = 'game_event',
  Chat = 'chat',
  Error = 'error',
  ServerUnreachable = 'server_unreachable' // Added for better error handling
}

// Define player type
export type PlayerType = 'merc' | 'jackalope';

// Define event listener type
type ConnectionEventListener = (event: any) => void;

/**
 * Connection Manager class
 */
export class ConnectionManager {
  private socket: WebSocket | null = null;
  private serverUrl: string;
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 2000;
  private reconnectTimer: number | null = null;
  private eventListeners: Map<ConnectionEventType, ConnectionEventListener[]> = new Map();
  private playerId: string | null = null;
  private playerName: string | null = null;
  private sessionKey: string | null = null;
  private isWordPress: boolean = false;
  private forcedReady: boolean = false;
  private offlineMode: boolean = false;
  private playerIndex: number = -1;
  private playerType: PlayerType = 'merc';
  private logLevel: LogLevel = LogLevel.ERROR;
  private verboseLogging: boolean = false;
  private processedShots: Set<string> = new Set();
  private lobbyFull: boolean = false;
  
  /**
   * Create a new connection manager
   * 
   * @param serverUrl - The WebSocket server URL
   * @param isWordPress - Whether running in WordPress mode
   */
  constructor(serverUrl: string, isWordPress: boolean = false) {
    // Use the provided URL or fallback to WordPress settings
    this.serverUrl = serverUrl || (window.jackalopesGameSettings?.serverUrl || 'ws://localhost:8082');
    this.isWordPress = isWordPress;
    
    // Initialize event listeners
    Object.values(ConnectionEventType).forEach(type => {
      this.eventListeners.set(type, []);
    });
    
    // Make connection manager available globally for debugging
    if (typeof window !== 'undefined') {
      window.connectionManager = this;
      
      // Initialize process shots if needed
      if (!window.__processedShots) {
        window.__processedShots = new Set<string>();
      }
      this.processedShots = window.__processedShots;
      
      // Add universal shot broadcast function
      window.__shotBroadcast = (shot: any) => this.handleUniversalShot(shot);
    }
    
    // Get default player index from localStorage
    try {
      // Get player count
      const playerCount = localStorage.getItem('jackalopes_player_count');
      if (playerCount) {
        this.playerIndex = parseInt(playerCount, 10);
        // Assign player type based on index
        this.playerType = this.playerIndex % 2 === 0 ? 'jackalope' : 'merc';
      } else {
        // First player - initialize count
        localStorage.setItem('jackalopes_player_count', '0');
        this.playerIndex = 0;
        this.playerType = 'jackalope';
      }
      
      // Keep track of how many players we have
      localStorage.setItem('jackalopes_player_count', (this.playerIndex + 1).toString());
      
      // If we have 4 or more players, the lobby is full (for 2v2 gameplay)
      this.lobbyFull = this.playerIndex >= 4;
      
      // Log player assignment
      this.log(LogLevel.INFO, `Player assigned index ${this.playerIndex} as ${this.playerType}`);
    } catch (e) {
      console.error('Error initializing player index:', e);
      this.playerIndex = 0;
      this.playerType = 'jackalope';
    }
  }
  
  /**
   * Connect to the WebSocket server
   * 
   * @param playerName - The player's name
   * @param sessionKey - The game session key
   * @returns A promise that resolves when connected
   */
  public connect(playerName: string, sessionKey: string = 'JACKALOPES-DEFAULT'): Promise<boolean> {
    this.playerName = playerName;
    this.sessionKey = sessionKey;
    
    // Debug log
    this.log(LogLevel.INFO, `Connecting to ${this.serverUrl} as ${playerName} in session ${sessionKey}`);
    
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.serverUrl);
        
        // Set connection timeout
        const connectionTimeout = setTimeout(() => {
          if (!this.connected) {
            this.log(LogLevel.ERROR, 'Connection timeout');
            this.triggerEvent(ConnectionEventType.ServerUnreachable, { message: 'Connection timeout' });
            this.socket?.close();
            this.enableOfflineMode();
            resolve(true); // Resolve with success since we'll use offline mode
          }
        }, 5000);
        
        this.socket.onopen = () => {
          clearTimeout(connectionTimeout);
          this.log(LogLevel.INFO, 'WebSocket connection established');
          this.connected = true;
          this.reconnectAttempts = 0;
          
          // Authenticate with the server
          this.sendMessage({
            type: 'auth',
            playerName: this.playerName,
            playerType: this.playerType, // Include player type in auth
            playerIndex: this.playerIndex // Include player index
          });
          
          // Don't resolve yet - wait for authentication response
        };
        
        this.socket.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          // Filter player_update messages in logs if not verbose
          if (data.type !== 'player_update' || this.verboseLogging) {
            this.log(LogLevel.VERBOSE, 'Received message:', data);
          }
          
          // Handle authentication response
          if (data.type === 'auth_success') {
            this.log(LogLevel.INFO, 'Authentication successful', data);
            this.playerId = data.player.id;
            
            // Join session after authentication
            this.sendMessage({
              type: 'join_session',
              playerName: this.playerName,
              sessionKey: this.sessionKey,
              playerType: this.playerType, // Include player type
              playerIndex: this.playerIndex // Include player index
            });
          }
          
          // Handle join session response
          if (data.type === 'join_success') {
            this.log(LogLevel.INFO, 'Joined session successfully', data);
            
            // Update player index if provided
            if (data.playerIndex !== undefined) {
              this.playerIndex = data.playerIndex;
              // Update player type based on new index
              this.playerType = this.getPlayerCharacterType().type;
              this.log(LogLevel.INFO, `Server assigned player index: ${this.playerIndex}, type: ${this.playerType}`);
            }
            
            // Check if lobby is full
            if (data.lobbyFull) {
              this.lobbyFull = true;
              this.log(LogLevel.INFO, 'Lobby is full (4 players reached)');
            }
            
            // Now we're fully connected
            this.triggerEvent(ConnectionEventType.Connected, { 
              playerId: this.playerId,
              sessionKey: this.sessionKey,
              playerType: this.playerType,
              playerIndex: this.playerIndex
            });
            
            clearTimeout(connectionTimeout);
            resolve(true);
          }
          
          // Handle player updates
          if (data.type === 'player_update') {
            this.triggerEvent(ConnectionEventType.PlayerUpdate, data);
          }
          
          // Handle game events
          if (data.type === 'game_event') {
            this.triggerEvent(ConnectionEventType.GameEvent, data);
          }
          
          // Handle chat messages
          if (data.type === 'chat') {
            this.triggerEvent(ConnectionEventType.Chat, data);
          }
          
          // Handle errors
          if (data.type === 'error') {
            this.log(LogLevel.ERROR, 'Server error:', data);
            this.triggerEvent(ConnectionEventType.Error, data);
          }
        };
        
        this.socket.onclose = () => {
          clearTimeout(connectionTimeout);
          this.log(LogLevel.INFO, 'WebSocket connection closed');
          this.connected = false;
          this.triggerEvent(ConnectionEventType.Disconnected, {});
          
          this.attemptReconnect();
        };
        
        this.socket.onerror = (error) => {
          clearTimeout(connectionTimeout);
          this.log(LogLevel.ERROR, 'WebSocket error:', error);
          this.triggerEvent(ConnectionEventType.Error, { message: 'Connection error' });
          
          // Check if we should switch to offline mode
          if (!this.connected) {
            this.triggerEvent(ConnectionEventType.ServerUnreachable, { message: 'Server unreachable' });
            this.enableOfflineMode();
            resolve(true); // Resolve with success since we'll use offline mode
          } else {
            reject(error);
          }
        };
      } catch (error) {
        this.log(LogLevel.ERROR, 'Failed to connect:', error);
        this.triggerEvent(ConnectionEventType.ServerUnreachable, { message: 'Server unreachable' });
        
        // Enable offline mode and resolve anyway
        this.enableOfflineMode();
        resolve(true); // Resolve with success since we'll use offline mode
      }
    });
  }
  
  /**
   * Enable offline mode for local testing
   */
  private enableOfflineMode(): void {
    this.log(LogLevel.INFO, 'Enabling offline mode');
    this.offlineMode = true;
    this.connected = true; // Pretend we're connected
    this.forcedReady = true;
    
    // Set up localStorage event listener for cross-browser communication
    window.addEventListener('storage', this.handleStorageEvent);
    
    // Notify about offline mode
    this.triggerEvent(ConnectionEventType.Connected, { 
      playerId: `local_${Math.random().toString(36).substring(2, 9)}`,
      sessionKey: this.sessionKey || 'LOCAL_SESSION',
      offlineMode: true,
      playerType: this.playerType,
      playerIndex: this.playerIndex
    });
  }
  
  /**
   * Handle localStorage events for cross-browser communication in offline mode
   */
  private handleStorageEvent = (e: StorageEvent) => {
    if (!this.offlineMode) return;
    
    try {
      // Handle shot broadcasts
      if (e.key === 'jackalopes_shot' && e.newValue) {
        const shotData = JSON.parse(e.newValue);
        
        // Don't process our own shots (based on origin browser tab)
        if (shotData.origin_tab === window.name) return;
        
        // Process the shot
        this.handleUniversalShot(shotData);
      }
      
      // Handle player updates
      if (e.key === 'jackalopes_player_update' && e.newValue) {
        const updateData = JSON.parse(e.newValue);
        
        // Don't process our own updates
        if (updateData.origin_tab === window.name) return;
        
        // Convert to expected format and trigger event
        this.triggerEvent(ConnectionEventType.PlayerUpdate, {
          type: 'player_update',
          player: updateData
        });
      }
    } catch (error) {
      this.log(LogLevel.ERROR, 'Error handling storage event:', error);
    }
  };
  
  /**
   * Force the connection to ready state (for testing)
   */
  public forceReady(): void {
    this.log(LogLevel.INFO, 'Forcing ready state for testing');
    this.forcedReady = true;
    this.connected = true;
    this.offlineMode = true;
    
    // Set up localStorage event listener for cross-browser communication
    window.addEventListener('storage', this.handleStorageEvent);
    
    // Notify about forced ready state
    this.triggerEvent(ConnectionEventType.Connected, { 
      playerId: `local_${Math.random().toString(36).substring(2, 9)}`,
      sessionKey: this.sessionKey || 'FORCED_SESSION',
      offlineMode: true,
      playerType: this.playerType,
      playerIndex: this.playerIndex
    });
  }
  
  /**
   * Handle universal shot (from window.__shotBroadcast)
   */
  private handleUniversalShot(shot: any): void {
    if (!shot || !shot.shotId) {
      this.log(LogLevel.ERROR, 'Invalid shot data:', shot);
      return;
    }
    
    // Don't process duplicate shots
    if (this.processedShots.has(shot.shotId)) {
      return;
    }
    
    // Mark as processed
    this.processedShots.add(shot.shotId);
    
    // Log the shot
    this.log(LogLevel.VERBOSE, 'Processing universal shot:', shot);
    
    // Trigger game event
    this.triggerEvent(ConnectionEventType.GameEvent, {
      type: 'game_event',
      event: {
        event_type: 'player_shoot',
        ...shot
      }
    });
  }
  
  /**
   * Attempt to reconnect to the server
   */
  private attemptReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
    }
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.log(LogLevel.INFO, `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      this.reconnectTimer = window.setTimeout(() => {
        if (this.playerName && this.sessionKey) {
          this.connect(this.playerName, this.sessionKey).catch(error => {
            this.log(LogLevel.ERROR, 'Reconnection failed:', error);
          });
        }
      }, this.reconnectDelay);
    } else {
      this.log(LogLevel.ERROR, 'Max reconnection attempts reached');
      this.triggerEvent(ConnectionEventType.Error, { message: 'Failed to reconnect' });
      
      // Switch to offline mode
      this.enableOfflineMode();
    }
  }
  
  /**
   * Send a message to the server
   * 
   * @param message - The message to send
   */
  public sendMessage(message: any): void {
    // Add player type to outgoing messages when appropriate
    if (message && (message.type === 'player_update' || message.type === 'join_session' || message.type === 'auth')) {
      if (message.type === 'player_update' && message.state) {
        message.state.playerType = this.playerType;
        message.state.playerIndex = this.playerIndex;
      } else if (!message.playerType) {
        message.playerType = this.playerType;
        message.playerIndex = this.playerIndex;
      }
    }
    
    // Filter player_update messages in logs unless verbose
    if (message.type !== 'player_update' || this.verboseLogging) {
      this.log(LogLevel.VERBOSE, 'Sending message:', message);
    }
    
    // In offline mode, use localStorage for cross-browser communication
    if (this.offlineMode) {
      // For shots, use the shot broadcast mechanism
      if (message.type === 'game_event' && message.event?.event_type === 'player_shoot') {
        const shotData = {
          ...message.event,
          timestamp: Date.now(),
          origin_tab: window.name, // Mark the origin tab
          color: this.playerType === 'merc' ? '#ff0000' : '#0000ff'
        };
        
        // Store in localStorage for other browser tabs
        localStorage.setItem('jackalopes_shot', JSON.stringify(shotData));
        
        // Also process it via the window broadcast for current tab
        if (window.__shotBroadcast) {
          window.__shotBroadcast(shotData);
        }
        
        return;
      }
      
      // For player updates, use localStorage
      if (message.type === 'player_update') {
        const updateData = {
          ...message.state,
          timestamp: Date.now(),
          origin_tab: window.name, // Mark the origin tab
          playerType: this.playerType,
          playerIndex: this.playerIndex,
          id: this.playerId || `local_${Math.random().toString(36).substring(2, 9)}`
        };
        
        // Store in localStorage for other browser tabs
        localStorage.setItem('jackalopes_player_update', JSON.stringify(updateData));
        
        return;
      }
      
      return; // Other messages are ignored in offline mode
    }
    
    // Normal WebSocket sending
    if (this.socket && this.connected) {
      this.socket.send(JSON.stringify(message));
    } else {
      this.log(LogLevel.ERROR, 'Cannot send message: not connected');
    }
  }
  
  /**
   * Send a player update to the server
   * 
   * @param state - The player state to send
   */
  public sendPlayerUpdate(state: any): void {
    this.sendMessage({
      type: 'player_update',
      state: {
        ...state,
        playerType: this.playerType,
        playerIndex: this.playerIndex
      }
    });
  }
  
  /**
   * Send a shoot event to the server
   * 
   * @param origin - The origin position of the shot
   * @param direction - The direction of the shot
   */
  public sendShootEvent(origin: [number, number, number], direction: [number, number, number]): void {
    // Generate a unique shot ID
    const shotId = `shot_${this.getClientId()}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    this.sendMessage({
      type: 'game_event',
      event: {
        event_type: 'player_shoot',
        shotId,
        origin,
        direction,
        player_id: this.getClientId(),
        playerType: this.playerType,
        playerIndex: this.playerIndex,
        timestamp: Date.now(),
        color: this.playerType === 'merc' ? '#ff0000' : '#0000ff'
      }
    });
  }
  
  /**
   * Check if message sending is ready
   */
  public isReadyToSend(): boolean {
    return this.connected || this.forcedReady;
  }
  
  /**
   * Send a respawn request to the server
   * 
   * @param playerId - The ID of the player to respawn
   * @param spawnPosition - Optional spawn position
   */
  public sendRespawnRequest(playerId: string, spawnPosition?: [number, number, number]): void {
    // If no spawn position is provided, generate one using the spawn manager
    if (!spawnPosition && window.jackalopesGame?.spawnManager) {
      spawnPosition = window.jackalopesGame.spawnManager.getNextSpawnPoint();
      this.log(LogLevel.INFO, `Generated spawn position: [${spawnPosition.join(', ')}]`);
    }
    
    this.sendMessage({
      type: 'game_event',
      event: {
        event_type: 'player_respawn',
        player_id: playerId,
        requestedBy: this.getClientId(),
        timestamp: Date.now(),
        spawnPosition
      }
    });
  }
  
  /**
   * Send a chat message
   * 
   * @param message - The message to send
   */
  public sendChat(message: string): void {
    this.sendMessage({
      type: 'chat',
      message,
      playerType: this.playerType
    });
  }
  
  /**
   * Register an event listener
   * 
   * @param event - The event type to listen for
   * @param listener - The listener function
   */
  public on(event: ConnectionEventType, listener: ConnectionEventListener): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.push(listener);
    this.eventListeners.set(event, listeners);
  }
  
  /**
   * Remove an event listener
   * 
   * @param event - The event type
   * @param listener - The listener function to remove
   */
  public off(event: ConnectionEventType, listener: ConnectionEventListener): void {
    const listeners = this.eventListeners.get(event) || [];
    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
      this.eventListeners.set(event, listeners);
    }
  }
  
  /**
   * Trigger an event
   * 
   * @param event - The event type to trigger
   * @param data - The event data
   */
  private triggerEvent(event: ConnectionEventType, data: any): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        this.log(LogLevel.ERROR, `Error in ${event} listener:`, error);
      }
    });
  }
  
  /**
   * Disconnect from the server
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Remove storage event listener if we were in offline mode
    if (this.offlineMode) {
      window.removeEventListener('storage', this.handleStorageEvent);
    }
    
    this.connected = false;
    this.forcedReady = false;
    this.offlineMode = false;
  }
  
  /**
   * Check if connected to the server
   * 
   * @returns Whether connected
   */
  public isConnected(): boolean {
    return this.connected || this.forcedReady;
  }
  
  /**
   * Check if in offline mode
   * 
   * @returns Whether in offline mode
   */
  public isOfflineMode(): boolean {
    return this.offlineMode;
  }
  
  /**
   * Check if lobby is full
   * 
   * @returns Whether lobby is full
   */
  public isLobbyFull(): boolean {
    return this.lobbyFull;
  }
  
  /**
   * Get the client ID (playerId or generated ID)
   * 
   * @returns The client ID
   */
  public getClientId(): string {
    return this.playerId || `local_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  /**
   * Get the player ID
   * 
   * @returns The player ID
   */
  public getPlayerId(): string | null {
    return this.playerId;
  }
  
  /**
   * Get the session key
   * 
   * @returns The session key
   */
  public getSessionKey(): string | null {
    return this.sessionKey;
  }
  
  /**
   * Get the player index
   * 
   * @returns The player index
   */
  public getPlayerIndex(): number {
    return this.playerIndex;
  }
  
  /**
   * Check if this is the first client in the session
   * 
   * @returns Whether this is the first client
   */
  public isFirstClient(): boolean {
    return this.playerIndex === 0;
  }
  
  /**
   * Set the player type
   * 
   * @param type - The player type
   */
  public setPlayerType(type: PlayerType): void {
    this.playerType = type;
  }
  
  /**
   * Get the player type
   * 
   * @returns The player type
   */
  public getPlayerType(): PlayerType {
    return this.playerType;
  }
  
  /**
   * Get the player character type based on player index
   * 
   * @returns The player character info
   */
  public getPlayerCharacterType(): { type: PlayerType, thirdPerson: boolean } {
    // Even indices (0, 2) are jackalopes in third person
    // Odd indices (1, 3) are mercs in first person
    if (this.playerIndex % 2 === 0) {
      return { type: 'jackalope', thirdPerson: true };
    } else {
      return { type: 'merc', thirdPerson: false };
    }
  }
  
  /**
   * Force character type for testing
   * 
   * @param type - The character type to force
   * @returns The updated character info
   */
  public forceCharacterType(type: PlayerType): { type: PlayerType, thirdPerson: boolean } {
    this.playerType = type;
    const thirdPerson = type === 'jackalope';
    return { type, thirdPerson };
  }
  
  /**
   * Reset player count in localStorage
   */
  public resetPlayerCount(): void {
    try {
      localStorage.setItem('jackalopes_player_count', '0');
      this.playerIndex = 0;
      this.playerType = 'jackalope';
      this.log(LogLevel.INFO, 'Reset player count to 0');
    } catch (e) {
      this.log(LogLevel.ERROR, 'Error resetting player count:', e);
    }
  }
  
  /**
   * Reset and correct character type based on player index
   * 
   * @returns The corrected character info
   */
  public resetAndCorrectCharacterType(): { type: PlayerType, thirdPerson: boolean } {
    const characterInfo = this.getPlayerCharacterType();
    this.playerType = characterInfo.type;
    return characterInfo;
  }
  
  /**
   * Set the log level
   * 
   * @param level - The log level
   */
  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
  
  /**
   * Enable verbose logging
   */
  public enableVerboseLogging(): void {
    this.verboseLogging = true;
  }
  
  /**
   * Disable verbose logging
   */
  public disableVerboseLogging(): void {
    this.verboseLogging = false;
  }
  
  /**
   * Log a message with the specified level
   * 
   * @param level - The log level
   * @param message - The message to log
   * @param ...args - Additional arguments
   */
  private log(level: LogLevel, message: string, ...args: any[]): void {
    if (level <= this.logLevel) {
      const prefix = this.getLogLevelPrefix(level);
      console.log(`${prefix} ${message}`, ...args);
    }
  }
  
  /**
   * Get the prefix for the specified log level
   * 
   * @param level - The log level
   * @returns The prefix
   */
  private getLogLevelPrefix(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR:
        return '[ConnectionManager ERROR]';
      case LogLevel.INFO:
        return '[ConnectionManager INFO]';
      case LogLevel.VERBOSE:
        return '[ConnectionManager VERBOSE]';
      default:
        return '[ConnectionManager]';
    }
  }
}

// Add global type definition
declare global {
  interface Window {
    connectionManager?: ConnectionManager;
    jackalopesGameSettings?: JackalopesGameSettings;
    __shotBroadcast?: (shot: any) => any;
    __processedShots?: Set<string>;
    jackalopesGame?: {
      playerType?: 'merc' | 'jackalope';
      debugLevel?: number;
      levaPanelState?: 'open' | 'closed';
      flashlightOn?: boolean;
      spawnManager?: {
        baseSpawnX: number;
        currentSpawnX: number;
        stepSize: number;
        minX: number;
        getNextSpawnPoint: () => [number, number, number];
        resetSpawnPoints: () => [number, number, number];
        getSpawnPoint: () => [number, number, number];
      };
    };
  }
}

export default ConnectionManager; 