import { Canvas } from './common/components/canvas'
import { Crosshair } from './common/components/crosshair'
import { Instructions } from './common/components/instructions'
import { useLoadingAssets } from './common/hooks/use-loading-assets'
import { Environment, MeshReflectorMaterial, PerspectiveCamera, OrbitControls } from '@react-three/drei'
import { EffectComposer, Vignette, ChromaticAberration, BrightnessContrast, ToneMapping, Bloom } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { useFrame, useThree } from '@react-three/fiber'
import { CuboidCollider, Physics, RigidBody } from '@react-three/rapier'
import { useControls, folder, Leva } from 'leva'
import { useTexture } from '@react-three/drei'
import { useRef, useEffect, useState, useMemo } from 'react'
import * as THREE from 'three'
import { Player, PlayerControls } from './game/player'
import { Jackalope } from './game/jackalope'
import { Ball } from './game/ball'
import { SphereTool, setSphereDarkMode } from './game/sphere-tool'
import { Platforms } from './game/platforms'
import { MultiplayerManager, useRemoteShots } from './network/MultiplayerManager'
import { NetworkStats } from './network/NetworkStats'
import { ConnectionManager } from './network/ConnectionManager'
import { ConnectionTest } from './components/ConnectionTest'
import { VirtualGamepad } from './components/VirtualGamepad'
import { RemotePlayer } from './game/RemotePlayer'
// import { KeyDisplay } from './common/components/key-display' // Commenting out unused import

// Add TypeScript declaration for window.__setGraphicsQuality
declare global {
    interface Window {
        __setGraphicsQuality?: (quality: 'auto' | 'high' | 'medium' | 'low') => void;
        __shotBroadcast?: ((shot: any) => any) | undefined;
        jackalopesGame?: {
            playerType?: 'merc' | 'jackalope';
            levaPanelState?: 'open' | 'closed';
            // Add other global game properties as needed
        };
    }
}

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

