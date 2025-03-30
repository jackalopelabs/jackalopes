import Rapier from '@dimforge/rapier3d-compat'
import { PerspectiveCamera, useKeyboardControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, RigidBodyProps, useBeforePhysicsStep, useRapier } from '@react-three/rapier'
import { useEffect, useRef, useState, useMemo, forwardRef, useImperativeHandle, useCallback } from 'react'
import { useGamepad } from '../common/hooks/use-gamepad'
import * as THREE from 'three'
import { Component, Entity, EntityType } from './ecs'

// Import ConnectionManager for multiplayer support
import { ConnectionManager } from '../network/ConnectionManager'
import { JackalopeModel } from './JackalopeModel' // Import the JackalopeModel component

// Animation system
const ANIMATION_SMOOTHING = 0.08;

// Direct movement constants
const BASE_SPEED = 6.8; // Doubled from 3.4 to make jackalope 2x faster
const RUN_MULTIPLIER = 1.8; // Keep this the same

// Jump handling adjustments
const JUMP_MULTIPLIER = 14.2; // Increased from 4 to make jumps higher
const GRAVITY_REDUCTION = 1; // Increased from 0.5 to make jumps shorter

// Props for the Jackalope component
type JackalopeProps = RigidBodyProps & {
    walkSpeed?: number
    runSpeed?: number
    jumpForce?: number
    onMove?: (position: THREE.Vector3) => void
    connectionManager?: ConnectionManager
    visible?: boolean
    thirdPersonView?: boolean
}

// Keyboard controls type
type KeyControls = {
    forward: boolean
    backward: boolean
    left: boolean
    right: boolean
    jump: boolean
    sprint: boolean
}

