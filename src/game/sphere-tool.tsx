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
const MAX_SPHERES_PER_PLAYER = 5 // Further reduced from 3
// Total maximum spheres allowed in the scene at once
const MAX_TOTAL_SPHERES = 20 // Further reduced from 10

// Add performance configuration options
// Add this after MAX_TOTAL_SPHERES
// Performance optimization settings
const PERFORMANCE_CONFIG = {
    enableLights: false,           // Disabled all point lights for performance
    lightDistance: 14,            // Significantly reduced from 22
    lightIntensity: 6,            // Reduced intensity but still bright enough
    maxScale: 5,                  // Reduced from 10
    useSimplifiedParticles: true, // Use fewer particles
    particleCount: 8,             // Reduced from 10
    skipFrames: 2,                // Only update particles every N frames
    disablePhysicsDistance: 50,   // Disable physics for spheres farther than this
    cullingDistance: 100,         // Don't render spheres farther than this
    maxPooledLights: 0,           // No lights for maximum performance
    emissiveBoost: 3.0,           // Significantly increased emissive intensity to compensate for no lights
    // Light settings for different quality levels
    lightSettings: {
        high: { max: 0, distance: 25, intensity: 7 },     // No lights even in high quality
        medium: { max: 0, distance: 20, intensity: 5.5 }, // No lights in medium quality
        low: { max: 0, distance: 15, intensity: 4 }       // No lights in low quality
    }
}

// Player position tracking for distance-based optimization
const playerPositionRef = { current: new THREE.Vector3() };

// Expose this function to update the player position
export const updatePlayerPositionForCulling = (position: THREE.Vector3) => {
    playerPositionRef.current.copy(position);
}

