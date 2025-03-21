import React, { useState, useEffect } from 'react';
import { ConnectionManager } from './ConnectionManager';

export const TestConnection: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [remotePlayers, setRemotePlayers] = useState<Record<string, any>>({});

  useEffect(() => {
    // Helper function to log with timestamp
    const log = (message: string) => {
      const timestamp = new Date().toISOString().substr(11, 8);
      setLogs(prevLogs => [`[${timestamp}] ${message}`, ...prevLogs].slice(0, 100));
    };

    log('Initializing connection manager...');
    const connectionManager = new ConnectionManager();

    // Set up event listeners
    connectionManager.on('connected', () => {
      log('Connected to server');
      setIsConnected(true);
    });

    connectionManager.on('disconnected', () => {
      log('Disconnected from server');
      setIsConnected(false);
    });

    connectionManager.on('initialized', (data) => {
      log(`Initialized with player ID: ${data.id}`);
      setPlayerId(data.id);
      
      // Initialize remote players
      const players = Object.entries(data.gameState.players)
        .filter(([id]) => id !== data.id)
        .reduce((acc, [id, player]) => {
          acc[id] = player;
          return acc;
        }, {} as Record<string, any>);
      
      setRemotePlayers(players);
      log(`Initial remote players: ${Object.keys(players).length}`);
    });

    connectionManager.on('player_joined', (data) => {
      log(`Player joined: ${data.id}`);
      setRemotePlayers(prev => ({
        ...prev,
        [data.id]: data.state
      }));
    });

    connectionManager.on('player_left', (data) => {
      log(`Player left: ${data.id}`);
      setRemotePlayers(prev => {
        const newPlayers = { ...prev };
        delete newPlayers[data.id];
        return newPlayers;
      });
    });

    connectionManager.on('player_update', (data) => {
      setRemotePlayers(prev => ({
        ...prev,
        [data.id]: {
          ...prev[data.id],
          position: data.position,
          rotation: data.rotation
        }
      }));
    });

    connectionManager.on('player_shoot', (data) => {
      log(`Player ${data.id} shot from ${JSON.stringify(data.origin)} in direction ${JSON.stringify(data.direction)}`);
    });

    connectionManager.on('error', (error) => {
      log(`Error: ${error}`);
    });

    // Connect to the server
    log('Connecting to server...');
    connectionManager.connect();

    // Send a random position update every 2 seconds
    const intervalId = setInterval(() => {
      if (isConnected) {
        const randomPos: [number, number, number] = [
          Math.random() * 10 - 5,
          Math.random() * 10,
          Math.random() * 10 - 5
        ];
        const randomRot: [number, number, number, number] = [0, 0, 0, 1];
        
        connectionManager.sendPlayerUpdate(randomPos, randomRot);
        log(`Sent position update: ${JSON.stringify(randomPos)}`);
      }
    }, 2000);

    return () => {
      clearInterval(intervalId);
      connectionManager.disconnect();
    };
  }, []);

  return (
    <div style={{ 
      fontFamily: 'monospace', 
      padding: '20px', 
      maxWidth: '800px', 
      margin: '0 auto' 
    }}>
      <h1>WebSocket Connection Test</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <div>
          <strong>Connection Status:</strong> {isConnected ? '✅ Connected' : '❌ Disconnected'}
        </div>
        <div>
          <strong>Player ID:</strong> {playerId || 'Not assigned'}
        </div>
        <div>
          <strong>Remote Players:</strong> {Object.keys(remotePlayers).length}
        </div>
      </div>
      
      <h2>Log:</h2>
      <div style={{ 
        height: '400px', 
        overflowY: 'scroll', 
        border: '1px solid #ccc', 
        padding: '10px',
        backgroundColor: '#f5f5f5',
        borderRadius: '4px'
      }}>
        {logs.map((log, index) => (
          <div key={index} style={{ marginBottom: '4px' }}>{log}</div>
        ))}
      </div>
    </div>
  );
}; 