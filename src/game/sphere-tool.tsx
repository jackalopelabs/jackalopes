import { useThree } from '@react-three/fiber'
import { RigidBody, useRapier, RapierRigidBody, CollisionEnterPayload, BallCollider } from '@react-three/rapier'
import { useEffect, useState, useRef, useMemo } from 'react'
import { useGamepad } from '../common/hooks/use-gamepad'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Points, BufferGeometry, NormalBufferAttributes, Material } from 'three'

// Fire color palette
const FIRE_COLORS = [
    '#FF4500', // Red-Orange
    '#FF7F00', // Orange
    '#FF5722', // Deep Orange
    '#FFAB00', // Amber
    '#FF9800', // Orange
]

const SHOOT_FORCE = 90 // Significantly increased shoot force
const SPHERE_OFFSET = {
    x: 0.12,  // Slightly to the right
    y: -0.27, // Lower below crosshair
    z: -1.7  // Offset even further back
}

// Maximum number of spheres per player to prevent performance issues
const MAX_SPHERES_PER_PLAYER = 5
// Total maximum spheres allowed in the scene at once
const MAX_TOTAL_SPHERES = 20

// Extended type to include player ID for multiplayer
type SphereProps = {
    id: string               // Unique ID for each sphere
    position: [number, number, number]
    direction: [number, number, number]
    color: string
    radius: number
    playerId?: string  // The ID of the player who shot this sphere
    timestamp: number  // When the sphere was created
    isStuck?: boolean  // Added to track if the sphere is stuck to a surface
}

// Type for remote player shots
export type RemoteShot = {
    id: string
    origin: [number, number, number]
    direction: [number, number, number]
}

// Extended type for network shots that includes additional fields
export interface NetworkRemoteShot extends RemoteShot {
    shotId?: string
    timestamp?: number
}

// Type for FireballParticles props
interface FireballParticlesProps {
    position: [number, number, number]
    color: string
}