// Extended type to include player ID for multiplayer
type SphereProps = {
    id: string               // Unique ID for each sphere
    position: [number, number, number]
    direction: [number, number, number]
    color: string
    radius: number
    playerId?: string        // The ID of the player who shot this sphere
    timestamp: number        // When the sphere was created
    isStuck?: boolean        // Added to track if the sphere is stuck to a surface
    physicsDisabled?: boolean // Flag to indicate if physics is disabled for optimization
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
    const count = PERFORMANCE_CONFIG.useSimplifiedParticles ? PERFORMANCE_CONFIG.particleCount : 10
    const frameCounter = useRef(0)
    
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
            // Skip frames to improve performance
            frameCounter.current = (frameCounter.current + 1) % PERFORMANCE_CONFIG.skipFrames
            if (frameCounter.current !== 0) return
            
            const positions = particlesRef.current.geometry.attributes.position.array as Float32Array
            
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

// After the imports at the top of file, add this light manager

// Pool of available lights to avoid creating too many at once
class LightPool {
  private static instance: LightPool;
  private maxActiveLights: number = 8; // Maximum number of active lights at once
  private activeFireballs: Map<string, {position: THREE.Vector3, intensity: number, color: string, distance: number}> = new Map();
  private distanceToPlayer: Map<string, number> = new Map();
  private poolDirty: boolean = false;
  private darkMode: boolean = false; // Add dark mode state

  // Get the singleton instance
  public static getInstance(): LightPool {
    if (!LightPool.instance) {
      LightPool.instance = new LightPool();
    }
    return LightPool.instance;
  }

  // Set max active lights (can be adjusted based on performance)
  public setMaxLights(max: number): void {
    this.maxActiveLights = max;
    this.poolDirty = true;
  }
  
  // Set dark mode state
  public setDarkMode(darkMode: boolean): void {
    this.darkMode = darkMode;
    this.poolDirty = true;
  }
  
  // Get dark mode state
  public isDarkMode(): boolean {
    return this.darkMode;
  }

  // Add a modifier for intensity based on dark mode
  private getIntensityModifier(): number {
    return this.darkMode ? 2.0 : 1.0; // Increase intensity in dark mode
  }

  // Register a fireball with the pool
  public registerFireball(id: string, position: THREE.Vector3, playerPosition: THREE.Vector3, intensity: number, color: string, distance: number): boolean {
    // Calculate distance to player
    const distanceToPlayer = position.distanceTo(playerPosition);
    this.distanceToPlayer.set(id, distanceToPlayer);
    
    // Calculate distance factor - maintain higher intensity at a distance
    const distanceFactor = Math.max(0, 1 - (distanceToPlayer / 50)); // Gradual falloff up to 50 units
    
    // Apply dark mode and distance-based intensity boost
    let adjustedIntensity = intensity * this.getIntensityModifier();
    
    // Boost intensity for distant fireballs to make them visible from further away
    // but only if there aren't too many lights competing (performance optimization)
    if (distanceToPlayer > 15 && this.activeFireballs.size < this.maxActiveLights) {
      adjustedIntensity *= (1 + (distanceToPlayer / 50)); // Up to 1.6x boost at 30 units
    }
    
    // Adjust distance based on dark mode and distance to player
    let adjustedDistance = this.darkMode ? distance * 1.4 : distance; // Increase in dark mode
    
    // For distant fireballs, increase light range even more to maintain visibility
    if (distanceToPlayer > 20) {
      adjustedDistance *= (1 + (distanceToPlayer / 100)); // Up to 1.5x at 50 units
    }
    
    // Store fireball data
    this.activeFireballs.set(id, {
      position: position.clone(),
      intensity: adjustedIntensity,
      color,
      distance: adjustedDistance
    });
    
    this.poolDirty = true;
    
    // Return whether this fireball should have a light attached
    return this.shouldHaveLight(id);
  }

  // Update fireball position
  public updateFireball(id: string, position: THREE.Vector3, playerPosition: THREE.Vector3): boolean {
    const fireball = this.activeFireballs.get(id);
    if (!fireball) return false;
    
    // Update position
    fireball.position.copy(position);
    
    // Recalculate distance to player
    const distanceToPlayer = position.distanceTo(playerPosition);
    this.distanceToPlayer.set(id, distanceToPlayer);
    
    return this.shouldHaveLight(id);
  }

  // Remove a fireball from the pool
  public removeFireball(id: string): void {
    this.activeFireballs.delete(id);
    this.distanceToPlayer.delete(id);
    this.poolDirty = true;
  }

  // Check if this fireball should have a high-quality light
  public shouldHaveLight(id: string): boolean {
    if (this.poolDirty) {
      this.updateLightAssignments();
    }
    
    // More dynamic distance cutoff - balance between distance and performance
    const baseMaxDistance = this.darkMode ? 45 : 35; // Increased from 35/25
    const distance = this.distanceToPlayer.get(id) || Infinity;
    
    // Count active lights that are closer to the player than this one
    const closerLightsCount = Array.from(this.distanceToPlayer.entries())
      .filter(entry => entry[1] < distance)
      .length;
    
    // Make distance cutoff more generous when fewer lights are active
    // This allows distant lights when there aren't many nearby
    const dynamicMaxDistance = Math.max(
      baseMaxDistance - (closerLightsCount * 2), // Reduce max distance when many close lights exist
      this.darkMode ? 30 : 22 // Minimum cutoff distance
    );
    
    // Skip if too far based on dynamic distance
    if (distance > dynamicMaxDistance) {
      return false;
    }
    
    // Get closest N fireballs to player that are within range
    const sorted = Array.from(this.distanceToPlayer.entries())
      .filter(entry => entry[1] <= baseMaxDistance) // Use base max for filtering
      .sort((a, b) => a[1] - b[1])
      .slice(0, this.maxActiveLights)
      .map(entry => entry[0]);
    
    return sorted.includes(id);
  }

  // Update all light assignments when pool changes
  private updateLightAssignments(): void {
    this.poolDirty = false;
  }

  // Get all active fireballs for rendering
  public getActiveFireballs(): Map<string, {position: THREE.Vector3, intensity: number, color: string, distance: number}> {
    return this.activeFireballs;
  }
}

// Component to render all pooled lights in one place
const PooledLights = () => {
  const [lights, setLights] = useState<{id: string, position: [number, number, number], color: string, intensity: number, distance: number}[]>([]);
  
  // Update lights on each frame
  useFrame(() => {
    // If lights are disabled, keep the lights array empty
    if (!PERFORMANCE_CONFIG.enableLights) {
      if (lights.length > 0) {
        setLights([]);
      }
      return;
    }
    
    const lightPool = LightPool.getInstance();
    const activeFireballs = lightPool.getActiveFireballs();
    
    // Convert to array for React rendering
    const newLights = Array.from(activeFireballs.entries())
      .filter(([id]) => lightPool.shouldHaveLight(id))
      .map(([id, data]) => ({
        id,
        position: [data.position.x, data.position.y, data.position.z] as [number, number, number],
        color: data.color,
        intensity: data.intensity,
        distance: data.distance
      }));
    
    // Only update state if lights have changed
    if (JSON.stringify(newLights) !== JSON.stringify(lights)) {
      setLights(newLights);
    }
  });
  
  // If lights are disabled, don't render anything
  if (!PERFORMANCE_CONFIG.enableLights) {
    return null;
  }
  
  return (
    <>
      {lights.map(light => {
        // Calculate distance to player for this light
        const playerPos = playerPositionRef.current;
        const lightPos = new THREE.Vector3(...light.position);
        const distanceToPlayer = lightPos.distanceTo(playerPos);
        
        // Adjust decay based on distance - lower decay (slower falloff) when further away
        // This makes lights visible from further despite their intensity
        const dynamicDecay = distanceToPlayer > 15 ? 2.0 : 2.5;
        
        // For distant lights, disable shadows to improve performance
        const shouldCastShadow = distanceToPlayer < 10 ? false : false;
        
        return (
          <pointLight
            key={light.id}
            position={light.position}
            color={light.color}
            intensity={light.intensity}
            distance={light.distance}
            decay={dynamicDecay}
            castShadow={shouldCastShadow}
          />
        );
      })}
    </>
  );
};

const Sphere = ({ id, position, direction, color, radius, isStuck: initialIsStuck }: SphereProps) => {
    const [stuck, setStuck] = useState(initialIsStuck || false)
    const [finalPosition, setFinalPosition] = useState<[number, number, number]>(position)
    const rigidBodyRef = useRef<RapierRigidBody>(null)
    const [intensity, setIntensity] = useState(2)
    const [canCollide, setCanCollide] = useState(false)
    const distanceTraveled = useRef(0)
    const startPosition = useRef(new THREE.Vector3(...position))
    // Add reference for collision time
    const collisionTimeRef = useRef<number | null>(null);
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
    
    // Cache for distance-based optimizations
    const distanceToPlayer = useRef(0);
    const skipPhysicsFrames = useRef(0);
    const currentPosition = useRef(new THREE.Vector3(...position));
    
    // Pulse animation for glow effect and handle growth animation
    useFrame(() => {
        // Only do these calculations every few frames for distant objects
        skipPhysicsFrames.current = (skipPhysicsFrames.current + 1) % 5;
        
        // Check distance to player for optimization
        if (skipPhysicsFrames.current === 0 && !stuck) {
            // Update distance to player
            const playerPos = playerPositionRef.current;
            currentPosition.current.set(...finalPosition);
            distanceToPlayer.current = currentPosition.current.distanceTo(playerPos);
            
            // Register with light pool
            if (PERFORMANCE_CONFIG.enableLights) {
                const lightIntensity = PERFORMANCE_CONFIG.lightIntensity * intensity;
                const lightDistance = PERFORMANCE_CONFIG.lightDistance * Math.min(scale, PERFORMANCE_CONFIG.maxScale / 1.5);
                const spherePosition = new THREE.Vector3(...finalPosition);
                
                // The return value indicates if this sphere should have a high-quality light
                const hasHighQualityLight = LightPool.getInstance().registerFireball(
                    id, 
                    spherePosition,
                    playerPositionRef.current,
                    lightIntensity,
                    color,
                    lightDistance
                );
                
                // Adjust emissive intensity based on whether this has a high-quality light
                // Apply emissive boost for dark mode
                if (innerMaterialRef.current) {
                    // Brighter emissive for spheres without a dedicated light, even brighter in dark mode
                    const baseIntensity = hasHighQualityLight ? 2.5 : 4.0;
                    innerMaterialRef.current.emissiveIntensity = baseIntensity * PERFORMANCE_CONFIG.emissiveBoost;
                }
                if (outerMaterialRef.current) {
                    const baseIntensity = hasHighQualityLight ? 1.2 : 2.0;
                    outerMaterialRef.current.emissiveIntensity = baseIntensity * PERFORMANCE_CONFIG.emissiveBoost;
                }
            }
        }
        
        // For stuck fireballs, handle light duration and fading
        if (stuck && collisionTimeRef.current) {
            const timeSinceCollision = Date.now() - collisionTimeRef.current;
            const lightDuration = 4000; // Keep light for 4 seconds after collision
            const fadeDuration = 1000; // Fade out over 1 second at the end
            
            if (timeSinceCollision < lightDuration) {
                // Calculate fade factor (1.0 = full intensity, 0.0 = zero)
                let fadeFactor = 1.0;
                
                // Start fading in the last second
                if (timeSinceCollision > (lightDuration - fadeDuration)) {
                    fadeFactor = 1.0 - ((timeSinceCollision - (lightDuration - fadeDuration)) / fadeDuration);
                }
                
                // Keep registering with the light pool but with fading intensity
                if (PERFORMANCE_CONFIG.enableLights && skipPhysicsFrames.current === 0) {
                    const fadeIntensity = PERFORMANCE_CONFIG.lightIntensity * intensity * fadeFactor;
                    const spherePosition = new THREE.Vector3(...finalPosition);
                    
                    const hasHighQualityLight = LightPool.getInstance().registerFireball(
                        id, 
                        spherePosition,
                        playerPositionRef.current,
                        fadeIntensity,
                        color,
                        PERFORMANCE_CONFIG.lightDistance * Math.min(scale, PERFORMANCE_CONFIG.maxScale / 1.5)
                    );
                    
                    // Also fade emissive material
                    if (innerMaterialRef.current) {
                        const baseIntensity = hasHighQualityLight ? 2.5 : 4.0;
                        innerMaterialRef.current.emissiveIntensity = baseIntensity * PERFORMANCE_CONFIG.emissiveBoost * fadeFactor;
                    }
                    if (outerMaterialRef.current) {
                        const baseIntensity = hasHighQualityLight ? 1.2 : 2.0;
                        outerMaterialRef.current.emissiveIntensity = baseIntensity * PERFORMANCE_CONFIG.emissiveBoost * fadeFactor;
                    }
                }
            } else if (timeSinceCollision >= lightDuration) {
                // After full duration, remove light but keep sphere
                LightPool.getInstance().removeFireball(id);
                // Only remove from tracking once to avoid multiple calls
                collisionTimeRef.current = null;
            }
        }
        
        // Skip processing if too far away (culling)
        if (distanceToPlayer.current > PERFORMANCE_CONFIG.cullingDistance) {
            return;
        }
        
        // Reduce animation frequency for distant objects
        if (distanceToPlayer.current > PERFORMANCE_CONFIG.disablePhysicsDistance/2 && 
            skipPhysicsFrames.current !== 0) {
            return;
        }
        
        // Animate glow - reduced frequency for distant objects
        if (skipPhysicsFrames.current === 0 || distanceToPlayer.current < 20) {
            setIntensity(1.5 + Math.sin(Date.now() * 0.005) * 0.5);
        }
        
        // Handle growth animation with reduced maximum scale
        if (isGrowing.current) {
            const elapsed = (Date.now() - startTime.current) / 1000; // Convert to seconds
            if (elapsed >= 0.8) { // Slightly faster animation
                // Animation complete
                setScale(PERFORMANCE_CONFIG.maxScale);
                isGrowing.current = false;
            } else {
                // Smooth growth from 1 to maxScale over 0.8 seconds
                const newScale = 1 + (PERFORMANCE_CONFIG.maxScale - 1) * (elapsed / 0.8);
                setScale(newScale);
            }
        }
        
        // Don't process further if stuck or not initialized
        if (stuck || !rigidBodyRef.current) return;
        
        // For distant objects, disable physics but continue visual updates
        if (distanceToPlayer.current > PERFORMANCE_CONFIG.disablePhysicsDistance && !stuck) {
            // Very distant objects update very infrequently
            if (distanceToPlayer.current > PERFORMANCE_CONFIG.disablePhysicsDistance * 2) {
                if (skipPhysicsFrames.current % 10 !== 0) return; // Only update every 10th frame
            } 
            // Medium distant objects update less frequently
            else if (distanceToPlayer.current > PERFORMANCE_CONFIG.disablePhysicsDistance) {
                if (skipPhysicsFrames.current % 5 !== 0) return; // Only update every 5th frame
            }
        }
        
        // Calculate distance traveled
        const currentPos = rigidBodyRef.current.translation();
        const current = new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z);
        distanceTraveled.current = current.distanceTo(startPosition.current);
        
        // After traveling some distance, enable collisions
        if (!canCollide && distanceTraveled.current > 5) {
            setCanCollide(true);
        }
        
        // Update final position for particle effects
        setFinalPosition([currentPos.x, currentPos.y, currentPos.z]);
    })
    
    // Create a fake emissive glow effect with layers
    const innerMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
    const outerMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);

    const innerMaterial = useMemo(() => {
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(color),
            emissive: new THREE.Color(color),
            emissiveIntensity: 5.0, // Significantly increased from 2.5 for more glow without lights
            toneMapped: false,
            transparent: true,
            opacity: 0.9 // Slightly more opaque to increase visibility
        });
        innerMaterialRef.current = material;
        return material;
    }, [color]);
    
    const outerMaterial = useMemo(() => {
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(color),
            transparent: true,
            opacity: 0.5, // Increased from 0.4 for better visibility without lights
            emissive: new THREE.Color(color),
            emissiveIntensity: 2.5, // Increased from 1.2 for brighter glow
            toneMapped: false
        });
        outerMaterialRef.current = material;
        return material;
    }, [color]);
    
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
        
        // Mark as stuck but DON'T remove from light pool until later
        setStuck(true)
        
        // Register this collision time to start light fade timer
        collisionTimeRef.current = Date.now();
    }
    
    // Auto-destroy after 5 seconds
    useEffect(() => {
        if (stuck) {
            const timeout = setTimeout(() => {
                if (rigidBodyRef.current) {
                    rigidBodyRef.current.sleep();
                }
                // Remove from light pool when destroyed - already handled by collision timer
                // LightPool.getInstance().removeFireball(id);
            }, 5000);
            
            return () => clearTimeout(timeout);
        }
    }, [stuck, id]);
    
    // Also auto-destroy after 15 seconds even if not stuck
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (rigidBodyRef.current && !stuck) {
                rigidBodyRef.current.sleep();
            }
            // Remove from light pool when destroyed
            LightPool.getInstance().removeFireball(id);
        }, 15000);
        
        return () => clearTimeout(timeout);
    }, [id, stuck]);
    
    // Clean up on unmount
    useEffect(() => {
        return () => {
            // Ensure light is removed from pool when component unmounts
            LightPool.getInstance().removeFireball(id);
        };
    }, [id]);
    
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
                
                {/* Light is now managed by the light pool instead of individual lights */}
                {/* Each sphere now has a bright emissive material to simulate glow when no light is attached */}
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
    thirdPersonView = false,
    playerPosition = null // Add optional player position for third-person shooting
}: { 
    onShoot?: (origin: [number, number, number], direction: [number, number, number]) => void,
    remoteShots?: RemoteShot[],
    thirdPersonView?: boolean,
    playerPosition?: THREE.Vector3 | null
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
    
    // Process remote shots - ensure we use the exact direction from the shot data
    useEffect(() => {
        if (!remoteShots || remoteShots.length === 0) return;
        
        // IMPORTANT: Create a Map to track shots by their ID before processing
        // This ensures we only process each unique shot once
        const shotMap = new Map<string, RemoteShot>();
        
        // First pass: organize shots by their unique ID
        remoteShots.forEach(shot => {
            // Use the player ID and original shotId if available, otherwise generate one
            // This is more reliable than using position for deduplication
            const shotId = shot.id && (shot as any).shotId 
                ? `${shot.id}--${(shot as any).shotId}`
                : `${shot.id}--${shot.origin.join(',')}-${Date.now()}`;
            
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
        
        // Limit the size of our processed shots set to avoid memory leaks - more aggressive cleanup
        if (processedRemoteShots.current.size > 100) { // Increased from 50 for better tracking
            const oldSize = processedRemoteShots.current.size;
            processedRemoteShots.current = new Set(
                Array.from(processedRemoteShots.current).slice(-50) // Keep the 50 most recent
            );
            console.log(`Trimmed processed shots set from ${oldSize} to ${processedRemoteShots.current.size}`);
        }
    }, [remoteShots, sphereRadius]);

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
            
            let position: THREE.Vector3;
            
            if (thirdPersonView && playerPosition) {
                // If playerPosition is provided in third-person mode,
                // use the actual player position as the base for shooting
                position = playerPosition.clone();
                
                // Add a slight offset forward and up from the player's center
                position.y += 1.0; // Chest height
                
                // Calculate a forward offset based on direction
                const forwardOffset = new THREE.Vector3()
                    .copy(direction)
                    .multiplyScalar(0.5); // Forward offset distance
                
                // Only use the X and Z components for forward movement
                forwardOffset.y = 0;
                
                // Add the forward offset to position
                position.add(forwardOffset);
                
                console.log('Third-person shooting from player position:', position.toArray());
            } else {
                // For first-person or when player position is not available
                if (thirdPersonView) {
                    // In third-person but no player position, adjust the offset
                    offset.set(0, 0.3, -0.5);
                }
                
                // Apply offset to camera position
                offset.applyQuaternion(camera.quaternion);
                position = camera.position.clone().add(offset);
                
                // Debug log for third-person shooting from camera
                if (thirdPersonView) {
                    console.log('Third-person shooting from camera (fallback):', position.toArray());
                }
            }
            
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

            // Update player position for culling
            if (thirdPersonView && playerPosition) {
                updatePlayerPositionForCulling(playerPosition);
            } else {
                updatePlayerPositionForCulling(camera.position);
            }
            
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
                    isStuck: false,
                    physicsDisabled: false // Start with physics enabled
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
        if (shootCooldownRef.current) return;
        
        isPointerDown.current = true
        shootSphere()
        
        // Set a cooldown to prevent rapid-firing
        shootCooldownRef.current = true;
        setTimeout(() => {
            shootCooldownRef.current = false;
        }, 300);
        
        // Increase interval between shots significantly
        shootingInterval.current = window.setInterval(shootSphere, 300) // Increased from 150 to 300ms
    }

    const stopShooting = () => {
        isPointerDown.current = false
        if (shootingInterval.current) {
            clearInterval(shootingInterval.current)
        }
    }

    // Add a cooldown ref to prevent rapid firing
    const shootCooldownRef = useRef(false);

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
                
                // Track removed spheres to clean them from the light pool
                const removedSphereIds: string[] = [];
                
                // Remove spheres older than 6 seconds (reduced from 10)
                const filteredSpheres = prev.filter(sphere => {
                    const age = now - sphere.timestamp;
                    
                    // Check if sphere should be removed
                    const shouldRemove = 
                        (age > 6000) || // Remove very old spheres regardless of state
                        (sphere.isStuck && age > 5000); // Remove stuck spheres after 5 seconds instead of 3
                    
                    // If removing, track the ID for light pool cleanup
                    if (shouldRemove) {
                        removedSphereIds.push(sphere.id);
                    }
                    
                    return !shouldRemove;
                });
                
                // Clean up lights for removed spheres
                if (removedSphereIds.length > 0) {
                    const lightPool = LightPool.getInstance();
                    removedSphereIds.forEach(id => {
                        lightPool.removeFireball(id);
                    });
                    
                    console.log(`Cleaned up ${removedSphereIds.length} old spheres and their lights. Remaining: ${filteredSpheres.length}`);
                }
                
                return filteredSpheres;
            });
            
            // Also clean up processed shots to keep memory usage low
            if (processedRemoteShots.current.size > 150) {
                console.log(`Cleaning up processed shots. Before: ${processedRemoteShots.current.size}`);
                processedRemoteShots.current = new Set(
                    Array.from(processedRemoteShots.current).slice(-100) // Keep more recent shots
                );
                console.log(`After cleanup: ${processedRemoteShots.current.size}`);
            }
        }, 1000); // Clean up every second
        
        return () => clearInterval(cleanup);
    }, []);

    // Add an effect to the SphereTool component to update player position based on camera position
    // Add this inside the SphereTool component before the return statement:
    useFrame(() => {
        if (thirdPersonView && playerPosition) {
            updatePlayerPositionForCulling(playerPosition);
        } else {
            updatePlayerPositionForCulling(camera.position);
        }
    });

    // useEffect for cleanup
    useEffect(() => {
        // Clean up when component unmounts
        return () => {
            // Clean up any remaining spheres from the light pool
            spheres.forEach(sphere => {
                LightPool.getInstance().removeFireball(sphere.id);
            });
        };
    }, [spheres]);

    return (
        <group>
            {/* Render all pooled lights in one place */}
            <PooledLights />
            
            {/* Render all spheres */}
            {spheres.map((props) => (
                <Sphere key={props.id} {...props} />
            ))}
        </group>
    )
}

