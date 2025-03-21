import { useState, useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { ConnectionManager } from './ConnectionManager';
import { RemotePlayer } from '../game/RemotePlayer';
import { RemoteShot } from '../game/sphere-tool';
import * as THREE from 'three';

// Add these new interfaces for state prediction
interface PredictedState {
  position: [number, number, number];
  rotation: [number, number, number, number];
  timestamp: number;
}

type RemotePlayerData = {
  position: [number, number, number];
  rotation: [number, number, number, number];
  updateRef?: {
    updateTransform: (position: [number, number, number], rotation: [number, number, number, number]) => void;
  };
};

type PlayerData = {
  position: [number, number, number];
  rotation: [number, number, number, number];
  health: number;
};

type InitializedData = {
  id: string;
  gameState: {
    players: Record<string, PlayerData>;
  };
};

// Create a hook for the multiplayer logic
export const useMultiplayer = (
  localPlayerRef: React.MutableRefObject<any>,
  connectionManager: ConnectionManager
) => {
  const [remotePlayers, setRemotePlayers] = useState<Record<string, RemotePlayerData>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  
  // Add state prediction buffer
  const stateBuffer = useRef<PredictedState[]>([]);
  const lastServerUpdateTime = useRef<number>(0);
  const serverTimeOffset = useRef<number>(0);

  const remotePlayerRefs = useRef<Record<string, RemotePlayerData>>({});
  const { camera } = useThree();
  
  // Get server time with offset
  const getServerTime = () => {
    return Date.now() + serverTimeOffset.current;
  };
  
  // Set up connection and event handlers
  useEffect(() => {
    console.log('Setting up multiplayer connection...');
    
    // Connection events
    connectionManager.on('connected', () => {
      console.log('Connected to multiplayer server');
      setIsConnected(true);
    });
    
    connectionManager.on('disconnected', () => {
      console.log('Disconnected from multiplayer server');
      setIsConnected(false);
    });
    
    connectionManager.on('initialized', (data: InitializedData) => {
      console.log('Initialized with ID:', data.id);
      setPlayerId(data.id);
      
      // Initialize remote players from current game state
      const initialPlayers: Record<string, RemotePlayerData> = {};
      Object.entries(data.gameState.players).forEach(([id, playerData]) => {
        if (id !== data.id) { // Skip local player
          initialPlayers[id] = {
            position: playerData.position,
            rotation: playerData.rotation
          };
        }
      });
      
      // Reset state buffer on initialization
      stateBuffer.current = [];
      lastServerUpdateTime.current = Date.now();
      
      // Estimate server time offset (assume minimal latency for simplicity)
      serverTimeOffset.current = 0;
      
      setRemotePlayers(initialPlayers);
    });
    
    // Player events
    connectionManager.on('player_joined', (data) => {
      console.log('Player joined:', data.id);
      setRemotePlayers(prev => ({
        ...prev,
        [data.id]: {
          position: data.state.position,
          rotation: data.state.rotation
        }
      }));
    });
    
    connectionManager.on('player_left', (data) => {
      console.log('Player left:', data.id);
      setRemotePlayers(prev => {
        const newPlayers = { ...prev };
        delete newPlayers[data.id];
        return newPlayers;
      });
    });
    
    connectionManager.on('player_update', (data) => {
      if (remotePlayerRefs.current[data.id]?.updateRef) {
        // Update the player directly via ref if available
        remotePlayerRefs.current[data.id].updateRef!.updateTransform(
          data.position, 
          data.rotation
        );
      } else {
        // Otherwise update the state (this will be slower)
        setRemotePlayers(prev => ({
          ...prev,
          [data.id]: {
            ...prev[data.id],
            position: data.position,
            rotation: data.rotation
          }
        }));
      }
    });
    
    // Connect to the server
    connectionManager.connect();
    
    return () => {
      console.log('Cleaning up multiplayer connection...');
      // Ensure we disconnect properly when component unmounts
      connectionManager.disconnect();
      // Reset states on unmount
      setIsConnected(false);
      setPlayerId(null);
      setRemotePlayers({});
    };
  }, [connectionManager]);
  
  // Send regular position updates with better cleanup
  useEffect(() => {
    if (!isConnected || !localPlayerRef.current?.rigidBody) return;
    
    console.log('Starting position update interval');
    const updateInterval = setInterval(() => {
      if (localPlayerRef.current?.rigidBody) {
        const position = localPlayerRef.current.rigidBody.translation();
        const cameraQuat = camera.quaternion.toArray() as [number, number, number, number];
        
        // Store predicted state in buffer
        const currentState: PredictedState = {
          position: [position.x, position.y, position.z],
          rotation: cameraQuat,
          timestamp: getServerTime()
        };
        
        // Add to state buffer (keep last 60 states max, ~1 second at 60fps)
        stateBuffer.current.push(currentState);
        if (stateBuffer.current.length > 60) {
          stateBuffer.current.shift();
        }
        
        connectionManager.sendPlayerUpdate(
          [position.x, position.y, position.z], 
          cameraQuat
        );
      }
    }, 100); // 10 updates per second
    
    return () => {
      console.log('Clearing position update interval');
      clearInterval(updateInterval);
    };
  }, [isConnected, localPlayerRef, camera, connectionManager]);
  
  // Handle ref updates for remote players
  const updatePlayerRef = (id: string, methods: { updateTransform: (position: [number, number, number], rotation: [number, number, number, number]) => void }) => {
    remotePlayerRefs.current[id] = {
      ...remotePlayerRefs.current[id],
      updateRef: methods
    };
  };
  
  return {
    remotePlayers,
    handleShoot: (origin: [number, number, number], direction: [number, number, number]) => {
      if (isConnected) {
        connectionManager.sendShootEvent(origin, direction);
      }
    },
    updatePlayerRef,
    isConnected,
    playerId
  };
};

// Actual component that uses the hook and renders things
export const MultiplayerManager = ({ 
  localPlayerRef,
  connectionManager
}: { 
  localPlayerRef: React.MutableRefObject<any>,
  connectionManager: ConnectionManager
}) => {
  const {
    remotePlayers,
    handleShoot,
    updatePlayerRef
  } = useMultiplayer(localPlayerRef, connectionManager);
  
  return (
    <>
      {/* Render all remote players */}
      {Object.entries(remotePlayers).map(([id, playerData]) => (
        <RemotePlayer
          key={id}
          id={id}
          initialPosition={playerData.position}
          initialRotation={playerData.rotation}
          updateRef={(methods) => updatePlayerRef(id, methods)}
        />
      ))}
    </>
  );
};

// Add a hook to get remote shots from the current connection manager
export const useRemoteShots = (connectionManager: ConnectionManager) => {
  const [shots, setShots] = useState<RemoteShot[]>([]);
  
  useEffect(() => {
    console.log('Setting up remote shots listener on connection manager:', connectionManager);
    
    // Debug: Test event emitter
    connectionManager.on('message_received', (msg) => {
      console.log('Connection message received:', msg);
    });
    
    const handleShot = (data: { id: string; origin: [number, number, number]; direction: [number, number, number] }) => {
      console.log('Remote shot received:', data);
      
      const newShot: RemoteShot = {
        id: data.id,
        origin: data.origin,
        direction: data.direction
      };
      
      setShots(prev => {
        const updated = [...prev, newShot];
        // Limit to last 30 shots
        if (updated.length > 30) {
          return updated.slice(-30);
        }
        return updated;
      });
    };
    
    connectionManager.on('player_shoot', handleShot);
    
    return () => {
      console.log('Cleaning up remote shots listener');
      connectionManager.off('player_shoot', handleShot);
      connectionManager.off('message_received', () => {});  // Pass empty callback
      setShots([]);
    };
  }, [connectionManager]);
  
  return shots;
}; 