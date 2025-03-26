import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useFrame, RootState } from '@react-three/fiber';

// Interface for RemotePlayer props
export interface RemotePlayerProps {
  id: string;
  initialPosition: [number, number, number];
  initialRotation: [number, number, number, number];
}

// Interface for the exposed methods
export interface RemotePlayerMethods {
  updateTransform: (position: [number, number, number], rotation: [number, number, number, number]) => void;
}

// Remote Player Component
export const RemotePlayer = React.memo(
  forwardRef<RemotePlayerMethods, RemotePlayerProps>(
    ({ id, initialPosition, initialRotation }, ref) => {
      const groupRef = useRef<THREE.Group>(null);
      const meshRef = useRef<THREE.Mesh>(null);
      // Only store position/rotation in refs to avoid state updates completely
      const positionRef = useRef<[number, number, number]>(initialPosition);
      const rotationRef = useRef<[number, number, number, number]>(initialRotation);
      
      // Target values for smoother interpolation
      const targetPosition = useRef<[number, number, number]>(initialPosition);
      const targetRotation = useRef<[number, number, number, number]>(initialRotation);
      
      // Track the last significant update for debugging
      const lastUpdateRef = useRef<number>(Date.now());
      
      // Track velocity for prediction
      const velocityRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
      const lastPositionRef = useRef<THREE.Vector3>(new THREE.Vector3(...initialPosition));
      
      // For rate limiting updates
      const updateThrottleRef = useRef<{
        lastUpdateTime: number;
        minTimeBetweenUpdates: number;
        pendingUpdate: null | {
          position: [number, number, number];
          rotation: [number, number, number, number];
        };
      }>({
        lastUpdateTime: 0,
        minTimeBetweenUpdates: 70, // 70ms = ~14 updates per second max, more conservative rate
        pendingUpdate: null
      });
      
      // For rotation stability
      const rotationStabilityRef = useRef<{
        isIdle: boolean;
        idleTime: number;
        lastRotationDifference: number;
        rotationHistory: Array<[number, number, number, number]>;
      }>({
        isIdle: false,
        idleTime: 0,
        lastRotationDifference: 0,
        rotationHistory: [initialRotation]
      });
      
      // For rotation visualization, track which way the player is facing
      const directionRef = useRef(new THREE.Vector3(0, 0, -1));
      
      // Detect Safari browser
      const isSafari = useMemo(() => {
        const ua = navigator.userAgent.toLowerCase();
        return ua.indexOf('safari') !== -1 && ua.indexOf('chrome') === -1;
      }, []);
      
      // Create an interface for external updates - no state dependencies
      useImperativeHandle(ref, () => ({
        updateTransform: (newPosition: [number, number, number], newRotation: [number, number, number, number]) => {
          // Apply rate limiting to updates
          const now = Date.now();
          const timeSinceLastUpdate = now - updateThrottleRef.current.lastUpdateTime;
          
          // Log rotation updates occasionally for debugging
          if (Math.random() < 0.05) {
            console.log(`Remote player ${id} receiving rotation update:`, newRotation);
          }
          
          // Store the incoming update
          updateThrottleRef.current.pendingUpdate = {
            position: [...newPosition],
            rotation: [...newRotation]
          };
          
          // If it's been long enough since the last update, apply it immediately
          if (timeSinceLastUpdate >= updateThrottleRef.current.minTimeBetweenUpdates) {
            applyPendingUpdate();
          }
          // Otherwise, it will be applied in the next frame via rate limiter
        }
      }), []);
      
      // Function to apply a pending update
      const applyPendingUpdate = () => {
        if (!updateThrottleRef.current.pendingUpdate) return;
        
        const { position: newPosition, rotation: newRotation } = updateThrottleRef.current.pendingUpdate;
        updateThrottleRef.current.pendingUpdate = null;
        updateThrottleRef.current.lastUpdateTime = Date.now();
        
        // Normalize the new rotation quaternion
        const newQuat = new THREE.Quaternion(
          newRotation[0], newRotation[1], newRotation[2], newRotation[3]
        ).normalize();
        
        // Convert back to array
        const normalizedRotation: [number, number, number, number] = [
          newQuat.x, newQuat.y, newQuat.z, newQuat.w
        ];
        
        // Update target rotation with normalized values
        targetRotation.current = normalizedRotation;
        
        // Calculate velocity for prediction
        const currentPosition = new THREE.Vector3(...positionRef.current);
        const newPositionVec = new THREE.Vector3(...newPosition);
        const timeDelta = Date.now() - lastUpdateRef.current;
        
        if (timeDelta > 0) {
          // Calculate instantaneous velocity (units per ms)
          const newVelocity = new THREE.Vector3()
            .subVectors(newPositionVec, lastPositionRef.current)
            .divideScalar(timeDelta);
          
          // Mix with previous velocity for smoothing (80% new, 20% old)
          velocityRef.current.lerp(newVelocity, 0.8);
        }
        
        // Update last position for next velocity calculation
        lastPositionRef.current.copy(newPositionVec);
        
        // Calculate position prediction
        targetPosition.current = newPosition;
        
        // For large position changes, update immediately (teleportation)
        const distance = Math.sqrt(
          Math.pow(positionRef.current[0] - newPosition[0], 2) +
          Math.pow(positionRef.current[1] - newPosition[1], 2) +
          Math.pow(positionRef.current[2] - newPosition[2], 2)
        );
        
        // Check for large rotation changes
        const currentQuat = new THREE.Quaternion(
          rotationRef.current[0], rotationRef.current[1], 
          rotationRef.current[2], rotationRef.current[3]
        );
        
        // Dot product close to -1 means nearly opposite rotation (180 degrees)
        const quatDot = currentQuat.dot(newQuat);
        const largeRotationChange = quatDot < 0.5; // Very large rotation difference
        
        // For big changes (>5 units) or large rotation shifts, teleport instantly
        if (distance > 5 || largeRotationChange) {
          if (largeRotationChange) {
            console.log(`Remote player ${id} large rotation change detected: ${quatDot}`);
          }
          
          positionRef.current = [...newPosition];
          rotationRef.current = [...normalizedRotation];
          lastUpdateRef.current = Date.now();
          
          // Force update group position immediately (outside of frame loop)
          if (groupRef.current) {
            groupRef.current.position.set(...newPosition);
            
            // Apply rotation to the group
            groupRef.current.quaternion.copy(newQuat);
          }
          
          // Reset rotation stability tracking on teleport
          rotationStabilityRef.current.isIdle = false;
          rotationStabilityRef.current.idleTime = 0;
          rotationStabilityRef.current.rotationHistory = [normalizedRotation];
        }
        
        // Update the rotation history for stability
        rotationStabilityRef.current.rotationHistory.push(normalizedRotation);
        if (rotationStabilityRef.current.rotationHistory.length > 5) {
          rotationStabilityRef.current.rotationHistory.shift();
        }
        
        lastUpdateRef.current = Date.now();
      };
      
      // Initial setup - ensure rotation is applied at mount time
      useEffect(() => {
        if (groupRef.current) {
          // Apply initial position
          groupRef.current.position.set(...initialPosition);
          
          // Apply initial rotation
          const initialQuat = new THREE.Quaternion(
            initialRotation[0], initialRotation[1], 
            initialRotation[2], initialRotation[3]
          ).normalize();
          
          groupRef.current.quaternion.copy(initialQuat);
          
          console.log(`Remote player ${id} initial rotation applied:`, initialRotation);
        }
      }, []);
      
      // Frame-by-frame interpolation for smooth movement
      useFrame((_state: RootState, delta: number) => {
        if (!groupRef.current) return;
        
        // Apply any pending updates if rate limit elapsed
        const now = Date.now();
        const timeSinceLastUpdate = now - updateThrottleRef.current.lastUpdateTime;
        if (updateThrottleRef.current.pendingUpdate && 
            timeSinceLastUpdate >= updateThrottleRef.current.minTimeBetweenUpdates) {
          applyPendingUpdate();
        }
        
        // Movement interpolation - position (similar to before)
        const lerpSpeed = 5; // Reduced from 8 for smoother movement
        const smoothingFactor = Math.min(1, delta * lerpSpeed);
        
        // Apply velocity-based prediction - position moves ahead based on velocity
        const predictedPosition = new THREE.Vector3(...targetPosition.current);
        
        // Calculate time since last update to determine prediction amount
        const elapsedSinceLastUpdate = now - lastUpdateRef.current;
        
        // Only apply prediction if we have significant velocity and some time has passed
        if (velocityRef.current.lengthSq() > 0.000001 && elapsedSinceLastUpdate > 20) {
          // Apply velocity-based prediction with adaptive scaling
          // Prediction factor increases with elapsed time to compensate for network delay
          // but is capped to avoid over-prediction
          const predictionFactor = Math.min(elapsedSinceLastUpdate, 300);
          const velocityComponent = velocityRef.current.clone().multiplyScalar(predictionFactor);
          
          // Add predicted movement to the position
          predictedPosition.add(velocityComponent);
        }
        
        // Interpolate position (lerp)
        const newX = positionRef.current[0] + (predictedPosition.x - positionRef.current[0]) * smoothingFactor;
        const newY = positionRef.current[1] + (predictedPosition.y - positionRef.current[1]) * smoothingFactor;
        const newZ = positionRef.current[2] + (predictedPosition.z - positionRef.current[2]) * smoothingFactor;
        
        // Update local ref without state changes
        positionRef.current = [newX, newY, newZ];
        
        // Apply to the group (not the mesh)
        groupRef.current.position.set(newX, newY, newZ);
        
        // Rotation interpolation - this is critical for the player orientation
        // Get current quaternion from ref
        const currentQuat = new THREE.Quaternion(
          rotationRef.current[0],
          rotationRef.current[1],
          rotationRef.current[2],
          rotationRef.current[3]
        );
        
        // Target quaternion - what we're interpolating towards
        let targetQuat;
        
        // Check if we need rotation stabilization (when player is idle)
        const positionDelta = Math.sqrt(
          Math.pow(positionRef.current[0] - targetPosition.current[0], 2) +
          Math.pow(positionRef.current[1] - targetPosition.current[1], 2) +
          Math.pow(positionRef.current[2] - targetPosition.current[2], 2)
        );
        
        const isMoving = positionDelta > 0.01 || velocityRef.current.lengthSq() > 0.0001;
        
        // Update idle state
        if (isMoving) {
          rotationStabilityRef.current.isIdle = false;
          rotationStabilityRef.current.idleTime = 0;
        } else {
          if (!rotationStabilityRef.current.isIdle) {
            rotationStabilityRef.current.isIdle = true;
            rotationStabilityRef.current.idleTime = now;
          }
        }
        
        // If idle for more than 500ms, use weighted average of recent rotations for stability
        const idleTime = rotationStabilityRef.current.isIdle ? now - rotationStabilityRef.current.idleTime : 0;
        
        if (idleTime > 500 && rotationStabilityRef.current.rotationHistory.length > 1) {
          // Use weighted average of recent rotations for stability
          const avgQuat = new THREE.Quaternion(0, 0, 0, 0);
          let totalWeight = 0;
          
          // Calculate weighted average of recent rotations
          // Most recent rotations have highest weight
          rotationStabilityRef.current.rotationHistory.forEach((rot, index) => {
            const weight = index + 1; // Weight increases with recency
            const q = new THREE.Quaternion(rot[0], rot[1], rot[2], rot[3]);
            
            // Add to average, weighted by position in history
            avgQuat.x += q.x * weight;
            avgQuat.y += q.y * weight;
            avgQuat.z += q.z * weight;
            avgQuat.w += q.w * weight;
            
            totalWeight += weight;
          });
          
          // Normalize the weighted average
          if (totalWeight > 0) {
            avgQuat.x /= totalWeight;
            avgQuat.y /= totalWeight;
            avgQuat.z /= totalWeight;
            avgQuat.w /= totalWeight;
            avgQuat.normalize();
          }
          
          targetQuat = avgQuat;
        } else {
          // Normal movement, use the target rotation directly
          targetQuat = new THREE.Quaternion(
            targetRotation.current[0],
            targetRotation.current[1],
            targetRotation.current[2],
            targetRotation.current[3]
          );
        }
        
        // Determine how fast to interpolate rotation
        // Use faster interpolation for larger changes to catch up quickly
        const quatDot = Math.abs(currentQuat.dot(targetQuat));
        
        // If dot product is close to 1, the quaternions are similar (small change)
        // If dot product is close to 0, they're very different (large change)
        // Adjust interpolation speed based on how different they are
        const rotationDelta = 1 - quatDot;
        
        // Increase the base rotation speed from 3 to 4
        const baseRotationSpeed = 4;
        
        // Adaptive speed - faster for large changes, slower for small adjustments
        // Multiply by up to 3x for very large rotational differences 
        const adaptiveRotationSpeed = baseRotationSpeed * (1 + rotationDelta * 2);
        
        // Calculate smoothing factor, faster than position but still smooth
        const rotationSmoothingFactor = Math.min(1, delta * adaptiveRotationSpeed);
        
        // Interpolate using slerp (spherical interpolation) - better for rotations
        // Create new quaternion to avoid modifying the ref directly
        const interpolatedQuat = currentQuat.clone().slerp(targetQuat, rotationSmoothingFactor);
        
        // Make sure the quaternion is normalized
        interpolatedQuat.normalize();
        
        // Apply to group, not mesh
        groupRef.current.quaternion.copy(interpolatedQuat);
        
        // Update ref without state changes
        rotationRef.current = [
          interpolatedQuat.x,
          interpolatedQuat.y,
          interpolatedQuat.z,
          interpolatedQuat.w
        ];
        
        // Update direction reference for visualization
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(interpolatedQuat);
        directionRef.current.copy(forward);
        
        // Track rotation change amount
        rotationStabilityRef.current.lastRotationDifference = rotationDelta;
        
        // If velocity is very small, gradually reduce it to zero
        // This prevents perpetual motion when updates stop
        if (velocityRef.current.lengthSq() < 0.000001) {
          velocityRef.current.set(0, 0, 0);
        } else if (!updateThrottleRef.current.pendingUpdate) {
          // Decay velocity when no updates are pending
          velocityRef.current.multiplyScalar(0.95);
        }
      });
      
      // Log when the player is mounted (only once per player)
      useEffect(() => {
        console.log(`Remote player ${id} mounted at position:`, initialPosition, 'with rotation:', initialRotation);
        
        return () => {
          console.log(`Remote player ${id} unmounted`);
        };
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [id]); // Only run on mount/unmount, dependent only on id
      
      // Generate a consistent color based on player ID
      const playerColor = useMemo(() => {
        // Simple hash function to get consistent color from ID
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
          hash = id.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        // Convert to RGB
        const r = (hash & 0xFF0000) >> 16;
        const g = (hash & 0x00FF00) >> 8;
        const b = hash & 0x0000FF;
        
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      }, [id]);
      
      return (
        <group ref={groupRef} position={initialPosition}>
          {/* Player body - more recognizable character */}
          <group>
            {/* Player head */}
            <mesh position={[0, 1.7, 0]} castShadow>
              <sphereGeometry args={[0.4, 16, 16]} />
              <meshStandardMaterial color={playerColor} />
            </mesh>
            
            {/* Player body */}
            <mesh position={[0, 0.9, 0]} castShadow>
              <capsuleGeometry args={[0.4, 1.2, 4, 8]} />
              <meshStandardMaterial color={playerColor} />
            </mesh>
            
            {/* Player arm - left */}
            <mesh position={[-0.6, 0.9, 0]} rotation={[0, 0, -Math.PI / 4]} castShadow>
              <capsuleGeometry args={[0.15, 0.6, 4, 8]} />
              <meshStandardMaterial color={playerColor} />
            </mesh>
            
            {/* Player arm - right */}
            <mesh position={[0.6, 0.9, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
              <capsuleGeometry args={[0.15, 0.6, 4, 8]} />
              <meshStandardMaterial color={playerColor} />
            </mesh>
            
            {/* Direction indicator (forward pointer) */}
            <mesh position={[0, 1.2, -0.5]} castShadow>
              <coneGeometry args={[0.2, 0.4, 8]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            
            {/* Stable nametag container - attached to group instead of mesh */}
            <Html position={[0, 2.5, 0]} center sprite distanceFactor={15} 
                  occlude={false} zIndexRange={[0, 100]}>
              <div style={{
                color: 'white',
                background: 'rgba(0, 0, 0, 0.7)',
                padding: '5px 8px',
                borderRadius: '3px',
                whiteSpace: 'nowrap',
                fontSize: '14px',
                fontFamily: 'Arial, sans-serif',
                userSelect: 'none',
                textShadow: '0 0 2px black',
                fontWeight: 'bold',
                border: `1px solid ${playerColor}`
              }}>
                {id.substring(0, 8)}
              </div>
            </Html>
          </group>
        </group>
      );
    }
  ),
  // Custom comparison function for React.memo
  // Only re-render if player ID changes, ignore position/rotation changes
  (prevProps, nextProps) => {
    return prevProps.id === nextProps.id;
  }
); 