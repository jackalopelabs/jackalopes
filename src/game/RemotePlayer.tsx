import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useFrame, RootState } from '@react-three/fiber';
import { Points, BufferGeometry, NormalBufferAttributes, Material } from 'three';
import { MercModel } from './MercModel'; // Import MercModel for remote players
import { JackalopeModel } from './JackalopeModel'; // Import the new JackalopeModel
import { RemotePlayerAudio } from '../components/RemotePlayerAudio'; // Import RemotePlayerAudio component

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

// Add a global debug level constant
// 0 = no logs, 1 = error only, 2 = important info, 3 = verbose 
const DEBUG_LEVEL = 2;

// Interface for RemotePlayer props
export interface RemotePlayerProps {
  id: string;
  initialPosition: [number, number, number];
  initialRotation: [number, number, number, number];
  playerType?: 'merc' | 'jackalope'; // Add player type to determine which model to show
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
export const RemotePlayer = ({ playerId, position, rotation, playerType, isMoving, isRunning, isShooting }: RemotePlayerData) => {
  // Add debug logging for player type
  console.log(`🎮 RemotePlayer ${playerId} rendering with playerType: ${playerType || 'undefined'}`);
  
  const meshRef = useRef<THREE.Mesh>(null);
  const lastAnimationChangeTime = useRef<number>(Date.now());
  const pendingAnimationChange = useRef<string | null>(null);
  const lastPosition = useRef<THREE.Vector3 | null>(null);
  const lastMoveTimestamp = useRef<number>(Date.now());
  const currentAnimation = useRef("idle"); // Default to idle
  
  // Add reference for smooth rotation
  const currentRotation = useRef<number>(rotation || 0);
  
  const MIN_ANIMATION_CHANGE_INTERVAL = 200; // ms
  
  // Log initialization
  useEffect(() => {
    console.log(`RemotePlayer ${playerId} initialized.`);
    
    return () => {
      console.log(`RemotePlayer ${playerId} unmounted.`);
    };
  }, [playerId]);
  
  // Get local state for animation scheduling
  const [localIsMoving, setLocalIsMoving] = useState(isMoving || false);
  const [localIsRunning, setLocalIsRunning] = useState(isRunning || false);
  
  // Log every state update to debug movement sound issues
  useEffect(() => {
    console.log(`RemotePlayer ${playerId} received props update:`, { 
      isMoving, 
      isRunning, 
      isShooting,
      localIsMoving,
      localIsRunning
    });
  }, [isMoving, isRunning, isShooting, localIsMoving, localIsRunning, playerId]);
  
  // Force re-check movement state when props change
  useEffect(() => {
    // Debug the incoming props more clearly
    console.log(`RemotePlayer ${playerId} movement props received:`, {
      isMoving: isMoving === true ? "TRUE" : (isMoving === false ? "FALSE" : "undefined"),
      isRunning: isRunning === true ? "TRUE" : (isRunning === false ? "FALSE" : "undefined"),
    });
    
    // Add hysteresis to prevent rapid toggling between states
    const now = Date.now();
    const timeSinceLastChange = now - lastAnimationChangeTime.current;
    const MIN_STATE_CHANGE_INTERVAL = 500; // Require 500ms between state changes
    
    // If it's too soon for another state change, ignore this update
    if (timeSinceLastChange < MIN_STATE_CHANGE_INTERVAL) {
      console.log(`${playerId}: Ignoring movement state change - too frequent (${timeSinceLastChange}ms)`);
      return;
    }
    
    // Don't let walking and running both be true at the same time
    if (isMoving === true && isRunning === true) {
      // Running takes precedence
      console.log(`${playerId}: Both moving and running flags are true - setting to RUNNING`);
      setLocalIsMoving(true);
      setLocalIsRunning(true);
      lastAnimationChangeTime.current = now;
    } else if (isMoving === true && isRunning !== true) {
      // Walking only - make sure isRunning is explicitly FALSE
      console.log(`${playerId}: Moving=true, Running!=true - setting to WALKING`);
      setLocalIsMoving(true);
      setLocalIsRunning(false);
      lastAnimationChangeTime.current = now;
    } else if (isMoving === false) {
      // Not moving - stop all movement
      console.log(`${playerId}: Moving=false - setting to STOPPED`);
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
    console.log(`${playerId} audio states calculated:`, {
      walkingOnly,
      running,
      shouldPlayWalkSound: walkingOnly,
      shouldPlayRunSound: running,
    });
  }, [walkingOnly, running, playerId]);
  
  // Update local isMoving state when the prop changes, with rate limiting
  useEffect(() => {
    if (isMoving !== undefined) {
      const now = Date.now();
      const timeSinceLastChange = now - lastAnimationChangeTime.current;
      
      console.log(`RemotePlayer ${playerId} movement state update: isMoving=${isMoving}, isRunning=${isRunning}`);
      
      // Apply rate limiting to prevent animation flicker
      if (timeSinceLastChange < MIN_ANIMATION_CHANGE_INTERVAL) {
        // Too soon for another animation change, store it as pending
        pendingAnimationChange.current = isMoving ? "walk" : "idle";
        console.log(`Animation change too frequent for ${playerId}, queueing ${pendingAnimationChange.current}`);
      } else {
        // Apply animation change immediately
        setLocalIsMoving(isMoving);
        currentAnimation.current = isMoving ? "walk" : "idle";
        lastAnimationChangeTime.current = now;
        console.log(`Remote player ${playerId} animation set to ${isMoving ? "walk" : "idle"} from props`);
      }
    }
    
    // Update running state
    if (isRunning !== undefined) {
      setLocalIsRunning(isRunning);
      console.log(`RemotePlayer ${playerId} running state set to ${isRunning}`);
    }
  }, [isMoving, isRunning, playerId]);
  
  // Add debug output to monitor state changes
  useEffect(() => {
    console.log(`RemotePlayer ${playerId} state updated: localIsMoving=${localIsMoving}, localIsRunning=${localIsRunning}`);
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
        console.log(`Applied pending animation change for ${playerId}: ${newAnim}`);
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
            console.log(`Remote player ${playerId} started moving: ${distance.toFixed(4)} at speed ${speed.toFixed(2)}`);
          }
          
          // Check if player is running based on speed with higher threshold
          // Increase running threshold to 8.0 to match what's mentioned in SPATIALAUDIO.md
          if (speed > 8.0 && !localIsRunning && canChangeState) {
            setLocalIsRunning(true);
            lastAnimationChangeTime.current = now;
            console.log(`Remote player ${playerId} is now running at speed ${speed.toFixed(2)}`);
          } else if (speed < 6.0 && localIsRunning && canChangeState) {
            // Use a lower threshold for turning off running (hysteresis)
            setLocalIsRunning(false);
            lastAnimationChangeTime.current = now;
            console.log(`Remote player ${playerId} is now walking at speed ${speed.toFixed(2)}`);
          }
        } else {
          // If player has stopped moving for a while, set state to idle
          if (localIsMoving && canChangeState) {
            setLocalIsMoving(false);
            setLocalIsRunning(false);
            currentAnimation.current = "idle";
            lastAnimationChangeTime.current = now;
            console.log(`Remote player ${playerId} stopped moving: ${distance.toFixed(4)}`);
          }
        }
      }
      
      // Update last position
      lastPosition.current.copy(currentPos);
      
      // Update mesh position
      meshRef.current.position.set(position.x, position.y, position.z);
    }
    
