import { EventEmitter } from 'events';

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
  private maxReconnectAttempts: number = 5;
  private gameState: GameState = { players: {} };
  private reconnectTimeout: number | null = null;
  
  // Add latency tracking properties
  private pingInterval: number | null = null;
  private pingStartTime: number = 0;
  private latency: number = 0;
  
  constructor(private serverUrl: string = 'ws://localhost:8080') {
    super();
  }
  
  connect(): void {
    try {
      console.log('Connecting to WebSocket server at', this.serverUrl);
      
      // Cleanup any existing socket first
      if (this.socket) {
        this.disconnect();
      }
      
      this.socket = new WebSocket(this.serverUrl);
      
      this.socket.onopen = () => {
        console.log('Connected to server');
        this.isConnected = true;
        this.reconnectAttempts = 0; // Reset reconnect counter on successful connection
        this.emit('connected');
        
        // Start ping interval after connection
        this.startPingInterval();
      };
      
      this.socket.onclose = () => {
        // Use our improved handleDisconnect method
        this.handleDisconnect();
      };
      
      this.socket.onerror = (error) => {
        this.handleError(error);
      };
      
      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };
    } catch (error) {
      console.error('Error connecting to WebSocket server:', error);
      // If we failed to connect, attempt reconnect
      this.handleDisconnect();
    }
  }
  
  disconnect(): void {
    // Clear any pending reconnection attempts
    this.clearReconnectTimeout();
    
    // Stop ping interval
    this.stopPingInterval();
    
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
    
    this.isConnected = false;
    this.emit('disconnected');
    console.log('Disconnected from server');
  }
  
  // Start measuring ping every 2 seconds
  private startPingInterval(): void {
    this.stopPingInterval();
    
    this.pingInterval = window.setInterval(() => {
      if (this.isConnected) {
        this.sendPing();
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
    this.send({
      type: 'ping',
      timestamp: this.pingStartTime
    });
  }
  
  // Handle a pong message from server
  private handlePong(message: any): void {
    const now = Date.now();
    const roundTripTime = now - message.timestamp;
    
    // Calculate latency (half of round trip)
    this.latency = Math.round(roundTripTime / 2);
    this.emit('latency_update', this.latency);
  }
  
  // Get the current latency estimate
  getLatency(): number {
    return this.latency;
  }
  
  // Update sendPlayerUpdate to include sequence number
  sendPlayerUpdate(position: [number, number, number], rotation: [number, number, number, number], sequence?: number): void {
    if (!this.isConnected) {
      console.log('Cannot send player update: not connected to server');
      return;
    }
    
    this.send({
      type: 'player_update',
      position,
      rotation,
      sequence: sequence || 0 // Include sequence number for reconciliation
    });
  }
  
  sendShootEvent(origin: [number, number, number], direction: [number, number, number]): void {
    if (!this.isConnected) {
      console.log('Cannot send shoot event: not connected to server');
      return;
    }
    
    // Generate a unique ID for this shot
    const shotId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    console.log('ConnectionManager sending shoot event to server:', { 
      shotId,
      origin, 
      direction,
      playerId: this.playerId
    });
    
    this.send({
      type: 'shoot',
      shotId: shotId,
      origin,
      direction
    });
  }
  
  private send(data: any): void {
    if (this.socket && this.isConnected) {
      try {
        const jsonData = JSON.stringify(data);
        console.log(`Sending data to server (${data.type}):`, data);
        this.socket.send(jsonData);
        this.emit('message_sent', data);
      } catch (error) {
        console.error('Error sending data to server:', error);
      }
    } else {
      console.warn('Cannot send data: socket not available or not connected', {
        socketExists: !!this.socket,
        isConnected: this.isConnected
      });
    }
  }
  
  private handleMessage(message: any): void {
    console.log(`Received message from server (${message.type}):`, message);
    this.emit('message_received', message);
    
    switch (message.type) {
      case 'connection':
        this.playerId = message.id;
        this.gameState = message.gameState;
        this.emit('initialized', { id: this.playerId, gameState: this.gameState });
        break;
        
      case 'player_joined':
        this.gameState.players[message.id] = message.initialState;
        this.emit('player_joined', { id: message.id, state: message.initialState });
        break;
        
      case 'player_left':
        delete this.gameState.players[message.id];
        this.emit('player_left', { id: message.id });
        break;
        
      case 'player_update':
        if (this.gameState.players[message.id]) {
          this.gameState.players[message.id].position = message.position;
          this.gameState.players[message.id].rotation = message.rotation;
          
          // If message is for local player, emit server_state_update for reconciliation
          if (message.id === this.playerId && message.sequence !== undefined) {
            this.emit('server_state_update', {
              position: message.position,
              rotation: message.rotation,
              timestamp: message.timestamp || Date.now(), // Use server timestamp if available
              sequence: message.sequence,
              positionError: message.positionError, // Server reported error
              serverCorrection: message.serverCorrection // Whether server made a major correction
            });
          } else {
            // Normal update for remote players
            this.emit('player_update', { 
              id: message.id, 
              position: message.position, 
              rotation: message.rotation 
            });
          }
        }
        break;
        
      case 'shoot':
        console.log('Received shot event:', message);
        // Make sure we don't process our own shots
        if (message.id !== this.playerId) {
          console.log('Emitting player_shoot event for shot from player:', message.id);
          this.emit('player_shoot', {
            id: message.id,
            shotId: message.shotId || 'no-id',
            origin: message.origin,
            direction: message.direction
          });
        } else {
          console.log('Ignoring our own shot event from server (player ID:', this.playerId, ')');
        }
        break;
        
      case 'pong':
        this.handlePong(message);
        break;
    }
  }
  
  private handleClose(): void {
    console.log('Disconnected from server');
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
    console.error('WebSocket error:', error);
    // Don't emit error if we're not connected yet - this is expected if server isn't running
    if (this.isConnected) {
      this.emit('error', error);
    } else {
      console.log('WebSocket connection failed - server might not be running');
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
  
  private clearReconnectTimeout() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
  
  private handleDisconnect(): void {
    this.isConnected = false;
    this.emit('disconnected');
    console.log('Disconnected from server');
    
    // Stop ping interval
    this.stopPingInterval();
    
    // Clear any existing reconnect timeout
    this.clearReconnectTimeout();
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectInterval}ms`);
      this.reconnectTimeout = setTimeout(() => this.connect(), this.reconnectInterval);
    } else {
      console.log(`Max reconnect attempts (${this.maxReconnectAttempts}) reached. Giving up.`);
    }
  }
  
  // Add server-side game snapshot for state synchronization
  sendGameSnapshot(snapshot: GameSnapshot): void {
    if (!this.isConnected) {
      console.log('Cannot send game snapshot: not connected to server');
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
    return {
      totalCorrections: 0,
      averageError: 0,
      lastError: 0,
      lastCorrection: 0,
      active: true
    };
  }
} 