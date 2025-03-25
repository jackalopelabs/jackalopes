// Add global type declaration at the top of the file
declare global {
  interface Window { 
    __shotBroadcast?: (shot: any) => any;
    __processedShots?: Set<string>;
  }
}

import { useState, useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { ConnectionManager } from './ConnectionManager';
import { RemotePlayer } from '../game/RemotePlayer';
import { RemoteShot } from '../game/sphere-tool';
import * as THREE from 'three';

// Types for multiplayer system
interface RemotePlayerData {
  position: [number, number, number];
  rotation: [number, number, number, number];
  updateRef?: {
    updateTransform: (position: [number, number, number], rotation: [number, number, number, number]) => void;
  };
}

// Extended RemoteShot type with additional fields for networking
interface NetworkRemoteShot {
  id: string;
  shotId: string;
  origin: [number, number, number];
  direction: [number, number, number];
  timestamp: number;
}

interface InitializedData {
  id: string;
  gameState: {
    players: Record<string, PlayerData>;
  };
}

// Types for prediction and reconciliation
interface PredictedState {
  timestamp: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  sequence: number;
  processed: boolean;
}

// Snapshot system interfaces
interface GameSnapshot {
  timestamp: number;
  sequence: number;
  players: Record<string, PlayerSnapshot>;
  events: GameEvent[];
}

interface PlayerSnapshot {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number, number];
  velocity?: [number, number, number];
  health: number;
}

interface GameEvent {
  type: string;
  timestamp: number;
  data: any;
}

interface ServerState {
  position: [number, number, number];
  timestamp: number;
  sequence: number;
}

type PlayerData = {
  position: [number, number, number];
  rotation: [number, number, number, number];
  health: number;
};

// ReconciliationDebugOverlay component to show reconciliation metrics
const ReconciliationDebugOverlay = ({ metrics }: { metrics: {
  totalCorrections: number,
  averageError: number,
  lastError: number,
  lastCorrection: number,
  active: boolean
} }) => {
  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.7)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      fontFamily: 'monospace',
      width: '200px',
      zIndex: 1000,
    }}>
      <h3 style={{margin: '0 0 5px 0'}}>Reconciliation Metrics</h3>
      <div>Total Corrections: {metrics.totalCorrections}</div>
      <div>Avg Error: {metrics.averageError.toFixed(3)}</div>
      <div>Last Error: {metrics.lastError.toFixed(3)}</div>
      <div>Last Correction: {metrics.lastCorrection > 0 ? `${((Date.now() - metrics.lastCorrection) / 1000).toFixed(1)}s ago` : 'None'}</div>
    </div>
  );
};

