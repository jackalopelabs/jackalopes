/**
 * React hook for using the connection manager
 */
import { useEffect, useState, useRef } from 'react';
import ConnectionManager, { ConnectionEventType } from '../utils/connectionManager';

/**
 * Connection status types
 */
export enum ConnectionStatus {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Error = 'error'
}

/**
 * Hook for using the connection manager in React components
 * 
 * @param serverUrl - The WebSocket server URL
 * @param isWordPress - Whether running in WordPress mode
 * @param autoConnect - Whether to automatically connect
 * @param playerName - The player name to use
 * @param sessionKey - The session key to use
 * @returns The connection manager and status
 */
export const useConnection = (
  serverUrl: string,
  isWordPress: boolean = false,
  autoConnect: boolean = false,
  playerName: string = 'Player',
  sessionKey: string = 'JACKALOPES-DEFAULT'
) => {
  // Connection manager ref to prevent recreating on render
  const connectionRef = useRef<ConnectionManager | null>(null);
  
  // Connection status state
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.Disconnected);
  
  // Connection events
  const [events, setEvents] = useState<any[]>([]);
  
  // Player ID assigned by server
  const [playerId, setPlayerId] = useState<string | null>(null);
  
  // Error messages
  const [error, setError] = useState<string | null>(null);
  
  // Initialize the connection manager
  useEffect(() => {
    // Create a new connection manager if not already created
    if (!connectionRef.current) {
      connectionRef.current = new ConnectionManager(serverUrl, isWordPress);
      
      // Register event listeners
      connectionRef.current.on(ConnectionEventType.Connected, (data) => {
        console.log('Connected:', data);
        setStatus(ConnectionStatus.Connected);
        setPlayerId(data.playerId);
        
        // Add to events
        setEvents(prev => [...prev, { type: 'connected', timestamp: Date.now(), data }]);
      });
      
      connectionRef.current.on(ConnectionEventType.Disconnected, () => {
        console.log('Disconnected');
        setStatus(ConnectionStatus.Disconnected);
        
        // Add to events
        setEvents(prev => [...prev, { type: 'disconnected', timestamp: Date.now() }]);
      });
      
      connectionRef.current.on(ConnectionEventType.Error, (data) => {
        console.error('Connection error:', data);
        setStatus(ConnectionStatus.Error);
        setError(data.message || 'Unknown error');
        
        // Add to events
        setEvents(prev => [...prev, { type: 'error', timestamp: Date.now(), message: data.message }]);
      });
      
      // Auto-connect if enabled
      if (autoConnect) {
        connect();
      }
    }
    
    // Clean up on unmount
    return () => {
      if (connectionRef.current) {
        connectionRef.current.disconnect();
      }
    };
  }, [serverUrl, isWordPress]);
  
  /**
   * Connect to the server
   * 
   * @param name - Optional player name override
   * @param session - Optional session key override
   */
  const connect = async (name?: string, session?: string) => {
    if (!connectionRef.current) {
      setError('Connection manager not initialized');
      return;
    }
    
    try {
      setStatus(ConnectionStatus.Connecting);
      setError(null);
      
      // Connect with the provided name/session or defaults
      await connectionRef.current.connect(name || playerName, session || sessionKey);
    } catch (error) {
      console.error('Failed to connect:', error);
      setStatus(ConnectionStatus.Error);
      setError(error instanceof Error ? error.message : 'Failed to connect');
    }
  };
  
  /**
   * Disconnect from the server
   */
  const disconnect = () => {
    if (connectionRef.current) {
      connectionRef.current.disconnect();
      setStatus(ConnectionStatus.Disconnected);
    }
  };
  
  /**
   * Send a player update
   * 
   * @param state - The player state to send
   */
  const sendPlayerUpdate = (state: any) => {
    if (connectionRef.current && connectionRef.current.isConnected()) {
      connectionRef.current.sendPlayerUpdate(state);
    }
  };
  
  /**
   * Send a shot event
   * 
   * @param shotId - The unique ID of the shot
   * @param origin - The origin position of the shot
   * @param direction - The direction of the shot
   */
  const sendShot = (shotId: string, origin: [number, number, number], direction: [number, number, number]) => {
    if (connectionRef.current && connectionRef.current.isConnected()) {
      connectionRef.current.sendShot(shotId, origin, direction);
    }
  };
  
  /**
   * Send a respawn request
   * 
   * @param playerId - The ID of the player to respawn
   * @param spawnPosition - Optional spawn position
   */
  const sendRespawnRequest = (playerId: string, spawnPosition?: [number, number, number]) => {
    if (connectionRef.current && connectionRef.current.isConnected()) {
      connectionRef.current.sendRespawnRequest(playerId, spawnPosition);
    }
  };
  
  // Return the connection manager and status
  return {
    connection: connectionRef.current,
    status,
    playerId,
    events,
    error,
    connect,
    disconnect,
    sendPlayerUpdate,
    sendShot,
    sendRespawnRequest,
    isConnected: status === ConnectionStatus.Connected
  };
};

export default useConnection; 