import { useState, useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { ConnectionManager } from './ConnectionManager';
import { RemotePlayer } from '../game/RemotePlayer';
import * as THREE from 'three';

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
  localPlayerRef 
}: { 
  localPlayerRef: React.MutableRefObject<any> 
}) => {
  const [connectionManager] = useState(() => new ConnectionManager());
  const [remotePlayers, setRemotePlayers] = useState<Record<string, RemotePlayerData>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  
  const remotePlayerRefs = useRef<Record<string, RemotePlayerData>>({});
  const { camera } = useThree();
  
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
      // Clean up on unmount
      connectionManager.disconnect();
    };
  }, []);
  
  // Send regular position updates
  useEffect(() => {
    if (!isConnected || !localPlayerRef.current?.rigidBody) return;
    
    const updateInterval = setInterval(() => {
      if (localPlayerRef.current?.rigidBody) {
        const position = localPlayerRef.current.rigidBody.translation();
        const cameraQuat = camera.quaternion.toArray() as [number, number, number, number];
        
        connectionManager.sendPlayerUpdate(
          [position.x, position.y, position.z], 
          cameraQuat
        );
      }
    }, 100); // 10 updates per second
    
    return () => clearInterval(updateInterval);
  }, [isConnected, localPlayerRef, camera]);
  
  // Register shoot events
  useEffect(() => {
    const handleShoot = () => {
      if (!isConnected || !document.pointerLockElement) return;
      
      // Get current camera position and direction
      const position = camera.position.toArray();
      const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).toArray();
      
      connectionManager.sendShootEvent(
        position as [number, number, number], 
        direction as [number, number, number]
      );
    };
    
    window.addEventListener('pointerdown', handleShoot);
    
    return () => window.removeEventListener('pointerdown', handleShoot);
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