// Add a Stars component using instanced meshes for performance
const Stars = ({ count = 1000, depth = 100, size = 0.2, color = "#ffffff", twinkle = true }: {
    count?: number;
    depth?: number;
    size?: number;
    color?: string;
    twinkle?: boolean;
}) => {
    // Reference to the instanced mesh
    const instancedMeshRef = useRef<THREE.InstancedMesh>(null);
    
    // Create stars once using instanced meshes for efficiency
    useEffect(() => {
        if (!instancedMeshRef.current) return;
        
        const dummy = new THREE.Object3D();
        
        // Place stars in a hemisphere above the level
        for (let i = 0; i < count; i++) {
            // Random position in a hemisphere
            const theta = Math.random() * Math.PI * 2; // Around
            const phi = Math.acos((Math.random() * 2) - 1) * 0.5; // Up (hemisphere)
            const radius = depth * (0.5 + Math.random() * 0.5); // Vary the distance
            
            // Calculate position
            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.cos(phi) + 20; // Offset upward
            const z = radius * Math.sin(phi) * Math.sin(theta);
            
            // Random scale for varied star sizes
            const scale = size * (0.3 + Math.random() * 0.7);
            
            // Set position and scale
            dummy.position.set(x, y, z);
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            
            // Apply to instance
            instancedMeshRef.current.setMatrixAt(i, dummy.matrix);
        }
        
        // Update the instance matrix
        instancedMeshRef.current.instanceMatrix.needsUpdate = true;
    }, [count, depth, size]);
    
    // Subtle twinkling animation using shader material
    const starMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                color: { value: new THREE.Color(color) },
                twinkleEnabled: { value: twinkle ? 1.0 : 0.0 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec3 color;
                uniform float twinkleEnabled;
                varying vec2 vUv;
                
                void main() {
                    // Create a radial gradient for each star point
                    float dist = length(vUv - vec2(0.5, 0.5));
                    
                    // Smooth falloff for star points
                    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
                    
                    // Simple noise-based twinkling
                    float twinkle = mix(
                        1.0,
                        0.75 + 0.25 * sin(time * 0.5 + gl_FragCoord.x * 0.01 + gl_FragCoord.y * 0.01),
                        twinkleEnabled
                    );
                    
                    gl_FragColor = vec4(color * twinkle, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false // Improve performance by skipping depth write
        });
    }, [color, twinkle]);
    
    // Update time uniform for twinkling animation
    useFrame(({ clock }) => {
        if (starMaterial) {
            starMaterial.uniforms.time.value = clock.elapsedTime;
        }
    });
    
    return (
        <instancedMesh ref={instancedMeshRef} args={[undefined, undefined, count]}>
            <sphereGeometry args={[1, 4, 4]} /> {/* Low-poly sphere for better performance */}
            <primitive object={starMaterial} attach="material" />
        </instancedMesh>
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
  isOfflineMode,
  setPlayerCharacterInfo
}: { 
  connectionManager: any, 
  visible: boolean,
  isOfflineMode: boolean,
  setPlayerCharacterInfo: (info: { type: 'merc' | 'jackalope', thirdPerson: boolean }) => void
}) => {
  const [shots, setShots] = useState(0);
  const [universals, setUniversals] = useState(0);
  const [forceMercCharacter, setForceMercCharacter] = useState(false);
  
  // Insert a toggle button for testing character type override
  const [characterTypeOverride, setCharacterTypeOverride] = useState<'merc' | 'jackalope' | null>(null);
  
  // Track forces
  const [forceCount, setForceCount] = useState(0);
  
  useEffect(() => {
    if (!connectionManager || !characterTypeOverride) return;
    
    // Force character type using our new helper method
    const characterInfo = connectionManager.forceCharacterType(characterTypeOverride);
    console.log(`🎮 Forced character type to ${characterTypeOverride}:`, characterInfo);
    
    // Increment force count to trigger our dependency
    setForceCount(prev => prev + 1);
    
    // Reset override
    setCharacterTypeOverride(null);
  }, [connectionManager, characterTypeOverride]);

  const sendTestShot = () => {
    if (!connectionManager) return;
    
    // Generate a random shot direction
    const randomAngle = Math.random() * Math.PI * 2;
    const randomDirection: [number, number, number] = [
      Math.sin(randomAngle),
      0, // No vertical component
      Math.cos(randomAngle)
    ];
    
    // Player's current position (hardcoded for test)
    const origin: [number, number, number] = [0, 1, 0];
    
    // Send the shot through the connection manager
    try {
      connectionManager.sendShootEvent(origin, randomDirection);
      setShots(s => s + 1);
      console.log('Test shot sent');
    } catch (error) {
      console.error('Error sending test shot:', error);
    }
  };
  
  const sendUniversalBroadcast = () => {
    // Use the browser broadcast API if window.__shotBroadcast is available
    if (window.__shotBroadcast) {
      const testShotData = {
        id: 'test-player-universal',
        origin: [0, 1, 0] as [number, number, number],
        direction: [1, 0, 0] as [number, number, number],
        color: '#ff0000',
        timestamp: Date.now(),
        shotId: `universal-${Date.now()}`
      };
      
      try {
        window.__shotBroadcast(testShotData);
        setUniversals(u => u + 1);
        console.log('Universal broadcast sent');
      } catch (error) {
        console.error('Error sending universal broadcast:', error);
      }
    } else {
      console.error('Universal broadcast not available - window.__shotBroadcast is not defined');
    }
  };
  
  const forceOfflineMode = () => {
    if (connectionManager && connectionManager.forceReady) {
      connectionManager.forceReady();
    }
  };
  
  const resetPlayerCount = () => {
    if (connectionManager && connectionManager.resetPlayerCount) {
      connectionManager.resetPlayerCount();
      console.log('🔄 Reset player count - next reload will assign new player types');
      
      // After reset, force a reload to get a new player type
      if (confirm('Reset player count successful! Reload now to get a new player type?')) {
        window.location.reload();
      }
    }
  };

  return visible ? (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      zIndex: 1000,
      width: '300px',
      fontFamily: 'monospace'
    }}>
      <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>Multiplayer Test Panel</div>
      
      <div style={{ marginBottom: '10px' }}>
        <button 
          onClick={sendTestShot}
          style={{ 
            backgroundColor: '#4CAF50', 
            border: 'none', 
            color: 'white', 
            padding: '5px 10px', 
            margin: '0 5px 5px 0',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          TEST SHOT
        </button>
        <span>Shots: {shots}</span>
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <button 
          onClick={sendUniversalBroadcast}
          style={{ 
            backgroundColor: '#2196F3', 
            border: 'none', 
            color: 'white', 
            padding: '5px 10px', 
            margin: '0 5px 5px 0',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          UNIVERSAL BROADCAST
        </button>
        <span>Sent: {universals}</span>
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <button 
          onClick={forceOfflineMode}
          style={{ 
            backgroundColor: '#FF9800', 
            border: 'none', 
            color: 'white', 
            padding: '5px 10px', 
            margin: '0 5px 5px 0',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          FORCE OFFLINE MODE
        </button>
        <span>{isOfflineMode ? '✅ OFFLINE' : '❌ ONLINE'}</span>
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <button 
          onClick={() => setCharacterTypeOverride('merc')}
          style={{ 
            backgroundColor: '#E91E63', 
            border: 'none', 
            color: 'white', 
            padding: '5px 10px', 
            margin: '0 5px 5px 0',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          FORCE MERC
        </button>
        <button 
          onClick={() => setCharacterTypeOverride('jackalope')}
          style={{ 
            backgroundColor: '#9C27B0', 
            border: 'none', 
            color: 'white', 
            padding: '5px 10px', 
            margin: '0 5px 5px 0',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          FORCE JACKALOPE
        </button>
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <button 
          onClick={resetPlayerCount}
          style={{ 
            backgroundColor: '#F44336', 
            border: 'none', 
            color: 'white', 
            padding: '5px 10px', 
            margin: '0 5px 5px 0',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          RESET PLAYER COUNT
        </button>
      </div>
      
      <div style={{ fontSize: '10px', opacity: 0.8 }}>
        Connection: {connectionManager ? 'Ready' : 'Not initialized'}<br />
        Mode: {isOfflineMode ? 'Offline (LocalStorage)' : 'Online (WebSocket)'}<br />
        Forces: {forceCount}
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <button 
          onClick={() => {
            if (connectionManager && connectionManager.resetAndCorrectCharacterType) {
              // Force character type correction
              const characterInfo = connectionManager.resetAndCorrectCharacterType();
              console.log(`🎮 Force corrected character type: ${characterInfo.type}`);
              setPlayerCharacterInfo(characterInfo);
            }
          }}
          style={{ 
            backgroundColor: '#673AB7', 
            border: 'none', 
            color: 'white', 
            padding: '5px 10px', 
            margin: '0 5px 5px 0',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          CORRECT CHARACTER TYPE
        </button>
      </div>
    </div>
  ) : null;
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
    const playerType = useRef<'merc' | 'jackalope'>('merc');
    
    // Get player character type from the App
    useEffect(() => {
        // Try to determine player type based on the global state
        try {
            const appPlayerType = window.jackalopesGame?.playerType;
            if (appPlayerType === 'jackalope') {
                playerType.current = 'jackalope';
                console.log("ThirdPersonCamera: Detected jackalope player type");
            } else {
                playerType.current = 'merc';
            }
        } catch (err) {
            console.warn("ThirdPersonCamera: Could not determine player type");
        }
    }, []);
    
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
    useFrame((_, delta) => {
        if (!enabled || !cameraRef.current) return;
        
        try {
            // Only update with valid player position
            if (player instanceof THREE.Vector3 && !Number.isNaN(player.x) && 
                !Number.isNaN(player.y) && !Number.isNaN(player.z)) {
                
                // Use different interpolation speeds for different player types
                // For jackalope, balance between responsiveness and smoothness
                const isJackalope = playerType.current === 'jackalope';
                
                // Balance between smoothness and responsiveness
                // Not too direct (causes jitter) but not too smooth (causes lag)
                // Use deltaTime-based interpolation for consistent smoothing across frame rates
                const targetSmoothing = isJackalope ? 
                    Math.min(delta * 20.0, 0.5) : // Good balance for jackalope
                    Math.min(delta * 4.0, 0.25);  // Normal responsiveness for merc
                
                // Log camera state occasionally for debugging
                if (Math.random() < 0.01) {
                    console.log(`[CAMERA] Delta: ${delta.toFixed(4)}, Smoothing: ${targetSmoothing.toFixed(2)}`);
                    console.log(`[CAMERA] Target: (${player.x.toFixed(2)}, ${player.y.toFixed(2)}, ${player.z.toFixed(2)})`);
                    console.log(`[CAMERA] Current: (${targetRef.current.x.toFixed(2)}, ${targetRef.current.y.toFixed(2)}, ${targetRef.current.z.toFixed(2)})`);
                }
                
                targetRef.current.lerp(player, targetSmoothing);
                
                // Calculate camera position based on rotation around target
                const cameraOffset = new THREE.Vector3(
                    Math.sin(rotationRef.current.y) * distance,
                    height + Math.sin(rotationRef.current.x) * distance,
                    Math.cos(rotationRef.current.y) * distance
                );
                
                // Balance camera smoothness and responsiveness
                const newCamPos = new THREE.Vector3().copy(targetRef.current).add(cameraOffset);
                const cameraSmoothing = isJackalope ? 
                    Math.min(delta * 25.0, 0.6) : // Responsive but still smooth for jackalope
                    Math.min(delta * 8.0, 0.4);   // Normal responsiveness for merc
                
                cameraRef.current.position.lerp(newCamPos, cameraSmoothing);
                
                // Look at player
                cameraRef.current.lookAt(targetRef.current);
            }
        } catch (error) {
            console.error("Error in ThirdPersonCameraControls frame update:", error);
        }
    });
    
    return null; // No need to render any elements
};

// Add PerformanceStats component
const PerformanceStats = () => {
    const [fps, setFps] = useState(0);
    const [memory, setMemory] = useState<{
        geometries: number;
        textures: number;
        triangles: number;
        jsHeap?: number;
    }>({
        geometries: 0,
        textures: 0,
        triangles: 0
    });
    const frameCount = useRef(0);
    const lastTime = useRef(performance.now());
    const frameTimeHistory = useRef<number[]>([]);
    const maxHistoryLength = 30; // Store 30 frames of history for smoother display

    // Get renderer info from three.js
    const { gl } = useThree();
    const rendererInfo = useMemo(() => gl.info, [gl]);

    useEffect(() => {
        // Function to update performance stats
        const updateStats = () => {
            frameCount.current++;
            const now = performance.now();
            const elapsed = now - lastTime.current;

            // Update FPS approximately every 500ms for more stable reading
            if (elapsed >= 500) {
                // Calculate FPS
                const currentFps = Math.round((frameCount.current * 1000) / elapsed);
                
                // Add to history for smoothing
                frameTimeHistory.current.push(currentFps);
                // Keep history at max length
                if (frameTimeHistory.current.length > maxHistoryLength) {
                    frameTimeHistory.current.shift();
                }
                
                // Calculate average FPS from history
                const avgFps = Math.round(
                    frameTimeHistory.current.reduce((sum, fps) => sum + fps, 0) / 
                    frameTimeHistory.current.length
                );
                
                setFps(avgFps);
                
                // Update memory stats
                const memoryStats = {
                    geometries: rendererInfo.memory.geometries,
                    textures: rendererInfo.memory.textures,
                    triangles: rendererInfo.render.triangles,
                    // Add JS heap size if performance.memory is available (Chrome only)
                    jsHeap: (performance as any).memory?.usedJSHeapSize / (1024 * 1024) // Convert to MB
                };
                
                setMemory(memoryStats);
                
                // Reset for next update
                frameCount.current = 0;
                lastTime.current = now;
            }
            
            requestAnimationFrame(updateStats);
        };
        
        const animationId = requestAnimationFrame(updateStats);
        
        return () => {
            cancelAnimationFrame(animationId);
        };
    }, [rendererInfo]);

    return (
        <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            color: fps < 30 ? '#ff5252' : fps < 50 ? '#ffbd52' : '#52ff7a',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace',
            userSelect: 'none',
            zIndex: 2000,
            textAlign: 'right',
            lineHeight: '1.4'
        }}>
            <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
                {fps} FPS
            </div>
            <div style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '10px' }}>
                Triangles: {memory.triangles.toLocaleString()}<br />
                Geometries: {memory.geometries}<br />
                Textures: {memory.textures}
                {memory.jsHeap && (<><br />Memory: {memory.jsHeap.toFixed(1)} MB</>)}
            </div>
        </div>
    );
};

// ... existing code ...

// Split the performance stats into two components:
// 1. StatsCollector - inside Canvas to collect data
// 2. StatsDisplay - outside Canvas to display data
interface PerformanceData {
    fps: number;
    triangles: number;
    geometries: number;
    textures: number;
    jsHeap?: number;
}

// Create a state to share data between components
const performanceState = {
    listeners: [] as ((data: PerformanceData) => void)[],
    subscribe(listener: (data: PerformanceData) => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    },
    notify(data: PerformanceData) {
        this.listeners.forEach(listener => listener(data));
    }
};

// This component goes inside the Canvas
const StatsCollector = () => {
    const frameCount = useRef(0);
    const lastTime = useRef(performance.now());
    const frameTimeHistory = useRef<number[]>([]);
    const maxHistoryLength = 30;
    
    // Get renderer info from three.js
    const { gl } = useThree();
    const rendererInfo = useMemo(() => gl.info, [gl]);
    
    useFrame(() => {
        frameCount.current++;
        const now = performance.now();
        const elapsed = now - lastTime.current;
        
        // Update stats every 500ms
        if (elapsed >= 500) {
            // Calculate FPS
            const currentFps = Math.round((frameCount.current * 1000) / elapsed);
            
            // Add to history for smoothing
            frameTimeHistory.current.push(currentFps);
            if (frameTimeHistory.current.length > maxHistoryLength) {
                frameTimeHistory.current.shift();
            }
            
            // Calculate average FPS from history
            const avgFps = Math.round(
                frameTimeHistory.current.reduce((sum, fps) => sum + fps, 0) / 
                frameTimeHistory.current.length
            );
            
            // Get memory stats
            const jsHeap = (performance as any).memory?.usedJSHeapSize / (1024 * 1024);
            
            // Notify subscribers with new data
            performanceState.notify({
                fps: avgFps,
                triangles: rendererInfo.render.triangles,
                geometries: rendererInfo.memory.geometries,
                textures: rendererInfo.memory.textures,
                jsHeap
            });
            
            // Reset for next update
            frameCount.current = 0;
            lastTime.current = now;
        }
    });
    
    return null;
};

// This component goes outside the Canvas
const StatsDisplay = () => {
    const [stats, setStats] = useState<PerformanceData>({
        fps: 0,
        triangles: 0,
        geometries: 0,
        textures: 0
    });
    
    useEffect(() => {
        // Subscribe to performance updates
        return performanceState.subscribe(data => {
            setStats(data);
        });
    }, []);
    
    return (
        <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            color: stats.fps < 30 ? '#ff5252' : stats.fps < 50 ? '#ffbd52' : '#52ff7a',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace',
            userSelect: 'none',
            zIndex: 2000,
            textAlign: 'right',
            lineHeight: '1.4'
        }}>
            <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
                {stats.fps} FPS
            </div>
            <div style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '10px' }}>
                Triangles: {stats.triangles.toLocaleString()}<br />
                Geometries: {stats.geometries}<br />
                Textures: {stats.textures}
                {stats.jsHeap && (<><br />Memory: {stats.jsHeap.toFixed(1)} MB</>)}
            </div>
        </div>
    );
};

// Add a helper function to explicitly reconnect the camera to fix third person view
const forceCameraReconnection = (trigger: string) => {
    console.log(`[CAMERA] Force reconnection triggered by: ${trigger}`);
    
    // Dispatch multiple events to ensure proper camera update
    window.dispatchEvent(new CustomEvent('cameraUpdateNeeded'));
    
    // Add a slight delay to allow for DOM updates
    setTimeout(() => {
        window.dispatchEvent(new CustomEvent('forceArmsReset'));
        window.dispatchEvent(new CustomEvent('forceCameraSync', { 
            detail: { 
                timestamp: Date.now(),
                operation: 'panel_toggle'
            } 
        }));
    }, 100);
    
    // Additional updates with increasing delays for reliability
    setTimeout(() => window.dispatchEvent(new CustomEvent('cameraUpdateNeeded')), 300);
    setTimeout(() => window.dispatchEvent(new CustomEvent('cameraUpdateNeeded')), 800);
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
        const MAX_HISTORY = 3; // Further reduced from 5 to 3 for even more responsive camera
        
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
                    
                    // Apply much faster interpolation for snappier movement
                    const smoothingFactor = Math.min(0.4, deltaTime * 15);
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
        collapsed: true,
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
        moonOrbitSpeed,
        highQualityShadows,
        moonVisible,
        bloomEnabled,
        bloomIntensity,
        bloomLuminanceThreshold,
        starsEnabled,
        starsCount,
        starsSize,
        starsColor,
        starsTwinkle
    } = useControls({
        fog: folder({
            fogEnabled: true,
            fogColor: '#dbdbdb',
            fogNear: { value: 13, min: 0, max: 50, step: 1 },
            fogFar: { value: 95, min: 0, max: 100, step: 1 }
        }, { collapsed: true }),
        lighting: folder({
            ambientIntensity: { value: 0, min: 0, max: 2, step: 0.1 },
            directionalIntensity: { value: 3.0, min: 0, max: 5, step: 0.1 },
            directionalHeight: { value: 40, min: 5, max: 60, step: 1 },
            directionalDistance: { value: 40, min: 5, max: 70, step: 1 },
            moonOrbit: { value: false, label: 'Moon Orbits Level' },
            moonOrbitSpeed: { value: 0.005, min: 0.001, max: 0.1, step: 0.001, label: 'Orbit Speed' },
            moonVisible: { value: false, label: 'Show Moon Mesh' },
            highQualityShadows: { value: false, label: 'High Quality Shadows' },
        }, { collapsed: true }),
        stars: folder({
            starsEnabled: { value: true, label: 'Show Stars' },
            starsCount: { value: 1000, min: 200, max: 3000, step: 100, label: 'Star Count' },
            starsSize: { value: 0.2, min: 0.05, max: 0.5, step: 0.05, label: 'Star Size' },
            starsColor: { value: '#ffffff', label: 'Star Color' },
            starsTwinkle: { value: true, label: 'Twinkling Effect' }
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
            toneMappingExposure: { value: 1.2, min: 0, max: 2, step: 0.1 },
            bloomEnabled: { value: true, label: 'Bloom Effect' },
            bloomIntensity: { value: 0.5, min: 0, max: 2, step: 0.1 },
            bloomLuminanceThreshold: { value: 0.6, min: 0, max: 1, step: 0.1 }
        }, { collapsed: true })
    }, {
        collapsed: true,
        persist: true,
        order: 995
    })

    // Update the Game UI controls to include virtual gamepad toggle
    const { showTools, showConnectionTest, virtualGamepad, thirdPersonView, characterType, darkMode, forceDarkLevel, ...restControls } = useControls('Game UI', {
        showTools: {
            value: false,
            label: 'Show Multiplayer Tools'
        },
        showConnectionTest: {
            value: false,
            label: 'Show Connection Test'  
        },
        virtualGamepad: {
            value: false,
            label: 'Show Virtual Controls'
        },
        thirdPersonView: {
            value: false,
            label: 'Third Person Camera'
        },
        characterType: {
            value: 'jackalope', // Changed default to jackalope
            options: ['merc', 'jackalope'],
            label: 'Character Type'
        },
        darkMode: {
            value: false,
            label: 'Dark Mode'
        },
        forceDarkLevel: {
            value: false,
            label: 'Dark Level Lighting'
        }
    }, { collapsed: true });
    
    // Get the setter from the returned controls object
    const setControls = (restControls as any).set;
    
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
    
    // Simplified StableLightUpdater to just position the light
    const StableLightUpdater = () => {
        // Single setup effect rather than frame-by-frame updates for better performance
        useEffect(() => {
            if (directionalLightRef.current) {
                // Set a fixed position for best shadow coverage over the level
                directionalLightRef.current.position.set(
                    -directionalDistance,
                    directionalHeight,
                    -directionalDistance
                );
                
                // Set target to center of level
                directionalLightRef.current.target.position.set(0, 0, 0);
                directionalLightRef.current.target.updateMatrixWorld();
                
                // Optimize shadows
                directionalLightRef.current.shadow.bias = -0.001;
                directionalLightRef.current.shadow.normalBias = 0.05;
                directionalLightRef.current.shadow.radius = highQualityShadows ? 1 : 2; // Softer shadows in low quality mode
                directionalLightRef.current.shadow.mapSize.width = highQualityShadows ? 2048 : 1024;
                directionalLightRef.current.shadow.mapSize.height = highQualityShadows ? 2048 : 1024;
            }
        }, [directionalHeight, directionalDistance, highQualityShadows]);
        
        return null;
    };

    // Add this inside the App component
    useEffect(() => {
        // Log when character type changes
        console.log(`Character type changed to ${characterType}`);
    }, [characterType]);

    // Add moon orbit component for when orbiting is enabled
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
        });
        
        return null;
    };

    // Graphics quality settings
    const performanceSettings = useControls('Performance', {
        graphicsQuality: {
            value: 'low' as const, // Changed from 'auto' to 'low'
            label: 'Graphics Quality',
            options: ['auto', 'high', 'medium', 'low'] as const,
            onChange: (value: 'auto' | 'high' | 'medium' | 'low') => {
                // Only included if window.__setGraphicsQuality is defined
                if (typeof window !== 'undefined' && window.__setGraphicsQuality) {
                    window.__setGraphicsQuality(value);
                }
            }
        }
    }, {
        collapsed: true,
        order: 999
    });
    
    // Extract graphicsQuality with proper type assertion
    const graphicsQuality = (performanceSettings as any)?.graphicsQuality || 'low'; // Changed default fallback from 'auto' to 'low'
    
    // Add global rendering quality parameters controlled by graphics quality
    const [globalQualityParams, setGlobalQualityParams] = useState({
        shadowMapSize: 2048,
        bloomQuality: 'medium' as 'high' | 'medium' | 'low',
        effectsEnabled: true,
        environmentResolution: 64,
        maxParticles: 10000,
        cullingDistance: 100
    });
    
    // Effect to apply graphics quality to global rendering parameters
    useEffect(() => {
        // Function to apply quality settings
        const applyQualitySettings = (quality: 'auto' | 'high' | 'medium' | 'low') => {
            console.log(`[GRAPHICS] Applying global quality settings: ${quality}`);
            
            if (quality === 'auto') {
                // Keep current settings
                return;
            }
            
            // Apply settings based on quality level
            switch (quality) {
                case 'high':
                    setGlobalQualityParams({
                        shadowMapSize: 2048,
                        bloomQuality: 'high',
                        effectsEnabled: true,
                        environmentResolution: 128,
                        maxParticles: 10000,
                        cullingDistance: 150
                    });
                    // Also update Leva controls if needed
                    if (setControls) {
                        setControls({
                            highQualityShadows: true,
                            bloomIntensity: 0.7,
                            starsCount: 1500
                        });
                    }
                    break;
                    
                case 'medium':
                    setGlobalQualityParams({
                        shadowMapSize: 1024,
                        bloomQuality: 'medium',
                        effectsEnabled: true,
                        environmentResolution: 64,
                        maxParticles: 5000,
                        cullingDistance: 100
                    });
                    // Also update Leva controls if needed
                    if (setControls) {
                        setControls({
                            highQualityShadows: false,
                            bloomIntensity: 0.5,
                            starsCount: 1000
                        });
                    }
                    break;
                    
                case 'low':
                    setGlobalQualityParams({
                        shadowMapSize: 512,
                        bloomQuality: 'low',
                        effectsEnabled: false,
                        environmentResolution: 32,
                        maxParticles: 2000,
                        cullingDistance: 75
                    });
                    // Also update Leva controls if needed
                    if (setControls) {
                        setControls({
                            highQualityShadows: false,
                            enablePostProcessing: false,
                            starsCount: 500
                        });
                    }
                    break;
            }
            
            // Force camera update to prevent FPS arms disconnection
            // Use multiple attempts with increasing delays to ensure stability
            const triggerCameraUpdate = () => {
                console.log('[GRAPHICS] Triggering camera update to fix FPS arms position');
                const cameraUpdateEvent = new CustomEvent('cameraUpdateNeeded');
                window.dispatchEvent(cameraUpdateEvent);
            };
            
            // Multiple attempts with different delays
            setTimeout(triggerCameraUpdate, 100);
            setTimeout(triggerCameraUpdate, 500);
            setTimeout(triggerCameraUpdate, 1000);
        };
        
        // Apply settings when quality changes
        applyQualitySettings(graphicsQuality);
        
        // Also listen for the custom event from sphere-tool.tsx
        const handleQualityChange = (event: CustomEvent<{quality: 'auto' | 'high' | 'medium' | 'low'}>) => {
            applyQualitySettings(event.detail.quality);
        };
        
        window.addEventListener('graphicsQualityChanged', handleQualityChange as EventListener);
        
        return () => {
            window.removeEventListener('graphicsQualityChanged', handleQualityChange as EventListener);
        };
    }, [graphicsQuality, setControls]);

    // Add state to track player character info based on connection order
    const [playerCharacterInfo, setPlayerCharacterInfo] = useState<{ type: 'merc' | 'jackalope', thirdPerson: boolean }>({ 
        type: 'jackalope',  // Set initial state to jackalope 
        thirdPerson: false 
    });

    // Use an effect to get the character type from ConnectionManager when it's ready
    useEffect(() => {
        console.log('Checking for character type assignment, multiplayer enabled:', enableMultiplayer);
        
        // Only proceed if multiplayer is enabled
        if (!enableMultiplayer) {
            console.log('Multiplayer disabled, using manual character selection:', characterType);
            // Always respect the user's manual selection when multiplayer is disabled
            setPlayerCharacterInfo({
                type: characterType as 'merc' | 'jackalope',
                thirdPerson: characterType === 'jackalope' ? true : false
            });
            return;
        }
        
        // Check if connection manager is available
        if (!connectionManager) {
            console.log('Connection manager not available yet');
            return;
        }
        
        // IMPORTANT: First check the player index 
        const playerIndex = connectionManager.getPlayerIndex();
        console.log(`🎮 Current player index: ${playerIndex}`);
        
        // Only get character info after player has a valid index
        if (playerIndex >= 0) {
            // Get character info from connection manager
            const characterInfo = connectionManager.getPlayerCharacterType();
            console.log('🎮 Character assignment from ConnectionManager:', characterInfo);
            
            // Double-check that assignment matches index
            if ((playerIndex % 2 === 0 && characterInfo.type !== 'jackalope') || 
                (playerIndex % 2 === 1 && characterInfo.type !== 'merc')) {
                console.error(`⚠️ Character type mismatch! Index ${playerIndex} should be ${playerIndex % 2 === 0 ? 'JACKALOPE' : 'MERC'} but is ${characterInfo.type.toUpperCase()}`);
            }
            
            // Update local state and ensure UI updates
            // IMPORTANT: Override any previous settings with the connection-manager assigned type
            setPlayerCharacterInfo(characterInfo);
            
            // Also set the player type in the connection manager so it will be sent in updates
            connectionManager.setPlayerType(characterInfo.type);
            
            // Auto-switch to third person view if character type requires it
            if (characterInfo.thirdPerson) {
                console.log('Character requires third-person view');
            }
        } else {
            console.log('Waiting for player index assignment before setting character type');
            // While waiting, set to jackalope by default
            setPlayerCharacterInfo({
                type: 'jackalope',
                thirdPerson: true
            });
        }
    }, [connectionManager, enableMultiplayer, connectionManager?.getPlayerIndex(), characterType]);

    // Force characterType to match playerCharacterInfo when it changes
    useEffect(() => {
        if (playerCharacterInfo && playerCharacterInfo.type) {
            // Log the character type change
            console.log(`Character type set to ${playerCharacterInfo.type} (third-person: ${playerCharacterInfo.thirdPerson})`);
            
            // If this is a third-person character, force third-person camera setup
            if (playerCharacterInfo.thirdPerson) {
                // Manually set up third-person camera
                console.log('Forcing third-person camera setup for', playerCharacterInfo.type);
                // The third-person view will be handled by the rendering logic
            }
        }
    }, [playerCharacterInfo]);

    // Ensure we respect the character info when the player index changes
    useEffect(() => {
        // Check if connected and player index is valid
        if (connectionManager && connectionManager.getPlayerIndex() >= 0) {
            // Get updated character info based on the latest player index
            const characterInfo = connectionManager.getPlayerCharacterType();
            console.log('🎮 Updated character assignment from ConnectionManager:', characterInfo);
            
            // CRITICAL: This update must override any previous settings
            // This ensures the player type is correctly set based on player index
            setPlayerCharacterInfo(characterInfo);
            
            // Set player type in connection manager for network updates
            connectionManager.setPlayerType(characterInfo.type);
        }
    }, [connectionManager?.getPlayerIndex?.()]);

    // Add a separate effect to log when the character info changes
    useEffect(() => {
        console.log('Player character info updated:', playerCharacterInfo);
        
        // If this is a third-person character, force third-person view
        if (playerCharacterInfo.thirdPerson) {
            // Configure third-person camera
            console.log('Enabling third-person view for', playerCharacterInfo.type);
        }
    }, [playerCharacterInfo]);

    // Add a conditional class to the body element for dark mode
    // Add this effect to the App component
    useEffect(() => {
        if (darkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }, [darkMode]);

    // Update sphere tool lighting when dark mode changes
    useEffect(() => {
        // Use the exported setSphereDarkMode function to enhance lighting in dark mode
        setSphereDarkMode(darkMode);
    }, [darkMode]);

    // Add an effect to forcibly correct character type based on player index when component mounts
    useEffect(() => {
        // Only run this once on component mount
        console.log('Adding character correction check');
        
        // Set a timer to check and correct the character type after the player index is assigned
        const timer = setTimeout(() => {
            if (connectionManager && connectionManager.getPlayerIndex() >= 0) {
                // Get the player index
                const playerIndex = connectionManager.getPlayerIndex();
                console.log(`Checking if character type matches player index ${playerIndex}`);
                
                // Get current character info
                const characterInfo = playerCharacterInfo;
                
                // Check if the type matches the index parity
                const expectedType = playerIndex % 2 === 0 ? 'jackalope' : 'merc';
                if (characterInfo.type !== expectedType) {
                    console.error(`Character type mismatch! Forcing correction...`);
                    // Correct the character type
                    const correctedInfo = connectionManager.resetAndCorrectCharacterType();
                    setPlayerCharacterInfo(correctedInfo);
                } else {
                    console.log(`Character type ${characterInfo.type} correctly matches player index ${playerIndex}`);
                }
            }
        }, 3000); // Check after 3 seconds to allow for player index assignment
        
        return () => clearTimeout(timer);
    }, []);

    // Add debug controls for forcing character types
    const debugSettings = useControls('Debug Options', {
        force_merc_fps: {
            value: false,
            label: 'Force Merc (FPS) Mode'
        },
        force_jackalope_third: {
            value: false,
            label: 'Force Jackalope (3rd Person)'
        },
        disable_character_correction: {
            value: false,
            label: 'Disable Auto Character Correction'
        }
    }, {
        collapsed: true,
        order: 990
    });

    // Listen for debug option changes - handle merc
    useEffect(() => {
        if (debugSettings.force_merc_fps && enableMultiplayer) {
            console.log("Debug: Forcing merc character with FPS view");
            
            // Log debug info
            console.log("[DEBUG] Force Merc FPS mode activated");
            
            // Set character type to merc
            setPlayerCharacterInfo({
                type: 'merc',
                thirdPerson: false
            });
            
            // Update connection manager if available
            if (connectionManager) {
                // Use the correct method name
                connectionManager.setPlayerType('merc');
            }
            
            // Function to trigger camera reset and dispatch the event
            const triggerCameraReset = () => {
                console.log("[DEBUG] Dispatching camera update needed event");
                window.dispatchEvent(new CustomEvent('cameraUpdateNeeded'));
            };
            
            // Call immediately and also with various delays for reliability
            triggerCameraReset();
            setTimeout(triggerCameraReset, 100);
            setTimeout(triggerCameraReset, 300);
            setTimeout(triggerCameraReset, 1000);
            
            // Also force a reset of the FPS arms
            const forceArmsReset = () => {
                console.log("[DEBUG] Dispatching force arms reset event");
                window.dispatchEvent(new CustomEvent('forceArmsReset'));
            };
            
            // Call with delays for reliability
            forceArmsReset();
            setTimeout(forceArmsReset, 300);
            setTimeout(forceArmsReset, 1000);
        }
    }, [debugSettings.force_merc_fps, enableMultiplayer, connectionManager]);
    
    // Listen for debug option changes - handle jackalope
    useEffect(() => {
        if (debugSettings.force_jackalope_third && enableMultiplayer) {
            console.log("Debug: Forcing jackalope character with third person view");
            
            // Log debug info
            console.log("[DEBUG] Force Jackalope mode activated");
            
            // Set character type to jackalope
            setPlayerCharacterInfo({
                type: 'jackalope',
                thirdPerson: true
            });
            
            // Update connection manager if available
            if (connectionManager) {
                connectionManager.setPlayerType('jackalope');
            }
            
            // Just make sure camera is updated appropriately
            setTimeout(() => {
                console.log("[DEBUG] Dispatching camera update for jackalope");
                window.dispatchEvent(new CustomEvent('cameraUpdateNeeded'));
            }, 100);
        }
    }, [debugSettings.force_jackalope_third, enableMultiplayer, connectionManager]);
    
    // Add an effect to force arms reset on initial load
    useEffect(() => {
        // Only do this once on component mount
        const initialLoadTimer = setTimeout(() => {
            console.log("[App] Initial load complete, forcing arms reset");
            // Dispatch force arms reset event
            window.dispatchEvent(new CustomEvent('forceArmsReset'));
            
            // Also make sure camera is updated
            window.dispatchEvent(new CustomEvent('cameraUpdateNeeded'));
        }, 1500); // Give extra time for everything to initialize
        
        return () => clearTimeout(initialLoadTimer);
    }, []); // Empty dependency array means this runs once on mount
    
    // Add character correction check
    useEffect(() => {
        // Add a check to correct character type based on player index
        // This ensures players are properly assigned as merc/jackalope
        const checkCharacterCorrection = () => {
            // Skip correction if disabled in debug settings
            if (debugSettings.disable_character_correction) {
                console.log('[DEBUG] Character auto-correction disabled');
                return;
            }
            
            // Skip correction if force_merc_fps is enabled
            if (debugSettings.force_merc_fps) {
                console.log('[DEBUG] Character auto-correction skipped (force_merc_fps active)');
                return;
            }

            if (!connectionManager) return;
            
            const playerIndex = connectionManager.getPlayerIndex();
            console.log(`Checking if character type matches player index ${playerIndex}`);
            
            if (playerIndex < 0) return; // Skip if no player index assigned
            
            // Get correct character for this player index
            const correctCharacter = connectionManager.getPlayerCharacterType();
            
            // Check if current character matches the correct assignment
            if (playerCharacterInfo.type !== correctCharacter.type || 
                playerCharacterInfo.thirdPerson !== correctCharacter.thirdPerson) {
                
                console.error('Character type mismatch! Forcing correction...');
                console.error('🔄 Forcing character type correction based on player index');
                console.error(`🔄 Reset character to ${correctCharacter.type.toUpperCase()} (index: ${playerIndex}, third-person: ${correctCharacter.thirdPerson})`);
                
                // Apply correction
                setPlayerCharacterInfo(correctCharacter);
                
                // Set player type in connection manager for network updates
                connectionManager.setPlayerType(correctCharacter.type);
            } else {
                console.log(`Character type ${playerCharacterInfo.type} correctly matches player index ${playerIndex}`);
            }
        };
        
        console.log('Adding character correction check');
        
        // Check for correct character assignment periodically
        if (enableMultiplayer) {
            const interval = setInterval(checkCharacterCorrection, 5000);
            // Also check immediately
            setTimeout(checkCharacterCorrection, 500);
            
            return () => clearInterval(interval);
        }
    }, [enableMultiplayer, connectionManager, playerCharacterInfo.type, playerCharacterInfo.thirdPerson, debugSettings.disable_character_correction, debugSettings.force_merc_fps]);

    // Add this effect to update playerCharacterInfo when characterType changes in non-multiplayer mode
    useEffect(() => {
        if (!enableMultiplayer) {
            console.log(`Manual character selection changed to: ${characterType}`);
            setPlayerCharacterInfo({
                type: characterType as 'merc' | 'jackalope',
                thirdPerson: characterType === 'jackalope' ? true : false
            });
        }
    }, [characterType, enableMultiplayer]);
    
    // Update third person view when debug settings change
    useEffect(() => {
        if (debugSettings.force_merc_fps && enableMultiplayer) {
            console.log("[DEBUG] Force merc FPS mode enabled");
            // Set character to merc (mercenary) type
            setPlayerCharacterInfo({
                type: 'merc',
                thirdPerson: false
            });
            
            // Trigger a camera update event multiple times for reliability
            const triggerCameraReset = () => {
                console.log("[DEBUG] Dispatching camera update event...");
                window.dispatchEvent(new CustomEvent('cameraUpdateNeeded'));
            };
            
            // Trigger immediately and with delays for reliability
            triggerCameraReset();
            setTimeout(triggerCameraReset, 100);
            setTimeout(triggerCameraReset, 300);
            setTimeout(triggerCameraReset, 1000);
            
            // Also force a reload of FPS arms if needed
            window.dispatchEvent(new CustomEvent('forceArmsReset'));
        }
    }, [debugSettings.force_merc_fps, enableMultiplayer, connectionManager]);
    
    // Handle forceDarkLevel changes - reset arms position for visibility in dark environments
    useEffect(() => {
        if (forceDarkLevel !== undefined) { // Run for both true and false changes
            console.log(`[DEBUG] Force dark level ${forceDarkLevel ? 'enabled' : 'disabled'} - resetting arms position`);
            
            // Function to trigger all needed updates
            const resetCameraAndArms = () => {
                // First dispatch camera update event
                window.dispatchEvent(new CustomEvent('cameraUpdateNeeded'));
                
                // Then dispatch arms reset event (with small delay)
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('forceArmsReset'));
                }, 50);
                
                // Finally force a camera position sync with detailed info
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('forceCameraSync', { 
                        detail: { 
                            forceDarkLevel,
                            timestamp: Date.now(),
                            operation: 'toggle_dark_level'
                        } 
                    }));
                }, 100);
            };
            
            // Execute several times with increasing delays for reliability
            // This improves chances of successful sync across various frame timings
            resetCameraAndArms();
            for (let i = 1; i <= 5; i++) {
                setTimeout(resetCameraAndArms, i * 300);
            }
        }
    }, [forceDarkLevel]);
    
    // Add effect to track player type for global access
    useEffect(() => {
        // Create global game state object if it doesn't exist
        if (!window.jackalopesGame) {
            window.jackalopesGame = {};
        }
        
        // Update player type in global state
        window.jackalopesGame.playerType = enableMultiplayer 
            ? playerCharacterInfo.type 
            : (thirdPersonView ? 'jackalope' : 'merc');
            
        console.log(`Set global player type: ${window.jackalopesGame.playerType}`);
        
        return () => {
            // Cleanup
            delete window.jackalopesGame?.playerType;
        };
    }, [enableMultiplayer, playerCharacterInfo.type, thirdPersonView]);
    
    // Enhanced Leva panel toggle detection
    useEffect(() => {
        // Initialize global state tracking for Leva panel
        if (!window.jackalopesGame) {
            window.jackalopesGame = {};
        }
        window.jackalopesGame.levaPanelState = 'closed'; // Default to closed
        
        // Function to check if panel is collapsed based on DOM
        const isPanelCollapsed = () => {
            const levaRoot = document.getElementById('leva__root');
            if (!levaRoot) return true; // Default to collapsed if not found
            
            // Look for the collapsed class on any child element
            const collapsedElement = levaRoot.querySelector('[class*="leva-c-"][class*="collapsed"]');
            return !!collapsedElement;
        };
        
        // Function to handle manual trigger for camera update
        const handleLevaToggle = (isOpen?: boolean) => {
            console.log("Leva panel toggle detected - forcing camera update");
            
            // Update global state based on DOM if not explicitly provided
            const newState = isOpen !== undefined ? isOpen : !isPanelCollapsed();
            window.jackalopesGame!.levaPanelState = newState ? 'open' : 'closed';
            console.log(`Leva panel is now ${window.jackalopesGame!.levaPanelState}`);
            
            forceCameraReconnection('leva_toggle');
            
            // Reset player position tracking to avoid jumps
            if (playerRef.current?.rigidBody) {
                const position = playerRef.current.rigidBody.translation();
                if (position && playerPosition.current) {
                    playerPosition.current.set(position.x, position.y, position.z);
                }
            }
        };
        
        // Function to handle clicks on the Leva panel button
        const handleLevaBtnClick = (e: MouseEvent) => {
            const target = e.target as Element;
            // Check for clicks on the toggle button or drag handle
            if (target && (
                target.closest('.leva__panel__draggable') || 
                target.closest('#leva__root button') ||
                // Also look for specific Leva classes
                target.closest('[class*="leva-c-"][class*="titleBar"]') ||
                target.closest('[class*="leva-c-"][class*="titleButton"]')
            )) {
                // Short delay to let DOM update
                setTimeout(() => handleLevaToggle(), 50);
            }
        };
        
        // Add click listener for the Leva button with capture phase
        document.addEventListener('click', handleLevaBtnClick, true);
        
        // Create a mutation observer with more reliable detection
        const observer = new MutationObserver((mutations) => {
            // Filter for mutations that might indicate panel state change
            const relevantMutation = mutations.some(mutation => {
                // Check for class changes
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const target = mutation.target as Element;
                    return target.className && 
                        (target.className.includes('leva-c-') || 
                         target.className.includes('collapsed') ||
                         target.className.includes('titleBar'));
                }
                return false;
            });
            
            if (relevantMutation) {
                // Short delay to let DOM update
                setTimeout(() => handleLevaToggle(), 50);
            }
        });
        
        // Find the Leva panel root element and observe it
        const setupObserver = () => {
            const levaRoot = document.getElementById('leva__root');
            if (levaRoot) {
                observer.observe(levaRoot, { 
                    attributes: true, 
                    childList: true, 
                    subtree: true 
                });
                console.log("Observing Leva panel for changes");
                
                // Initial check for panel state
                const initialState = !isPanelCollapsed();
                window.jackalopesGame!.levaPanelState = initialState ? 'open' : 'closed';
                console.log(`Initial Leva panel state: ${window.jackalopesGame!.levaPanelState}`);
            } else {
                // Retry if not found
                setTimeout(setupObserver, 500);
            }
        };
        
        // Setup the observer
        setupObserver();
        
        // Make sure camera is updated on initial load
        setTimeout(() => forceCameraReconnection('initial_setup'), 1500);
        
        return () => {
            observer.disconnect();
            document.removeEventListener('click', handleLevaBtnClick, true);
        };
    }, []);
    
    // Add a special effect to ensure camera is properly connected when character type changes
    useEffect(() => {
        // Only run for jackalope character type
        if (playerCharacterInfo.type === 'jackalope' || thirdPersonView) {
            console.log("Character type or view changed - ensuring camera reconnection");
            
            // Force immediate reconnection
            forceCameraReconnection('character_type_change');
            
            // Add additional reconnection attempts with increasing delays for reliability
            setTimeout(() => forceCameraReconnection('character_delayed_1'), 500);
            setTimeout(() => forceCameraReconnection('character_delayed_2'), 1000);
            setTimeout(() => forceCameraReconnection('character_delayed_3'), 2000);
        }
    }, [playerCharacterInfo.type, thirdPersonView]);
    
    // Add effect to track player type for global access
    useEffect(() => {
        // Create global game state object if it doesn't exist
        if (!window.jackalopesGame) {
            window.jackalopesGame = {};
        }
        
        // Update player type in global state
        window.jackalopesGame.playerType = enableMultiplayer 
            ? playerCharacterInfo.type 
            : (thirdPersonView ? 'jackalope' : 'merc');
            
        console.log(`Set global player type: ${window.jackalopesGame.playerType}`);
        
        return () => {
            // Cleanup
            delete window.jackalopesGame?.playerType;
        };
    }, [enableMultiplayer, playerCharacterInfo.type, thirdPersonView]);
    
    return (
        <>
            {/* Add styles to fix Leva panel positioning and prevent UI disruption */}
            <style>
                {`
                /* Fix positioning of Leva panel and ensure it doesn't disrupt other UI */
                #leva__root {
                    position: fixed !important;
                    z-index: 10000;
                }
                
                /* Ensure Leva panel has consistent width to prevent layout shifts */
                #leva__root > div {
                    width: 280px !important;
                    max-width: 280px !important;
                }
                
                /* Make sure the panel doesn't overlap with important UI elements */
                #leva__root .leva-c-kWgxhW {
                    overflow: auto;
                    max-height: calc(100vh - 40px);
                }
                `}
            </style>
            
            {/* Remove model tester component */}
            {/* {showModelTester && <ModelTester />} */}
            
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
            {playerCharacterInfo.type === 'merc' && (
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
                {fogEnabled && <fog attach="fog" args={[forceDarkLevel ? '#050a14' : (darkMode ? '#111111' : fogColor), forceDarkLevel ? fogNear * 0.5 : fogNear, forceDarkLevel ? (fogFar * 0.3) : (darkMode ? (fogFar * 0.5) : fogFar)]} />}
                <Environment
                    preset={forceDarkLevel ? "night" : "sunset"}
                    background
                    blur={forceDarkLevel ? 0.8 : 0.4} // Increased blur for dark level
                    resolution={globalQualityParams.environmentResolution} // Use quality-based resolution
                />

                {/* Add stars to night sky */}
                {(starsEnabled || darkMode || forceDarkLevel) && <Stars 
                    count={forceDarkLevel ? 4000 : (darkMode ? Math.min(starsCount * 1.5, 3000) : starsCount)} 
                    size={forceDarkLevel ? starsSize * 1.5 : (darkMode ? starsSize * 1.2 : starsSize)} 
                    color={forceDarkLevel ? "#8abbff" : (darkMode ? "#c4e1ff" : starsColor)} 
                    twinkle={starsTwinkle}
                    depth={forceDarkLevel ? 150 : (darkMode ? 120 : 100)} // Even deeper stars in force dark level
                />}

                {/* Add Stats Collector - must be inside Canvas */}
                <StatsCollector />

                <ambientLight intensity={forceDarkLevel ? 0.005 : (darkMode ? 0.02 : ambientIntensity)} />
                <directionalLight
                    castShadow
                    position={[-directionalDistance, directionalHeight, -directionalDistance]}
                    ref={directionalLightRef}
                    intensity={forceDarkLevel ? 0.02 : (darkMode ? 0.1 : directionalIntensity)}
                    shadow-mapSize={[globalQualityParams.shadowMapSize, globalQualityParams.shadowMapSize]}
                    shadow-camera-left={-40}
                    shadow-camera-right={40}
                    shadow-camera-top={40}
                    shadow-camera-bottom={-40}
                    shadow-camera-near={1}
                    shadow-camera-far={200}
                    shadow-bias={-0.001}
                    shadow-normalBias={0.05}
                    shadow-radius={highQualityShadows ? 1 : 2} // Softer shadows in low quality mode
                    color={forceDarkLevel ? "#5577aa" : "#fff"} // Bluish tint for dark level mode
                />

                {/* Only show moon if visibility is enabled */}
                {moonVisible && moonOrbit && <Moon 
                    orbitRadius={Math.max(directionalDistance, 50)} 
                    height={directionalHeight + 10} 
                    orbitSpeed={moonOrbitSpeed} 
                />}

                <Physics 
                    debug={false} 
                    paused={loading}
                    timeStep={1/240} // Increased physics rate to 240Hz for smoother movement
                    interpolate={true}
                    gravity={[0, -9.81, 0]}>
                    <PlayerControls thirdPersonView={enableMultiplayer ? playerCharacterInfo.thirdPerson : thirdPersonView}>
                        {/* Conditionally render either the Player (merc) or Jackalope */}
                        {enableMultiplayer ? (
                            playerCharacterInfo.type === 'merc' ? (
                                <Player 
                                    ref={playerRef}
                                    position={[0, 7, 10]}
                                    walkSpeed={0.02}
                                    runSpeed={0.025}
                                    jumpForce={jumpForce * 0.7}
                                    visible={playerCharacterInfo.thirdPerson}
                                    thirdPersonView={playerCharacterInfo.thirdPerson}
                                    playerType={playerCharacterInfo.type}
                                    connectionManager={enableMultiplayer ? connectionManager : undefined}
                                    onMove={(position) => {
                                        if (directionalLightRef.current && !playerCharacterInfo.thirdPerson) {
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
                                    position={[0, 7, 10]} // Increased height to start well above the ground
                                    walkSpeed={0.56}
                                    runSpeed={1.0}
                                    jumpForce={jumpForce * 0.8}
                                    visible={playerCharacterInfo.thirdPerson}
                                    thirdPersonView={playerCharacterInfo.thirdPerson}
                                    connectionManager={enableMultiplayer ? connectionManager : undefined}
                                    onMove={(position) => {
                                        if (directionalLightRef.current && !playerCharacterInfo.thirdPerson) {
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
                            )
                        ) : (
                            characterType === 'merc' ? (
                                <Player 
                                    ref={playerRef}
                                    position={[0, 7, 10]}
                                    walkSpeed={0.02}
                                    runSpeed={0.025}
                                    jumpForce={jumpForce * 0.7}
                                    visible={thirdPersonView}
                                    thirdPersonView={thirdPersonView}
                                    playerType={characterType}
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
                                    position={[0, 7, 10]} // Increased height to start well above the ground
                                    walkSpeed={0.56}
                                    runSpeed={1.0}
                                    jumpForce={jumpForce * 0.8}
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
                            )
                        )}
                    </PlayerControls>
                    <Platforms />
                    <Ball />

                    <Scene playerRef={playerRef} />
                    
                    {/* Show SphereTool only for merc character - jackalobes don't shoot */}
                    {(enableMultiplayer ? playerCharacterInfo.type === 'merc' : characterType === 'merc') && (
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
                            thirdPersonView={enableMultiplayer ? playerCharacterInfo.thirdPerson : thirdPersonView}
                            playerPosition={enableMultiplayer ? 
                                (playerCharacterInfo.thirdPerson ? playerPosition.current : null) : 
                                (thirdPersonView ? playerPosition.current : null)}
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

                {/* Add third-person camera when needed */}
                {(enableMultiplayer ? playerCharacterInfo.thirdPerson : thirdPersonView) && (
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
                {(enableMultiplayer ? playerCharacterInfo.thirdPerson : thirdPersonView) && playerPosition.current && (
                    <ThirdPersonCameraControls 
                        player={playerPosition.current}
                        cameraRef={thirdPersonCameraRef}
                        enabled={enableMultiplayer ? playerCharacterInfo.thirdPerson : thirdPersonView}
                        distance={cameraDistance}
                        height={cameraHeight}
                        invertY={invertYAxis}
                    />
                )}

                {/* Simplified - just add StableLightUpdater once */}
                <StableLightUpdater />

                {/* Add position tracker component */}
                <PlayerPositionTracker playerRef={playerRef} playerPosition={playerPosition} />

                {/* Add MoonOrbit component if orbiting is enabled */}
                {moonOrbit && <MoonOrbit />}

                {enablePostProcessing && globalQualityParams.effectsEnabled && (
                    <EffectComposer>
                        {bloomEnabled ? (
                            <Bloom 
                                intensity={forceDarkLevel ? bloomIntensity * 4.0 : (darkMode ? bloomIntensity * 2.0 : bloomIntensity)}
                                luminanceThreshold={forceDarkLevel ? 0.01 : (darkMode ? 0.03 : bloomLuminanceThreshold)}
                                luminanceSmoothing={forceDarkLevel ? 0.5 : (darkMode ? 0.7 : 0.9)}
                                mipmapBlur={globalQualityParams.bloomQuality !== 'low'}
                            />
                        ) : <></>}
                        <Vignette
                            offset={vignetteEnabled ? (forceDarkLevel ? 0.0 : (darkMode ? 0.1 : vignetteOffset)) : 0}
                            darkness={vignetteEnabled ? (forceDarkLevel ? 0.98 : (darkMode ? 0.95 : vignetteDarkness)) : 0}
                            eskil={false}
                        />
                        <ChromaticAberration
                            offset={new THREE.Vector2(
                                chromaticAberrationEnabled ? (forceDarkLevel ? chromaticAberrationOffset * 2 : chromaticAberrationOffset) : 0,
                                chromaticAberrationEnabled ? (forceDarkLevel ? chromaticAberrationOffset * 2 : chromaticAberrationOffset) : 0
                            )}
                            radialModulation={false}
                            modulationOffset={0}
                        />
                        <BrightnessContrast
                            brightness={brightnessContrastEnabled ? (forceDarkLevel ? -0.95 : (darkMode ? -0.9 : brightness)) : 0}
                            contrast={brightnessContrastEnabled ? (forceDarkLevel ? 0.6 : (darkMode ? 0.4 : contrast)) : 0} 
                        />
                        <ToneMapping
                            blendFunction={BlendFunction.NORMAL}
                            mode={toneMapping}
                        />
                    </EffectComposer>
                )}
            </Canvas>

            {/* Only show crosshair in first-person view */}
            {(enableMultiplayer ? !playerCharacterInfo.thirdPerson : !thirdPersonView) && <Crosshair />}
            
            {/* Stats Display - must be outside Canvas */}
            <StatsDisplay />
            
            {/* Add NetworkStats component - only affects UI visibility */}
            {showMultiplayerTools && enableMultiplayer && (
                <NetworkStats connectionManager={connectionManager} visible={true} />
            )}

            {showMultiplayerTools && showDebug && connectionManager && (
                <MultiplayerDebugPanel 
                    connectionManager={connectionManager}
                    visible={showMultiplayerTools}
                    isOfflineMode={connectionManager?.isOfflineMode?.() || false}
                    setPlayerCharacterInfo={setPlayerCharacterInfo}
                />
            )}

            {showMultiplayerTools && showDebug && connectionManager && 
              // Check if snapshots exist on connectionManager before using them
              'snapshots' in connectionManager && 'getSnapshotAtTime' in connectionManager && (
                <SnapshotDebugOverlay 
                    snapshots={(connectionManager as any).snapshots} 
                    getSnapshotAtTime={(connectionManager as any).getSnapshotAtTime}
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

            {/* Remove the redundant Instructions component */}
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
                    setPlayerCharacterInfo={setPlayerCharacterInfo}
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

            {/* Debug indicator for player character assignment */}
            {enableMultiplayer && (
                <div style={{
                    position: 'fixed',
                    top: isMobile ? '40px' : '10px', // Move down if mobile indicator is showing
                    left: '10px',
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    zIndex: 1000,
                    fontFamily: 'monospace'
                }}>
                    Player Type: <strong>{playerCharacterInfo.type}</strong><br />
                    View: <strong>{playerCharacterInfo.thirdPerson ? '3rd Person' : '1st Person'}</strong><br />
                    Player ID: <strong>{connectionManager.getPlayerId?.() || 'None'}</strong><br />
                    Connection: <strong>{connectionManager.isOfflineMode() ? 'Offline' : 'Online'}</strong><br />
                    Multiplayer: <strong>{enableMultiplayer ? 'Enabled' : 'Disabled'}</strong>
                </div>
            )}
            
            {/* Add Leva panel with collapsed prop to keep it closed by default */}
            <Leva 
                collapsed={true} 
                titleBar={{ title: "Game Settings", filter: true }} 
                theme={{ 
                    sizes: { rootWidth: "280px" },
                    colors: {
                        highlight1: '#ff9800',
                        highlight2: '#ff7043',
                        highlight3: '#ffab91'
                    }
                }}
                fill={false}
                flat={false}
                oneLineLabels={false}
            />
        </>
    );
}

export default App