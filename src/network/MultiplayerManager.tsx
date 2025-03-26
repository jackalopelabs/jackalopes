// Add global type declaration at the top of the file
declare global {
  interface Window { 
    __shotBroadcast?: (shot: any) => any;
    __processedShots?: Set<string>;
    __sendTestShot?: () => void;
  }
}

import React, { useState, useEffect, useRef, useImperativeHandle, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { ConnectionManager } from './ConnectionManager';
import { RemotePlayer, RemotePlayerMethods } from '../game/RemotePlayer';
import { RemoteShot } from '../game/sphere-tool';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

// Types for multiplayer system
type RemotePlayerData = {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number, number];
  lastUpdate: number;
};

// Interface for RemotePlayer props
interface RemotePlayerProps {
  id: string;
  initialPosition: [number, number, number];
  initialRotation: [number, number, number, number];
  ref?: React.RefObject<RemotePlayerMethods>;
}

// Extended RemoteShot type with additional fields for networking
interface NetworkRemoteShot extends RemoteShot {
  id: string;
  shotId: string;
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

// Add this near the beginning of the file, where other interfaces are defined
interface PlayerUpdateData {
  position: [number, number, number];
  rotation: [number, number, number, number];
  velocity?: [number, number, number];
  sequence?: number;
}

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
  const updateMethodsRef = useRef<Record<string, RemotePlayerMethods>>({});
  const { camera } = useThree();
  
  // Add refs for optimization
  const lastSentPosition = useRef<[number, number, number] | null>(null);
  const nextSequence = useRef<number>(0);
  
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
  