// Particle effect for fireballs - simplified version
const FireballParticles = ({ position, color }: FireballParticlesProps) => {
    const particlesRef = useRef<Points<BufferGeometry<NormalBufferAttributes>, Material | Material[]>>(null)
    const count = 10 // Reduced from 20
    
    // Generate initial random positions for particles around the fireball
    const initialPositions = useMemo(() => {
        const positions = new Float32Array(count * 3)
        for (let i = 0; i < count; i++) {
            const radius = 0.05 + Math.random() * 0.05
            const theta = Math.random() * Math.PI * 2
            const phi = Math.random() * Math.PI
            
            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
            positions[i * 3 + 2] = radius * Math.cos(phi)
        }
        return positions
    }, [count])
    
    // Animate particles - simplified to reduce computation
    useFrame(() => {
        if (particlesRef.current) {
            const positions = particlesRef.current.geometry.attributes.position.array as Float32Array
            
            // Only animate every other frame to reduce computation
            if (Math.random() > 0.5) return
            
            for (let i = 0; i < count; i++) {
                // Random movement in small radius - reduced movement
                positions[i * 3] += (Math.random() - 0.5) * 0.005
                positions[i * 3 + 1] += (Math.random() - 0.3) * 0.01 // Bias upward
                positions[i * 3 + 2] += (Math.random() - 0.5) * 0.005
                
                // Reset if too far
                const x = positions[i * 3]
                const y = positions[i * 3 + 1]
                const z = positions[i * 3 + 2]
                const distance = Math.sqrt(x * x + y * y + z * z)
                
                if (distance > 0.15) {
                    positions[i * 3] *= 0.7
                    positions[i * 3 + 1] *= 0.7
                    positions[i * 3 + 2] *= 0.7
                }
            }
            
            particlesRef.current.geometry.attributes.position.needsUpdate = true
        }
    })
    
    return (
        <points position={position} ref={particlesRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={count}
                    array={initialPositions}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial
                size={0.03} // Reduced from 0.04
                color={color}
                transparent
                opacity={0.7} // Reduced from 0.8
                blending={THREE.AdditiveBlending}
            />
        </points>
    )
}

const Sphere = ({ id, position, direction, color, radius, isStuck: initialIsStuck }: SphereProps) => {
    const [stuck, setStuck] = useState(initialIsStuck || false)
    const [finalPosition, setFinalPosition] = useState<[number, number, number]>(position)
    const rigidBodyRef = useRef<RapierRigidBody>(null)
    const [intensity, setIntensity] = useState(2)
    const [canCollide, setCanCollide] = useState(false)
    const distanceTraveled = useRef(0)
    const startPosition = useRef(new THREE.Vector3(...position))
    // Add scale state for growth animation
    const [scale, setScale] = useState(1)
    const startTime = useRef(Date.now())
    const isGrowing = useRef(true)
    
    // Track stuck state for parent component
    const stuckRef = useRef(stuck)
    
    // Update ref when state changes
    useEffect(() => {
        stuckRef.current = stuck;
    }, [stuck]);
    
    // If initially stuck, ensure position is set correctly
    useEffect(() => {
        if (initialIsStuck) {
            setStuck(true);
            setFinalPosition(position);
        }
    }, [initialIsStuck, position]);
    
    // Pulse animation for glow effect and handle growth animation
    useFrame(() => {
        // Animate glow
        setIntensity(1.5 + Math.sin(Date.now() * 0.005) * 0.5)
        
        // Handle growth animation
        if (isGrowing.current) {
            const elapsed = (Date.now() - startTime.current) / 1000 // Convert to seconds
            if (elapsed >= 1) {
                // Animation complete
                setScale(10)
                isGrowing.current = false
            } else {
                // Smooth growth from 1 to 10 over 1 second
                const newScale = 1 + (10 - 1) * elapsed
                setScale(newScale)
            }
        }
        
        // Don't process further if stuck or not initialized
        if (stuck || !rigidBodyRef.current) return
        
        // Calculate distance traveled
        const currentPos = rigidBodyRef.current.translation()
        const current = new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z)
        distanceTraveled.current = current.distanceTo(startPosition.current)
        
        // After traveling some distance, enable collisions
        if (!canCollide && distanceTraveled.current > 5) {
            setCanCollide(true)
        }
        
        // Update final position for particle effects
        setFinalPosition([currentPos.x, currentPos.y, currentPos.z])
    })
    
    // Create a fake emissive glow effect with layers
    const innerMaterial = useMemo(() => {
        return new THREE.MeshStandardMaterial({
            color: new THREE.Color(color),
            emissive: new THREE.Color(color),
            emissiveIntensity: 1.5,
            toneMapped: false
        })
    }, [color])
    
    const outerMaterial = useMemo(() => {
        return new THREE.MeshStandardMaterial({
            color: new THREE.Color(color),
            transparent: true,
            opacity: 0.6,
            emissive: new THREE.Color(color),
            emissiveIntensity: 0.8,
            toneMapped: false
        })
    }, [color])
    
    // Handle collision events 
    const handleCollision = (payload: CollisionEnterPayload) => {
        // Skip if already stuck or can't collide yet or no rigid body reference
        if (stuck || !canCollide || !rigidBodyRef.current) return
        
        // Don't process collisions with entities that lack a rigid body
        if (!payload.other.rigidBody) return
                
        // Get current position
        const position = rigidBodyRef.current.translation()
        setFinalPosition([position.x, position.y, position.z])
        
        // Stick to the surface by making it fixed
        rigidBodyRef.current.setBodyType(1, true) // 1 for Fixed, true to wake the body
        
        // Disable all movement
        rigidBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
        rigidBodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true)
        
        setStuck(true)
    }
    
    // Auto-destroy after 5 seconds
    useEffect(() => {
        if (stuck) {
            const timeout = setTimeout(() => {
                if (rigidBodyRef.current) {
                    rigidBodyRef.current.sleep()
                }
            }, 5000)
            
            return () => clearTimeout(timeout)
        }
    }, [stuck])
    
    // Also auto-destroy after 15 seconds even if not stuck
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (rigidBodyRef.current && !stuck) {
                rigidBodyRef.current.sleep()
            }
        }, 15000)
        
        return () => clearTimeout(timeout)
    }, [])
    
    return (
        <>
            <RigidBody
                ref={rigidBodyRef}
                position={position}
                friction={1}
                angularDamping={0.8}
                linearDamping={0.05} // Lower damping for longer travel
                restitution={0.1}
                colliders={false} // Changed from "ball" to false so we can add our own collider
                mass={0.3} // Even lower mass
                ccd={true}
                onCollisionEnter={handleCollision}
                linearVelocity={stuck ? [0, 0, 0] : [direction[0] * SHOOT_FORCE, direction[1] * SHOOT_FORCE, direction[2] * SHOOT_FORCE]}
                type={stuck ? "fixed" : "dynamic"}
                gravityScale={0.3} // Reduce gravity effect
                scale={scale} // Apply the scale for growth animation
            >
                {/* Custom ball collider that updates with scale */}
                <BallCollider args={[radius]} />
                
                {/* Inner core */}
                <mesh castShadow receiveShadow>
                    <sphereGeometry args={[radius * 0.7, 16, 16]} />
                    <primitive object={innerMaterial} />
                </mesh>
                
                {/* Outer glow */}
                <mesh castShadow>
                    <sphereGeometry args={[radius, 16, 16]} />
                    <primitive object={outerMaterial} />
                </mesh>
            </RigidBody>
            
            {/* Add fire particles - scale with the fireball */}
            <group position={finalPosition} scale={scale}>
                <FireballParticles position={[0, 0, 0]} color={color} />
            </group>
        </>
    )
}