// Add a way to detect performance issues and adjust settings automatically
// Add this after imports at the top of the file
// Performance detection and automatic adjustment
let fpsHistory: number[] = [];
let lastFrameTime = performance.now();
let lowPerformanceDetected = false;

// Monitor FPS and adjust settings if needed
const checkPerformance = () => {
    const now = performance.now();
    const delta = now - lastFrameTime;
    lastFrameTime = now;
    
    if (delta > 0) {
        const fps = 1000 / delta;
        fpsHistory.push(fps);
        
        // Keep last 60 frames
        if (fpsHistory.length > 60) {
            fpsHistory.shift();
        }
        
        // If we have enough samples, check for low performance
        if (fpsHistory.length >= 30) {
            const avgFps = fpsHistory.reduce((sum, fps) => sum + fps, 0) / fpsHistory.length;
            
            if (avgFps < 45 && !lowPerformanceDetected) {
                // Automatically reduce settings
                console.log('Low performance detected, reducing effects');
                PERFORMANCE_CONFIG.enableLights = false; // Keep lights disabled for performance
                PERFORMANCE_CONFIG.maxScale = 3;
                PERFORMANCE_CONFIG.useSimplifiedParticles = true;
                PERFORMANCE_CONFIG.particleCount = 4;
                PERFORMANCE_CONFIG.skipFrames = 4;
                // Set emissive boost for low performance
                PERFORMANCE_CONFIG.emissiveBoost = 2.0;
                // Keep max lights at 0
                LightPool.getInstance().setMaxLights(0);
                lowPerformanceDetected = true;
            }
        }
    }
    
    requestAnimationFrame(checkPerformance);
};

