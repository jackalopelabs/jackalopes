import { useState, useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { ConnectionManager } from './ConnectionManager';
import { RemotePlayer } from '../game/RemotePlayer';
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

export const MultiplayerManager = ({ 
  localPlayerRef,
  connectionManager: externalConnectionManager
}: { 
  localPlayerRef: React.MutableRefObject<any>,
  connectionManager?: ConnectionManager
}) => {
  const [connectionManager] = useState(() => externalConnectionManager || new ConnectionManager());
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
    
    connectionManager.on('player_shoot', (data) => {
      console.log('Remote player shot:', data);
      // TODO: Implement visual feedback for remote player shooting
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
  }, []);
  
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
  }, [isConnected, localPlayerRef, camera]);
  
  // Register shoot events with better cleanup
  useEffect(() => {
    if (!isConnected) return;
    
    console.log('Setting up shoot event handler');
    const handleShoot = (event: MouseEvent) => {
      // Only process shoot events when pointer is locked and we're connected
      if (!isConnected) return;
      if (!document.pointerLockElement) {
        console.log('Pointer not locked, ignoring shoot event');
        return;
      }
      
      try {
        // Get current camera position and direction
        const position = camera.position.toArray();
        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).toArray();
        
        connectionManager.sendShootEvent(
          position as [number, number, number], 
          direction as [number, number, number]
        );
      } catch (error) {
        console.error('Error processing shoot event:', error);
      }
    };
    
    window.addEventListener('pointerdown', handleShoot);
    
    return () => {
      console.log('Removing shoot event handler');
      window.removeEventListener('pointerdown', handleShoot);
    };
  }, [isConnected, camera]);
  
  // Handle ref updates for remote players
  const updatePlayerRef = (id: string, methods: { updateTransform: (position: [number, number, number], rotation: [number, number, number, number]) => void }) => {
    remotePlayerRefs.current[id] = {
      ...remotePlayerRefs.current[id],
      updateRef: methods
    };
  };
  
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
      
      {/* Optional: Debug UI */}
      {false && (
        <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.5)', color: 'white', padding: 10 }}>
          <div>Connected: {isConnected ? '✅' : '❌'}</div>
          <div>Player ID: {playerId || 'Not assigned'}</div>
          <div>Remote Players: {Object.keys(remotePlayers).length}</div>
        </div>
      )}
    </>
  );
}; 