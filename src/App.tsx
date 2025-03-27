import { Canvas } from './common/components/canvas'
import { Crosshair } from './common/components/crosshair'
import { Instructions } from './common/components/instructions'
import { useLoadingAssets } from './common/hooks/use-loading-assets'
import { Environment, MeshReflectorMaterial, PerspectiveCamera, OrbitControls } from '@react-three/drei'
import { EffectComposer, Vignette, ChromaticAberration, BrightnessContrast, ToneMapping } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { useFrame, useThree } from '@react-three/fiber'
import { CuboidCollider, Physics, RigidBody } from '@react-three/rapier'
import { useControls, folder } from 'leva'
import { useTexture } from '@react-three/drei'
import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { Player, PlayerControls } from './game/player'
import { Jackalope } from './game/jackalope'
import { Ball } from './game/ball'
import { SphereTool } from './game/sphere-tool'
import { Platforms } from './game/platforms'
import { MultiplayerManager, useRemoteShots } from './network/MultiplayerManager'
import { NetworkStats } from './network/NetworkStats'
import { ConnectionManager } from './network/ConnectionManager'
import { ConnectionTest } from './components/ConnectionTest'
import { VirtualGamepad } from './components/VirtualGamepad'

// Add Moon component
const Moon = ({ orbitRadius, height, orbitSpeed }: { orbitRadius: number, height: number, orbitSpeed: number }) => {
    const moonRef = useRef<THREE.Group>(null);
    const angle = useRef(0);
    
    // Create moon light
    const moonLightRef = useRef<THREE.PointLight>(null);
    
    useFrame(() => {
        if (!moonRef.current || !moonLightRef.current) return;
        
        // Increment angle for orbit - significantly slower
        angle.current += orbitSpeed * 0.005;
        
        // Calculate moon position in orbit around the center of the level
        // Using an elliptical orbit to spread on the x-axis
        const xRadius = orbitRadius * 2.5; // Make x-axis much wider for longer shadows
        const zRadius = orbitRadius * 1.2; // Also increase z-radius for more distance
        const x = Math.sin(angle.current) * xRadius;
        const z = Math.cos(angle.current) * zRadius;
        
        // Set moon position
        moonRef.current.position.set(x, height, z);
        
        // Light follows moon with slight offset to avoid z-fighting
        moonLightRef.current.position.set(x, height - 2, z);
    });
    
    // Simplified glow effect with fewer layers for better performance
    const createGlowEffect = () => {
        return (
            <>
                {/* Core moon */}
                <mesh castShadow>
                    <sphereGeometry args={[4, 24, 24]} />
                    <meshStandardMaterial 
                        color="#ffffff" 
                        emissive="#ffffff" 
                        emissiveIntensity={2.5} 
                    />
                </mesh>
                
                {/* Single outer glow layer for better performance */}
                <mesh>
                    <sphereGeometry args={[6, 24, 24]} />
                    <meshBasicMaterial 
                        color="#f0f8ff" 
                        transparent={true} 
                        opacity={0.3}
                    />
                </mesh>
            </>
        );
    };
    
    return (
        <>
            {/* Moon with glow effect */}
            <group ref={moonRef} position={[orbitRadius, height, 0]}>
                {createGlowEffect()}
            </group>
            
            {/* Moon light */}
            <pointLight 
                ref={moonLightRef}
                position={[orbitRadius, height - 2, 0]}
                intensity={9}
                color="#f0f8ff"
                distance={400}
                decay={1.5} // Lower decay for harder shadows (less falloff)
                castShadow
                shadow-mapSize={[2048, 2048]} // Reduced from 4096 for better performance
                shadow-bias={-0.001}
                shadow-camera-near={1}
                shadow-camera-far={150}
                shadow-radius={1} // Smaller shadow radius for harder edges
            />
        </>
    );
};

const Scene = ({ playerRef }: { playerRef: React.RefObject<any> }) => {
    const texture = useTexture('/final-texture.png')
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    
    // Ground texture (50x50)
    const groundTexture = texture.clone()
    groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping
    groundTexture.repeat.set(12, 12) // 12 repeats to match ground size
    
    // Side walls texture (2x4)
    const sideWallTexture = texture.clone()
    sideWallTexture.wrapS = sideWallTexture.wrapT = THREE.RepeatWrapping
    sideWallTexture.repeat.set(12, 1) // 12 repeats horizontally to match wall length
    
    // Front/back walls texture (50x4)
    const frontWallTexture = texture.clone()
    frontWallTexture.wrapS = frontWallTexture.wrapT = THREE.RepeatWrapping
    frontWallTexture.repeat.set(12, 1) // 12 repeats horizontally to match wall width

    return (
        <RigidBody type="fixed" position={[0, 0, 0]} colliders={false}>
            {/* Ground collider */}
            <CuboidCollider args={[25, 0.1, 25]} position={[0, -0.1, 0]} />
            
            {/* Wall colliders */}
            <CuboidCollider position={[25, 2, 0]} args={[1, 2, 25]} />
            <CuboidCollider position={[-25, 2, 0]} args={[1, 2, 25]} />
            <CuboidCollider position={[0, 2, 25]} args={[25, 2, 1]} />
            <CuboidCollider position={[0, 2, -25]} args={[25, 2, 1]} />
            
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                <planeGeometry args={[50, 50]} />
                <MeshReflectorMaterial
                    map={groundTexture}
                    mirror={0}
                    roughness={1}
                    depthScale={0}
                    minDepthThreshold={0.9}
                    maxDepthThreshold={1}
                    metalness={0}
                />
            </mesh>
            
            {/* Border walls */}
            <mesh position={[25, 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[2, 4, 50]} />
                <meshStandardMaterial map={sideWallTexture} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[-25, 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[2, 4, 50]} />
                <meshStandardMaterial map={sideWallTexture} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 2, 25]} castShadow receiveShadow>
                <boxGeometry args={[50, 4, 2]} />
                <meshStandardMaterial map={frontWallTexture} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 2, -25]} castShadow receiveShadow>
                <boxGeometry args={[50, 4, 2]} />
                <meshStandardMaterial map={frontWallTexture} side={THREE.DoubleSide} />
            </mesh>
        </RigidBody>
    )
}

