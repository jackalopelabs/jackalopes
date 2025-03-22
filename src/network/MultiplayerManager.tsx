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

  const remotePlayerRefs = useRef<Record<string, RemotePlayerData>>({});
  const { camera } = useThree();
  
  // Get server time with offset
  const getServerTime = () => {
    return Date.now() + serverTimeOffset.current;
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
      const shouldCorrect = positionError > 0.1; // Threshold in world units
      
      // If error is significant, reconcile
      if (shouldCorrect) {
        console.log(`Reconciling position error of ${positionError.toFixed(3)} units (ratio: ${errorRatio.toFixed(2)})`);
        
        // Update metrics
        updateReconciliationMetrics(positionError);
        
        // Store error for adaptive correction
        accumulatedError.current += positionError;
        errorCount.current++;
        
        // Calculate average error over recent reconciliations
        const avgError = accumulatedError.current / Math.max(1, errorCount.current);
        
        // Reset counters periodically to adapt to changing network conditions
        if (errorCount.current > 30) {
          accumulatedError.current = avgError * 5; // Keep a weighted history
          errorCount.current = 5;
        }
        
        // Calculate smoothing factor based on error magnitude
        // Large errors need more aggressive correction
        const smoothingFactor = Math.min(0.8, Math.max(0.2, errorRatio * 0.3));
        
        // If player reference exists, apply correction
        if (localPlayerRef.current?.rigidBody) {
          // Avoid too frequent corrections (jitter prevention)
          const timeSinceLastCorrection = Date.now() - lastCorrectionTime.current;
          
          if (timeSinceLastCorrection > 100) { // Limit corrections to max 10 per second
            correctPlayerPosition(serverPosition, smoothingFactor);
            lastCorrectionTime.current = Date.now();
          }
        }
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
  
  // Function to apply correction in the physics system
  const applyCorrection = () => {
    if (!pendingCorrection.current || !correctionData.current) return false;
    
    try {
      if (localPlayerRef.current?.rigidBody) {
        const rigidBody = localPlayerRef.current.rigidBody;
        
        // Get current position
        const currentPos = rigidBody.translation();
        const currentPosition = new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z);
        
        // Calculate corrected position using smoothing
        const targetPosition = correctionData.current.position;
        const smoothing = correctionData.current.smoothingFactor;
        
        // Interpolate between current and target positions
        const correctedPosition = new THREE.Vector3().lerpVectors(
          currentPosition,
          targetPosition,
          smoothing
        );
        
        // Store original Y to preserve jumping
        const originalY = currentPosition.y;
        
        // Optionally preserve Y position to avoid disrupting jumps
        // This is a design choice - sometimes you want full correction including Y
        if (Math.abs(targetPosition.y - originalY) < 1.0) {
          correctedPosition.y = originalY;
        }
        
        // Apply the correction
        rigidBody.setTranslation(
          { x: correctedPosition.x, y: correctedPosition.y, z: correctedPosition.z },
          true
        );
        
        // Debug visualization of corrections
        if (debugMode) {
          console.log(`Applied correction: Current: (${currentPosition.x.toFixed(2)},${currentPosition.y.toFixed(2)},${currentPosition.z.toFixed(2)}) → ` +
                      `Target: (${targetPosition.x.toFixed(2)},${targetPosition.y.toFixed(2)},${targetPosition.z.toFixed(2)}) with factor ${smoothing}`);
        }
        
        pendingCorrection.current = false;
        return true;
      }
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
      
      setRemotePlayers(initialPlayers);
    });
    
    // Add server state update handler
    connectionManager.on('server_state_update', (data: ServerState) => {
      // Process server reconciliation
      handleServerReconciliation(data);
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
          position: new THREE.Vector3(position.x, position.y, position.z),
          velocity: new THREE.Vector3(0, 0, 0), // Assuming no velocity for now
          sequence: 0, // Assuming sequence number 0 for now
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
  
  // Apply correction during each frame
  useFrame(() => {
    // Apply any pending corrections
    if (pendingCorrection.current) {
      applyCorrection();
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
    ReconciliationDebugOverlay
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
  const [shots, setShots] = useState<NetworkRemoteShot[]>([]);
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
    
    // Handle remote shots from other players
    const handleShot = (data: { id: string; shotId?: string; origin: [number, number, number]; direction: [number, number, number] }) => {
      // Generate a consistent shotId if none provided
      const shotId = data.shotId || `${data.id}-${data.origin.join(',')}-${data.direction.join(',')}`;
      
      // Deduplicate shots (may receive multiple times due to broadcast)
      if (processedShotIds.current.has(shotId)) {
        console.log('Ignoring duplicate shot:', shotId);
        return;
      }
      
      // Mark as processed
      processedShotIds.current.add(shotId);
      console.log('Adding shot to processed shots, new size:', processedShotIds.current.size);
      
      // Create NetworkRemoteShot object
      const shot: NetworkRemoteShot = {
        id: data.id,
        shotId: shotId,
        origin: data.origin,
        direction: data.direction,
        timestamp: Date.now()
      };
      
      // Pass to remote shots system with shot limiting
      setShots(prev => {
        const updated = [...prev, shot];
        // Limit to last 50 shots
        if (updated.length > 50) {
          return updated.slice(-50);
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

// ReconciliationDebugOverlay - show correction metrics
const ReconciliationDebugOverlay = ({ metrics }: { metrics: { 
  totalCorrections: number,
  averageError: number,
  lastError: number,
  lastCorrection: number,
  active: boolean
} }) => {
  const [visible, setVisible] = useState(true);
  
  if (!visible || !metrics.active) return null;
  
  return (
    <div 
      style={{
        position: 'absolute',
        bottom: '10px',
        right: '10px',
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        fontFamily: 'monospace',
        fontSize: '12px',
        zIndex: 1000,
        pointerEvents: 'none'
      }}
    >
      <div style={{ marginBottom: '5px', borderBottom: '1px solid #555' }}>
        Reconciliation Stats:
      </div>
      <div>Total corrections: {metrics.totalCorrections}</div>
      <div>Avg error: {metrics.averageError.toFixed(3)} units</div>
      <div>Last error: {metrics.lastError.toFixed(3)} units</div>
      <div>Last correction: {(Date.now() - metrics.lastCorrection) / 1000}s ago</div>
    </div>
  );
}; 