// Start performance monitoring
requestAnimationFrame(checkPerformance);

// Declare the type for the quality setting function for TypeScript
declare global {
    interface Window {
        __setGraphicsQuality?: (quality: 'auto' | 'high' | 'medium' | 'low') => void;
        __currentQuality?: 'auto' | 'high' | 'medium' | 'low'; // Add this
    }
}

// Add a global function to set quality from UI
window.__setGraphicsQuality = (quality: 'auto' | 'high' | 'medium' | 'low') => {
    console.log(`Setting graphics quality to: ${quality}`);
    
    window.__currentQuality = quality; // Store the current quality
    
    if (quality === 'auto') {
        // Keep current auto-detection settings
        return;
    }
    
    // Reset low performance detection since user is manually setting quality
    lowPerformanceDetected = false;
    
    // Apply settings based on quality level
    switch (quality) {
        case 'high':
            PERFORMANCE_CONFIG.enableLights = false; // Lights disabled for performance
            PERFORMANCE_CONFIG.lightDistance = 44;
            PERFORMANCE_CONFIG.lightIntensity = 12;
            PERFORMANCE_CONFIG.maxScale = 8;
            PERFORMANCE_CONFIG.useSimplifiedParticles = false;
            PERFORMANCE_CONFIG.particleCount = 10;
            PERFORMANCE_CONFIG.skipFrames = 1;
            PERFORMANCE_CONFIG.emissiveBoost = 4.0; // Higher emissive boost for high quality
            // Set light pool size
            LightPool.getInstance().setMaxLights(0);
            break;
            
        case 'medium':
            PERFORMANCE_CONFIG.enableLights = false; // Lights disabled for performance
            PERFORMANCE_CONFIG.lightDistance = 22;
            PERFORMANCE_CONFIG.lightIntensity = 8;
            PERFORMANCE_CONFIG.maxScale = 5;
            PERFORMANCE_CONFIG.useSimplifiedParticles = true;
            PERFORMANCE_CONFIG.particleCount = 8;
            PERFORMANCE_CONFIG.skipFrames = 2;
            PERFORMANCE_CONFIG.emissiveBoost = 3.0; // Medium emissive boost
            // Set light pool size
            LightPool.getInstance().setMaxLights(0);
            break;
            
        case 'low':
            PERFORMANCE_CONFIG.enableLights = false; // Lights disabled for performance
            PERFORMANCE_CONFIG.lightDistance = 18;
            PERFORMANCE_CONFIG.lightIntensity = 5;
            PERFORMANCE_CONFIG.maxScale = 3;
            PERFORMANCE_CONFIG.useSimplifiedParticles = true;
            PERFORMANCE_CONFIG.particleCount = 4;
            PERFORMANCE_CONFIG.skipFrames = 4;
            PERFORMANCE_CONFIG.emissiveBoost = 2.0; // Lower but still sufficient emissive boost
            // Set light pool size
            LightPool.getInstance().setMaxLights(0);
            break;
    }
    
    console.log('Applied new performance settings:', PERFORMANCE_CONFIG);
};

