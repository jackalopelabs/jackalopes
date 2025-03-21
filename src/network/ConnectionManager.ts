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
  
  constructor(private serverUrl: string = 'ws://localhost:8080') {
    super();
  }
  
  connect(): void {
    if (this.socket) {
      this.socket.close();
    }
    
    this.socket = new WebSocket(this.serverUrl);
    
    this.socket.onopen = this.handleOpen.bind(this);
    this.socket.onmessage = this.handleMessage.bind(this);
    this.socket.onclose = this.handleClose.bind(this);
    this.socket.onerror = this.handleError.bind(this);
  }
  
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
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
    
    this.send({
      type: 'shoot',
      origin,
      direction
    });
  }
  
  private send(data: any): void {
    if (this.socket && this.isConnected) {
      this.socket.send(JSON.stringify(data));
    }
  }
  
  private handleOpen(): void {
    console.log('Connected to server');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.emit('connected');
  }
  
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      
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
          this.emit('player_shoot', {
            id: message.id,
            origin: message.origin,
            direction: message.direction
          });
          break;
      }
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  }
  
  private handleClose(): void {
    console.log('Disconnected from server');
    this.isConnected = false;
    this.emit('disconnected');
    
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
} 