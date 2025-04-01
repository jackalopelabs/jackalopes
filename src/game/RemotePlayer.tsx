import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { Html, Billboard, Text, Clone, useGLTF } from '@react-three/drei';
import { useFrame, RootState } from '@react-three/fiber';
import { Points, BufferGeometry, NormalBufferAttributes, Material } from 'three';
import { MercModelPath, JackalopeModelPath } from '../assets'; // Import model paths instead of components
import { RemotePlayerAudio } from '../components/RemotePlayerAudio'; // Import RemotePlayerAudio component
import { log, DEBUG_LEVELS, isDebugEnabled } from '../utils/debugUtils'; // Import new debug utilities
import { RigidBody, CapsuleCollider, BallCollider, CuboidCollider } from '@react-three/rapier'; // Import Rapier physics components
import { MercModel } from './MercModel';
import { JackalopeModel } from './JackalopeModel';

// Add window type declaration at the top of the file with all custom properties
declare global {
  interface Window {
    __fallbackModels?: Record<string, THREE.Object3D>;
    __jackalopeAttachmentHandlers?: Record<string, (projectileData: {id: string, position: THREE.Vector3}) => boolean>;
  }
}

// Define the RemotePlayerData interface locally to match MultiplayerManager
interface RemotePlayerData {
  playerId: string;
  position: { x: number, y: number, z: number };
  rotation: number;
  playerType?: 'merc' | 'jackalope';
  isMoving?: boolean;
  isRunning?: boolean;
  isShooting?: boolean;
}

// Interface for RemotePlayer props
export interface RemotePlayerProps {
  playerId: string;
  position: THREE.Vector3;
  rotation: number;
  playerType: 'merc' | 'jackalope';
  isMoving?: boolean;
  isRunning?: boolean;
  isShooting?: boolean;
  audioListener?: THREE.AudioListener;
  // Add any other props needed
}

// Interface for the exposed methods
export interface RemotePlayerMethods {
  updateTransform: (position: [number, number, number], rotation: [number, number, number, number]) => void;
}

// FlamethrowerFlame component for the particle effect
const FlamethrowerFlame = () => {
  const particlesRef = useRef<Points<BufferGeometry<NormalBufferAttributes>, Material | Material[]>>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const count = 15; // Number of particles
  
  // Generate initial random positions for particles 
  const initialPositions = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Start particles from the nozzle with forward direction
      const spread = 0.03;
      positions[i * 3] = 0.1 + Math.random() * 0.1; // Forward from nozzle
      positions[i * 3 + 1] = (Math.random() - 0.5) * spread; // Slight up/down spread
      positions[i * 3 + 2] = (Math.random() - 0.5) * spread; // Slight left/right spread
    }
    return positions;
  }, [count]);
  
  // Animate particles for flame effect
  useFrame(() => {
    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
      
      for (let i = 0; i < count; i++) {
        // Move particles outward from nozzle
        positions[i * 3] += 0.02 + Math.random() * 0.01;
        
        // Add some random movement
        positions[i * 3 + 1] += (Math.random() - 0.5) * 0.01;
        positions[i * 3 + 2] += (Math.random() - 0.5) * 0.01;
        
        // Reset particles that have gone too far
        if (positions[i * 3] > 0.3) {
          positions[i * 3] = 0.05 + Math.random() * 0.05;
          positions[i * 3 + 1] = (Math.random() - 0.5) * 0.03;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 0.03;
        }
      }
      
      // Pulsing glow effect for the flame
      if (materialRef.current) {
        materialRef.current.size = 0.02 + Math.sin(Date.now() * 0.01) * 0.005;
        materialRef.current.opacity = 0.7 + Math.sin(Date.now() * 0.008) * 0.2;
      }
      
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });
  
  return (
    <points ref={particlesRef} position={[0.6, 0, 0]}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={initialPositions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        size={0.02}
        color="#ff7700"
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

// PilotLight component for the animated pilot light
const PilotLight = () => {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  
  // Animate the pilot light intensity
  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.emissiveIntensity = 2 + Math.sin(Date.now() * 0.01) * 0.5;
    }
  });
  
  return (
    <mesh position={[0.63, 0.03, 0]}>
      <sphereGeometry args={[0.02, 8, 8]} />
      <meshStandardMaterial 
        ref={materialRef}
        color="#ff9500" 
        emissive="#ff5500" 
        emissiveIntensity={2}
        toneMapped={false} 
      />
    </mesh>
  );
};

