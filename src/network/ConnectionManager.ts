import { EventEmitter } from 'events';

type GameState = {
  players: Record<string, {
    position: [number, number, number];
    rotation: [number, number, number, number];
    health: number;
  }>;
};

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
  
  constructor(private serverUrl: string = 'ws://localhost:8082') {
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
  
  sendPlayerUpdate(position: [number, number, number], rotation: [number, number, number, number]): void {
    if (!this.isConnected) return;
    
    this.send({
      type: 'player_update',
      position,
      rotation
    });
  }
  
  sendShootEvent(origin: [number, number, number], direction: [number, number, number]): void {
    if (!this.isConnected) return;
    
    console.log('ConnectionManager sending shoot event to server:', { origin, direction });
    
    this.send({
      type: 'shoot',
      origin,
      direction
    });
  }
  
  private send(data: any): void {
    if (this.socket && this.isConnected) {
      this.socket.send(JSON.stringify(data));
      this.emit('message_sent', data);
    }
  }
  
  private handleMessage(message: any): void {
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
          this.emit('player_update', { 
            id: message.id, 
            position: message.position, 
            rotation: message.rotation 
          });
        }
        break;
        
      case 'shoot':
        console.log('Received shot event:', message);
        this.emit('player_shoot', {
          id: message.id,
          origin: message.origin,
          direction: message.direction
        });
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
} 