// Now expose a global function to set dark mode
// Add this near the other global functions:
export const setSphereDarkMode = (darkMode: boolean) => {
  LightPool.getInstance().setDarkMode(darkMode);
  
  // Also adjust the PERFORMANCE_CONFIG for dark mode
  if (darkMode) {
    // In dark mode: higher emissive intensity for better visibility
    PERFORMANCE_CONFIG.lightIntensity = PERFORMANCE_CONFIG.lightIntensity * 1.5; // Keep for potential future use
    PERFORMANCE_CONFIG.lightDistance = PERFORMANCE_CONFIG.lightDistance * 1.3;   // Keep for potential future use
    
    // Much higher emissive boost to enhance the glow effect in dark mode
    PERFORMANCE_CONFIG.emissiveBoost = 5.0;
    
    // Keep max lights at 0 for performance
    LightPool.getInstance().setMaxLights(0);
  } else {
    // Reset to original values based on current quality
    const quality = window.__currentQuality || 'medium';
    switch (quality) {
      case 'high':
        PERFORMANCE_CONFIG.lightIntensity = 8;
        PERFORMANCE_CONFIG.lightDistance = 18;
        PERFORMANCE_CONFIG.emissiveBoost = 4.0;
        break;
      case 'medium':
        PERFORMANCE_CONFIG.lightIntensity = 6;
        PERFORMANCE_CONFIG.lightDistance = 14;
        PERFORMANCE_CONFIG.emissiveBoost = 3.0;
        break;
      case 'low':
        PERFORMANCE_CONFIG.lightIntensity = 4;
        PERFORMANCE_CONFIG.lightDistance = 10;
        PERFORMANCE_CONFIG.emissiveBoost = 2.0;
        break;
    }
    
    // Keep max lights at 0 for performance
    LightPool.getInstance().setMaxLights(0);
  }
  
  console.log(`Sphere dark mode set to: ${darkMode}, emissive boost: ${PERFORMANCE_CONFIG.emissiveBoost}`);
};