    // Smoothly interpolate rotation with error checking
    if (rotation !== undefined && rotation !== null) {
      // Calculate the shortest path for rotation
      let targetRotation = rotation;
      let currentRot = currentRotation.current;
      
      // Find the shortest path to rotate (clockwise or counterclockwise)
      let deltaRotation = targetRotation - currentRot;
      
      // Normalize to -PI to PI range
      while (deltaRotation > Math.PI) deltaRotation -= Math.PI * 2;
      while (deltaRotation < -Math.PI) deltaRotation += Math.PI * 2;
      
      // Smoothly interpolate the rotation (adjust the 2.5 factor to change rotation speed)
      const smoothFactor = Math.min(1, delta * 2.5);
      currentRotation.current = currentRot + deltaRotation * smoothFactor;
      
      // Apply the smooth rotation to the mesh
      meshRef.current.rotation.set(0, currentRotation.current, 0);
      
      // Debug rotation occasionally
      if (Math.random() < 0.01) {
        console.log(`Remote player ${playerId} rotation updated: ${currentRotation.current.toFixed(2)}`);
      }
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
    />
  );

  // For merc type, use the MercModel
  if (playerType === 'merc') {
    return (
      <>
        <MercModel 
          position={position ? [position.x, position.y - 1.6, position.z] : [0, -1.6, 0]} 
          rotation={[0, rotation || 0, 0]}
          animation={localIsMoving ? "walk" : "idle"}
          scale={[5, 5, 5]}
        />
        {/* Player ID tag - positioned higher for the taller merc model */}
        <Html position={[position?.x || 0, (position?.y || 0) + 6, position?.z || 0]} center>
          <div style={{ 
            background: 'rgba(0,0,0,0.5)', 
            padding: '2px 6px', 
            borderRadius: '4px', 
            color: 'white',
            fontSize: '12px',
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
    if (Date.now() % 5000 < 20) {
      console.log(`Remote jackalope position: (${position?.x.toFixed(2)}, ${position?.y.toFixed(2)}, ${position?.z.toFixed(2)})`);
    }
    
    return (
      <>
        <JackalopeModel 
          position={position ? [position.x, position.y + 0.3, position.z] : [0, 0.3, 0]} 
          rotation={[0, (rotation || 0) + Math.PI, 0]}
          animation={localIsMoving ? "walk" : "idle"}
          scale={[2, 2, 2]}
        />
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

  return (
    <>
      <mesh ref={meshRef} position={[position.x, position.y, position.z]} rotation={[0, rotation, 0]}>
        {/* Body */}
        <boxGeometry args={[0.5, 1, 0.25]} />
        <meshStandardMaterial color={color} />
        
        {/* Head */}
        <mesh position={[0, 0.65, 0]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshStandardMaterial color={color} />
        </mesh>
        
        {/* Indicator with player ID */}
        <mesh position={[0, 1.1, 0]}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshStandardMaterial color="yellow" />
        </mesh>
      </mesh>
      
      {/* Add spatial audio for remote fallback player */}
      {audioComponent}
    </>
  );
};

// Custom comparison function for React.memo
// Only re-render if player ID changes, ignore position/rotation changes
const compareRemotePlayers = (prevProps: RemotePlayerData, nextProps: RemotePlayerData) => {
  return prevProps.playerId === nextProps.playerId;
};

export const RemotePlayerMemo = React.memo(RemotePlayer, compareRemotePlayers); 