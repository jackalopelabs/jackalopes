// The top of the file, add import for the JackalopesGameSettings interface
import { JackalopesGameSettings } from '../types/wordpress';

/**
 * Connection Manager for Jackalopes game
 * 
 * Handles WebSocket connections for multiplayer functionality
 * with WordPress integration.
 */

// Define event types for the connection manager
export enum ConnectionEventType {
  Connected = 'connected',
  Disconnected = 'disconnected',
  PlayerUpdate = 'player_update',
  GameEvent = 'game_event',
  Chat = 'chat',
  Error = 'error'
}

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
    console.log(`Connecting to ${this.serverUrl} as ${playerName} in session ${sessionKey}`);
    
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.serverUrl);
        
        this.socket.onopen = () => {
          console.log('WebSocket connection established');
          this.connected = true;
          this.reconnectAttempts = 0;
          
          // Authenticate with the server
          this.sendMessage({
            type: 'auth',
            playerName: this.playerName
          });
          
          // Don't resolve yet - wait for authentication response
        };
        
        this.socket.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          // Handle authentication response
          if (data.type === 'auth_success') {
            console.log('Authentication successful', data);
            this.playerId = data.player.id;
            
            // Join session after authentication
            this.sendMessage({
              type: 'join_session',
              playerName: this.playerName,
              sessionKey: this.sessionKey
            });
          }
          
          // Handle join session response
          if (data.type === 'join_success') {
            console.log('Joined session successfully', data);
            
            // Now we're fully connected
            this.triggerEvent(ConnectionEventType.Connected, { 
              playerId: this.playerId,
              sessionKey: this.sessionKey
            });
            
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
            console.error('Server error:', data);
            this.triggerEvent(ConnectionEventType.Error, data);
          }
        };
        
        this.socket.onclose = () => {
          console.log('WebSocket connection closed');
          this.connected = false;
          this.triggerEvent(ConnectionEventType.Disconnected, {});
          
          this.attemptReconnect();
        };
        
        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.triggerEvent(ConnectionEventType.Error, { message: 'Connection error' });
          reject(error);
        };
      } catch (error) {
        console.error('Failed to connect:', error);
        reject(error);
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
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      this.reconnectTimer = window.setTimeout(() => {
        if (this.playerName && this.sessionKey) {
          this.connect(this.playerName, this.sessionKey).catch(error => {
            console.error('Reconnection failed:', error);
          });
        }
      }, this.reconnectDelay);
    } else {
      console.error('Max reconnection attempts reached');
      this.triggerEvent(ConnectionEventType.Error, { message: 'Failed to reconnect' });
    }
  }
  
  /**
   * Send a message to the server
   * 
   * @param message - The message to send
   */
  public sendMessage(message: any): void {
    if (this.socket && this.connected) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.error('Cannot send message: not connected');
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
      state
    });
  }
  
  /**
   * Send a shot event to the server
   * 
   * @param shotId - The unique ID of the shot
   * @param origin - The origin position of the shot
   * @param direction - The direction of the shot
   */
  public sendShot(shotId: string, origin: [number, number, number], direction: [number, number, number]): void {
    this.sendMessage({
      type: 'game_event',
      event: {
        event_type: 'player_shoot',
        shotId,
        origin,
        direction,
        player_id: this.playerId,
        timestamp: Date.now()
      }
    });
  }
  
  /**
   * Send a respawn request to the server
   * 
   * @param playerId - The ID of the player to respawn
   * @param spawnPosition - Optional spawn position
   */
  public sendRespawnRequest(playerId: string, spawnPosition?: [number, number, number]): void {
    this.sendMessage({
      type: 'game_event',
      event: {
        event_type: 'player_respawn',
        player_id: playerId,
        requestedBy: this.playerId,
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
      message
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
        console.error(`Error in ${event} listener:`, error);
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
    
    this.connected = false;
  }
  
  /**
   * Check if connected to the server
   * 
   * @returns Whether connected
   */
  public isConnected(): boolean {
    return this.connected;
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
}

// Add global type definition
declare global {
  interface Window {
    connectionManager?: ConnectionManager;
    jackalopesGameSettings?: JackalopesGameSettings;
  }
}

export default ConnectionManager; 