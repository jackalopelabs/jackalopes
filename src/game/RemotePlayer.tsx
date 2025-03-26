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
        minTimeBetweenUpdates: 35, // Reduced from 70ms to 35ms - faster updates
        pendingUpdate: null
      });
      
      // For rotation visualization, track which way the player is facing
      const directionRef = useRef(new THREE.Vector3(0, 0, 1));
      
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
            const isZero = newRotation[0] === 0 && newRotation[1] === 0 && 
                          newRotation[2] === 0 && newRotation[3] === 1;
            
            console.log(`Remote player ${id} receiving ${isZero ? "IDENTITY" : "REAL"} rotation:`, 
              JSON.stringify(newRotation), 
              `time since last: ${timeSinceLastUpdate}ms`);
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
        
        // Check for identity quaternion [0,0,0,1], which seems to be a default value
        // If we're getting an identity quaternion, don't update rotation as it's likely a default value
        const isIdentityQuaternion = 
          Math.abs(newRotation[0]) < 0.0001 && 
          Math.abs(newRotation[1]) < 0.0001 && 
          Math.abs(newRotation[2]) < 0.0001 && 
          Math.abs(Math.abs(newRotation[3]) - 1) < 0.0001;
        
        // Skip rotation update for identity quaternion to avoid "facing reset"
        if (isIdentityQuaternion) {
          console.log(`Received identity quaternion for ${id}, skipping rotation update`);
          
          // Only update position, keep current rotation
          targetPosition.current = newPosition;
          
          // Calculate velocity for better prediction - use higher weight for smoother movement
          const currentPosition = new THREE.Vector3(...positionRef.current);
          const newPositionVec = new THREE.Vector3(...newPosition);
          const timeDelta = Date.now() - lastUpdateRef.current;
          
          if (timeDelta > 0) {
            // Calculate instantaneous velocity
            const newVelocity = new THREE.Vector3()
              .subVectors(newPositionVec, lastPositionRef.current)
              .divideScalar(timeDelta);
            
            // Use higher interpolation factor for smoother movement (increased from 0.8 to 0.9)
            velocityRef.current.lerp(newVelocity, 0.9);
          }
          
          // Update last position for next velocity calculation
          lastPositionRef.current.copy(newPositionVec);
          
          // For large position changes, update immediately (teleportation)
          const distance = Math.sqrt(
            Math.pow(positionRef.current[0] - newPosition[0], 2) +
            Math.pow(positionRef.current[1] - newPosition[1], 2) +
            Math.pow(positionRef.current[2] - newPosition[2], 2)
          );
          
          // Only teleport position for large changes
          if (distance > 5) {
            console.log(`Remote player ${id} large position change detected: ${distance}`);
            positionRef.current = [...newPosition];
            
            // Force update group position
            if (groupRef.current) {
              groupRef.current.position.set(...newPosition);
            }
          }
          
          lastUpdateRef.current = Date.now();
          return;
        }
        
        // Normal handling for legitimate rotation updates
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
          // Calculate instantaneous velocity
          const newVelocity = new THREE.Vector3()
            .subVectors(newPositionVec, lastPositionRef.current)
            .divideScalar(timeDelta);
          
          // Mix with previous velocity for smoothing
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
        
        // Only teleport for POSITION changes, never for rotation changes
        // This is critical for stable rotation
        if (distance > 5) {
          console.log(`Remote player ${id} large position change detected: ${distance}`);
          
          positionRef.current = [...newPosition];
          // Don't teleport rotation: rotationRef.current = [...normalizedRotation];
          
          // Force update group position immediately
          if (groupRef.current) {
            groupRef.current.position.set(...newPosition);
            // Don't teleport rotation: groupRef.current.quaternion.copy(newQuat);
          }
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
          
          // Create a rotation for the model to face the correct direction
          // This rotates the entire model 180 degrees around the Y axis to match camera space
          const modelRotation = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0), Math.PI
          );
          
          // Combine the rotations - apply model orientation correction first, then the actual rotation
          // This ensures the model faces the correct direction relative to the camera quaternion
          const combinedRotation = modelRotation.multiply(initialQuat);
          
          groupRef.current.quaternion.copy(combinedRotation);
          
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
        
        // Movement interpolation - position
        const lerpSpeed = 5;
        const smoothingFactor = Math.min(1, delta * lerpSpeed);
        
        // Apply velocity-based prediction
        const predictedPosition = new THREE.Vector3(...targetPosition.current);
        
        // Calculate time since last update
        const elapsedSinceLastUpdate = now - lastUpdateRef.current;
        
        // Only apply prediction if we have significant velocity and some time has passed
        if (velocityRef.current.lengthSq() > 0.000001 && elapsedSinceLastUpdate > 20) {
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
        
        // Apply to the group 
        groupRef.current.position.set(newX, newY, newZ);
        
        // SUPER SMOOTH ROTATION HANDLING
        // Create quaternions from arrays
        const currentQuat = new THREE.Quaternion(
          rotationRef.current[0],
          rotationRef.current[1],
          rotationRef.current[2],
          rotationRef.current[3]
        ).normalize();
        
        const targetQuat = new THREE.Quaternion(
          targetRotation.current[0],
          targetRotation.current[1],
          targetRotation.current[2],
          targetRotation.current[3]
        ).normalize();
        
        // If rotation flips signs (e.g., from positive to negative), 
        // negate one quaternion to take the shortest path
        if (currentQuat.dot(targetQuat) < 0) {
          targetQuat.x = -targetQuat.x;
          targetQuat.y = -targetQuat.y;
          targetQuat.z = -targetQuat.z;
          targetQuat.w = -targetQuat.w;
        }
        
        // MUCH slower rotation speed - key to smooth movement
        const rotationSpeed = 3; // Increased from 1.5 to 3 for faster rotation updates
        
        // Calculate smoothing factor with delta time
        // This makes rotation speed independent of frame rate
        const rotationSmoothingFactor = Math.min(0.1, delta * rotationSpeed); // Increased from 0.05 to 0.1
        
        // Create a new quaternion and slerp with very small step
        // This creates extremely smooth, stable rotation
        const newRotation = currentQuat.clone().slerp(targetQuat, rotationSmoothingFactor);
        
        // Create a rotation for the model to face the correct direction
        // This rotates the entire model 180 degrees around the Y axis to match camera space
        const modelRotation = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0), Math.PI
        );
        
        // Combine the rotations - model orientation first, then player rotation
        // This ensures the model faces the correct direction relative to the camera quaternion
        const combinedRotation = modelRotation.clone().multiply(newRotation);
        
        // Apply to the group
        groupRef.current.quaternion.copy(combinedRotation);
        
        // Log rotation values occasionally to debug
        if (Math.random() < 0.01) {
          console.log("Applied rotation:", JSON.stringify(rotationRef.current), 
                      "Combined with model rotation:", 
                      JSON.stringify([combinedRotation.x, combinedRotation.y, combinedRotation.z, combinedRotation.w]));
        }
        
        // Update the rotation ref - store the original rotation without the model correction
        // This way we interpolate between the original rotations, not the combined ones
        rotationRef.current = [
          newRotation.x,
          newRotation.y,
          newRotation.z,
          newRotation.w
        ];
        
        // Update direction for visualization - no longer used since direction
        // is now indicated by the entire group rotation
        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(newRotation);
        directionRef.current.copy(forward);
        
        // Decay velocity when not moving
        if (velocityRef.current.lengthSq() < 0.000001) {
          velocityRef.current.set(0, 0, 0);
        } else if (!updateThrottleRef.current.pendingUpdate) {
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
            
            {/* Direction indicator (forward pointer) - moved to match the corrected orientation */}
            <mesh position={[0, 1.7, 0.8]} rotation={[0, Math.PI, 0]} castShadow>
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