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

export function App() {
    const loading = useLoadingAssets()
    const directionalLightRef = useRef<THREE.DirectionalLight>(null)
    
    // Move playerRef to App component scope
    const playerRef = useRef<any>(null);
    // Add a state to track if playerRef is ready
    const [playerRefReady, setPlayerRefReady] = useState(false);
    // Create a shared ConnectionManager instance
    const [connectionManager] = useState(() => new ConnectionManager());
    
    // Use an effect to track when the playerRef becomes available
    useEffect(() => {
        if (playerRef.current && !playerRefReady) {
            setPlayerRefReady(true);
        }
    }, [playerRef.current, playerRefReady]);
    
    // Add multiplayer controls to Leva panel and track its state change
    const { enableMultiplayer } = useControls('Multiplayer', {
        enableMultiplayer: {
            value: true,
            label: 'Enable Multiplayer'
        }
    }, {
        collapsed: false,
        order: 997
    });

    // Add a state to properly handle mounting/unmounting of MultiplayerManager
    const [showMultiplayer, setShowMultiplayer] = useState(enableMultiplayer);
    
    // Use an effect to properly handle multiplayer enabling/disabling with proper cleanup timing
    useEffect(() => {
        let timeoutId: number | null = null;
        
        if (enableMultiplayer) {
            // When enabling, set immediately
            setShowMultiplayer(true);
            console.log('Multiplayer enabled');
        } else {
            // When disabling, add a delay to allow for cleanup
            console.log('Disabling multiplayer with cleanup delay...');
            timeoutId = window.setTimeout(() => {
                setShowMultiplayer(false);
                console.log('Multiplayer disabled after cleanup');
            }, 500); // Half-second delay for proper cleanup
        }
        
        // Cleanup function to clear the timeout
        return () => {
            if (timeoutId) {
                window.clearTimeout(timeoutId);
            }
        };
    }, [enableMultiplayer]);

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
        hidden: true
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
        }, { collapsed: true, hidden: true }),
        lighting: folder({
            ambientIntensity: { value: 1.3, min: 0, max: 2, step: 0.1 },
            directionalIntensity: { value: 1, min: 0, max: 2, step: 0.1 },
            directionalHeight: { value: 20, min: 5, max: 50, step: 1 },
            directionalDistance: { value: 10, min: 5, max: 30, step: 1 }
        }, { collapsed: true, hidden: true }),
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
        }, { collapsed: true, hidden: true })
    }, {
        collapsed: true,
        hidden: true
    })

    // Get remote shots from the connection manager (always call the hook to maintain hook order)
    const allRemoteShots = useRemoteShots(connectionManager);
    // Only use the shots when multiplayer is enabled
    const remoteShots = showMultiplayer ? allRemoteShots : [];
    
    // Debug logging for remote shots
    useEffect(() => {
        if (remoteShots.length > 0) {
            console.log('Remote shots in App:', remoteShots);
        }
    }, [remoteShots]);

    const { showDebug } = useControls('Game Settings', {
        showDebug: { value: false }
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
                    intensity={1}
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
                    substeps={2}
                    maxStabilizationIterations={10}
                    maxVelocityIterations={10}
                    maxVelocityFriction={1}
                >
                    <PlayerControls>
                        <Player 
                            ref={playerRef}
                            position={[0, 7, 10]}
                            walkSpeed={walkSpeed}
                            runSpeed={runSpeed}
                            jumpForce={jumpForce}
                            connectionManager={showMultiplayer ? connectionManager : undefined}
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
                        onShoot={showMultiplayer ? 
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

                    {/* Use showMultiplayer instead of enableMultiplayer for conditional rendering */}
                    {showMultiplayer && playerRefReady && (
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

                {enablePostProcessing && (
                    <EffectComposer>
                        {vignetteEnabled && (
                            <Vignette
                                offset={vignetteOffset}
                                darkness={vignetteDarkness}
                                eskil={false}
                            />
                        )}
                        {chromaticAberrationEnabled && (
                            <ChromaticAberration
                                offset={new THREE.Vector2(chromaticAberrationOffset, chromaticAberrationOffset)}
                                radialModulation={false}
                                modulationOffset={0}
                            />
                        )}
                        {brightnessContrastEnabled && (
                            <BrightnessContrast
                                brightness={brightness}
                                contrast={contrast} 
                            />
                        )}
                        {colorGradingEnabled && (
                            <ToneMapping
                                blendFunction={BlendFunction.NORMAL}
                                mode={toneMapping}
                            />
                        )}
                    </EffectComposer>
                )}
            </Canvas>

            <Crosshair />
            
            {/* Add NetworkStats component */}
            {showMultiplayer && (
                <NetworkStats connectionManager={connectionManager} visible={true} />
            )}

            {/* Add debug overlay if enabled */}
            {showMultiplayer && showDebug && (
                <MultiplayerManager.ReconciliationDebugOverlay metrics={connectionManager.reconciliationMetrics} />
            )}

            {showMultiplayer && showDebug && connectionManager?.snapshots && (
                <SnapshotDebugOverlay 
                    snapshots={connectionManager.snapshots} 
                    getSnapshotAtTime={connectionManager.getSnapshotAtTime}
                />
            )}
        </>
    )
}

export default App