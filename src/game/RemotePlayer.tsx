import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useFrame, RootState } from '@react-three/fiber';
import { Points, BufferGeometry, NormalBufferAttributes, Material } from 'three';
import { MercModel } from './MercModel'; // Import MercModel for remote players

// Define the RemotePlayerData interface locally to match MultiplayerManager
interface RemotePlayerData {
  playerId: string;
  position: { x: number, y: number, z: number };
  rotation: number;
  playerType?: 'merc' | 'jackalope';
  isMoving?: boolean;
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
export const RemotePlayer = ({ playerId, position, rotation, playerType, isMoving }: RemotePlayerData) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const lastPosition = useRef<THREE.Vector3 | null>(null);
  const [localIsMoving, setLocalIsMoving] = useState(false);
  const currentAnimation = useRef("idle"); // Default to idle
  
  // Add refs for animation debouncing
  const lastAnimationChangeTime = useRef(0);
  const pendingAnimationChange = useRef<string | null>(null);
  const MIN_ANIMATION_CHANGE_INTERVAL = 800; // minimum 800ms between animation changes
  
  // Log a one-time warning if we get invalid data
  useEffect(() => {
    if (!position) {
      console.warn('RemotePlayer received invalid position', { playerId, position });
    }
    if (rotation === undefined || rotation === null) {
      console.warn('RemotePlayer received invalid rotation', { playerId, rotation });
    }
  }, [playerId]);

  // Update local isMoving state when the prop changes, with rate limiting
  useEffect(() => {
    if (isMoving !== undefined) {
      const now = Date.now();
      const timeSinceLastChange = now - lastAnimationChangeTime.current;
      
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
  }, [isMoving, playerId]);
  
  // Apply any pending animation changes
  useFrame(() => {
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
        
        // If player moved more than a threshold, set state to moving
        // Using a higher threshold (0.03) to avoid micro-movements
        if (distance > 0.03) {
          if (!localIsMoving) {
            setLocalIsMoving(true);
            currentAnimation.current = "walk";
            console.log(`Remote player ${playerId} started moving: ${distance.toFixed(4)}`);
          }
        } else {
          // If player has stopped moving for a while, set state to idle
          if (localIsMoving) {
            setLocalIsMoving(false);
            currentAnimation.current = "idle";
            console.log(`Remote player ${playerId} stopped moving: ${distance.toFixed(4)}`);
          }
        }
      }
      
      // Update last position
      lastPosition.current.copy(currentPos);
      
      // Update mesh position
      meshRef.current.position.set(position.x, position.y, position.z);
    }
    
    // Safely update rotation with error checking
    if (rotation !== undefined && rotation !== null) {
      meshRef.current.rotation.set(0, rotation, 0);
    }
  });

  // For merc type, use the MercModel
  if (playerType === 'merc') {
    return (
      <MercModel 
        position={position ? [position.x, position.y, position.z] : [0, 0, 0]} 
        rotation={[0, rotation || 0, 0]}
        animation={localIsMoving ? "walk" : "idle"}
      />
    );
  }

  // For other player types (jackalope), use the geometric representation
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
  );
};

// Custom comparison function for React.memo
// Only re-render if player ID changes, ignore position/rotation changes
const compareRemotePlayers = (prevProps: RemotePlayerData, nextProps: RemotePlayerData) => {
  return prevProps.playerId === nextProps.playerId;
};

export const RemotePlayerMemo = React.memo(RemotePlayer, compareRemotePlayers); 