// Remote Player Component
export const RemotePlayer: React.FC<RemotePlayerProps> = ({ 
  playerId, position, rotation, playerType = 'merc', isMoving, isRunning, isShooting, audioListener
}) => {
  // Add debug logging for player type
  if (isDebugEnabled(DEBUG_LEVELS.INFO)) {
    log.player(`RemotePlayer ${playerId} rendering with playerType: ${playerType || 'undefined'}`);
  }
  
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const lastAnimationChangeTime = useRef<number>(Date.now());
  const pendingAnimationChange = useRef<string | null>(null);
  const lastPosition = useRef<THREE.Vector3 | null>(null);
  const lastMoveTimestamp = useRef<number>(Date.now());
  const currentAnimation = useRef("idle"); // Default to idle
  
  // Add reference for smooth rotation
  const currentRotation = useRef<number>(rotation || 0);
  
  const MIN_ANIMATION_CHANGE_INTERVAL = 200; // ms
  
  // Inside the RemotePlayer component, add better error handling
  // Add a state to track model loading errors
  const [modelError, setModelError] = useState(false);
  
  // Determine player color based on type
  const playerColor = useMemo(() => {
    return playerType === 'merc' ? 'red' : 'blue';
  }, [playerType]);
  
  // Create a fallback model if needed
  const createFallbackModel = useCallback(() => {
    const geometry = new THREE.BoxGeometry(0.5, 1.8, 0.5);
    const material = new THREE.MeshStandardMaterial({ 
      color: playerColor,
      roughness: 0.7,
      metalness: 0.3
    });
    return new THREE.Mesh(geometry, material);
  }, [playerColor]);
  
  // Get local state for animation scheduling
  const [localIsMoving, setLocalIsMoving] = useState(isMoving || false);
  const [localIsRunning, setLocalIsRunning] = useState(isRunning || false);
  
  // Log every state update to debug movement sound issues
  useEffect(() => {
    if (isDebugEnabled(DEBUG_LEVELS.VERBOSE)) {
      log.player(`RemotePlayer ${playerId} received props update: ${JSON.stringify({ 
        isMoving, 
        isRunning, 
        isShooting,
        localIsMoving,
        localIsRunning
      })}`);
    }
  }, [isMoving, isRunning, isShooting, localIsMoving, localIsRunning, playerId]);
  
  // Force re-check movement state when props change
  useEffect(() => {
    // Debug the incoming props more clearly
    if (isDebugEnabled(DEBUG_LEVELS.VERBOSE)) {
      log.player(`RemotePlayer ${playerId} movement props received: ${JSON.stringify({
        isMoving: isMoving === true ? "TRUE" : (isMoving === false ? "FALSE" : "undefined"),
        isRunning: isRunning === true ? "TRUE" : (isRunning === false ? "FALSE" : "undefined"),
      })}`);
    }
    
    // Add hysteresis to prevent rapid toggling between states
    const now = Date.now();
    const timeSinceLastChange = now - lastAnimationChangeTime.current;
    const MIN_STATE_CHANGE_INTERVAL = 500; // Require 500ms between state changes
    
    // If it's too soon for another state change, ignore this update
    if (timeSinceLastChange < MIN_STATE_CHANGE_INTERVAL) {
      if (isDebugEnabled(DEBUG_LEVELS.VERBOSE)) {
        log.player(`${playerId}: Ignoring movement state change - too frequent (${timeSinceLastChange}ms)`);
      }
      return;
    }
    
    // Don't let walking and running both be true at the same time
    if (isMoving === true && isRunning === true) {
      // Running takes precedence
      if (isDebugEnabled(DEBUG_LEVELS.VERBOSE)) {
        log.player(`${playerId}: Both moving and running flags are true - setting to RUNNING`);
      }
      setLocalIsMoving(true);
      setLocalIsRunning(true);
      lastAnimationChangeTime.current = now;
    } else if (isMoving === true && isRunning !== true) {
      // Walking only - make sure isRunning is explicitly FALSE
      if (isDebugEnabled(DEBUG_LEVELS.VERBOSE)) {
        log.player(`${playerId}: Moving=true, Running!=true - setting to WALKING`);
      }
      setLocalIsMoving(true);
      setLocalIsRunning(false);
      lastAnimationChangeTime.current = now;
    } else if (isMoving === false) {
      // Not moving - stop all movement
      if (isDebugEnabled(DEBUG_LEVELS.VERBOSE)) {
        log.player(`${playerId}: Moving=false - setting to STOPPED`);
      }
      setLocalIsMoving(false);
      setLocalIsRunning(false);
      lastAnimationChangeTime.current = now;
    }
  }, [isMoving, isRunning, playerId]);
  
  // Calculate local walking and running state properly
  const walkingOnly = localIsMoving && !localIsRunning;
  const running = localIsRunning;
  
  // Log changes in the calculated audio states
  useEffect(() => {
    if (isDebugEnabled(DEBUG_LEVELS.VERBOSE)) {
      log.player(`${playerId} audio states calculated: ${JSON.stringify({
        walkingOnly,
        running,
        shouldPlayWalkSound: walkingOnly,
        shouldPlayRunSound: running,
      })}`);
    }
  }, [walkingOnly, running, playerId]);
  
  // Update local isMoving state when the prop changes, with rate limiting
  useEffect(() => {
    if (isMoving !== undefined) {
      const now = Date.now();
      const timeSinceLastChange = now - lastAnimationChangeTime.current;
      
      if (isDebugEnabled(DEBUG_LEVELS.VERBOSE)) {
        log.player(`RemotePlayer ${playerId} movement state update: isMoving=${isMoving}, isRunning=${isRunning}`);
      }
      
      // Apply rate limiting to prevent animation flicker
      if (timeSinceLastChange < MIN_ANIMATION_CHANGE_INTERVAL) {
        // Too soon for another animation change, store it as pending
        pendingAnimationChange.current = isMoving ? "walk" : "idle";
        if (isDebugEnabled(DEBUG_LEVELS.VERBOSE)) {
          log.player(`Animation change too frequent for ${playerId}, queueing ${pendingAnimationChange.current}`);
        }
      } else {
        // Apply animation change immediately
        setLocalIsMoving(isMoving);
        currentAnimation.current = isMoving ? "walk" : "idle";
        lastAnimationChangeTime.current = now;
        if (isDebugEnabled(DEBUG_LEVELS.VERBOSE)) {
          log.player(`Remote player ${playerId} animation set to ${isMoving ? "walk" : "idle"} from props`);
        }
      }
    }
    
    // Update running state
    if (isRunning !== undefined) {
      setLocalIsRunning(isRunning);
      if (isDebugEnabled(DEBUG_LEVELS.VERBOSE)) {
        log.player(`RemotePlayer ${playerId} running state set to ${isRunning}`);
      }
    }
  }, [isMoving, isRunning, playerId]);
  
  // Add debug output to monitor state changes
  useEffect(() => {
    if (isDebugEnabled(DEBUG_LEVELS.VERBOSE)) {
      log.player(`RemotePlayer ${playerId} state updated: localIsMoving=${localIsMoving}, localIsRunning=${localIsRunning}`);
    }
  }, [localIsMoving, localIsRunning, playerId]);
  
  // Apply any pending animation changes
  useFrame((_, delta) => {
    // Check if there's a pending animation change and enough time has passed
    if (pendingAnimationChange.current !== null) {
      const now = Date.now();
      const timeSinceLastChange = now - lastAnimationChangeTime.current;
      
      if (timeSinceLastChange >= MIN_ANIMATION_CHANGE_INTERVAL) {
        // Apply the pending animation change
        const newAnim = pendingAnimationChange.current;
        setLocalIsMoving(newAnim === "walk");
        currentAnimation.current = newAnim;
        lastAnimationChangeTime.current = now;
        pendingAnimationChange.current = null;
        if (isDebugEnabled(DEBUG_LEVELS.VERBOSE)) {
          log.player(`Applied pending animation change for ${playerId}: ${newAnim}`);
        }
      }
    }
    
    if (!meshRef.current) return;
    
    // Safely update position with error checking
    if (position && typeof position.x === 'number' && 
        typeof position.y === 'number' && 
        typeof position.z === 'number') {
      
      // Set initial last position if undefined
      if (!lastPosition.current) {
        lastPosition.current = new THREE.Vector3(position.x, position.y, position.z);
      }
      
      // Create current position vector for comparison
      const currentPos = new THREE.Vector3(position.x, position.y, position.z);
      
      // IMPROVED POSITION INTERPOLATION
      // Get current mesh position
      const meshPos = meshRef.current.position;
      
      // Calculate the distance to the target position
      const distanceToTarget = meshPos.distanceTo(currentPos);
      
      // Determine interpolation speed based on distance
      // Faster interpolation when further away to catch up quickly
      let moveSpeed;
      if (distanceToTarget > 5) {
        // Very far behind - snap to position
        moveSpeed = 1.0;
      } else if (distanceToTarget > 2) {
        // Far behind - catch up quickly
        moveSpeed = Math.min(1, delta * 15);
      } else if (distanceToTarget > 0.5) {
        // Medium distance - moderate catch-up
        moveSpeed = Math.min(1, delta * 8);
      } else {
        // Close - smooth movement
        moveSpeed = Math.min(1, delta * 6);
      }
      
      // Apply interpolation - faster than before to reduce lag
      meshPos.lerp(currentPos, moveSpeed);
      
      // Only check for movement when isMoving is undefined (fallback to local detection)
      if (lastPosition.current && isMoving === undefined) {
        const distance = lastPosition.current.distanceTo(currentPos);
        const now = Date.now();
        const timeDelta = Math.min((now - lastMoveTimestamp.current) / 1000, 1);
        lastMoveTimestamp.current = now;
        
        // Calculate speed for determining running vs walking
        const speed = distance / timeDelta;
        
        // Add state transition debouncing
        const MIN_STATE_CHANGE_TIME = 300; // ms
        const timeSinceLastStateChange = now - lastAnimationChangeTime.current;
        const canChangeState = timeSinceLastStateChange > MIN_STATE_CHANGE_TIME;
        
        // If player moved more than a threshold, set state to moving
        // Using a higher threshold (0.03) to avoid micro-movements
        if (distance > 0.03) {
          if (!localIsMoving && canChangeState) {
            setLocalIsMoving(true);
            currentAnimation.current = "walk";
            lastAnimationChangeTime.current = now;
            if (isDebugEnabled(DEBUG_LEVELS.VERBOSE)) {
              log.player(`Remote player ${playerId} started moving: ${distance.toFixed(4)} at speed ${speed.toFixed(2)}`);
            }
          }
          
          // Check if player is running based on speed with higher threshold
          // Increase running threshold to 8.0 to match what's mentioned in SPATIALAUDIO.md
          if (speed > 8.0 && !localIsRunning && canChangeState) {
            setLocalIsRunning(true);
            lastAnimationChangeTime.current = now;
            if (isDebugEnabled(DEBUG_LEVELS.VERBOSE)) {
              log.player(`Remote player ${playerId} is now running at speed ${speed.toFixed(2)}`);
            }
          } else if (speed < 6.0 && localIsRunning && canChangeState) {
            // Use a lower threshold for turning off running (hysteresis)
            setLocalIsRunning(false);
            lastAnimationChangeTime.current = now;
            if (isDebugEnabled(DEBUG_LEVELS.VERBOSE)) {
              log.player(`Remote player ${playerId} is now walking at speed ${speed.toFixed(2)}`);
            }
          }
        } else {
          // If player has stopped moving for a while, set state to idle
          if (localIsMoving && canChangeState) {
            setLocalIsMoving(false);
            setLocalIsRunning(false);
            currentAnimation.current = "idle";
            lastAnimationChangeTime.current = now;
            if (isDebugEnabled(DEBUG_LEVELS.VERBOSE)) {
              log.player(`Remote player ${playerId} stopped moving: ${distance.toFixed(4)}`);
            }
          }
        }
      }
      
      // Update last position - but use the target position to track actual movement
      lastPosition.current.copy(currentPos);
    }
    
    // IMPROVED ROTATION HANDLING - much more stable now
    // We're now getting normalized rotation values from EntityStateObserver
    if (rotation !== undefined && rotation !== null) {
      // Since rotation is now consistently a single value (yaw angle in radians),
      // we can directly apply it to the Y axis rotation
      const targetRotation = playerType === 'jackalope' ? rotation + Math.PI : rotation;
      
      // Smoothly interpolate to the target rotation
      // Use a fast lerp for responsive rotation updates
      const rotationSpeed = Math.min(delta * 15, 0.5); // Faster rotation, limited to 50% per frame
      
      // Set rotation directly on the mesh, now using a simpler approach
      meshRef.current.rotation.y = THREE.MathUtils.lerp(
        meshRef.current.rotation.y,
        targetRotation,
        rotationSpeed
      );
    }
  });

  // Common component for all player types with explicit states
  const audioComponent = (
    <RemotePlayerAudio
      playerId={playerId}
      position={position} 
      isWalking={walkingOnly}
      isRunning={running}
      isShooting={isShooting}
      playerType={playerType}
    />
  );

  // Update the getFallbackModel function to use the correct window typing
  const getFallbackModel = (type: 'merc' | 'jackalope'): THREE.Object3D => {
    // 1. Try to get from window.__fallbackModels
    const color = type === 'merc' ? 'red' : 'blue';
    if (typeof window !== 'undefined' && window.__fallbackModels && window.__fallbackModels[color]) {
      console.log(`Using global fallback model for ${type}`);
      return window.__fallbackModels[color].clone();
    }
    
    // 2. Create one on the fly if not available
    console.log(`Creating on-demand fallback for ${type}`);
    const geometry = new THREE.BoxGeometry(0.5, 1.8, 0.5);
    const material = new THREE.MeshStandardMaterial({ 
      color: type === 'merc' ? 0xff0000 : 0x0000ff,
      roughness: 0.7,
      metalness: 0.3
    });
    
    return new THREE.Mesh(geometry, material);
  };

  // For merc type, use the MercModel
  if (playerType === 'merc') {
    return (
      <>
        <RigidBody 
          type="fixed" 
          position={position ? [position.x, position.y - 1.6, position.z] : [0, -1.6, 0]}
          rotation={[0, rotation || 0, 0]}
          colliders={false}
          name={`remote-merc-${playerId}`}
          userData={{ isMerc: true, playerId }}
          friction={1}
          sensor={false}
          includeInvisible={true}
          ccd={true} // Add continuous collision detection
          collisionGroups={0xFFFFFFFF} // Collide with everything
        >
          {/* Use multiple colliders for better hit detection - scale up for larger model */}
          <CapsuleCollider args={[7.5, 4]} position={[0, 7.5, 0]} sensor={false} />
          
          {/* Add a box collider to ensure hits register */}
          <CuboidCollider args={[4, 7.5, 4]} position={[0, 7.5, 0]} sensor={false} />
          
          {/* Add a collider for the head area */}
          <BallCollider args={[3]} position={[0, 12.5, 0]} sensor={false} />
          
          {/* Use primitive for the model */}
          <MercModel 
            position={[0, 0, 0]} 
            rotation={[0, 0, 0]} 
            scale={[5, 5, 5]} // Increase the scale to make the merc appear much larger
          />
        </RigidBody>
        {/* Player ID tag - positioned higher for the taller merc model */}
        <Html position={[position?.x || 0, (position?.y || 0) + 12, position?.z || 0]} center>
          <div style={{ 
            background: 'rgba(0,0,0,0.5)', 
            padding: '2px 6px', 
            borderRadius: '4px', 
            color: 'white',
            fontSize: '14px', // Slightly smaller font to match 5x scale
            fontFamily: 'Arial, sans-serif'
          }}>
            {playerId?.split('-')[0]}
          </div>
        </Html>
        {/* Add spatial audio for remote merc player */}
        {audioComponent}
      </>
    );
  }

  // For jackalope type, use the new JackalopeModel
  if (playerType === 'jackalope') {
    // Debug output occasionally to help diagnose position issues
    if (Date.now() % 10000 < 20) {
      log.player(`Remote jackalope position: (${position?.x.toFixed(2)}, ${position?.y.toFixed(2)}, ${position?.z.toFixed(2)}), rotation: ${rotation?.toFixed(2)}`);
    }
    
    // Track attached projectiles with a ref
    const [attachedProjectiles, setAttachedProjectiles] = useState<{id: string, position: THREE.Vector3}[]>([]);
    const attachedProjectilesRef = useRef<{id: string, position: THREE.Vector3}[]>([]);
    const rigidBodyRef = useRef<any>(null);
    
    // Keep ref in sync with state
    useEffect(() => {
      attachedProjectilesRef.current = attachedProjectiles;
    }, [attachedProjectiles]);
    
    // Add automatic cleanup for old projectiles
    useEffect(() => {
      // Set up a timer to clean up projectiles after some time
      const cleanupTimer = setInterval(() => {
        if (attachedProjectilesRef.current.length > 0) {
          const MAX_PROJECTILES = 8; // Maximum allowed projectiles per jackalope
          
          // If we have too many projectiles, remove the oldest ones
          if (attachedProjectilesRef.current.length > MAX_PROJECTILES) {
            setAttachedProjectiles(prev => prev.slice(-MAX_PROJECTILES));
          }
        }
      }, 5000); // Check every 5 seconds
      
      return () => clearInterval(cleanupTimer);
    }, []);
    
    // Add a global handler to allow attaching projectiles to this jackalope from anywhere
    useEffect(() => {
      if (!window.__jackalopeAttachmentHandlers) {
        window.__jackalopeAttachmentHandlers = {};
      }
      
      // Create a unique handler for this jackalope instance
      window.__jackalopeAttachmentHandlers[playerId] = (projectileData: {id: string, position: THREE.Vector3}) => {
        // Check if we already have this projectile to prevent duplicates
        if (attachedProjectilesRef.current.some(p => p.id === projectileData.id)) {
          console.log(`Projectile ${projectileData.id} already attached to jackalope ${playerId}`);
          return true;
        }
        
        // Add the new projectile
        setAttachedProjectiles(prev => {
          // Check for max projectiles directly here
          const MAX_PROJECTILES = 8;
          let newList = [...prev, projectileData];
          
          // If we exceed the maximum, remove the oldest ones
          if (newList.length > MAX_PROJECTILES) {
            newList = newList.slice(-MAX_PROJECTILES);
          }
          
          return newList;
        });
        
        return true;
      };
      
      // Cleanup
      return () => {
        if (window.__jackalopeAttachmentHandlers) {
          delete window.__jackalopeAttachmentHandlers[playerId];
        }
      };
    }, [playerId]);
    
    // Render the attached projectiles more efficiently
    const renderedProjectiles = useMemo(() => {
      return attachedProjectiles.map(projectile => (
        <group 
          key={projectile.id} 
          position={[
            projectile.position.x - (position?.x || 0), 
            projectile.position.y - (position?.y || 0) - 0.3, 
            projectile.position.z - (position?.z || 0)
          ]}
          name={`attached-projectile-${projectile.id}`}
        >
          <mesh>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshStandardMaterial 
              emissive="#ff4500" 
              emissiveIntensity={3} 
              toneMapped={false}
            />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial 
              color="#ff7f00"
              transparent={true}
              opacity={0.6}
              emissive="#ff7f00"
              emissiveIntensity={1.5}
            />
          </mesh>
          {/* Disable point light for performance - use emissive materials instead */}
        </group>
      ));
    }, [attachedProjectiles, position]);
    
    return (
      <>
        <RigidBody 
          ref={rigidBodyRef}
          type="fixed" 
          position={position ? [position.x, position.y + 0.3, position.z] : [0, 0.3, 0]}
          rotation={[0, (rotation || 0) + Math.PI, 0]}
          colliders={false}
          name={`remote-jackalope-${playerId}`}
          userData={{ isJackalope: true, playerId, playerType: 'jackalope', jackalopeId: playerId }}
          friction={1}
          sensor={false}
          includeInvisible={true}
          ccd={true} // Add continuous collision detection
          collisionGroups={0xFFFFFFFF} // Collide with everything
          restitution={0.1} // Make collisions less bouncy
        >
          {/* Use multiple colliders to ensure good collision detection */}
          {/* Main body collider - enlarged for better hit detection */}
          <CapsuleCollider args={[1.2, 1.0]} position={[0, 0.6, 0]} sensor={false} friction={1} restitution={0.1} />
          
          {/* Add a box collider to ensure hits register */}
          <CuboidCollider args={[1.0, 1.0, 1.0]} position={[0, 0.6, 0]} sensor={false} friction={1} restitution={0.1} />
          
          {/* Add a collider for the head area */}
          <BallCollider args={[0.7]} position={[0, 1.5, 0]} sensor={false} friction={1} restitution={0.1} />
          
          {/* Extra collider to catch projectiles */}
          <BallCollider args={[1.2]} position={[0, 0.8, 0]} sensor={false} friction={1} restitution={0.1} />
          
          {/* Use primitive for the model */}
          <JackalopeModel 
            position={[0, -0.9, 0]} 
            rotation={[0, 0, 0]} 
            scale={[0.9, 0.9, 0.9]} 
          />
          
          {/* Render all attached projectiles directly as children of the jackalope */}
          {renderedProjectiles}
        </RigidBody>
        
        {/* Player ID tag */}
        <Html position={[position?.x || 0, (position?.y || 0) + 2.5, position?.z || 0]} center>
          <div style={{ 
            background: 'rgba(0,0,0,0.5)', 
            padding: '2px 6px', 
            borderRadius: '4px', 
            color: 'white',
            fontSize: '10px',
            fontFamily: 'Arial, sans-serif'
          }}>
            {playerId?.split('-')[0]}
          </div>
        </Html>
        {/* Add spatial audio for remote jackalope player */}
        {audioComponent}
      </>
    );
  }

  // For other player types, use the geometric representation
  const color = useMemo(() => {
    // Generate a consistent color based on the player ID
    if (!playerId) {
      return new THREE.Color('#888888'); // Default gray color if no playerId
    }
    
    let hash = 0;
    for (let i = 0; i < playerId.length; i++) {
      hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const r = (hash & 0xff0000) >> 16;
    const g = (hash & 0x00ff00) >> 8;
    const b = hash & 0x0000ff;
    
    return new THREE.Color(`rgb(${r}, ${g}, ${b})`);
  }, [playerId]);

  // Fix the useEffect that checks for fallback models
  useEffect(() => {
    // Debug log when component mounts
    console.log(`RemotePlayer ${playerId} mounted with type: ${playerType}`);
    
    // Check if fallback models are available
    if (typeof window !== 'undefined' && window.__fallbackModels) {
      console.log(`Fallback models available: ${Object.keys(window.__fallbackModels).join(', ')}`);
    } else {
      console.warn(`No fallback models available for player ${playerId}`);
    }
    
    return () => {
      console.log(`RemotePlayer ${playerId} unmounting`);
    };
  }, [playerId, playerType]);

  return (
    <group 
      ref={groupRef}
      position={[position.x, position.y, position.z]}
      rotation={[0, rotation, 0]}
      name={`remote-player-${playerId}`}
    >
      {/* Debug visuals */}
      {isDebugEnabled(DEBUG_LEVELS.VERBOSE) && (
        <mesh>
          <boxGeometry args={[0.5, 1.8, 0.5]} />
          <meshBasicMaterial wireframe color={playerType === 'jackalope' ? "blue" : "red"} />
        </mesh>
      )}
      
      {/* The actual character model */}
      <mesh
        ref={meshRef}
        position={[0, playerType === 'jackalope' ? -0.9 : 0, 0]}
        scale={playerType === 'jackalope' ? [0.9, 0.9, 0.9] : [5, 5, 5]} // Match 5x scale
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        {playerType === 'merc' ? (
          <MercModel 
            position={[0, 0, 0]} 
            rotation={[0, 0, 0]} 
            scale={[5, 5, 5]} // Use consistent 5x scale
          />
        ) : (
          <JackalopeModel 
            position={[0, -0.9, 0]} 
            rotation={[0, 0, 0]} 
            scale={[0.9, 0.9, 0.9]} 
          />
        )}
      </mesh>
      
      {/* Character nameplate */}
      <Billboard
        position={[0, playerType === 'merc' ? 7 : 2.2, 0]} // Adjust based on player type
        follow={true}
        lockX={false}
        lockY={false}
        lockZ={false}
      >
        <Text
          fontSize={playerType === 'merc' ? 0.5 : 0.2} // Larger text for merc to be readable
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {playerId?.split('-')[0]} 
          {playerType === 'jackalope' ? ' (Jackalope)' : ' (Merc)'}
        </Text>
      </Billboard>
      
      {/* Add spatial audio for remote fallback player */}
      {audioComponent}
    </group>
  );
};

// Custom comparison function for React.memo
// Only re-render if player ID changes, ignore position/rotation changes
const compareRemotePlayers = (prevProps: RemotePlayerData, nextProps: RemotePlayerData) => {
  return prevProps.playerId === nextProps.playerId;
};

export const RemotePlayerMemo = React.memo(RemotePlayer, compareRemotePlayers); 