const SnapshotDebugOverlay = ({ 
  snapshots,
  getSnapshotAtTime
}: { 
  snapshots: any[],
  getSnapshotAtTime: (timestamp: number) => any
}) => {
  const [expanded, setExpanded] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<any>(null);
  
  // Update selected snapshot when snapshots change
  useEffect(() => {
    if (snapshots.length > 0 && !selectedSnapshot) {
      setSelectedSnapshot(snapshots[snapshots.length - 1]);
    }
  }, [snapshots, selectedSnapshot]);
  
  if (!snapshots || snapshots.length === 0) return null;
  
  return (
    <div style={{
      position: 'absolute',
      bottom: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.7)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      fontFamily: 'monospace',
      width: expanded ? '400px' : '200px',
      zIndex: 1000,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '8px',
        borderBottom: '1px solid #555',
        paddingBottom: '4px'
      }}>
        <h3 style={{margin: 0}}>Snapshot System</h3>
        <button 
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      <div>Snapshots: {snapshots.length}</div>
      {expanded && snapshots.length > 0 && (
        <>
          <div style={{marginTop: '8px'}}>
            <div>Latest Snapshot:</div>
            <div>Time: {new Date(snapshots[snapshots.length - 1].timestamp).toISOString().substr(11, 8)}</div>
            <div>Seq: {snapshots[snapshots.length - 1].sequence}</div>
            <div>Players: {Object.keys(snapshots[snapshots.length - 1].players).length}</div>
            <div>Events: {snapshots[snapshots.length - 1].events?.length || 0}</div>
          </div>
          
          {selectedSnapshot && (
            <div style={{
              marginTop: '8px',
              padding: '8px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '4px'
            }}>
              <div>Selected Snapshot:</div>
              <div>Time: {new Date(selectedSnapshot.timestamp).toISOString().substr(11, 8)}</div>
              <div>Sequence: {selectedSnapshot.sequence}</div>
              <div>
                Players: {Object.keys(selectedSnapshot.players).map(id => (
                  <div key={id} style={{paddingLeft: '8px', fontSize: '10px'}}>
                    {id}: {JSON.stringify(selectedSnapshot.players[id].position).substring(0, 20)}...
                  </div>
                ))}
              </div>
              {selectedSnapshot.events && selectedSnapshot.events.length > 0 && (
                <div>
                  Events: {selectedSnapshot.events.map((event: any, i: number) => (
                    <div key={i} style={{paddingLeft: '8px', fontSize: '10px'}}>
                      {event.type}: {event.timestamp}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          <div style={{marginTop: '8px'}}>
            <div>Timeline:</div>
            <div style={{
              height: '20px',
              background: '#333',
              position: 'relative',
              borderRadius: '4px',
              marginTop: '4px'
            }}>
              {snapshots.map((snapshot, i) => {
                // Calculate relative position
                const startTime = snapshots[0].timestamp;
                const endTime = snapshots[snapshots.length - 1].timestamp;
                const range = endTime - startTime;
                const position = range > 0 ? ((snapshot.timestamp - startTime) / range) * 100 : 0;
                
                return (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: `${position}%`,
                      top: '0',
                      width: '2px',
                      height: '100%',
                      background: selectedSnapshot && snapshot.sequence === selectedSnapshot.sequence ? '#ff0' : '#0af',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedSnapshot(snapshot)}
                    title={`Snapshot ${snapshot.sequence} at ${new Date(snapshot.timestamp).toISOString()}`}
                  />
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Add a MultiplayerDebugPanel component for testing
const MultiplayerDebugPanel = ({ 
  connectionManager, 
  visible,
  isOfflineMode
}: { 
  connectionManager: any, 
  visible: boolean,
  isOfflineMode: boolean
}) => {
  // Set to false by default to keep it collapsed
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTestPlayers, setActiveTestPlayers] = useState<string[]>([]);
  
  if (!visible) return null;

  const sendTestShot = () => {
    // Generate a test shot and broadcast it
    const testShot = {
      id: 'test-player',
      shotId: `test-shot-${Date.now()}`,
      origin: [0, 0, 0],
      direction: [0, 1, 0],
      timestamp: Date.now()
    };
    
    // Trigger a shot via connectionManager
    connectionManager.emit('player_shoot', testShot);
    console.log('Manual test shot fired:', testShot);
  };

  const sendUniversalBroadcast = () => {
    // Use the global broadcast function if available
    if (window.__shotBroadcast) {
      const testShot = {
        id: 'broadcast-player',
        shotId: `universal-broadcast-${Date.now()}`,
        origin: [0, 0, 0],
        direction: [0, 1, 0],
        timestamp: Date.now()
      };
      
      // Use our more robust broadcast method
      window.__shotBroadcast(testShot);
    } else {
      // Fallback to simple localStorage method
      const testShot = {
        id: 'broadcast-player',
        shotId: `universal-broadcast-${Date.now()}`,
        origin: [0, 0, 0],
        direction: [0, 1, 0],
        timestamp: Date.now()
      };
      
      // Store in localStorage for cross-browser communication
      localStorage.setItem('jackalopes_shot_events', JSON.stringify(testShot));
      console.log('UNIVERSAL BROADCAST sent (fallback):', testShot);
    }
  };

  const forceOfflineMode = () => {
    console.log('Forcing offline mode...');
    if (connectionManager && connectionManager.forceReady) {
      connectionManager.forceReady();
    }
  };
  
  // Add test player functions
  const addTestPlayer = () => {
    if (connectionManager && connectionManager.addTestPlayer) {
      const testPlayerId = connectionManager.addTestPlayer();
      setActiveTestPlayers(prev => [...prev, testPlayerId]);
      console.log('Added test player:', testPlayerId);
    } else {
      console.warn('Test player functionality not available');
    }
  };
  
  const removeAllTestPlayers = () => {
    if (connectionManager && connectionManager.removeAllTestPlayers) {
      connectionManager.removeAllTestPlayers();
      setActiveTestPlayers([]);
      console.log('Removed all test players');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: isExpanded ? '180px' : '10px', // Move up when expanded
      right: '10px', // Changed from left to right
      backgroundColor: isOfflineMode ? 'rgba(244, 67, 54, 0.8)' : 'rgba(0, 0, 0, 0.7)',
      padding: '10px',
      borderRadius: '4px',
      zIndex: 1000,
      border: isOfflineMode ? '1px solid #ff8a80' : 'none',
    }}>
      <div style={{ 
        fontSize: '14px', 
        color: 'white', 
        marginBottom: '10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>
          {isOfflineMode ? '🔴 OFFLINE MODE' : 'Multiplayer Tools'}
        </span>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            backgroundColor: '#333',
            color: 'white',
            border: 'none',
            padding: '3px 6px',
            borderRadius: '2px',
            fontSize: '10px',
            cursor: 'pointer',
          }}
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={sendTestShot}
          style={{
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          TEST SHOT
        </button>
        <button
          onClick={sendUniversalBroadcast}
          style={{
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          UNIVERSAL BROADCAST
        </button>
        <button
          onClick={forceOfflineMode}
          style={{
            backgroundColor: isOfflineMode ? '#666' : '#FF5722',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
            opacity: isOfflineMode ? 0.7 : 1,
          }}
          disabled={isOfflineMode}
        >
          {isOfflineMode ? 'ALREADY OFFLINE' : 'FORCE OFFLINE MODE'}
        </button>
        
        {/* Add test player controls */}
        <button
          onClick={addTestPlayer}
          style={{
            backgroundColor: '#9C27B0',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ADD TEST PLAYER
        </button>
        <button
          onClick={removeAllTestPlayers}
          style={{
            backgroundColor: '#F44336',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
            opacity: activeTestPlayers.length === 0 ? 0.7 : 1,
          }}
          disabled={activeTestPlayers.length === 0}
        >
          {activeTestPlayers.length ? `REMOVE TEST PLAYERS (${activeTestPlayers.length})` : 'NO TEST PLAYERS'}
        </button>
      </div>
      
      {isExpanded && (
        <div style={{
          marginTop: '10px',
          fontSize: '12px',
          color: 'white',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          padding: '8px',
          borderRadius: '4px',
        }}>
          <p style={{ margin: '5px 0' }}>
            <strong>Connection Status:</strong> {connectionManager.isReadyToSend() ? 'Ready' : 'Not Ready'}
          </p>
          <p style={{ margin: '5px 0' }}>
            <strong>Socket State:</strong> {connectionManager.getSocketState?.() || 'Unknown'}
          </p>
          <p style={{ margin: '5px 0' }}>
            <strong>Player ID:</strong> {connectionManager.getPlayerId?.() || 'None'}
          </p>
          <p style={{ margin: '5px 0' }}>
            <strong>Offline Mode:</strong> {isOfflineMode ? 'Yes' : 'No'}
          </p>
          <p style={{ margin: '5px 0' }}>
            <strong>Test Players:</strong> {activeTestPlayers.length ? activeTestPlayers.join(', ') : 'None'}
          </p>
        </div>
      )}
    </div>
  );
};

// Simplified ThirdPersonCameraControls component without OrbitControls
const ThirdPersonCameraControls = ({ 
    player, 
    cameraRef,
    enabled,
    distance,
    height,
    invertY = false, // Add invert Y option with default = false
}: { 
    player: THREE.Vector3, 
    cameraRef: React.RefObject<THREE.PerspectiveCamera>,
    enabled: boolean,
    distance: number,
    height: number,
    invertY?: boolean,
}) => {
    // For tracking target position and rotation
    const targetRef = useRef(new THREE.Vector3());
    const isInitializedRef = useRef(false);
    const rotationRef = useRef({ x: 0, y: 0 });
    const pointerLockActiveRef = useRef(false);
    const lastMouseRef = useRef({ x: 0, y: 0 });
    
    // Set up initial camera position based on player position
    useEffect(() => {
        if (!cameraRef.current || !enabled) return;
        
        // Make sure player position is valid
        if (!(player instanceof THREE.Vector3)) {
            console.error("Player position is not a Vector3:", player);
            return;
        }
        
        // Initialize position and target only once
        if (!isInitializedRef.current) {
            console.log("Initializing simplified third-person camera");
            
            // Initialize target position
            targetRef.current.copy(player);
            
            // Initialize camera position directly behind player
            const cameraPos = new THREE.Vector3().copy(player);
            cameraPos.y += height;
            cameraPos.z += distance;
            cameraRef.current.position.copy(cameraPos);
            
            // Look at player
            cameraRef.current.lookAt(player);
            isInitializedRef.current = true;
            
            // Reset rotation
            rotationRef.current = { x: 0, y: 0 };
        }
        
        // Handle pointer lock for fps-style mouse movement
        const requestPointerLock = () => {
            document.body.requestPointerLock();
        };
        
        const handlePointerLockChange = () => {
            pointerLockActiveRef.current = document.pointerLockElement === document.body;
            console.log("Pointer lock state:", pointerLockActiveRef.current ? "ACTIVE" : "INACTIVE");
        };
        
        const handleMouseMove = (e: MouseEvent) => {
            if (pointerLockActiveRef.current) {
                // Use movementX/Y for pointer lock (fps style)
                const deltaX = e.movementX;
                const deltaY = e.movementY;
                
                // Update rotation based on mouse movement
                rotationRef.current.y -= deltaX * 0.003; // increased from 0.002 for faster rotation
                
                // Apply Y rotation with or without inversion
                if (invertY) {
                    rotationRef.current.x -= deltaY * 0.003; // increased from 0.002
                } else {
                    rotationRef.current.x += deltaY * 0.003; // increased from 0.002
                }
                
                // Clamp vertical rotation to avoid flipping
                rotationRef.current.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, rotationRef.current.x));
            }
        };
        
        // Set up pointer lock when third person mode is enabled
        if (enabled) {
            // Request pointer lock on first click
            document.addEventListener('click', requestPointerLock);
            document.addEventListener('pointerlockchange', handlePointerLockChange);
            document.addEventListener('mousemove', handleMouseMove);
            
            // Request pointer lock immediately if it's not active yet
            if (!pointerLockActiveRef.current) {
                document.body.requestPointerLock();
            }
        }
        
        // Clean up
        return () => {
            console.log("Cleaning up simplified third-person camera");
            document.removeEventListener('click', requestPointerLock);
            document.removeEventListener('pointerlockchange', handlePointerLockChange);
            document.removeEventListener('mousemove', handleMouseMove);
            
            // Exit pointer lock when component unmounts
            if (pointerLockActiveRef.current && document.exitPointerLock) {
                document.exitPointerLock();
            }
        };
    }, [enabled, player, cameraRef, distance, height, invertY]);
    
    // Reset initialization when disabled
    useEffect(() => {
        if (!enabled) {
            isInitializedRef.current = false;
            
            // Exit pointer lock when disabled
            if (pointerLockActiveRef.current && document.exitPointerLock) {
                document.exitPointerLock();
                pointerLockActiveRef.current = false;
            }
        }
    }, [enabled]);
    
    // Use frame loop to update the camera smoothly
    useFrame(() => {
        if (!enabled || !cameraRef.current) return;
        
        try {
            // Only update with valid player position
            if (player instanceof THREE.Vector3 && !Number.isNaN(player.x) && 
                !Number.isNaN(player.y) && !Number.isNaN(player.z)) {
                
                // Very slow interpolation for target position
                targetRef.current.lerp(player, 0.1);
                
                // Calculate camera position based on rotation around target
                const cameraOffset = new THREE.Vector3(
                    Math.sin(rotationRef.current.y) * distance,
                    height + Math.sin(rotationRef.current.x) * distance,
                    Math.cos(rotationRef.current.y) * distance
                );
                
                // Position camera relative to target with faster response
                cameraRef.current.position.copy(targetRef.current).add(cameraOffset);
                
                // Look at player
                cameraRef.current.lookAt(targetRef.current);
            }
        } catch (error) {
            console.error("Error in ThirdPersonCameraControls frame update:", error);
        }
    });
    
    return null; // No need to render any elements
};

export function App() {
    const loading = useLoadingAssets()
    const directionalLightRef = useRef<THREE.DirectionalLight>(null)
    
    // Move playerRef to App component scope
    const playerRef = useRef<any>(null);
    // Add a state to track if playerRef is ready
    const [playerRefReady, setPlayerRefReady] = useState(false);
    
    // Add this inside the App component
    const playerPosition = useRef<THREE.Vector3>(new THREE.Vector3(0, 7, 10));
    
    // Create a helper component to handle useFrame inside Canvas
    const PlayerPositionTracker = ({ playerRef, playerPosition }: { 
        playerRef: React.RefObject<any>,
        playerPosition: React.RefObject<THREE.Vector3>
    }) => {
        // Store the last valid position to avoid jumps
        const lastValidPosition = useRef<THREE.Vector3 | null>(null);
        const velocityRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
        const lastUpdateTime = useRef<number>(Date.now());
        const frameCountRef = useRef(0);
        const positionStabilityRef = useRef(new THREE.Vector3());
        const positionHistoryRef = useRef<THREE.Vector3[]>([]);
        const MAX_HISTORY = 5; // Reduced from 10 to 5 for more responsive camera
        
        // This useFrame is now safely inside the Canvas component
        useFrame(() => {
            if (!playerRef.current || !playerRef.current.rigidBody || !playerPosition.current) return;
            
            try {
                const position = playerRef.current.rigidBody.translation();
                const now = Date.now();
                const deltaTime = (now - lastUpdateTime.current) / 1000; // Convert to seconds
                lastUpdateTime.current = now;
                
                // Track frames for stability analysis
                frameCountRef.current++;
                
                // Check if position is valid and not NaN
                if (position && 
                    !Number.isNaN(position.x) && 
                    !Number.isNaN(position.y) && 
                    !Number.isNaN(position.z)) {
                    
                    // First time initialization
                    if (!lastValidPosition.current) {
                        lastValidPosition.current = new THREE.Vector3(position.x, position.y, position.z);
                        playerPosition.current.copy(lastValidPosition.current);
                        positionStabilityRef.current.copy(lastValidPosition.current);
                        
                        // Initialize history with current position
                        for (let i = 0; i < MAX_HISTORY; i++) {
                            positionHistoryRef.current.push(lastValidPosition.current.clone());
                        }
                        return;
                    }
                    
                    // Create a temp vector for the new position
                    const newPosition = new THREE.Vector3(position.x, position.y, position.z);
                    
                    // Calculate velocity for prediction
                    if (deltaTime > 0) {
                        const instantVelocity = new THREE.Vector3()
                            .subVectors(newPosition, lastValidPosition.current)
                            .divideScalar(deltaTime);
                        
                        // Very low lerp factor for super smooth velocity changes
                        velocityRef.current.lerp(instantVelocity, 0.1);
                    }
                    
                    // Check for large jumps (could indicate a glitch)
                    const distance = newPosition.distanceTo(lastValidPosition.current);
                    if (distance > 5) {
                        console.warn("Detected large position jump, smoothing:", distance);
                        // For very large jumps, teleport and reset history
                        if (distance > 10) {
                            playerPosition.current.copy(newPosition);
                            lastValidPosition.current.copy(newPosition);
                            positionStabilityRef.current.copy(newPosition);
                            
                            // Reset history
                            positionHistoryRef.current = [];
                            for (let i = 0; i < MAX_HISTORY; i++) {
                                positionHistoryRef.current.push(newPosition.clone());
                            }
                            console.warn("Teleporting due to extreme position change");
                            return;
                        }
                        
                        // Use stronger lerp to smooth out large jumps
                        newPosition.lerp(lastValidPosition.current, 0.8);
                    }
                    
                    // Add current position to history, removing oldest
                    positionHistoryRef.current.push(newPosition.clone());
                    if (positionHistoryRef.current.length > MAX_HISTORY) {
                        positionHistoryRef.current.shift();
                    }
                    
                    // Use a weighted average of history for super smooth movement
                    const smoothedPosition = new THREE.Vector3();
                    let totalWeight = 0;
                    
                    // More recent positions have higher weight
                    positionHistoryRef.current.forEach((pos, index) => {
                        // Increase weight for recent positions to reduce lag
                        const weight = Math.pow((index + 1) / positionHistoryRef.current.length, 2);
                        totalWeight += weight;
                        smoothedPosition.add(pos.clone().multiplyScalar(weight));
                    });
                    
                    // Normalize by total weight
                    if (totalWeight > 0) {
                        smoothedPosition.divideScalar(totalWeight);
                    }
                    
                    // Apply faster interpolation (0.15 instead of 0.05)
                    const smoothingFactor = Math.min(0.15, deltaTime * 8);
                    playerPosition.current.lerp(smoothedPosition, smoothingFactor);
                    
                    // Update the last valid position
                    lastValidPosition.current.copy(playerPosition.current);
                }
            } catch (error) {
                console.error("Error updating player position reference:", error);
            }
        });
        
        return null; // This component doesn't render anything
    };
    
    // Create a shared ConnectionManager instance with the staging server URL
    const [connectionManager] = useState(() => new ConnectionManager('ws://staging.games.bonsai.so/websocket/'));
    // Add state to track if we're in offline mode
    const [isOfflineMode, setIsOfflineMode] = useState(false);
    // Track if notification is visible
    const [showOfflineNotification, setShowOfflineNotification] = useState(false);
    
    // Add state for the virtual gamepad
    const [showVirtualGamepad, setShowVirtualGamepad] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    
    // Current key state tracking for gamepad
    const currentKeys = useRef<Record<string, boolean>>({
        'w': false, 's': false, 'a': false, 'd': false, ' ': false
    });
    
    // Use a ref to track if shoot is on cooldown
    const shootCooldownRef = useRef(false);
    
    // Detect mobile devices
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    
    // Auto-show gamepad on mobile devices
    useEffect(() => {
        if (isMobile) {
            setShowVirtualGamepad(true);
        }
    }, [isMobile]);
    
    // Use an effect to track when the playerRef becomes available
    useEffect(() => {
        if (playerRef.current && !playerRefReady) {
            setPlayerRefReady(true);
        }
    }, [playerRef.current, playerRefReady]);
    
    // Listen for connection status changes
    useEffect(() => {
        const handleServerUnreachable = () => {
            console.log('App received server_unreachable event, showing notification');
            setIsOfflineMode(true);
            setShowOfflineNotification(true);
            // Auto-hide notification after 7 seconds
            setTimeout(() => setShowOfflineNotification(false), 7000);
        };
        
        const handleConnected = () => {
            setIsOfflineMode(false);
        };
        
        const handleDisconnected = () => {
            // Only consider disconnected if we're not forcing offline mode
            if (!connectionManager.isReadyToSend()) {
                setIsOfflineMode(true);
            }
        };
        
        connectionManager.on('server_unreachable', handleServerUnreachable);
        connectionManager.on('connected', handleConnected);
        connectionManager.on('disconnected', handleDisconnected);
        
        return () => {
            connectionManager.off('server_unreachable', handleServerUnreachable);
            connectionManager.off('connected', handleConnected);
            connectionManager.off('disconnected', handleDisconnected);
        };
    }, [connectionManager]);
    
    // Add multiplayer controls to Leva panel and track its state change
    const { enableMultiplayer } = useControls('Multiplayer', {
        enableMultiplayer: {
            value: true,
            label: 'Enable Connection'
        }
    }, {
        collapsed: false,
        order: 997
    });

    // Set to false initially to hide the panel by default
    const [showMultiplayerTools, setShowMultiplayerTools] = useState(false);
    
    // Use an effect to properly handle multiplayer enabling/disabling with proper cleanup timing
    useEffect(() => {
        let timeoutId: number | null = null;
        let forceReadyTimeoutId: number | null = null;
        
        if (enableMultiplayer) {
            // When enabling, set immediately
            console.log('Multiplayer enabled');
            
            // Add a fallback for connection issues by forcing ready state after 8 seconds (increased from 4)
            forceReadyTimeoutId = setTimeout(() => {
                console.log('Checking if connection is ready, forcing if needed...');
                if (connectionManager && !connectionManager.isReadyToSend()) {
                    console.log('⚠️ Connection not fully established after 8s, forcing ready state for testing');
                    connectionManager.forceReady();
                    setIsOfflineMode(true);
                    setShowOfflineNotification(true);
                    // Auto-hide notification after 5 seconds
                    setTimeout(() => setShowOfflineNotification(false), 5000);
                }
            }, 8000); // Increased from 4000 to 8000ms for slower connections
            
            // Cleanup function to clear both timeouts
            return () => {
                if (timeoutId) {
                    window.clearTimeout(timeoutId);
                }
                if (forceReadyTimeoutId) {
                    clearTimeout(forceReadyTimeoutId);
                }
            };
        } else {
            // When disabling, add a delay to allow for cleanup
            console.log('Disabling multiplayer with cleanup delay...');
            timeoutId = window.setTimeout(() => {
                console.log('Multiplayer disabled after cleanup');
            }, 500); // Half-second delay for proper cleanup
            
            // Cleanup function to clear the timeout
            return () => {
                if (timeoutId) {
                    window.clearTimeout(timeoutId);
                }
                if (forceReadyTimeoutId) {
                    clearTimeout(forceReadyTimeoutId);
                }
            };
        }
    }, [enableMultiplayer, connectionManager]);

    const { 
        walkSpeed,
        runSpeed,
        jumpForce
    } = useControls('Character', {
        walkSpeed: { value: 0.11, min: 0.05, max: 0.2, step: 0.01 },
        runSpeed: { value: 0.15, min: 0.1, max: 0.3, step: 0.01 },
        jumpForce: { value: 0.5, min: 0.3, max: 0.8, step: 0.1 }
    }, {
        collapsed: true,
        order: 998
    })

    const { 
        fogEnabled,
        fogColor,
        fogNear,
        fogFar,
        ambientIntensity,
        directionalIntensity,
        directionalHeight,
        directionalDistance,
        enablePostProcessing,
        vignetteEnabled,
        vignetteOffset,
        vignetteDarkness,
        chromaticAberrationEnabled,
        chromaticAberrationOffset,
        brightnessContrastEnabled,
        brightness,
        contrast,
        colorGradingEnabled,
        toneMapping,
        toneMappingExposure,
        moonOrbit,
        moonOrbitSpeed
    } = useControls({
        fog: folder({
            fogEnabled: true,
            fogColor: '#dbdbdb',
            fogNear: { value: 13, min: 0, max: 50, step: 1 },
            fogFar: { value: 95, min: 0, max: 100, step: 1 }
        }, { collapsed: true }),
        lighting: folder({
            ambientIntensity: { value: 0, min: 0, max: 2, step: 0.1 },
            directionalIntensity: { value: 2.5, min: 0, max: 5, step: 0.1 },
            directionalHeight: { value: 30, min: 5, max: 60, step: 1 }, // Increased height
            directionalDistance: { value: 45, min: 5, max: 70, step: 1 }, // Increased distance
            moonOrbit: { value: true, label: 'Moon Orbits Level' },
            moonOrbitSpeed: { value: 0.01, min: 0.001, max: 0.1, step: 0.001, label: 'Orbit Speed' },
        }, { collapsed: true }),
        postProcessing: folder({
            enablePostProcessing: true,
            vignetteEnabled: true,
            vignetteOffset: { value: 0.5, min: 0, max: 1, step: 0.1 },
            vignetteDarkness: { value: 0.5, min: 0, max: 1, step: 0.1 },
            chromaticAberrationEnabled: true,
            chromaticAberrationOffset: { value: 0.0025, min: 0, max: 0.01, step: 0.0001 },
            brightnessContrastEnabled: true,
            brightness: { value: -0.3, min: -1, max: 1, step: 0.1 },
            contrast: { value: 0, min: -1, max: 1, step: 0.1 },
            colorGradingEnabled: true,
            toneMapping: { 
                value: THREE.ACESFilmicToneMapping,
                options: {
                    'ACESFilmic': THREE.ACESFilmicToneMapping,
                    'Reinhard': THREE.ReinhardToneMapping,
                    'Cineon': THREE.CineonToneMapping,
                    'Linear': THREE.LinearToneMapping
                }
            },
            toneMappingExposure: { value: 1.2, min: 0, max: 2, step: 0.1 }
        }, { collapsed: true })
    }, {
        collapsed: true,
        order: 995
    })

    // Update the Game UI controls to include virtual gamepad toggle
    const { showTools, showConnectionTest, virtualGamepad, thirdPersonView, characterType } = useControls('Game UI', {
        showTools: {
            value: false,
            label: 'Show Multiplayer Tools'
        },
        showConnectionTest: {
            value: false,
            label: 'Show Connection Test UI'
        },
        virtualGamepad: {
            value: false,
            label: 'Virtual Gamepad'
        },
        thirdPersonView: {
            value: false,
            label: 'Third-Person View'
        },
        characterType: {
            value: 'merc',
            label: 'Character Type',
            options: ['merc', 'jackalope']
        },
        logLevel: {
            value: 0,
            label: 'Log Level (0=None, 5=Verbose)',
            min: 0,
            max: 5,
            step: 1,
            onChange: (value) => {
                // Update ConnectionManager log level
                if (connectionManager && connectionManager.setLogLevel) {
                    connectionManager.setLogLevel(value);
                }
            }
        }
    }, {
        collapsed: true,
        order: 996
    });
    
    // Set showMultiplayerTools based on the control panel toggle
    useEffect(() => {
        // Only update the UI visibility, not the connection status
        setShowMultiplayerTools(showTools);
    }, [showTools]);
    
    // Update virtual gamepad visibility based on the control panel toggle
    useEffect(() => {
        setShowVirtualGamepad(virtualGamepad);
    }, [virtualGamepad]);
    
    // Handle virtual gamepad inputs
    const handleVirtualMove = (x: number, y: number) => {
        // Map virtual joystick to keyboard events for WASD movement
        // Forward/backward (W/S) mapped to Y axis
        const forwardKey = y < -0.3 ? 'w' : null;
        const backwardKey = y > 0.3 ? 's' : null;
        
        // Left/right (A/D) mapped to X axis
        const leftKey = x < -0.3 ? 'a' : null;
        const rightKey = x > 0.3 ? 'd' : null;
        
        // Helper to update key states
        const updateKey = (key: string | null, isPressed: boolean) => {
            if (!key) {
                // Release all keys that might be in this direction
                if (key === forwardKey) {
                    if (currentKeys.current['w']) {
                        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', bubbles: true }));
                        currentKeys.current['w'] = false;
                    }
                } else if (key === backwardKey) {
                    if (currentKeys.current['s']) {
                        window.dispatchEvent(new KeyboardEvent('keyup', { key: 's', bubbles: true }));
                        currentKeys.current['s'] = false;
                    }
                } else if (key === leftKey) {
                    if (currentKeys.current['a']) {
                        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));
                        currentKeys.current['a'] = false;
                    }
                } else if (key === rightKey) {
                    if (currentKeys.current['d']) {
                        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd', bubbles: true }));
                        currentKeys.current['d'] = false;
                    }
                }
                return;
            }
            
            // Only send event if the state changed
            if (isPressed && !currentKeys.current[key]) {
                // Dispatch keydown event
                window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
                currentKeys.current[key] = true;
            } else if (!isPressed && currentKeys.current[key]) {
                // Dispatch keyup event
                window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
                currentKeys.current[key] = false;
            }
        };
        
        // Update WASD keys based on joystick position
        updateKey('w', !!forwardKey);
        updateKey('s', !!backwardKey);
        updateKey('a', !!leftKey);
        updateKey('d', !!rightKey);
        
        // If joystick is released (x and y are 0), release all keys
        if (Math.abs(x) < 0.1 && Math.abs(y) < 0.1) {
            if (currentKeys.current['w']) {
                window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', bubbles: true }));
                currentKeys.current['w'] = false;
            }
            if (currentKeys.current['s']) {
                window.dispatchEvent(new KeyboardEvent('keyup', { key: 's', bubbles: true }));
                currentKeys.current['s'] = false;
            }
            if (currentKeys.current['a']) {
                window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));
                currentKeys.current['a'] = false;
            }
            if (currentKeys.current['d']) {
                window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd', bubbles: true }));
                currentKeys.current['d'] = false;
            }
        }
    };
    
    const handleVirtualJump = () => {
        console.log("Virtual jump handler triggered!");
        
        // Prevent repeated keydown events
        if (!currentKeys.current[' ']) {
            // Trigger space key for jump
            const keydownEvent = new KeyboardEvent('keydown', { 
                key: ' ', 
                code: 'Space',
                bubbles: true,
                cancelable: true
            });
            window.dispatchEvent(keydownEvent);
            document.dispatchEvent(keydownEvent); // Also dispatch to document in case game is listening there
            currentKeys.current[' '] = true;
            
            console.log("Sent jump keydown event (space)");
            
            // Release key after a short delay
            setTimeout(() => {
                const keyupEvent = new KeyboardEvent('keyup', { 
                    key: ' ', 
                    code: 'Space',
                    bubbles: true,
                    cancelable: true
                });
                window.dispatchEvent(keyupEvent);
                document.dispatchEvent(keyupEvent); // Also dispatch to document
                currentKeys.current[' '] = false;
                console.log("Sent jump keyup event (space)");
            }, 200);
        }
    };
    
    const handleVirtualShoot = () => {
        console.log("Virtual shoot handler triggered!");
        
        // Prevent rapid-fire
        if (!shootCooldownRef.current) {
            shootCooldownRef.current = true;
            
            // Simulate mouse click for shooting
            const mouseDownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                button: 0, // Left button
                view: window
            });
            document.dispatchEvent(mouseDownEvent);
            console.log("Sent shoot mousedown event");
            
            // Release after a short delay
            setTimeout(() => {
                const mouseUpEvent = new MouseEvent('mouseup', {
                    bubbles: true,
                    cancelable: true,
                    button: 0,
                    view: window
                });
                document.dispatchEvent(mouseUpEvent);
                console.log("Sent shoot mouseup event");
                
                // Add cooldown to prevent spamming
                setTimeout(() => {
                    shootCooldownRef.current = false;
                }, 300);
            }, 100);
        }
    };

    // Get remote shots from the connection manager (always call the hook to maintain hook order)
    const allRemoteShots = useRemoteShots(connectionManager);
    // Only use the shots when multiplayer is enabled, not affected by UI visibility
    const remoteShots = enableMultiplayer ? allRemoteShots : [];
    
    // Debug logging for remote shots
    useEffect(() => {
        if (remoteShots.length > 0) {
            console.log('Remote shots in App:', remoteShots);
        }
    }, [remoteShots]);

    const { showDebug } = useControls('Game Settings', {
        showDebug: { value: false }
    }, {
        collapsed: true,
        order: 999
    });

    // Add third-person camera controls
    const { 
        cameraDistance, 
        cameraHeight, 
        cameraSmoothing,
        invertYAxis 
    } = useControls('Third Person Camera', {
        cameraDistance: { value: 5, min: 2, max: 10, step: 0.5 },
        cameraHeight: { value: 2.5, min: 1, max: 5, step: 0.5 },
        cameraSmoothing: { value: 0.1, min: 0.01, max: 1, step: 0.01 },
        invertYAxis: { value: false, label: 'Invert Y-Axis' }
    }, {
        collapsed: true,
        order: 994
    });
    
    // Updated reference for the third-person camera
    const thirdPersonCameraRef = useRef<THREE.PerspectiveCamera>(null);
    const lastCameraPosition = useRef(new THREE.Vector3());
    
    // Update the camera position update function to use the controls
    const updateThirdPersonCamera = (playerPosition: THREE.Vector3, playerRotation: THREE.Quaternion) => {
        if (!thirdPersonView || !thirdPersonCameraRef.current) return;
        
        // Don't update camera position when using OrbitControls
        // OrbitControls will handle camera positioning instead
        
        // Just make sure the camera is looking at the player
        const lookAtPosition = new THREE.Vector3().copy(playerPosition);
        lookAtPosition.y += 1; // Look at player's head level
        thirdPersonCameraRef.current.lookAt(lookAtPosition);
    };
    
    // Add this to the Player component props
    const playerVisibility = thirdPersonView;

    // Add this inside the App component
    useEffect(() => {
        // Log when third-person view is activated or deactivated
        console.log(`Third-person view ${thirdPersonView ? 'enabled' : 'disabled'}`);
        
        // Reset camera position tracker when switching views
        if (!thirdPersonView && playerPosition.current) {
            // Reset to current position without interpolation to prevent glitches
            // when switching back to third-person view
            playerPosition.current.copy(
                playerRef.current?.rigidBody?.translation() || 
                new THREE.Vector3(0, 7, 10)
            );
        }
    }, [thirdPersonView, playerRef]);

    // Add a light position stabilization function
    const updateDirectionalLight = (position: THREE.Vector3) => {
        if (!directionalLightRef.current) return;
        
        // Use a more stable target position (player's center)
        // This helps prevent shadow/light flickering
        directionalLightRef.current.target.position.set(position.x, position.y, position.z);
        directionalLightRef.current.target.updateMatrixWorld();
        
        // Position calculation is now handled by MoonOrbit if enabled
        if (!moonOrbit) {
            // Only update light position, not target - more stable for shadows
            directionalLightRef.current.position.set(
                position.x + directionalDistance,
                directionalHeight,
                position.z + directionalDistance
            );
        }
    };
    
    // Add moon orbit component - update for wider orbit
    const MoonOrbit = () => {
        const angle = useRef(0);
        
        useFrame(() => {
            if (!moonOrbit || !directionalLightRef.current) return;
            
            // Increment angle for orbit - significantly slower
            angle.current += moonOrbitSpeed * 0.005;
            
            // Calculate light position in orbit around the center of the level
            // Using an elliptical orbit to spread on the x-axis
            const xRadius = Math.max(directionalDistance * 2.5, 50); // Much wider on x-axis
            const zRadius = Math.max(directionalDistance * 1.2, 25); // Also wider on z-axis
            const x = Math.sin(angle.current) * xRadius;
            const z = Math.cos(angle.current) * zRadius;
            
            // Set light position
            directionalLightRef.current.position.set(
                x,
                directionalHeight,
                z
            );
            
            // Keep shadows sharp but with better performance
            directionalLightRef.current.shadow.bias = -0.001;
            directionalLightRef.current.shadow.normalBias = 0.02;
            directionalLightRef.current.shadow.radius = 1; // Harder shadows
            directionalLightRef.current.shadow.mapSize.width = 2048; // Reduced from 4096
            directionalLightRef.current.shadow.mapSize.height = 2048; // Reduced from 4096
        });
        
        return null;
    };

    // Update the light position in useFrame via PlayerPositionTracker
    // This is more stable than the onMove handler which can be sporadic
    const StableLightUpdater = () => {
        useFrame(() => {
            if (playerPosition.current) {
                updateDirectionalLight(playerPosition.current);
            }
        });
        return null;
    };

    // Add this inside the App component
    useEffect(() => {
        // Log when character type changes
        console.log(`Character type changed to ${characterType}`);
    }, [characterType]);

    return (
        <>
            <div style={{
                position: 'absolute',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                color: 'rgba(255, 255, 255, 0.75)',
                fontSize: '13px',
                fontFamily: 'monospace',
                userSelect: 'none',
                zIndex: 1000
            }}>
                <div style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    letterSpacing: '0.5px',
                    whiteSpace: 'nowrap'
                }}>
                    WASD to move | SPACE to jump | SHIFT to run
                    {thirdPersonView ? ' | Mouse to rotate camera | ESC to release mouse' : ''}
                </div>
            </div>
            
            {/* Only show ammo display for merc character */}
            {characterType === 'merc' && (
                <div id="ammo-display" style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    color: 'rgba(255, 255, 255, 0.75)',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    userSelect: 'none',
                    zIndex: 1000
                }}>
                    AMMO: 50/50
                </div>
            )}
            
            <Canvas>
                {fogEnabled && <fog attach="fog" args={[fogColor, fogNear, fogFar]} />}
                <Environment
                    preset="sunset"
                    background
                    blur={0.6} // Reduced blur amount
                    resolution={128} // Reduced from 256
                />

                <ambientLight intensity={ambientIntensity} />
                <directionalLight
                    castShadow
                    position={[directionalDistance, directionalHeight, directionalDistance]}
                    ref={directionalLightRef}
                    intensity={directionalIntensity}
                    shadow-mapSize={[2048, 2048]} // Reduced from 4096 for better performance
                    shadow-camera-left={-50}
                    shadow-camera-right={50}
                    shadow-camera-top={50}
                    shadow-camera-bottom={-50}
                    shadow-camera-near={1}
                    shadow-camera-far={200}
                    shadow-bias={-0.001}
                    shadow-normalBias={0.02}
                    shadow-radius={1}
                    color="#f0f8ff"
                />

                {/* Add visible moon */}
                {moonOrbit && <Moon 
                    orbitRadius={Math.max(directionalDistance, 50)} 
                    height={directionalHeight + 10} 
                    orbitSpeed={moonOrbitSpeed} 
                />}

                <Physics 
                    debug={false} 
                    paused={loading}
                    timeStep={1/60}
                    interpolate={true}
                    gravity={[0, -9.81, 0]}
                >
                    <PlayerControls thirdPersonView={thirdPersonView}>
                        {/* Conditionally render either the Player (merc) or Jackalope */}
                        {characterType === 'merc' ? (
                            <Player 
                                ref={playerRef}
                                position={[0, 7, 10]}
                                walkSpeed={walkSpeed}
                                runSpeed={runSpeed}
                                jumpForce={jumpForce}
                                visible={thirdPersonView}
                                thirdPersonView={thirdPersonView}
                                connectionManager={enableMultiplayer ? connectionManager : undefined}
                                onMove={(position) => {
                                    if (directionalLightRef.current && !thirdPersonView) {
                                        // Only update light directly in first-person mode
                                        // In third-person, StableLightUpdater handles it
                                        const light = directionalLightRef.current;
                                        light.position.x = position.x + directionalDistance;
                                        light.position.z = position.z + directionalDistance;
                                        light.target.position.copy(position);
                                        light.target.updateMatrixWorld();
                                    }
                                }}
                            />
                        ) : (
                            <Jackalope
                                ref={playerRef}
                                position={[0, 1, 10]} // Lower position for the jackalope to start on the ground
                                walkSpeed={walkSpeed}
                                runSpeed={runSpeed}
                                jumpForce={jumpForce * 1.2} // Higher jump for jackalope
                                visible={thirdPersonView}
                                thirdPersonView={thirdPersonView}
                                connectionManager={enableMultiplayer ? connectionManager : undefined}
                                onMove={(position) => {
                                    if (directionalLightRef.current && !thirdPersonView) {
                                        // Only update light directly in first-person mode
                                        // In third-person, StableLightUpdater handles it
                                        const light = directionalLightRef.current;
                                        light.position.x = position.x + directionalDistance;
                                        light.position.z = position.z + directionalDistance;
                                        light.target.position.copy(position);
                                        light.target.updateMatrixWorld();
                                    }
                                }}
                            />
                        )}
                    </PlayerControls>
                    <Platforms />
                    <Ball />

                    <Scene playerRef={playerRef} />
                    
                    {/* Show SphereTool only for merc character - jackalobes don't shoot */}
                    {characterType === 'merc' && (
                        <SphereTool 
                            onShoot={enableMultiplayer ? 
                                (origin, direction) => {
                                    console.log('App: onShoot called with', { origin, direction });
                                    try {
                                        connectionManager.sendShootEvent(origin, direction);
                                        console.log('App: successfully sent shoot event');
                                    } catch (error) {
                                        console.error('App: error sending shoot event:', error);
                                    }
                                } 
                                : undefined
                            }
                            remoteShots={remoteShots}
                            thirdPersonView={thirdPersonView}
                            playerPosition={thirdPersonView ? playerPosition.current : null}
                        />
                    )}

                    {/* Use enableMultiplayer instead of showMultiplayerTools for the actual multiplayer functionality */}
                    {enableMultiplayer && playerRefReady && (
                        <MultiplayerManager 
                            localPlayerRef={playerRef} 
                            connectionManager={connectionManager}
                        />
                    )}
                </Physics>

                <PerspectiveCamera 
                    makeDefault={!thirdPersonView} 
                    position={[0, 10, 10]} 
                    rotation={[0, 0, 0]}
                    near={0.1}
                    far={1000}
                />

                {/* Add third-person camera with simpler setup */}
                {thirdPersonView && (
                    <PerspectiveCamera
                        ref={thirdPersonCameraRef}
                        makeDefault
                        position={[0, cameraHeight, cameraDistance]} 
                        near={0.1}
                        far={1000}
                        fov={75}
                    />
                )}

                {/* Add simplified ThirdPersonCameraControls */}
                {thirdPersonView && playerPosition.current && (
                    <ThirdPersonCameraControls 
                        player={playerPosition.current}
                        cameraRef={thirdPersonCameraRef}
                        enabled={thirdPersonView}
                        distance={cameraDistance}
                        height={cameraHeight}
                        invertY={invertYAxis}
                    />
                )}

                {enablePostProcessing && (
                    <EffectComposer>
                        <Vignette
                            offset={vignetteEnabled ? vignetteOffset : 0}
                            darkness={vignetteEnabled ? vignetteDarkness : 0}
                            eskil={false}
                        />
                        <ChromaticAberration
                            offset={new THREE.Vector2(
                                chromaticAberrationEnabled ? chromaticAberrationOffset : 0,
                                chromaticAberrationEnabled ? chromaticAberrationOffset : 0
                            )}
                            radialModulation={false}
                            modulationOffset={0}
                        />
                        <BrightnessContrast
                            brightness={brightnessContrastEnabled ? brightness : 0}
                            contrast={brightnessContrastEnabled ? contrast : 0} 
                        />
                        <ToneMapping
                            blendFunction={BlendFunction.NORMAL}
                            mode={toneMapping}
                        />
                    </EffectComposer>
                )}

                {/* Add MoonOrbit component */}
                <MoonOrbit />

                {/* Add stable light updater for third-person view */}
                {thirdPersonView && <StableLightUpdater />}

                {/* Add position tracker component */}
                <PlayerPositionTracker playerRef={playerRef} playerPosition={playerPosition} />
            </Canvas>

            {/* Only show crosshair in first-person view */}
            {!thirdPersonView && <Crosshair />}
            
            {/* Add NetworkStats component - only affects UI visibility */}
            {showMultiplayerTools && enableMultiplayer && (
                <NetworkStats connectionManager={connectionManager} visible={true} />
            )}

            {showMultiplayerTools && showDebug && connectionManager?.snapshots && (
                <SnapshotDebugOverlay 
                    snapshots={connectionManager.snapshots} 
                    getSnapshotAtTime={connectionManager.getSnapshotAtTime}
                />
            )}

            {/* Offline Mode Notification - tied to enableMultiplayer for functionality, showMultiplayerTools for visibility */}
            {enableMultiplayer && showMultiplayerTools && showOfflineNotification && (
                <div style={{
                    position: 'fixed',
                    top: '50px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: '#f44336',
                    color: 'white',
                    padding: '10px 15px',
                    borderRadius: '4px',
                    zIndex: 2000,
                    fontSize: '14px',
                    textAlign: 'center',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                    maxWidth: '80%'
                }}>
                    <p style={{ margin: '0', fontWeight: 'bold' }}>
                        Server connection failed. Running in offline mode.
                    </p>
                    <p style={{ margin: '5px 0 0', fontSize: '12px' }}>
                        Cross-browser shots are enabled using localStorage
                    </p>
                </div>
            )}

            <Instructions>Please use WASD to move and mouse to look around</Instructions>
            {/* Pass the shared connection manager to ConnectionTest */}
            {showConnectionTest && (
                <ConnectionTest sharedConnectionManager={connectionManager} />
            )}
            
            {/* Add debugging panel for multiplayer testing - only affects UI visibility */}
            {showMultiplayerTools && enableMultiplayer && (
                <MultiplayerDebugPanel 
                    connectionManager={connectionManager} 
                    visible={true} 
                    isOfflineMode={isOfflineMode}
                />
            )}

            {/* Add Virtual Gamepad */}
            <VirtualGamepad
                visible={showVirtualGamepad}
                onMove={handleVirtualMove}
                onJump={handleVirtualJump}
                onShoot={handleVirtualShoot}
            />
            
            {/* Mobile detected indicator */}
            {isMobile && (
                <div style={{
                    position: 'fixed',
                    top: '10px',
                    left: '10px',
                    background: 'rgba(0,0,0,0.5)',
                    color: 'white',
                    padding: '5px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    zIndex: 1000
                }}>
                    Mobile device detected
                </div>
            )}
        </>
    )
}

export default App