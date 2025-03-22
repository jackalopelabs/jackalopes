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
        console.log('handleShoot called in useMultiplayer, sending to connectionManager', { 
          origin, 
          direction,
          isConnected 
        });
        connectionManager.sendShootEvent(origin, direction);
      } else {
        console.log('Cannot send shoot event - not connected to server');
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
  const processedShotIds = useRef<Set<string>>(new Set());
  const eventListenersAttached = useRef<boolean>(false);
  
  useEffect(() => {
    console.log('Setting up remote shots listener on connection manager:', connectionManager);
    
    if (eventListenersAttached.current) {
      console.log('Event listeners already attached, cleaning up first');
      connectionManager.off('player_shoot', () => {});
      connectionManager.off('message_received', () => {});
    }
    
    eventListenersAttached.current = true;
    
    // Debug: Test event emitter
    const handleMessageReceived = (msg: any) => {
      console.log('Connection message received:', msg);
      // Explicitly check for shoot messages
      if (msg.type === 'shoot') {
        console.log('IMPORTANT: Shot message received in message_received handler:', msg);
      }
    };
    
    connectionManager.on('message_received', handleMessageReceived);
    
    // Add a global check for events
    const oldEmit = connectionManager.emit;
    connectionManager.emit = function(event: string, ...args: any[]) {
      console.log(`ConnectionManager emitting event: ${event}`, args);
      return oldEmit.apply(this, [event, ...args]);
    };
    
    const handleShot = (data: { id: string; shotId?: string; origin: [number, number, number]; direction: [number, number, number] }) => {
      console.log('Remote shot received in handleShot:', data);
      
      // Create a unique identifier for this shot
      const shotId = data.shotId || `${data.id}-${data.origin.join(',')}-${data.direction.join(',')}`;
      
      // Avoid duplicate processing
      if (processedShotIds.current.has(shotId)) {
        console.log('Ignoring duplicate shot:', shotId);
        return;
      }
      
      // Mark as processed
      processedShotIds.current.add(shotId);
      console.log('Adding shot to processed shots, new size:', processedShotIds.current.size);
      
      const newShot: RemoteShot = {
        id: data.id,
        origin: data.origin,
        direction: data.direction
      };
      
      // Use functional update to ensure we're working with the latest state
      setShots(prev => {
        const updated = [...prev, newShot];
        console.log('New remote shots state:', updated);
        // Limit to last 30 shots
        if (updated.length > 30) {
          return updated.slice(-30);
        }
        return updated;
      });
    };
    
    // Function to clear old shot IDs periodically
    const clearOldShotIds = () => {
      if (processedShotIds.current.size > 100) {
        console.log('Clearing old shot IDs, current size:', processedShotIds.current.size);
        processedShotIds.current = new Set(
          Array.from(processedShotIds.current).slice(-50)
        );
      }
    };
    
    // Set up interval to clear old shot IDs
    const intervalId = setInterval(clearOldShotIds, 10000);
    
    // Send periodic test shots every 5 seconds for debugging
    const testShotIntervalId = setInterval(() => {
      console.log('Sending test shot directly to useRemoteShots hook');
      const testShot = {
        id: 'test-player',
        shotId: `test-${Date.now()}`,
        origin: [0, 0, 0] as [number, number, number],
        direction: [0, 1, 0] as [number, number, number]
      };
      
      handleShot(testShot);
    }, 5000);
    
    // Test direct event emission
    console.log('Testing direct event emission');
    connectionManager.emit('player_shoot', {
      id: 'test-player',
      origin: [0, 0, 0] as [number, number, number],
      direction: [0, 1, 0] as [number, number, number]
    });
    
    connectionManager.on('player_shoot', handleShot);
    
    return () => {
      console.log('Cleaning up remote shots listener');
      // Restore original emit function
      connectionManager.emit = oldEmit;
      connectionManager.off('player_shoot', handleShot);
      connectionManager.off('message_received', handleMessageReceived);
      clearInterval(intervalId);
      clearInterval(testShotIntervalId);
      eventListenersAttached.current = false;
      setShots([]);
    };
  }, [connectionManager]);
  
  return shots;
}; 