// Create a hook for the multiplayer logic
export const useMultiplayer = (
  localPlayerRef: React.MutableRefObject<any>,
  connectionManager: ConnectionManager
) => {
  const [remotePlayers, setRemotePlayers] = useState<Record<string, RemotePlayerData>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  
  // Add state prediction buffer
  const stateBuffer = useRef<PredictedState[]>([]);
  const lastServerUpdateTime = useRef<number>(0);
  const serverTimeOffset = useRef<number>(0);
  const sequenceNumber = useRef<number>(0);
  
  // Add reconciliation tracking variables
  const accumulatedError = useRef<number>(0);
  const errorCount = useRef<number>(0);
  const lastCorrectionTime = useRef<number>(0);
  const pendingCorrection = useRef<boolean>(false);
  const correctionData = useRef<{
    position: THREE.Vector3;
    smoothingFactor: number;
    timestamp: number;
  } | null>(null);

  // New snapshot system state
  const snapshots = useRef<GameSnapshot[]>([]);
  const snapshotInterval = useRef<number>(100); // ms between snapshots
  const lastSnapshotTime = useRef<number>(0);
  const maxSnapshots = useRef<number>(60); // Keep at most 60 snapshots (6 seconds at 10 per second)

  const remotePlayerRefs = useRef<Record<string, RemotePlayerData>>({});
  const { camera } = useThree();
  
  // Get server time with offset
  const getServerTime = () => {
    return Date.now() + serverTimeOffset.current;
  };
  
  // Create a new game snapshot
  const createGameSnapshot = () => {
    if (!isConnected || !localPlayerRef.current || !playerId) return null;
    
    // Get current player states
    const players: Record<string, PlayerSnapshot> = {};
    
    // Add local player
    if (localPlayerRef.current.rigidBody) {
      const position = localPlayerRef.current.rigidBody.translation();
      const positionArray: [number, number, number] = [position.x, position.y, position.z];
      const rotationArray: [number, number, number, number] = camera.quaternion.toArray() as [number, number, number, number];
      
      players[playerId] = {
        id: playerId,
        position: positionArray,
        rotation: rotationArray,
        health: 100, // Assuming default health
      };
    }
    
    // Add remote players
    Object.entries(remotePlayerRefs.current).forEach(([id, data]) => {
      if (data && data.position) {
        players[id] = {
          id,
          position: data.position,
          rotation: data.rotation,
          health: 100, // Assuming default health
        };
      }
    });
    
    // Create the snapshot
    const snapshot: GameSnapshot = {
      timestamp: getServerTime(),
      sequence: sequenceNumber.current,
      players,
      events: [] // No events in this basic snapshot
    };
    
    // Add to snapshot buffer
    snapshots.current.push(snapshot);
    
    // Limit buffer size
    if (snapshots.current.length > maxSnapshots.current) {
      snapshots.current.shift();
    }
    
    lastSnapshotTime.current = Date.now();
    
    return snapshot;
  };
  
  // Add function to send player position with prediction
  const sendPlayerPosition = (position: THREE.Vector3, rotation: THREE.Quaternion) => {
    if (!isConnected || !localPlayerRef.current) return;
    
    // Convert to arrays for network transmission
    const positionArray: [number, number, number] = [position.x, position.y, position.z];
    const rotationArray: [number, number, number, number] = [
      rotation.x, rotation.y, rotation.z, rotation.w
    ];

    // Store predicted state in buffer with sequence number
    const currentState: PredictedState = {
      position: new THREE.Vector3(position.x, position.y, position.z),
      velocity: new THREE.Vector3(0, 0, 0), // We'll track velocity later
      sequence: sequenceNumber.current,
      timestamp: getServerTime(),
      processed: false
    };
    
    // Add to prediction buffer
    stateBuffer.current.push(currentState);
    
    // Limit buffer size to prevent memory issues
    if (stateBuffer.current.length > 100) {
      stateBuffer.current = stateBuffer.current.slice(-100);
    }

    // Send to server with sequence number for reconciliation
    connectionManager.sendPlayerUpdate(
      positionArray, 
      rotationArray,
      sequenceNumber.current
    );
    
    // Increment sequence number for next update
    sequenceNumber.current++;
  };

  // Handle server reconciliation when we receive updates
  const handleServerReconciliation = (serverState: ServerState) => {
    // Find the matching prediction in our buffer
    const matchingPrediction = stateBuffer.current.find(
      state => state.sequence === serverState.sequence
    );
    
    if (matchingPrediction) {
      // Mark as processed
      matchingPrediction.processed = true;
      
      // Calculate position error between our prediction and server state
      const serverPosition = new THREE.Vector3(
        serverState.position[0],
        serverState.position[1],
        serverState.position[2]
      );
      
      const positionError = serverPosition.distanceTo(matchingPrediction.position);
      
      // Calculate error ratios for logging and adaptive correction
      const errorRatio = positionError / 0.1; // Based on threshold
      const shouldCorrect = positionError > 0.1;
      
      // Update error tracking for metrics
      accumulatedError.current += positionError;
      errorCount.current++;
      updateReconciliationMetrics(positionError);
      
      if (shouldCorrect && localPlayerRef.current?.rigidBody) {
        console.log(`Correcting position error: ${positionError.toFixed(3)} (${errorRatio.toFixed(1)}x threshold)`);
        
        // Choose a smoothing factor based on error size
        // Larger errors use stronger correction
        let smoothingFactor = 0.3; // Default
        
        if (errorRatio > 5) {
          // Very large error - snap immediately
          smoothingFactor = 1.0;
        } else if (errorRatio > 2) {
          // Large error - correct more strongly
          smoothingFactor = 0.7;
        } else if (errorRatio < 0.5) {
          // Minor error - gentle correction
          smoothingFactor = 0.1;
        }
        
        // Don't apply corrections too frequently (prevent jitter)
        const correctionTimeDiff = Date.now() - lastCorrectionTime.current;
        if (correctionTimeDiff > 50) { // At least 50ms between corrections
          // For Y-axis, we want to be careful not to interfere with jumps
          // Only correct Y if we're significantly off
          const yError = Math.abs(serverPosition.y - matchingPrediction.position.y);
          if (yError > 0.5) {
            // Major Y difference - include in correction
            correctPlayerPosition(serverPosition, smoothingFactor);
          } else {
            // Minor Y difference - only correct XZ
            const currentPosition = localPlayerRef.current.rigidBody.translation();
            const correctedPosition = new THREE.Vector3(
              serverPosition.x,
              currentPosition.y, // Keep current Y
              serverPosition.z
            );
            correctPlayerPosition(correctedPosition, smoothingFactor);
          }
          
          lastCorrectionTime.current = Date.now();
        }
      } else if (shouldCorrect) {
        console.warn("Cannot correct position: no rigidBody reference");
      } else {
        console.log(`Position accurate within threshold: ${positionError.toFixed(3)}`);
      }
    } else {
      console.log(`No matching prediction found for sequence ${serverState.sequence}`);
      
      // Handle orphaned server updates (no matching prediction)
      // This can happen due to packet loss or out-of-order delivery
      if (localPlayerRef.current?.rigidBody && serverState.position) {
        const serverPosition = new THREE.Vector3(
          serverState.position[0],
          serverState.position[1],
          serverState.position[2]
        );
        
        // Use a higher smoothing factor for orphaned updates
        correctPlayerPosition(serverPosition, 0.5);
      }
    }
    
    // Clean up old entries that have been processed
    stateBuffer.current = stateBuffer.current.filter(
      state => !state.processed || state.sequence > serverState.sequence - 30
    );
  };
  
  // Function to correct player position with proper error handling
  const correctPlayerPosition = (serverPosition: THREE.Vector3, smoothingFactor: number) => {
    try {
      // Store the correction for application in the physics step
      correctionData.current = {
        position: serverPosition.clone(),
        smoothingFactor,
        timestamp: Date.now()
      };
      
      // Schedule correction to be applied in next physics step
      pendingCorrection.current = true;
      
      // Update timestamp for synchronization
      lastServerUpdateTime.current = Date.now();
    } catch (error) {
      console.error("Error during position correction:", error);
    }
  };
  
  // Apply correction with proper physics integration
  const applyCorrection = () => {
    if (!correctionData.current || !localPlayerRef.current?.rigidBody) {
      pendingCorrection.current = false;
      return false;
    }
    
    try {
      const { position, smoothingFactor } = correctionData.current;
      const currentPosition = localPlayerRef.current.rigidBody.translation();
      
      // Calculate interpolated position
      const newX = currentPosition.x + (position.x - currentPosition.x) * smoothingFactor;
      const newY = currentPosition.y + (position.y - currentPosition.y) * smoothingFactor;
      const newZ = currentPosition.z + (position.z - currentPosition.z) * smoothingFactor;
      
      // Apply the correction to the physics body
      localPlayerRef.current.rigidBody.setTranslation(
        { x: newX, y: newY, z: newZ },
        true
      );
      
      // Log the correction
      console.log(`Applied position correction with factor ${smoothingFactor}`);
      
      // Clear the correction data
      correctionData.current = null;
      pendingCorrection.current = false;
      
      return true;
    } catch (error) {
      console.error("Error applying correction:", error);
      pendingCorrection.current = false;
    }
    
    return false;
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
            position: playerData.position as [number, number, number],
            rotation: playerData.rotation as [number, number, number, number]
          };
        }
      });
      
      // Reset state buffer on initialization
      stateBuffer.current = [];
      sequenceNumber.current = 0;
      lastServerUpdateTime.current = Date.now();
      
      // Estimate server time offset (assume minimal latency for simplicity)
      serverTimeOffset.current = 0;
      
      // Initialize snapshots
      snapshots.current = [];
      lastSnapshotTime.current = Date.now();
      
      setRemotePlayers(initialPlayers);
    });
    
    // Add server state update handler
    connectionManager.on('server_state_update', (data: ServerState) => {
      // Process server reconciliation
      handleServerReconciliation(data);
    });
    
    // Handler for full game state snapshots from server
    connectionManager.on('game_snapshot', (snapshotData: GameSnapshot) => {
      console.log('Received game snapshot:', snapshotData);
      
      // Store in snapshot buffer for interpolation and replay
      snapshots.current.push(snapshotData);
      
      // Limit snapshot buffer size
      if (snapshots.current.length > maxSnapshots.current) {
        snapshots.current.shift();
      }
      
      // Process events in the snapshot
      if (snapshotData.events && snapshotData.events.length > 0) {
        console.log(`Processing ${snapshotData.events.length} events from snapshot`);
        snapshotData.events.forEach(event => {
          // Handle different event types
          switch (event.type) {
            case 'player_hit':
              console.log('Player hit event:', event.data);
              // Handle player hit logic
              break;
            case 'item_pickup':
              console.log('Item pickup event:', event.data);
              // Handle item pickup logic
              break;
            // Add more event types as needed
          }
        });
      }
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
  
  // Create and send snapshots periodically
  useEffect(() => {
    if (!isConnected || !localPlayerRef.current?.rigidBody) return;
    
    const snapshotTimer = setInterval(() => {
      const snapshot = createGameSnapshot();
      if (snapshot) {
        // Send snapshot to server if needed
        connectionManager.sendGameSnapshot(snapshot);
      }
    }, snapshotInterval.current);
    
    return () => {
      clearInterval(snapshotTimer);
    };
  }, [isConnected, localPlayerRef, connectionManager]);
  
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
          position: new THREE.Vector3(position.x, position.y, position.z),
          velocity: new THREE.Vector3(0, 0, 0), // Assuming no velocity for now
          sequence: sequenceNumber.current,
          timestamp: getServerTime(),
          processed: false
        };
        
        // Add to state buffer (keep last 60 states max, ~1 second at 60fps)
        stateBuffer.current.push(currentState);
        if (stateBuffer.current.length > 60) {
          stateBuffer.current.shift();
        }
        
        connectionManager.sendPlayerUpdate(
          [position.x, position.y, position.z], 
          cameraQuat,
          sequenceNumber.current
        );
        
        // Increment sequence number
        sequenceNumber.current++;
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
  
  // Apply correction during each frame and handle snapshot interpolation
  useFrame(() => {
    // Apply any pending corrections
    if (pendingCorrection.current) {
      applyCorrection();
    }
    
    // Snapshot management - check for stale data
    if (snapshots.current.length > 0) {
      const now = Date.now();
      // Clean up snapshots older than 10 seconds
      const oldestValidTime = now - 10000;
      snapshots.current = snapshots.current.filter(s => s.timestamp > oldestValidTime);
    }
  });
  
  // For reconciliation metrics
  const [reconciliationMetrics, setReconciliationMetrics] = useState({
    totalCorrections: 0,
    averageError: 0,
    lastError: 0,
    lastCorrection: 0,
    active: debugMode
  });
  
  // Update metrics when corrections happen
  const updateReconciliationMetrics = (error: number) => {
    setReconciliationMetrics(prev => {
      const totalCorrections = prev.totalCorrections + 1;
      const totalError = prev.averageError * prev.totalCorrections + error;
      const averageError = totalError / totalCorrections;
      
      return {
        totalCorrections,
        averageError,
        lastError: error,
        lastCorrection: Date.now(),
        active: debugMode
      };
    });
  };
  
  // Function to get a snapshot at a specific time
  const getSnapshotAtTime = (timestamp: number) => {
    if (snapshots.current.length === 0) {
      return null;
    }
    
    // Find the closest snapshots
    let before = snapshots.current[0];
    let after = snapshots.current[snapshots.current.length - 1];
    
    for (const snapshot of snapshots.current) {
      if (snapshot.timestamp <= timestamp && snapshot.timestamp > before.timestamp) {
        before = snapshot;
      }
      
      if (snapshot.timestamp >= timestamp && snapshot.timestamp < after.timestamp) {
        after = snapshot;
      }
    }
    
    // If we found exact match
    if (before.timestamp === timestamp) {
      return before;
    }
    
    // If the timestamp is out of range
    if (timestamp < before.timestamp) {
      return before;
    }
    
    if (timestamp > after.timestamp) {
      return after;
    }
    
    // Otherwise we need to interpolate
    return interpolateSnapshots(before, after, timestamp);
  };
  
  // Helper to interpolate between two snapshots
  const interpolateSnapshots = (before: GameSnapshot, after: GameSnapshot, timestamp: number) => {
    const t = (timestamp - before.timestamp) / (after.timestamp - before.timestamp);
    
    // Create a new interpolated snapshot
    const interpolated: GameSnapshot = {
      timestamp,
      sequence: Math.floor(before.sequence + (after.sequence - before.sequence) * t),
      players: {},
      events: [] // We don't interpolate events
    };
    
    // Interpolate player positions
    const playerIds = new Set([
      ...Object.keys(before.players),
      ...Object.keys(after.players)
    ]);
    
    playerIds.forEach(id => {
      const beforePlayer = before.players[id];
      const afterPlayer = after.players[id];
      
      if (beforePlayer && afterPlayer) {
        // Both snapshots have the player - interpolate
        const position: [number, number, number] = [
          beforePlayer.position[0] + (afterPlayer.position[0] - beforePlayer.position[0]) * t,
          beforePlayer.position[1] + (afterPlayer.position[1] - beforePlayer.position[1]) * t,
          beforePlayer.position[2] + (afterPlayer.position[2] - beforePlayer.position[2]) * t
        ];
        
        // Note: We should properly interpolate quaternions, but this is simplified
        const rotation = beforePlayer.rotation;
        
        interpolated.players[id] = {
          id,
          position,
          rotation,
          health: Math.floor(beforePlayer.health + (afterPlayer.health - beforePlayer.health) * t)
        };
      } else if (beforePlayer) {
        // Only in before snapshot - assume player was removed
        interpolated.players[id] = { ...beforePlayer };
      } else if (afterPlayer) {
        // Only in after snapshot - assume player was added
        interpolated.players[id] = { ...afterPlayer };
      }
    });
    
    return interpolated;
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
    playerId,
    sendPlayerPosition,
    // Add reconciliation controls
    setDebugMode,
    applyCorrection,
    pendingReconciliation: pendingCorrection,
    reconciliationMetrics,
    ReconciliationDebugOverlay,
    // Add snapshot system exports
    getSnapshotAtTime,
    createGameSnapshot,
    snapshots: snapshots.current,
    setSnapshotInterval: (interval: number) => {
      snapshotInterval.current = Math.max(50, interval); // Min 50ms
    }
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

// Add a direct browser-to-browser communication channel for testing
const LOCAL_STORAGE_KEY = 'jackalopes_shot_events';
const PLAYER_UPDATE_KEY = 'jackalopes_player_update';

// Function to broadcast a shot to other browser tabs
const broadcastShotToLocalStorage = (shot: NetworkRemoteShot) => {
  try {
    // Add a timestamp to ensure uniqueness and ordering
    const timestampedShot = {
      ...shot,
      timestamp: Date.now(),
      shotId: shot.shotId || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    };
    
    // Store in localStorage to share with other tabs
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(timestampedShot));
    console.log('Shot broadcasted to localStorage:', timestampedShot);
    
    // Immediately remove it to allow future events of the same type
    setTimeout(() => {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }, 50);
  } catch (error) {
    console.error('Error broadcasting shot to localStorage:', error);
  }
};

// Create a more robust cross-window universal broadcast function
const universalBroadcast = (shot: NetworkRemoteShot) => {
  try {
    // Create a special universal broadcast message
    const broadcastShot = {
      ...shot,
      isUniversalBroadcast: true,
      timestamp: Date.now(),
      shotId: `universal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    };
    
    // Store directly in sessionStorage first (immediately available in this browser)
    sessionStorage.setItem('last_universal_broadcast', JSON.stringify(broadcastShot));
    
    // Then use localStorage for cross-browser communication
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(broadcastShot));
    
    // Keep trying to broadcast a few times to ensure delivery
    const repeatInterval = setInterval(() => {
      try {
        localStorage.setItem(`${LOCAL_STORAGE_KEY}_repeat`, JSON.stringify({
          ...broadcastShot,
          repeatTimestamp: Date.now()
        }));
      } catch (e) {
        clearInterval(repeatInterval);
      }
    }, 100);
    
    // Stop repeating after 1 second
    setTimeout(() => {
      clearInterval(repeatInterval);
      // Clean up storage
      localStorage.removeItem(`${LOCAL_STORAGE_KEY}_repeat`);
    }, 1000);
    
    console.log('🌐 UNIVERSAL BROADCAST sent:', broadcastShot);
    
    return broadcastShot;
  } catch (error) {
    console.error('Error in universal broadcast:', error);
    return shot;
  }
};

// Add a hook to get remote shots from the current connection manager
export const useRemoteShots = (connectionManager: ConnectionManager) => {
  const [shots, setShots] = useState<NetworkRemoteShot[]>([]);
  const processedShotIds = useRef<Set<string>>(new Set());
  const eventListenersAttached = useRef<boolean>(false);
  
  // Process a shot and add it to the list if it's new
  const handleShot = (shotData: NetworkRemoteShot) => {
    // Skip if null or undefined
    if (!shotData) return;
    
    // Handle universal broadcast specially
    if ((shotData as any).isUniversalBroadcast) {
      console.log('🌐 Received universal broadcast:', shotData);
    }
    
    // Ensure we have a shot ID
    const shotId = shotData.shotId || `${shotData.id}-${shotData.origin.join(',')}-${shotData.direction.join(',')}`;
    
    // Skip if already processed
    if (processedShotIds.current.has(shotId)) {
      console.log(`Shot ${shotId} already processed:`, true);
      return;
    }
    
    console.log('Adding shot to processed shots, new size:', processedShotIds.current.size + 1);
    
    // Add to processed set
    processedShotIds.current.add(shotId);
    
    // Update shots list with full data
    setShots(prev => [
      ...prev, 
      {
        ...shotData,
        shotId
      }
    ]);
    
    // Broadcast to other browser tabs for cross-browser testing
    broadcastShotToLocalStorage({
      ...shotData,
      shotId
    });
  };
  
  // Add a global function for universal broadcasts
  if (typeof window !== 'undefined' && !window.__shotBroadcast) {
    window.__shotBroadcast = universalBroadcast;
  }
  
  useEffect(() => {
    console.log('Setting up remote shots listener on connection manager:', connectionManager);
    
    if (eventListenersAttached.current) {
      console.log('Event listeners already attached, cleaning up first');
      connectionManager.off('player_shoot', handleShot);
      connectionManager.off('message_received', () => {});
      window.removeEventListener('storage', () => {});
    }
    
    eventListenersAttached.current = true;
    
    // Listen for storage events from other tabs
    const handleStorageEvent = (event: StorageEvent) => {
      // Skip null events
      if (!event.key || !event.newValue) return;
      
      // Handle shot events
      if (event.key === LOCAL_STORAGE_KEY || 
          event.key === `${LOCAL_STORAGE_KEY}_repeat` || 
          event.key.startsWith(LOCAL_STORAGE_KEY)) {
        try {
          const shotData = JSON.parse(event.newValue) as NetworkRemoteShot;
          console.log('Received shot from localStorage:', shotData);
          handleShot(shotData);
        } catch (error) {
          console.error('Error processing shot from localStorage:', error);
        }
      }
      
      // Handle player updates
      if (event.key === PLAYER_UPDATE_KEY) {
        try {
          const updateData = JSON.parse(event.newValue);
          console.log('Received player update from localStorage:', updateData);
          // Process player update if needed
        } catch (error) {
          console.error('Error processing player update from localStorage:', error);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageEvent);
    
    // Debug: Test event emitter
    const handleMessageReceived = (msg: any) => {
      // Only log shoot messages to reduce console noise
      if (msg.type === 'shoot') {
        console.log('IMPORTANT: Shot message received in message_received handler:', msg);
      }
    };
    
    connectionManager.on('message_received', handleMessageReceived);
    
    // Check for new shots every second (fallback for environments where storage events don't fire)
    const intervalId = setInterval(() => {
      // Check normal shot events
      const storedShot = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedShot) {
        try {
          const shotData = JSON.parse(storedShot) as NetworkRemoteShot;
          handleShot(shotData);
        } catch (error) {
          console.error('Error processing shot from intervalId check:', error);
        }
      }
      
      // Check for repeated universal broadcasts
      const repeatedShot = localStorage.getItem(`${LOCAL_STORAGE_KEY}_repeat`);
      if (repeatedShot) {
        try {
          const shotData = JSON.parse(repeatedShot) as NetworkRemoteShot;
          handleShot(shotData);
        } catch (e) {
          // Ignore errors
        }
      }
      
      // Check session storage for direct broadcasts
      const sessionShot = sessionStorage.getItem('last_universal_broadcast');
      if (sessionShot) {
        try {
          const shotData = JSON.parse(sessionShot) as NetworkRemoteShot;
          handleShot(shotData);
          // Remove after processing
          sessionStorage.removeItem('last_universal_broadcast');
        } catch (e) {
          // Ignore errors
        }
      }
    }, 1000);
    
    // Send periodic test shots every 5 seconds for debugging
    const testShotIntervalId = setInterval(() => {
      console.log('Sending test shot directly to useRemoteShots hook');
      const testShot = {
        id: 'test-player',
        shotId: `test-player-0,0,0-0,1,0`,
        origin: [0, 0, 0] as [number, number, number],
        direction: [0, 1, 0] as [number, number, number],
        timestamp: Date.now()
      };
      
      handleShot(testShot);
    }, 5000);
    
    // Handle shots from the server
    connectionManager.on('player_shoot', handleShot);
    
    return () => {
      console.log('Cleaning up remote shots listener');
      connectionManager.off('player_shoot', handleShot);
      connectionManager.off('message_received', handleMessageReceived);
      window.removeEventListener('storage', handleStorageEvent);
      clearInterval(intervalId);
      clearInterval(testShotIntervalId);
      eventListenersAttached.current = false;
    };
  }, [connectionManager]);
  
  return shots;
}; 