export const Jackalope = forwardRef<EntityType, JackalopeProps>(({ 
    onMove, 
    walkSpeed = 0.12, 
    runSpeed = 0.22, 
    jumpForce = 0.8, 
    connectionManager, 
    visible = false, 
    thirdPersonView = false, 
    ...props 
}, ref) => {
    // Core references
    const jackalopeRef = useRef<EntityType>(null!)
    const jackalopeModelRef = useRef<THREE.Group>(null)
    const fpModelRef = useRef<THREE.Group>(null)
    
    // Physics
    const rapier = useRapier()
    const characterController = useRef<any>(null)
    
    // For direct position control
    const position = useRef(new THREE.Vector3())
    const velocity = useRef(new THREE.Vector3())
    const rotation = useRef(0)
    const targetRotation = useRef(0)
    
    // Animation state
    const [animation, setAnimation] = useState('idle')
    
    // Hopping system
    const hopTimer = useRef(0)
    const hopInterval = useRef(0.6) // Time between hops in seconds (slightly slower for a natural hop rhythm)
    const hopHeight = useRef(4.2) // Height of automatic hops (lower for more natural movement)
    const isHopping = useRef(false)
    
    // Core setup
    const camera = useThree((state) => state.camera)
    const [, getKeyboardControls] = useKeyboardControls()
    const gamepadState = useGamepad()
    
    // Track last server sync
    const lastStateTime = useRef(0)
    
    // Initialize position and physics controller
    useEffect(() => {
        // Create physics character controller
        const { world } = rapier
        characterController.current = world.createCharacterController(0.1)
        characterController.current.enableAutostep(0.5, 0.05, true)
        characterController.current.setSlideEnabled(true)
        characterController.current.enableSnapToGround(0.5)
        
        // Set initial position from props
        if (props.position && Array.isArray(props.position)) {
            position.current.set(props.position[0], props.position[1], props.position[2])
        }
        
        return () => {
            world.removeCharacterController(characterController.current)
        }
    }, [])
    
    // Main update - directly updates both the visual model and physics
    useFrame((state, delta) => {
        // Early return if refs aren't ready
        if (!jackalopeRef.current?.rigidBody) return
        
        // Get input state
        const { forward, backward, left, right, jump, sprint } = getKeyboardControls() as any
        
        // Combine keyboard and gamepad
        const moveForward = forward || (gamepadState?.leftStick?.y < 0)
        const moveBackward = backward || (gamepadState?.leftStick?.y > 0)
        const moveLeft = left || (gamepadState?.leftStick?.x < 0)
        const moveRight = right || (gamepadState?.leftStick?.x > 0)
        const isJumping = jump || gamepadState?.buttons?.jump
        const isSprinting = sprint || gamepadState?.buttons?.leftStickPress
        
        // Get movement direction from input
        const inputDir = new THREE.Vector3(
            (moveRight ? 1 : 0) - (moveLeft ? 1 : 0),
            0,
            (moveForward ? 1 : 0) - (moveBackward ? 1 : 0)
        ).normalize()
        
        // Convert to camera-relative direction
        const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
        cameraDirection.y = 0 // Keep movement horizontal
        cameraDirection.normalize()
        
        const cameraSide = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
        cameraSide.y = 0
        cameraSide.normalize()
        
        // Calculate movement in camera space
        const moveDirection = new THREE.Vector3()
        
        if (inputDir.z !== 0 || inputDir.x !== 0) {
            moveDirection
                .addScaledVector(cameraDirection, inputDir.z)
                .addScaledVector(cameraSide, inputDir.x)
                .normalize()
            
            targetRotation.current = Math.atan2(moveDirection.x, moveDirection.z) + Math.PI
        }
        
        // Apply movement if we have input
        const hasMovementInput = Math.abs(inputDir.x) > 0.1 || Math.abs(inputDir.z) > 0.1
        
        // Check if we're on the ground (moved up)
        const groundCheck = characterController.current.computedGrounded()
        
        if (hasMovementInput) {
            // Calculate speed
            const speed = BASE_SPEED * (isSprinting ? RUN_MULTIPLIER : 1.0)
            
            // Apply horizontal movement
            velocity.current.x = moveDirection.x * speed
            velocity.current.z = moveDirection.z * speed
            
            // Set animation based on speed
            setAnimation(isSprinting ? 'run' : 'walk')
            
            // Auto-hopping system when moving
            hopTimer.current += delta
            if (hopTimer.current >= hopInterval.current && groundCheck) {
                // Time to hop - apply upward velocity if we're on the ground
                // Make hops faster and lower during sprinting for a quick-hopping effect
                velocity.current.y = jumpForce * hopHeight.current
                // Reduce hop interval when sprinting for faster, quick hops
                hopInterval.current = isSprinting ? 0.4 : 0.8
                hopTimer.current = 0
                isHopping.current = true
            }
        } else {
            // Slow down if no input
            velocity.current.x *= 0.8
            velocity.current.z *= 0.8
            
            // Reset hop timer when not moving
            hopTimer.current = 0
            isHopping.current = false
            
            // Clamp small velocities to 0
            if (Math.abs(velocity.current.x) < 0.01) velocity.current.x = 0
            if (Math.abs(velocity.current.z) < 0.01) velocity.current.z = 0
            
            // Switch to idle animation if basically stopped
            if (Math.sqrt(velocity.current.x * velocity.current.x + velocity.current.z * velocity.current.z) < 0.1) {
                setAnimation('idle')
            }
        }
        
        // Jump handling
        if (isJumping && groundCheck) {
            velocity.current.y = jumpForce * JUMP_MULTIPLIER
            isHopping.current = false // Reset hopping state on manual jump
            hopTimer.current = 0 // Reset hop timer on manual jump
        }
        
        // Apply gravity if not on ground
        if (!groundCheck) {
            velocity.current.y -= 9.8 * delta * GRAVITY_REDUCTION // Reduced gravity effect for higher/longer jumps
        } else if (velocity.current.y < 0) {
            velocity.current.y = 0 // Stop falling if on ground
        }
        
        // Create a target position including the desired movement
        const targetPosition = position.current.clone().add(
            velocity.current.clone().multiplyScalar(delta)
        )
        
        // Handle collision with the character controller
        const rigidBody = jackalopeRef.current.rigidBody
        const collider = rigidBody.collider(0)
        
        // Calculate the movement vector (target - current)
        const movement = {
            x: targetPosition.x - position.current.x,
            y: targetPosition.y - position.current.y,
            z: targetPosition.z - position.current.z
        }
        
        // Check for valid collision movement
        characterController.current.computeColliderMovement(collider, movement)
        const safeMovement = characterController.current.computedMovement()
        
        // Apply the safe movement to our position
        position.current.x += safeMovement.x
        position.current.y += safeMovement.y
        position.current.z += safeMovement.z
        
        // Sync the physics body to our position
        rigidBody.setNextKinematicTranslation(position.current)
        
        // Smoothly rotate the model to face the movement direction
        const rotDiff = Math.atan2(
            Math.sin(targetRotation.current - rotation.current),
            Math.cos(targetRotation.current - rotation.current)
        )
        rotation.current += rotDiff * Math.min(1, 10 * delta)
        
        // DIRECT MODEL UPDATES - no React props involved
        
        // 1. Third-person model
        if (jackalopeModelRef.current && thirdPersonView) {
            // Update model position directly
            jackalopeModelRef.current.position.set(
                position.current.x,
                position.current.y - 0.65, // Reduce height offset to lower the model
                position.current.z
            )
            
            // BUGFIX: Apply animation-specific offset to maintain consistent pivot
            // When running/sprinting, adjust the Z position to counter the pivot shift
            if (animation === 'run') {
                // Apply a negative Z offset to counteract the forward-shifting pivot during sprinting
                // This makes the model rotate around its visual center consistently regardless of animation
                const sprintOffset = -0.3; // This value may need adjustment based on testing
                jackalopeModelRef.current.position.z += sprintOffset;
            }
            
            // Add PI rotation to make model face the correct direction
            jackalopeModelRef.current.rotation.y = rotation.current + Math.PI
        }
        
        // 2. First-person model
        if (fpModelRef.current && !thirdPersonView) {
            fpModelRef.current.position.set(
                position.current.x,
                position.current.y,
                position.current.z
            )
            fpModelRef.current.rotation.y = rotation.current
        }
        
        // Inform parent of movement
        if (onMove) {
            onMove(position.current.clone())
        }
        
        // Send multiplayer updates at fixed intervals
        if (connectionManager && connectionManager.isReadyToSend() &&
            (Date.now() - lastStateTime.current > 50)) { // 20 updates per second
            
            lastStateTime.current = Date.now()
            
            // Create rotation quaternion for network
            const rotationQuat = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(0, rotation.current, 0)
            )
            
            connectionManager.sendPlayerUpdate({
                position: [position.current.x, position.current.y, position.current.z],
                rotation: [rotationQuat.x, rotationQuat.y, rotationQuat.z, rotationQuat.w],
                velocity: [velocity.current.x, velocity.current.y, velocity.current.z],
                sequence: Date.now(),
                playerType: 'jackalope'
            })
        }
        
        // Add debug log occasionally
        if (Math.random() < 0.01) {
            console.log(`[JACKALOPE] Pos: (${position.current.x.toFixed(2)}, ${position.current.y.toFixed(2)}, ${position.current.z.toFixed(2)}) | Vel: (${velocity.current.x.toFixed(2)}, ${velocity.current.y.toFixed(2)}, ${velocity.current.z.toFixed(2)}) | Anim: ${animation}`)
        }
    })
    
    // Expose methods to parent through ref
    useImperativeHandle(ref, () => ({
        ...jackalopeRef.current,
        getPosition: () => {
            return position.current.clone()
        },
        getRotation: () => {
            return new THREE.Quaternion().setFromEuler(
                new THREE.Euler(0, rotation.current, 0)
            )
        }
    }))
    
    return (
        <>
            {/* Physics body - for collision only */}
            <Entity isPlayer ref={jackalopeRef}>
                <Component name="rigidBody">
                    <RigidBody
                        {...props}
                        colliders={false}
                        mass={1}
                        type="kinematicPosition"
                        enabledRotations={[false, false, false]}
                    >
                        <object3D name="jackalope" />
                        <CapsuleCollider args={[1.0, 0.5]} position={[0, -0.65, 0]} />
                    </RigidBody>
                </Component>
            </Entity>
            
            {/* First person model - we manipulate this directly in useFrame */}
            {visible && !thirdPersonView && (
                <group ref={fpModelRef}>
                    <mesh position={[0, 0.3, 0]} castShadow>
                        <capsuleGeometry args={[0.3, 0.4, 4, 8]} />
                        <meshStandardMaterial color="#ffffff" />
                    </mesh>
                    
                    <mesh position={[0, 0.8, 0.2]} castShadow>
                        <sphereGeometry args={[0.25, 16, 16]} />
                        <meshStandardMaterial color="#ffffff" />
                    </mesh>
                    
                    <group>
                        <mesh position={[-0.1, 1.1, 0.2]} rotation={[0.2, 0, -0.1]} castShadow>
                            <capsuleGeometry args={[0.03, 0.4, 4, 8]} />
                            <meshStandardMaterial color="#ffffff" />
                        </mesh>
                        <mesh position={[0.1, 1.1, 0.2]} rotation={[0.2, 0, 0.1]} castShadow>
                            <capsuleGeometry args={[0.03, 0.4, 4, 8]} />
                            <meshStandardMaterial color="#ffffff" />
                        </mesh>
                    </group>
                </group>
            )}
            
            {/* Third person model - manipulated directly in useFrame */}
            {visible && thirdPersonView && (
                <group ref={jackalopeModelRef} scale={[2, 2, 2]}>
                    <JackalopeModel
                        animation={animation}
                        visible={visible}
                        // Note: we don't pass position/rotation as props anymore
                        // The parent group will be manipulated directly in useFrame
                    />
                </group>
            )}
        </>
    )
}) 