export const SphereTool = ({ 
    onShoot,
    remoteShots = [],
    thirdPersonView = false
}: { 
    onShoot?: (origin: [number, number, number], direction: [number, number, number]) => void,
    remoteShots?: RemoteShot[],
    thirdPersonView?: boolean
}) => {
    const sphereRadius = 0.15 // Slightly larger size for fireballs
    const MAX_AMMO = 50

    const camera = useThree((s) => s.camera)
    const [spheres, setSpheres] = useState<SphereProps[]>([])
    const [ammoCount, setAmmoCount] = useState(MAX_AMMO)
    const [isReloading, setIsReloading] = useState(false)
    const shootingInterval = useRef<number>()
    const isPointerDown = useRef(false)
    const gamepadState = useGamepad()
    
    // Keep track of processed remote shots to avoid duplicates
    const processedRemoteShots = useRef<Set<string>>(new Set());
    
    // Process remote shots with throttling to avoid overwhelming the system
    const pendingRemoteShots = useRef<RemoteShot[]>([]);
    
    // Debug logging for component props
    useEffect(() => {
        console.log('SphereTool mounted with props:', { 
            hasOnShoot: !!onShoot, 
            remoteShots: remoteShots?.length || 0 
        });
        
        // Log when remoteShots array changes
        return () => {
            console.log('SphereTool unmounting, processed shots:', processedRemoteShots.current.size);
        };
    }, []);
    
    // Log when remoteShots changes
    useEffect(() => {
        console.log('remoteShots changed, new length:', remoteShots?.length || 0);
    }, [remoteShots]);
    
    // Helper function to remove old spheres if we exceed the limit for a player
    const removeOldSpheresIfNeeded = (playerID: string, spheresArray: SphereProps[]) => {
        // Keep a copy of the original array to avoid modifying it directly
        let newSpheres = [...spheresArray];
        
        // Find the spheres belonging to this player
        const playerSpheres = newSpheres.filter(sphere => sphere.playerId === playerID);
        
        // Check if we need to remove player-specific old spheres
        if (playerSpheres.length > MAX_SPHERES_PER_PLAYER) {
            // Sort player's spheres by timestamp (oldest first)
            const sortedPlayerSpheres = [...playerSpheres].sort((a, b) => a.timestamp - b.timestamp);
            
            // Get the IDs of the oldest spheres to remove - only remove one at a time to avoid visual glitches
            const numToRemove = Math.min(1, playerSpheres.length - MAX_SPHERES_PER_PLAYER);
            console.log(`Removing ${numToRemove} old spheres for player ${playerID}`);
            
            // Create a set of timestamps to remove (the oldest ones)
            const timestampsToRemove = new Set(
                sortedPlayerSpheres.slice(0, numToRemove).map(sphere => sphere.timestamp)
            );
            
            // Filter out only the specific old spheres by timestamp
            newSpheres = newSpheres.filter(sphere => 
                sphere.playerId !== playerID || !timestampsToRemove.has(sphere.timestamp)
            );
        }
        
        // Check if we need to remove spheres to meet the global limit
        if (newSpheres.length > MAX_TOTAL_SPHERES) {
            // Sort all spheres by timestamp (oldest first)
            const sortedSpheres = [...newSpheres].sort((a, b) => a.timestamp - b.timestamp);
            
            // Identify the specific timestamps to remove - only remove one at a time to avoid visual glitches
            const excessSpheres = Math.min(1, newSpheres.length - MAX_TOTAL_SPHERES);
            console.log(`Global sphere limit reached. Removing ${excessSpheres} oldest spheres.`);
            
            // Create a set of timestamps to remove (the oldest ones)
            const timestampsToRemove = new Set(
                sortedSpheres.slice(0, excessSpheres).map(sphere => sphere.timestamp)
            );
            
            // Filter out only the specific old spheres by timestamp
            newSpheres = newSpheres.filter(sphere => !timestampsToRemove.has(sphere.timestamp));
        }
        
        return newSpheres;
    };

    // Process remote shots - ensure we use the exact direction from the shot data
    useEffect(() => {
        if (!remoteShots || remoteShots.length === 0) return;
        
        console.log('Processing remote shots:', remoteShots);
        
        // IMPORTANT: Create a Map to track shots by their ID before processing
        // This ensures we only process each unique position once
        const shotMap = new Map<string, RemoteShot>();
        
        // First pass: organize shots by their position (rounded)
        remoteShots.forEach(shot => {
            // Create a unique ID for this shot with only player ID and approximate position
            // Round position to 1 decimal place to handle minor variations
            const roundedPos = shot.origin.map(coord => Math.round(coord * 10) / 10);
            const shotId = `${shot.id}--${roundedPos.join(',')}`;
            
            // Check if this shot has already been processed
            const isProcessed = processedRemoteShots.current.has(shotId);
            console.log(`Shot ${shotId} already processed: ${isProcessed}`);
            
            // Only add unprocessed shots to our map (and avoid duplicates within the current batch)
            if (!isProcessed && !shotMap.has(shotId)) {
                shotMap.set(shotId, shot);
                // Mark as processed immediately to prevent duplicates
                processedRemoteShots.current.add(shotId);
            }
        });
        
        // No new shots to process
        if (shotMap.size === 0) {
            console.log('No new shots to process');
            return;
        }
        
        console.log(`Processing ${shotMap.size} new remote shots`);
        
        // Second pass: create spheres from the unique shots
        setSpheres(prev => {
            let newSpheres = [...prev];
            
            // Process each unique shot
            for (const [shotId, shot] of shotMap.entries()) {
                console.log('Processing shot from player:', shot.id);
                
                // Add remote player's shot with fire color
                const fireColor = FIRE_COLORS[Math.floor(Math.random() * FIRE_COLORS.length)];
                
                // Use the exact direction from the shot data
                const exactDirection = [...shot.direction] as [number, number, number];
                
                // Create the new sphere with unique ID
                const uniqueId = `sphere_${shot.id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                const newSphere = {
                    id: uniqueId,
                    position: shot.origin,
                    direction: exactDirection, // Use exact direction
                    color: fireColor,
                    radius: sphereRadius,
                    playerId: shot.id,
                    timestamp: Date.now(),
                    isStuck: false
                };
                
                // Add the new sphere
                newSpheres.push(newSphere);
                
                // Remove old spheres if we exceed the limit
                if (shot.id) {
                    newSpheres = removeOldSpheresIfNeeded(shot.id, newSpheres);
                }
            }
            
            console.log(`Updated spheres array, new length: ${newSpheres.length}`);
            return newSpheres;
        });
        
        // Limit the size of our processed shots set to avoid memory leaks
        if (processedRemoteShots.current.size > 100) {
            const oldSize = processedRemoteShots.current.size;
            processedRemoteShots.current = new Set(
                Array.from(processedRemoteShots.current).slice(-50)
            );
            console.log(`Trimmed processed shots set from ${oldSize} to ${processedRemoteShots.current.size}`);
        }
    }, [remoteShots, sphereRadius]);

    // Remove the interval processing as it's no longer needed
    // The main useEffect above now handles all processing in batch
    useEffect(() => {
        // Clean up any remaining shots in the queue when component unmounts
        return () => {
            pendingRemoteShots.current = [];
        };
    }, []);

    const reload = () => {
        if (isReloading) return
        
        setIsReloading(true)
        // Simulate reload time
        setTimeout(() => {
            setAmmoCount(MAX_AMMO)
            setIsReloading(false)
        }, 1000)
    }

    // Generate a local player ID if needed
    const localPlayerIdRef = useRef<string>(`local_player_${Math.random().toString(36).substring(2, 11)}`);

    const shootSphere = () => {
        // Modified check for pointer lock to work in both first-person and third-person modes
        const firstPersonMode = !thirdPersonView && document.pointerLockElement !== null;
        const thirdPersonMode = thirdPersonView; // Always allow shooting in third-person mode
        const usingGamepad = gamepadState.connected;
        
        const canShoot = (firstPersonMode || thirdPersonMode || usingGamepad) && !isReloading && ammoCount > 0;
        
        if (!canShoot) {
            // More specific error message based on condition
            if (isReloading) {
                console.log('Cannot shoot: Reloading');
            } else if (ammoCount <= 0) {
                console.log('Cannot shoot: No ammo');
            } else {
                console.log('Cannot shoot: Input controls not ready');
            }
            return;
        }

        setAmmoCount(prev => {
            const newCount = prev - 1
            if (newCount <= 0) {
                reload()
            }
            return newCount
        })
        
        try {
            let direction: THREE.Vector3;
            
            if (thirdPersonView) {
                // In third-person mode, shoot straight forward from the camera
                // But modify the Y component to shoot more horizontally
                direction = camera.getWorldDirection(new THREE.Vector3());
                
                // Adjust the Y component to shoot more horizontally (level with the ground)
                // This prevents shooting into the ground in third-person view
                direction.y = Math.max(0, direction.y); // Prevent shooting downward
                
                // If shooting too upward, adjust to be more horizontal
                if (direction.y > 0.5) {
                    direction.y = 0.5;
                }
                
                // Re-normalize after adjustments
                direction.normalize();
                
                console.log('Third-person shooting direction adjusted:', direction);
            } else {
                // In first-person mode, use the exact camera direction
                direction = camera.getWorldDirection(new THREE.Vector3());
            }
            
            // Create offset vector in camera's local space
            const offset = new THREE.Vector3(SPHERE_OFFSET.x, SPHERE_OFFSET.y, SPHERE_OFFSET.z);
            
            if (thirdPersonView) {
                // In third-person, move the starting position forward and up a bit
                // to prevent collisions with the player model
                offset.set(0, 1.0, -1.0); // Start above and in front of the player
            }
            
            offset.applyQuaternion(camera.quaternion);
            const position = camera.position.clone().add(offset);
            
            // Validate vectors
            if (isNaN(direction.x) || isNaN(direction.y) || isNaN(direction.z) ||
                isNaN(position.x) || isNaN(position.y) || isNaN(position.z)) {
                console.warn("Cannot shoot: Invalid position or direction vector");
                return;
            }
            
            // Keep direction normalized
            direction.normalize();

            const fireColor = FIRE_COLORS[Math.floor(Math.random() * FIRE_COLORS.length)];
            const originArray = position.toArray() as [number, number, number];
            const directionArray = direction.toArray() as [number, number, number];
            const localPlayerId = localPlayerIdRef.current;
            
            // Generate a unique ID for this sphere
            const uniqueId = `sphere_${localPlayerId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

            // Always add the local sphere immediately
            setSpheres(prev => {
                // Create the new sphere
                const newSphere = {
                    id: uniqueId,
                    position: originArray,
                    direction: directionArray,
                    color: fireColor,
                    radius: sphereRadius,
                    playerId: localPlayerId,
                    timestamp: Date.now(),
                    isStuck: false
                };
                
                // Add the new sphere
                let newSpheres = [...prev, newSphere];
                
                // Remove old spheres if we exceed the limit
                newSpheres = removeOldSpheresIfNeeded(localPlayerId, newSpheres);
                
                return newSpheres;
            });
            
            // Notify multiplayer system of the shot
            if (onShoot) {
                console.log('Sending shot to multiplayer with onShoot handler:', {
                    position: originArray,
                    direction: directionArray
                });
                
                try {
                    onShoot(originArray, directionArray);
                    console.log('Shot successfully sent to multiplayer');
                } catch (error) {
                    console.error('Error sending shot to multiplayer:', error);
                }
            } else {
                console.log('No onShoot handler available, shot will only be local');
            }
        } catch (error) {
            console.error("Error in shootSphere:", error);
        }
    }

    const startShooting = () => {
        isPointerDown.current = true
        shootSphere()
        shootingInterval.current = window.setInterval(shootSphere, 80)
    }

    const stopShooting = () => {
        isPointerDown.current = false
        if (shootingInterval.current) {
            clearInterval(shootingInterval.current)
        }
    }

    useEffect(() => {
        window.addEventListener('pointerdown', startShooting)
        window.addEventListener('pointerup', stopShooting)
        
        // Handle gamepad shooting
        if (gamepadState.buttons.shoot) {
            if (!isPointerDown.current) {
                startShooting()
            }
        } else if (isPointerDown.current) {
            stopShooting()
        }
        
        return () => {
            window.removeEventListener('pointerdown', startShooting)
            window.removeEventListener('pointerup', stopShooting)
        }
    }, [camera, gamepadState.buttons.shoot])

    // Show ammo counter
    useEffect(() => {
        const ammoDisplay = document.getElementById('ammo-display')
        if (ammoDisplay) {
            ammoDisplay.textContent = isReloading ? 'RELOADING...' : `AMMO: ${ammoCount}/${MAX_AMMO}`
        }
    }, [ammoCount, isReloading])

    // Performance optimization: regularly clean up old spheres - more aggressive cleanup
    useEffect(() => {
        const cleanup = setInterval(() => {
            const now = Date.now();
            setSpheres(prev => {
                if (prev.length === 0) return prev;
                
                // Remove spheres older than 10 seconds (reduced from 15)
                const filteredSpheres = prev.filter(sphere => {
                    const age = now - sphere.timestamp;
                    
                    // Remove very old spheres regardless of state
                    if (age > 10000) return false;
                    
                    // Remove stuck spheres sooner
                    if (sphere.isStuck && age > 5000) return false;
                    
                    return true;
                });
                
                // Log cleanup if we actually removed any spheres
                if (filteredSpheres.length < prev.length) {
                    console.log(`Cleaned up ${prev.length - filteredSpheres.length} old spheres. Remaining: ${filteredSpheres.length}`);
                }
                
                return filteredSpheres;
            });
            
            // Also clean up processed shots to keep memory usage low
            if (processedRemoteShots.current.size > 200) {
                console.log(`Cleaning up processed shots. Before: ${processedRemoteShots.current.size}`);
                processedRemoteShots.current = new Set(
                    Array.from(processedRemoteShots.current).slice(-100)
                );
                console.log(`After cleanup: ${processedRemoteShots.current.size}`);
            }
        }, 2000); // Check every 2 seconds (reduced from 3)
        
        return () => clearInterval(cleanup);
    }, []);

    return (
        <group>
            {spheres.map((props) => (
                <Sphere key={props.id} {...props} />
            ))}
        </group>
    )
}