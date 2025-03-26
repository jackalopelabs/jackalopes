import { Canvas } from './common/components/canvas'
import { Crosshair } from './common/components/crosshair'
import { Instructions } from './common/components/instructions'
import { useLoadingAssets } from './common/hooks/use-loading-assets'
import { Environment, MeshReflectorMaterial, PerspectiveCamera } from '@react-three/drei'
import { EffectComposer, Vignette, ChromaticAberration, BrightnessContrast, ToneMapping } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { useFrame, useThree } from '@react-three/fiber'
import { CuboidCollider, Physics, RigidBody } from '@react-three/rapier'
import { useControls, folder } from 'leva'
import { useTexture } from '@react-three/drei'
import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { Player, PlayerControls } from './game/player'
import { Ball } from './game/ball'
import { SphereTool } from './game/sphere-tool'
import { Platforms } from './game/platforms'
import { MultiplayerManager, useRemoteShots } from './network/MultiplayerManager'
import { NetworkStats } from './network/NetworkStats'
import { ConnectionManager } from './network/ConnectionManager'
import { ConnectionTest } from './components/ConnectionTest'

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
            
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
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
            <mesh position={[25, 2, 0]}>
                <boxGeometry args={[2, 4, 50]} />
                <meshStandardMaterial map={sideWallTexture} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[-25, 2, 0]}>
                <boxGeometry args={[2, 4, 50]} />
                <meshStandardMaterial map={sideWallTexture} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 2, 25]}>
                <boxGeometry args={[50, 4, 2]} />
                <meshStandardMaterial map={frontWallTexture} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 2, -25]}>
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

export function App() {
    const loading = useLoadingAssets()
    const directionalLightRef = useRef<THREE.DirectionalLight>(null)
    
    // Move playerRef to App component scope
    const playerRef = useRef<any>(null);
    // Add a state to track if playerRef is ready
    const [playerRefReady, setPlayerRefReady] = useState(false);
    // Create a shared ConnectionManager instance with the staging server URL
    const [connectionManager] = useState(() => new ConnectionManager('ws://staging.games.bonsai.so/websocket/'));
    // Add state to track if we're in offline mode
    const [isOfflineMode, setIsOfflineMode] = useState(false);
    // Track if notification is visible
    const [showOfflineNotification, setShowOfflineNotification] = useState(false);
    
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
        toneMappingExposure
    } = useControls({
        fog: folder({
            fogEnabled: true,
            fogColor: '#dbdbdb',
            fogNear: { value: 13, min: 0, max: 50, step: 1 },
            fogFar: { value: 95, min: 0, max: 100, step: 1 }
        }, { collapsed: true }),
        lighting: folder({
            ambientIntensity: { value: 1.3, min: 0, max: 2, step: 0.1 },
            directionalIntensity: { value: 1, min: 0, max: 2, step: 0.1 },
            directionalHeight: { value: 20, min: 5, max: 50, step: 1 },
            directionalDistance: { value: 10, min: 5, max: 30, step: 1 }
        }, { collapsed: true }),
        postProcessing: folder({
            enablePostProcessing: true,
            vignetteEnabled: true,
            vignetteOffset: { value: 0.5, min: 0, max: 1, step: 0.1 },
            vignetteDarkness: { value: 0.5, min: 0, max: 1, step: 0.1 },
            chromaticAberrationEnabled: true,
            chromaticAberrationOffset: { value: 0.0005, min: 0, max: 0.01, step: 0.0001 },
            brightnessContrastEnabled: true,
            brightness: { value: 0.1, min: -1, max: 1, step: 0.1 },
            contrast: { value: 0.1, min: -1, max: 1, step: 0.1 },
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

    // Add a toggle for the multiplayer tools panel
    const { showTools, showConnectionTest } = useControls('Game UI', {
        showTools: {
            value: false,
            label: 'Show Multiplayer Tools'
        },
        showConnectionTest: {
            value: false,
            label: 'Show Connection Test UI'
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
                </div>
            </div>
            
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
            
            <Canvas>
                {fogEnabled && <fog attach="fog" args={[fogColor, fogNear, fogFar]} />}
                <Environment
                    preset="sunset"
                    background
                    blur={0.8}
                    resolution={256}
                />

                <ambientLight intensity={ambientIntensity} />
                <directionalLight
                    castShadow
                    position={[directionalDistance, directionalHeight, directionalDistance]}
                    ref={directionalLightRef}
                    intensity={directionalIntensity}
                    shadow-mapSize={[4096, 4096]}
                    shadow-camera-left={-30}
                    shadow-camera-right={30}
                    shadow-camera-top={30}
                    shadow-camera-bottom={-30}
                    shadow-camera-near={1}
                    shadow-camera-far={150}
                    shadow-bias={-0.0001}
                    shadow-normalBias={0.02}
                />

                <Physics 
                    debug={false} 
                    paused={loading}
                    timeStep={1/60}
                    interpolate={true}
                    gravity={[0, -9.81, 0]}
                >
                    <PlayerControls>
                        <Player 
                            ref={playerRef}
                            position={[0, 7, 10]}
                            walkSpeed={walkSpeed}
                            runSpeed={runSpeed}
                            jumpForce={jumpForce}
                            connectionManager={enableMultiplayer ? connectionManager : undefined}
                            onMove={(position) => {
                                if (directionalLightRef.current) {
                                    const light = directionalLightRef.current
                                    light.position.x = position.x + directionalDistance
                                    light.position.z = position.z + directionalDistance
                                    light.target.position.copy(position)
                                    light.target.updateMatrixWorld()
                                }
                            }}
                        />
                    </PlayerControls>
                    <Platforms />
                    <Ball />

                    <Scene playerRef={playerRef} />
                    
                    {/* Show SphereTool - always render it but pass remote shots when multiplayer is enabled */}
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
                    />

                    {/* Use enableMultiplayer instead of showMultiplayerTools for the actual multiplayer functionality */}
                    {enableMultiplayer && playerRefReady && (
                        <MultiplayerManager 
                            localPlayerRef={playerRef} 
                            connectionManager={connectionManager}
                        />
                    )}
                </Physics>

                <PerspectiveCamera 
                    makeDefault 
                    position={[0, 10, 10]} 
                    rotation={[0, 0, 0]}
                    near={0.1}
                    far={1000}
                />

                {/* Temporarily disable post-processing due to TypeScript errors */}
                {/* 
                    Post-processing is disabled due to TypeScript errors.
                    Uncomment this block and fix the TypeScript errors when debugging.
                */}
                {false && enablePostProcessing && (
                    <EffectComposer>
                        <Vignette
                            offset={vignetteOffset}
                            darkness={vignetteDarkness}
                            eskil={false}
                        />
                        <ChromaticAberration
                            offset={new THREE.Vector2(chromaticAberrationOffset, chromaticAberrationOffset)}
                            radialModulation={false}
                            modulationOffset={0}
                        />
                        <BrightnessContrast
                            brightness={brightness}
                            contrast={contrast} 
                        />
                        <ToneMapping
                            blendFunction={BlendFunction.NORMAL}
                            mode={toneMapping}
                        />
                    </EffectComposer>
                )}
            </Canvas>

            <Crosshair />
            
            {/* Add NetworkStats component - only affects UI visibility */}
            {showMultiplayerTools && enableMultiplayer && (
                <NetworkStats connectionManager={connectionManager} visible={true} />
            )}

            {/* Post-processing disabled warning */}
            {enablePostProcessing && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    zIndex: 1000
                }}>
                    Post-processing effects temporarily disabled
                </div>
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
        </>
    )
}

export default App