  // Track remote players
  useEffect(() => {
    if (!connectionManager) return;
    
    console.log("⚡ Setting up remote player tracking in MultiplayerManager");
    
    const handlePlayerJoined = (data: any) => {
      console.log("➕ Player joined:", data);
      
      setRemotePlayers(prev => {
        // Skip if player already exists
        if (prev[data.id]) {
          console.log(`Player ${data.id} already exists in our list`);
          return prev;
        }
        
        console.log(`Adding new remote player: ${data.id}`);
        
        // Add the new player with their initial state
        return {
          ...prev,
          [data.id]: {
            id: data.id,
            position: data.state?.position || [0, 1, 0],
            rotation: data.state?.rotation || [0, 0, 0, 1],
            lastUpdate: Date.now()
          }
        };
      });
    };
    
    const handlePlayerLeft = (data: any) => {
      console.log("➖ Player left:", data);
      
      // Also clean up rate limiting data for this player
      if (playerUpdateThrottleRef.current[data.id]) {
        delete playerUpdateThrottleRef.current[data.id];
      }
      
      setRemotePlayers(prev => {
        if (!prev[data.id]) {
          return prev;
        }
        
        // Create a new object without this player
        const newPlayers = { ...prev };
        delete newPlayers[data.id];
        return newPlayers;
      });
    };
    
    const handlePlayerUpdate = (data: any) => {
      // Skip updates from ourselves
      if (data.id === connectionManager.getPlayerId()) {
        return;
      }
      
      // Debug logging every 60 updates
      if (Math.random() < 0.02) {
        console.log(`📡 Remote player update for ${data.id}:`, {
          position: data.position,
          rotation: data.rotation
        });
      }
      
      // Apply rate limiting for updates - throttle incoming messages
      if (!playerUpdateThrottleRef.current[data.id]) {
        playerUpdateThrottleRef.current[data.id] = { 
          lastTime: 0, 
          minInterval: 50 // 50ms = max 20 updates/second per player
        };
      }
      
      const now = Date.now();
      const playerThrottle = playerUpdateThrottleRef.current[data.id];
      const timeSinceLastUpdate = now - playerThrottle.lastTime;
      
      // Skip this update if we're getting them too frequently
      if (timeSinceLastUpdate < playerThrottle.minInterval) {
        return;
      }
      
      // Update the last update time
      playerThrottle.lastTime = now;
      
      setRemotePlayers(prev => {
        // If we don't have this player yet, add them
        if (!prev[data.id]) {
          console.log(`Adding player ${data.id} from update - wasn't in our list`);
          return {
            ...prev,
            [data.id]: {
              id: data.id,
              position: data.position,
              rotation: data.rotation,
              lastUpdate: Date.now()
            }
          };
        }
        
        // Update existing player
        return {
          ...prev,
          [data.id]: {
            ...prev[data.id],
            position: data.position,
            rotation: data.rotation,
            lastUpdate: Date.now()
          }
        };
      });
    };
    
    // Register event handlers
    connectionManager.on('player_joined', handlePlayerJoined);
    connectionManager.on('player_left', handlePlayerLeft);
    connectionManager.on('player_update', handlePlayerUpdate);
    
    // When connected, request the player list to make sure we have everyone
    const handleConnected = () => {
      console.log("🔌 Connected to multiplayer server - requesting player list");
      
      // Only send player list request if not using the staging server
      if (connectionManager.isReadyToSend() && !connectionManager.getServerUrl().includes('staging.games.bonsai.so')) {
        connectionManager.sendMessage({
          type: 'request_player_list'
        });
      } else {
        console.log('Skipping request_player_list for staging server - not supported');
      }
    };
    
    connectionManager.on('connected', handleConnected);
    
    // Also request player list when initialized
    const handleInitialized = () => {
      console.log("🔌 Initialized connection - requesting player list");
      
      // Wait a second before requesting the player list
      setTimeout(() => {
        // Only send player list request if not using the staging server
        if (connectionManager.isReadyToSend() && !connectionManager.getServerUrl().includes('staging.games.bonsai.so')) {
          connectionManager.sendMessage({
            type: 'request_player_list'
          });
        } else {
          console.log('Skipping request_player_list for staging server - not supported');
        }
      }, 1000);
    };
    
    connectionManager.on('initialized', handleInitialized);
    
    // Request player list immediately if we're already connected
    if (connectionManager.isReadyToSend() && !connectionManager.getServerUrl().includes('staging.games.bonsai.so')) {
      console.log("Already connected - requesting player list");
      connectionManager.sendMessage({
        type: 'request_player_list'
      });
    } else if (connectionManager.isReadyToSend()) {
      console.log('Skipping request_player_list for staging server - not supported');
    }
    
    // When component unmounts
    return () => {
      console.log('Cleaning up multiplayer connection...');
      // Ensure we disconnect properly when component unmounts
      connectionManager.disconnect();
      // Remove specific message handler
      connectionManager.off('message_received', (message: any) => {});
      // Reset states on unmount
      setIsConnected(false);
      setPlayerId(null);
      setRemotePlayers({});
      // Remove all event handlers
      connectionManager.off('player_joined', handlePlayerJoined);
      connectionManager.off('player_left', handlePlayerLeft);
      connectionManager.off('player_update', handlePlayerUpdate);
      connectionManager.off('connected', handleConnected);
      connectionManager.off('initialized', handleInitialized);
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
  
  // Set up position update interval
  useEffect(() => {
    if (!connectionManager || !localPlayerRef.current || connectionManager.isOfflineMode()) {
      return;
    }
    
    console.log('Starting position update interval');
    
    // Store the last sent rotation to detect changes
    const lastSentRotation = {
      x: 0,
      y: 0,
      z: 0,
      w: 0
    };
    
    // Create a throttle mechanism to avoid sending too many updates
    let lastRotationUpdateTime = 0;
    const MIN_ROTATION_UPDATE_INTERVAL = 500; // Increased from 250ms to 500ms - much less frequent
    
    // Track rotation stability
    let isRotationStable = true;
    let lastRotationCheckTime = 0;
    const rotationHistory: Array<[number, number, number, number]> = [];
    
    // Send position updates
    const intervalId = setInterval(() => {
      if (!localPlayerRef.current || !connectionManager.isReadyToSend()) {
        return;
      }

      let position, rotation, velocity;
      
      // Get camera rotation - critical source of player orientation
      // We get a clean, normalized copy of the camera quaternion
      // First we get a fresh copy to avoid reusing mutated quaternions
      rotation = camera.quaternion.clone();
      
      // Ensure it's normalized to prevent drift issues
      rotation.normalize();
      
      // Debug - log actual camera rotation values occasionally 
      if (Math.random() < 0.001) {
        console.log("CAMERA ROTATION ACTUAL:", 
          [rotation.x, rotation.y, rotation.z, rotation.w]);
      }
      
      // Get position data
      if (localPlayerRef.current.body && typeof localPlayerRef.current.body.translation === 'function') {
        position = localPlayerRef.current.body.translation();
        velocity = localPlayerRef.current.body.linvel();
      } else if (localPlayerRef.current.rigidBody && typeof localPlayerRef.current.rigidBody.translation === 'function') {
        position = localPlayerRef.current.rigidBody.translation();
        velocity = localPlayerRef.current.rigidBody.linvel();
      } else if (localPlayerRef.current.position && localPlayerRef.current.position.x !== undefined) {
        position = localPlayerRef.current.position;
      }
      
      if (!position || position.x === undefined || !rotation || rotation.x === undefined) {
        return;
      }
      
      // Track rotation history for stability detection
      const now = Date.now();
      if (now - lastRotationCheckTime > 100) { // Check every 100ms
        rotationHistory.push([rotation.x, rotation.y, rotation.z, rotation.w]);
        if (rotationHistory.length > 5) {
          rotationHistory.shift(); // Keep last 5 rotations
        }
        
        // Calculate rotation stability by comparing recent rotations
        if (rotationHistory.length >= 3) {
          let totalDelta = 0;
          for (let i = 1; i < rotationHistory.length; i++) {
            const prev = rotationHistory[i-1];
            const curr = rotationHistory[i];
            const dotProduct = 
              prev[0] * curr[0] + 
              prev[1] * curr[1] + 
              prev[2] * curr[2] + 
              prev[3] * curr[3];
            totalDelta += Math.abs(1 - Math.abs(dotProduct));
          }
          // Average change between recent rotations
          const avgChange = totalDelta / (rotationHistory.length - 1);
          // Mark as stable if changes are very small
          isRotationStable = avgChange < 0.01;
        }
        
        lastRotationCheckTime = now;
      }
      
      // Position change detection - threshold of 5cm
      const lastPos = lastSentPosition.current;
      const posChanged = !lastPos || 
        Math.abs(position.x - lastPos[0]) > 0.05 || 
        Math.abs(position.y - lastPos[1]) > 0.05 || 
        Math.abs(position.z - lastPos[2]) > 0.05;
      
      // Rotation change detection - more strict (3% threshold)
      // Higher threshold means we send fewer rotation updates
      const rotationChanged = 
        Math.abs(rotation.x - lastSentRotation.x) > 0.03 || 
        Math.abs(rotation.y - lastSentRotation.y) > 0.03 || 
        Math.abs(rotation.z - lastSentRotation.z) > 0.03 || 
        Math.abs(rotation.w - lastSentRotation.w) > 0.03;
      
      // Force update minimum every 3 seconds (increased from 2 seconds)
      const timeSinceLastUpdate = now - (lastUpdateTime.current || 0);
      const shouldSendForTime = timeSinceLastUpdate > 3000;
      
      // Check if enough time has passed since last rotation update
      const timeSinceLastRotation = now - lastRotationUpdateTime;
      const canSendRotationUpdate = timeSinceLastRotation > MIN_ROTATION_UPDATE_INTERVAL;
      
      // Send update if one of these is true:
      // 1. Position changed significantly, OR
      // 2. Rotation changed AND enough time passed AND player rotation is stable, OR
      // 3. It's been too long since last update
      if (posChanged || 
          (rotationChanged && canSendRotationUpdate && isRotationStable) || 
          shouldSendForTime) {
        
        // Create update data
        const updateData: PlayerUpdateData = {
          position: [position.x, position.y, position.z],
          rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
          sequence: nextSequence.current++
        };
        
        // Add velocity
        if (velocity) {
          updateData.velocity = [velocity.x, velocity.y, velocity.z];
        }
        
        // Send to server
        connectionManager.sendPlayerUpdate(updateData);
        
        // Update tracking variables
        lastSentPosition.current = [position.x, position.y, position.z];
        lastSentRotation.x = rotation.x;
        lastSentRotation.y = rotation.y;
        lastSentRotation.z = rotation.z;
        lastSentRotation.w = rotation.w;
        lastUpdateTime.current = now;
        
        // If rotation changed, update rotation timestamp
        if (rotationChanged) {
          lastRotationUpdateTime = now;
          if (Math.random() < 0.05) {
            console.log("Sent rotation update (stable:", isRotationStable, "):", 
              [rotation.x, rotation.y, rotation.z, rotation.w]);
          }
        }
      }
    }, 50); // Increased from 30ms to 50ms (20fps instead of 33fps) - less network traffic
    
    return () => {
      clearInterval(intervalId);
      console.log('Cleared position update interval');
    };
  }, [connectionManager, localPlayerRef, camera]);
  
  // Handle ref updates for remote players
  const updatePlayerRef = (id: string, methods: RemotePlayerMethods) => {
    // Store methods in a separate structure, not as part of RemotePlayerData
    if (!remotePlayerRefs.current[id]) {
      remotePlayerRefs.current[id] = {
        id,
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        lastUpdate: Date.now()
      };
    }
    
    // Store the update method in a separate ref map
    if (!updateMethodsRef.current) {
      updateMethodsRef.current = {};
    }
    
    updateMethodsRef.current[id] = methods;
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
  
  // Set up connection and event handlers
  useEffect(() => {
    console.log('Setting up multiplayer connection...');
    
    // Connection events
    connectionManager.on('connected', () => {
      console.log('Connected to multiplayer server');
      // Don't set isConnected here, wait for auth & session join
    });
    
    connectionManager.on('disconnected', () => {
      console.log('Disconnected from multiplayer server');
      setIsConnected(false);
    });
    
    connectionManager.on('initialized', (data: any) => {
      console.log('Initialized with ID:', data.id);
      setPlayerId(data.id);
      // Don't set isConnected here, wait for session join confirmation
    });

    // Add specific handler for join_success
    connectionManager.on('message_received', (message: any) => {
      if (message.type === 'join_success') {
        console.log('Successfully joined session:', message.session?.id);
        setIsConnected(true);
      }
    });
    
    // Connect to the server
    connectionManager.connect();
    
    // Add a debug log to check connection status after 5 seconds
    setTimeout(() => {
      console.log("🔍 MULTIPLAYER CONNECTION STATUS (after 5s):");
      console.log("- IsConnected:", isConnected);
      console.log("- PlayerId:", playerId);
      console.log("- Remote players:", Object.keys(remotePlayers).length);
      console.log("- Server URL:", connectionManager.getServerUrl());
      console.log("- Socket state:", connectionManager.socket?.readyState || "NO_SOCKET");
      
      // Try to reestablish connection if needed
      if (!isConnected && connectionManager.socket?.readyState !== WebSocket.OPEN) {
        console.log("Attempting to reconnect...");
        connectionManager.connect();
      }
    }, 5000);
    
    return () => {
      console.log('Cleaning up multiplayer connection...');
      // Ensure we disconnect properly when component unmounts
      connectionManager.disconnect();
      // Remove specific message handler
      connectionManager.off('message_received', (message: any) => {});
      // Reset states on unmount
      setIsConnected(false);
      setPlayerId(null);
      setRemotePlayers({});
    };
  }, [connectionManager]);
  
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

// Render remote players - use React.memo to prevent unnecessary re-renders
export const RemotePlayers = React.memo(({ 
  players 
}: { 
  players: Record<string, RemotePlayerData> 
}) => {
  const playerRefsMap = useRef<Record<string, React.RefObject<RemotePlayerMethods>>>({});
  const [playerList, setPlayerList] = useState<string[]>([]);
  
  // Store initial positions/rotations for each player to prevent remounting on updates
  const initialValuesRef = useRef<Record<string, {
    position: [number, number, number], 
    rotation: [number, number, number, number]
  }>>({});

  // Create refs for new players without re-rendering
  // This effect handles adding new refs and updating player list
  useEffect(() => {
    // Find players that don't have refs yet
    const playerIds = Object.keys(players);
    const updatedRefs = {...playerRefsMap.current};
    let refsChanged = false;
    
    // Create refs for new players and store their initial values
    playerIds.forEach(id => {
      if (!updatedRefs[id]) {
        console.log(`Creating ref for new player: ${id}`);
        updatedRefs[id] = React.createRef<RemotePlayerMethods>();
        
        // Store initial position/rotation values
        initialValuesRef.current[id] = {
          position: [...players[id].position],
          rotation: [...players[id].rotation]
        };
        
        refsChanged = true;
      }
    });
    
    // Clean up removed players
    Object.keys(updatedRefs).forEach(id => {
      if (!playerIds.includes(id)) {
        console.log(`Removing ref for departed player: ${id}`);
        delete updatedRefs[id];
        delete initialValuesRef.current[id];
        refsChanged = true;
      }
    });
    
    // Only update refs if they've changed
    if (refsChanged) {
      playerRefsMap.current = updatedRefs;
    }
    
    // Update player list only when players are added/removed (not on position changes)
    const newPlayerIds = Object.keys(players);
    if (JSON.stringify(newPlayerIds.sort()) !== JSON.stringify(playerList.sort())) {
      console.log('Player list changed, updating component list');
      setPlayerList(newPlayerIds);
    }
  }, [players, playerList]);
  
  // Direct updates to the player refs
  // This effect runs on every update but doesn't trigger re-renders
  useEffect(() => {
    let animationId: number;
    
    const updatePlayerPositions = () => {
      // Only update existing players (avoid errors)
      Object.entries(players).forEach(([id, data]) => {
        const ref = playerRefsMap.current[id];
        if (ref && ref.current) {
          // Update via ref instead of re-rendering
          ref.current.updateTransform(data.position, data.rotation);
        }
      });
      
      // Continue updates on next frame
      animationId = requestAnimationFrame(updatePlayerPositions);
    };
    
    // Start the update loop
    animationId = requestAnimationFrame(updatePlayerPositions);
    
    // Clean up animation frame on unmount or when deps change
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [players]); // This dependency still triggers effect runs but not re-renders
  
  // Reduce debug logging frequency
  const renderCount = useRef(0);
  renderCount.current++;
  if (renderCount.current % 10 === 1) {
    console.log(`RemotePlayers rendering #${renderCount.current} with ${playerList.length} players`);
  }
  
  return (
    <>
      {playerList.map(id => {
        // Only return null if we don't have initial values yet
        if (!initialValuesRef.current[id]) return null;
        
        // Use stable initial values to prevent remounting
        return (
          <RemotePlayer
            key={id}
            id={id}
            initialPosition={initialValuesRef.current[id].position}
            initialRotation={initialValuesRef.current[id].rotation}
            ref={playerRefsMap.current[id]}
          />
        );
      })}
    </>
  );
});

// Export main MultiplayerManager component
export const MultiplayerManager: React.FC<{ 
  localPlayerRef: React.RefObject<any>,
  connectionManager: ConnectionManager
}> = ({ localPlayerRef, connectionManager }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [remotePlayers, setRemotePlayers] = useState<Record<string, RemotePlayerData>>({});
  
  // For rate limiting player updates
  const playerUpdateThrottleRef = useRef<Record<string, { lastTime: number, minInterval: number }>>({});
  
  // Track last position/update time
  const lastSentPosition = useRef<[number, number, number] | null>(null);
  const lastUpdateTime = useRef<number>(0);
  const nextSequence = useRef<number>(0);
  
  const { camera } = useThree(); // Get the camera from useThree hook outside of the effect
  
  // Set up connection and event handlers
  useEffect(() => {
    console.log('Setting up multiplayer connection...');
    
    // Connection events
    connectionManager.on('connected', () => {
      console.log('Connected to multiplayer server');
      // Don't set isConnected here, wait for auth & session join
    });
    
    connectionManager.on('disconnected', () => {
      console.log('Disconnected from multiplayer server');
      setIsConnected(false);
    });
    
    connectionManager.on('initialized', (data: any) => {
      console.log('Initialized with ID:', data.id);
      setPlayerId(data.id);
      // Don't set isConnected here, wait for session join confirmation
    });

    // Add specific handler for join_success
    connectionManager.on('message_received', (message: any) => {
      if (message.type === 'join_success') {
        console.log('Successfully joined session:', message.session?.id);
        setIsConnected(true);
      }
    });
    
    // Connect to the server
    connectionManager.connect();
    
    // Add a debug log to check connection status after 5 seconds
    setTimeout(() => {
      console.log("🔍 MULTIPLAYER CONNECTION STATUS (after 5s):");
      console.log("- IsConnected:", isConnected);
      console.log("- PlayerId:", playerId);
      console.log("- Remote players:", Object.keys(remotePlayers).length);
      console.log("- Server URL:", connectionManager.getServerUrl());
      console.log("- Socket state:", connectionManager.socket?.readyState || "NO_SOCKET");
      
      // Try to reestablish connection if needed
      if (!isConnected && connectionManager.socket?.readyState !== WebSocket.OPEN) {
        console.log("Attempting to reconnect...");
        connectionManager.connect();
      }
    }, 5000);
    
    return () => {
      console.log('Cleaning up multiplayer connection...');
      // Ensure we disconnect properly when component unmounts
      connectionManager.disconnect();
      // Remove specific message handler
      connectionManager.off('message_received', (message: any) => {});
      // Reset states on unmount
      setIsConnected(false);
      setPlayerId(null);
      setRemotePlayers({});
    };
  }, [connectionManager]);
  
  // Track remote players
  useEffect(() => {
    if (!connectionManager) return;
    
    console.log("⚡ Setting up remote player tracking in MultiplayerManager");
    
    const handlePlayerJoined = (data: any) => {
      console.log("➕ Player joined:", data);
      
      setRemotePlayers(prev => {
        // Skip if player already exists
        if (prev[data.id]) {
          console.log(`Player ${data.id} already exists in our list`);
          return prev;
        }
        
        console.log(`Adding new remote player: ${data.id}`);
        
        // Add the new player with their initial state
        return {
          ...prev,
          [data.id]: {
            id: data.id,
            position: data.state?.position || [0, 1, 0],
            rotation: data.state?.rotation || [0, 0, 0, 1],
            lastUpdate: Date.now()
          }
        };
      });
    };
    
    const handlePlayerLeft = (data: any) => {
      console.log("➖ Player left:", data);
      
      // Also clean up rate limiting data for this player
      if (playerUpdateThrottleRef.current[data.id]) {
        delete playerUpdateThrottleRef.current[data.id];
      }
      
      setRemotePlayers(prev => {
        if (!prev[data.id]) {
          return prev;
        }
        
        // Create a new object without this player
        const newPlayers = { ...prev };
        delete newPlayers[data.id];
        return newPlayers;
      });
    };
    
    const handlePlayerUpdate = (data: any) => {
      // Skip updates from ourselves
      if (data.id === connectionManager.getPlayerId()) {
        return;
      }
      
      // Debug logging every 60 updates
      if (Math.random() < 0.02) {
        console.log(`📡 Remote player update for ${data.id}:`, {
          position: data.position,
          rotation: data.rotation
        });
      }
      
      // Apply rate limiting for updates - throttle incoming messages
      if (!playerUpdateThrottleRef.current[data.id]) {
        playerUpdateThrottleRef.current[data.id] = { 
          lastTime: 0, 
          minInterval: 50 // 50ms = max 20 updates/second per player
        };
      }
      
      const now = Date.now();
      const playerThrottle = playerUpdateThrottleRef.current[data.id];
      const timeSinceLastUpdate = now - playerThrottle.lastTime;
      
      // Skip this update if we're getting them too frequently
      if (timeSinceLastUpdate < playerThrottle.minInterval) {
        return;
      }
      
      // Update the last update time
      playerThrottle.lastTime = now;
      
      setRemotePlayers(prev => {
        // If we don't have this player yet, add them
        if (!prev[data.id]) {
          console.log(`Adding player ${data.id} from update - wasn't in our list`);
          return {
            ...prev,
            [data.id]: {
              id: data.id,
              position: data.position,
              rotation: data.rotation,
              lastUpdate: Date.now()
            }
          };
        }
        
        // Update existing player
        return {
          ...prev,
          [data.id]: {
            ...prev[data.id],
            position: data.position,
            rotation: data.rotation,
            lastUpdate: Date.now()
          }
        };
      });
    };
    
    // Register event handlers
    connectionManager.on('player_joined', handlePlayerJoined);
    connectionManager.on('player_left', handlePlayerLeft);
    connectionManager.on('player_update', handlePlayerUpdate);
    
    // When connected, request the player list to make sure we have everyone
    const handleConnected = () => {
      console.log("🔌 Connected to multiplayer server - requesting player list");
      
      // Only send player list request if not using the staging server
      if (connectionManager.isReadyToSend() && !connectionManager.getServerUrl().includes('staging.games.bonsai.so')) {
        connectionManager.sendMessage({
          type: 'request_player_list'
        });
      } else {
        console.log('Skipping request_player_list for staging server - not supported');
      }
    };
    
    connectionManager.on('connected', handleConnected);
    
    // Also request player list when initialized
    const handleInitialized = () => {
      console.log("🔌 Initialized connection - requesting player list");
      
      // Wait a second before requesting the player list
      setTimeout(() => {
        // Only send player list request if not using the staging server
        if (connectionManager.isReadyToSend() && !connectionManager.getServerUrl().includes('staging.games.bonsai.so')) {
          connectionManager.sendMessage({
            type: 'request_player_list'
          });
        } else {
          console.log('Skipping request_player_list for staging server - not supported');
        }
      }, 1000);
    };
    
    connectionManager.on('initialized', handleInitialized);
    
    // Request player list immediately if we're already connected
    if (connectionManager.isReadyToSend() && !connectionManager.getServerUrl().includes('staging.games.bonsai.so')) {
      console.log("Already connected - requesting player list");
      connectionManager.sendMessage({
        type: 'request_player_list'
      });
    } else if (connectionManager.isReadyToSend()) {
      console.log('Skipping request_player_list for staging server - not supported');
    }
    
    // When component unmounts
    return () => {
      connectionManager.off('player_joined', handlePlayerJoined);
      connectionManager.off('player_left', handlePlayerLeft);
      connectionManager.off('player_update', handlePlayerUpdate);
      connectionManager.off('connected', handleConnected);
      connectionManager.off('initialized', handleInitialized);
    };
  }, [connectionManager]);
  
  // Set up position update interval
  useEffect(() => {
    if (!connectionManager || !localPlayerRef.current || connectionManager.isOfflineMode()) {
      return;
    }
    
    console.log('Starting position update interval');
    
    // Store the last sent rotation to detect changes
    const lastSentRotation = {
      x: 0,
      y: 0,
      z: 0,
      w: 0
    };
    
    // Create a throttle mechanism to avoid sending too many updates
    let lastRotationUpdateTime = 0;
    const MIN_ROTATION_UPDATE_INTERVAL = 500; // Increased from 250ms to 500ms - much less frequent
    
    // Track rotation stability
    let isRotationStable = true;
    let lastRotationCheckTime = 0;
    const rotationHistory: Array<[number, number, number, number]> = [];
    
    // Send position updates
    const intervalId = setInterval(() => {
      if (!localPlayerRef.current || !connectionManager.isReadyToSend()) {
        return;
      }

      let position, rotation, velocity;
      
      // Get camera rotation - critical source of player orientation
      // We get a clean, normalized copy of the camera quaternion
      // First we get a fresh copy to avoid reusing mutated quaternions
      rotation = camera.quaternion.clone();
      
      // Ensure it's normalized to prevent drift issues
      rotation.normalize();
      
      // Debug - log actual camera rotation values occasionally 
      if (Math.random() < 0.001) {
        console.log("CAMERA ROTATION ACTUAL:", 
          [rotation.x, rotation.y, rotation.z, rotation.w]);
      }
      
      // Get position data
      if (localPlayerRef.current.body && typeof localPlayerRef.current.body.translation === 'function') {
        position = localPlayerRef.current.body.translation();
        velocity = localPlayerRef.current.body.linvel();
      } else if (localPlayerRef.current.rigidBody && typeof localPlayerRef.current.rigidBody.translation === 'function') {
        position = localPlayerRef.current.rigidBody.translation();
        velocity = localPlayerRef.current.rigidBody.linvel();
      } else if (localPlayerRef.current.position && localPlayerRef.current.position.x !== undefined) {
        position = localPlayerRef.current.position;
      }
      
      if (!position || position.x === undefined || !rotation || rotation.x === undefined) {
        return;
      }
      
      // Track rotation history for stability detection
      const now = Date.now();
      if (now - lastRotationCheckTime > 100) { // Check every 100ms
        rotationHistory.push([rotation.x, rotation.y, rotation.z, rotation.w]);
        if (rotationHistory.length > 5) {
          rotationHistory.shift(); // Keep last 5 rotations
        }
        
        // Calculate rotation stability by comparing recent rotations
        if (rotationHistory.length >= 3) {
          let totalDelta = 0;
          for (let i = 1; i < rotationHistory.length; i++) {
            const prev = rotationHistory[i-1];
            const curr = rotationHistory[i];
            const dotProduct = 
              prev[0] * curr[0] + 
              prev[1] * curr[1] + 
              prev[2] * curr[2] + 
              prev[3] * curr[3];
            totalDelta += Math.abs(1 - Math.abs(dotProduct));
          }
          // Average change between recent rotations
          const avgChange = totalDelta / (rotationHistory.length - 1);
          // Mark as stable if changes are very small
          isRotationStable = avgChange < 0.01;
        }
        
        lastRotationCheckTime = now;
      }
      
      // Position change detection - threshold of 5cm
      const lastPos = lastSentPosition.current;
      const posChanged = !lastPos || 
        Math.abs(position.x - lastPos[0]) > 0.05 || 
        Math.abs(position.y - lastPos[1]) > 0.05 || 
        Math.abs(position.z - lastPos[2]) > 0.05;
      
      // Rotation change detection - more strict (3% threshold)
      // Higher threshold means we send fewer rotation updates
      const rotationChanged = 
        Math.abs(rotation.x - lastSentRotation.x) > 0.03 || 
        Math.abs(rotation.y - lastSentRotation.y) > 0.03 || 
        Math.abs(rotation.z - lastSentRotation.z) > 0.03 || 
        Math.abs(rotation.w - lastSentRotation.w) > 0.03;
      
      // Force update minimum every 3 seconds (increased from 2 seconds)
      const timeSinceLastUpdate = now - (lastUpdateTime.current || 0);
      const shouldSendForTime = timeSinceLastUpdate > 3000;
      
      // Check if enough time has passed since last rotation update
      const timeSinceLastRotation = now - lastRotationUpdateTime;
      const canSendRotationUpdate = timeSinceLastRotation > MIN_ROTATION_UPDATE_INTERVAL;
      
      // Send update if one of these is true:
      // 1. Position changed significantly, OR
      // 2. Rotation changed AND enough time passed AND player rotation is stable, OR
      // 3. It's been too long since last update
      if (posChanged || 
          (rotationChanged && canSendRotationUpdate && isRotationStable) || 
          shouldSendForTime) {
        
        // Create update data
        const updateData: PlayerUpdateData = {
          position: [position.x, position.y, position.z],
          rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
          sequence: nextSequence.current++
        };
        
        // Add velocity
        if (velocity) {
          updateData.velocity = [velocity.x, velocity.y, velocity.z];
        }
        
        // Send to server
        connectionManager.sendPlayerUpdate(updateData);
        
        // Update tracking variables
        lastSentPosition.current = [position.x, position.y, position.z];
        lastSentRotation.x = rotation.x;
        lastSentRotation.y = rotation.y;
        lastSentRotation.z = rotation.z;
        lastSentRotation.w = rotation.w;
        lastUpdateTime.current = now;
        
        // If rotation changed, update rotation timestamp
        if (rotationChanged) {
          lastRotationUpdateTime = now;
          if (Math.random() < 0.05) {
            console.log("Sent rotation update (stable:", isRotationStable, "):", 
              [rotation.x, rotation.y, rotation.z, rotation.w]);
          }
        }
      }
    }, 50); // Increased from 30ms to 50ms (20fps instead of 33fps) - less network traffic
    
    return () => {
      clearInterval(intervalId);
      console.log('Cleared position update interval');
    };
  }, [connectionManager, localPlayerRef, camera]);

  // Render remote players
  return (
    <>
      <RemotePlayers players={remotePlayers} />
    </>
  );
};

// Remote shots hook for use in the sphere tool component
export const useRemoteShots = (connectionManager: ConnectionManager) => {
  const [shots, setShots] = useState<RemoteShot[]>([]);
  const processedShots = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    if (!connectionManager) return;
    
    console.log('Setting up remote shots listener on connection manager:', connectionManager);
    
    // Create a handler for shots from other players
    const handleShot = (shotData: any) => {
      console.log('Remote shot received:', shotData);
      
      // Skip if we've already processed this shot
      if (!shotData.shotId || processedShots.current.has(shotData.shotId)) {
        console.log('Shot already processed, skipping:', shotData.shotId);
        return;
      }
      
      // Add to processed shots to prevent duplicates
      processedShots.current.add(shotData.shotId);
      console.log('Adding shot to processed shots, new size:', processedShots.current.size);
      
      // Note: RemoteShot only requires id, origin, and direction properties
      const remoteShot: RemoteShot = {
        id: shotData.id || 'unknown',
        origin: shotData.origin || shotData.position || [0, 0, 0],
        direction: shotData.direction || [0, 1, 0]
      };
      
      // Add the shot to our state
      setShots(prev => [...prev, remoteShot]);
    };
    
    // Setup cross-browser communication for shots
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'jackalopes_shot_events' && e.newValue) {
        try {
          const shotData = JSON.parse(e.newValue);
          console.log('Shot received from localStorage:', shotData);
          handleShot(shotData);
        } catch (error) {
          console.error('Error processing shot from localStorage:', error);
        }
      }
    };
    
    // Listen for shots from the connection manager
    connectionManager.on('player_shoot', handleShot);
    
    // Also listen for shots from localStorage (cross-browser testing)
    window.addEventListener('storage', handleStorageEvent);
    
    // Make the localStorage broadcast function available globally
    window.__shotBroadcast = (shotData: any) => {
      console.log('Shot broadcasted to localStorage:', shotData);
      localStorage.setItem('jackalopes_shot_events', JSON.stringify(shotData));
      
      // Also process it locally for the current window
      handleShot(shotData);
    };
    
    // Set up a function for sending test shots directly
    // This allows testing without the server connection
    const sendTestShot = () => {
      const testShotData = {
        id: 'test-player',
        shotId: 'test-player-0,0,0-0,1,0',
        origin: [0, 0, 0],
        direction: [0, 1, 0],
        timestamp: Date.now()
      };
      
      console.log('Sending test shot directly to useRemoteShots hook');
      handleShot(testShotData);
    };
    
    // Add the test function to the window for debugging
    window.__sendTestShot = sendTestShot;
    
    // Clean up on unmount
    return () => {
      console.log('Cleaning up remote shots listener');
      connectionManager.off('player_shoot', handleShot);
      window.removeEventListener('storage', handleStorageEvent);
      
      // Clean up global functions
      delete window.__shotBroadcast;
      delete window.__sendTestShot;
    };
  }, [connectionManager]);
  
  return shots;
}; 