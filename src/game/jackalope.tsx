import Rapier from '@dimforge/rapier3d-compat'
import { PerspectiveCamera, useKeyboardControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, RigidBodyProps, useBeforePhysicsStep, useRapier } from '@react-three/rapier'
import { useEffect, useRef, useState, useMemo, forwardRef, useImperativeHandle } from 'react'
import { useGamepad } from '../common/hooks/use-gamepad'
import * as THREE from 'three'
import { Component, Entity, EntityType } from './ecs'

// Import ConnectionManager for multiplayer support
import { ConnectionManager } from '../network/ConnectionManager'
import { JackalopeModel } from './JackalopeModel' // Import the JackalopeModel component

// Reuse these vectors from the player component
const _direction = new THREE.Vector3()
const _frontVector = new THREE.Vector3()
const _sideVector = new THREE.Vector3()
const _characterTranslation = new THREE.Vector3()
const _cameraWorldDirection = new THREE.Vector3()

// Constants for character movement (some adjusted for the jackalope's movement style)
const characterShapeOffset = 0.1
const autoStepMaxHeight = 1.5 // Lower step height for jackalope
const autoStepMinWidth = 0.05
const accelerationTimeAirborne = 0.2
const accelerationTimeGrounded = 0.025
const timeToJumpApex = 2
const maxJumpHeight = 0.7 // Higher jump for rabbit
const minJumpHeight = 0.3 // Higher minimum jump for rabbit
const velocityXZSmoothing = 0.1
const velocityXZMin = 0.0001
const jumpGravity = -(2 * maxJumpHeight) / Math.pow(timeToJumpApex, 2)
const maxJumpVelocity = Math.abs(jumpGravity) * timeToJumpApex
const minJumpVelocity = Math.sqrt(2 * Math.abs(jumpGravity) * minJumpHeight)

const up = new THREE.Vector3(0, 1, 0)

// For model rotation and position tracking
const _jackalopDirection = new THREE.Vector3();
const _lastModelPosition = new THREE.Vector3();
const _modelTargetPosition = new THREE.Vector3();

// Keyboard controls type
type KeyControls = {
    forward: boolean
    backward: boolean
    left: boolean
    right: boolean
    jump: boolean
    sprint: boolean
}

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

export const Jackalope = forwardRef<EntityType, JackalopeProps>(({ 
    onMove, 
    walkSpeed = 0.09, // Slightly slower than human
    runSpeed = 0.17, // Higher run speed (rabbits are fast!)
    jumpForce = 0.7, // Higher jump force for bunnies
    connectionManager, 
    visible = false, 
    thirdPersonView = false, 
    ...props 
}, ref) => {
    const jackalopeRef = useRef<EntityType>(null!)
    
    // For client-side prediction
    const lastStateTime = useRef(0)
    const pendingReconciliation = useRef(false)
    const reconciliationStrength = useRef(0.3) // Default reconciliation strength
    const serverPosition = useRef(new THREE.Vector3())
    const movementIntent = useRef({ forward: false, backward: false, left: false, right: false, jump: false, sprint: false })
    
    // For jackalope's rotation (third-person camera)
    const jackalopRotation = useRef(new THREE.Quaternion())

    const rapier = useRapier()
    const camera = useThree((state) => state.camera)
    const clock = useThree((state) => state.clock)

    // Use 'any' to avoid type conflicts between different versions of Rapier
    const characterController = useRef<any>(null!)

    const [, getKeyboardControls] = useKeyboardControls()
    const gamepadState = useGamepad()

    const horizontalVelocity = useRef({ x: 0, z: 0 })
    const jumpVelocity = useRef(0)
    const holdingJump = useRef(false)
    const jumpTime = useRef(0)
    const jumping = useRef(false)

    // Animation states
    const [isWalking, setIsWalking] = useState(false)
    const [isRunning, setIsRunning] = useState(false)
    
    // Add state for animation
    const [currentAnimation, setCurrentAnimation] = useState('idle')

    // Reference for the model
    const jackalopModelRef = useRef<THREE.Group>(null);

    // Set up character controller
    useEffect(() => {
        const { world } = rapier

        characterController.current = world.createCharacterController(characterShapeOffset)
        characterController.current.enableAutostep(autoStepMaxHeight, autoStepMinWidth, true)
        characterController.current.setSlideEnabled(true)
        characterController.current.enableSnapToGround(0.1)
        characterController.current.setApplyImpulsesToDynamicBodies(true)

        return () => {
            world.removeCharacterController(characterController.current)
            characterController.current = null!
        }
    }, [])

    // Implement jackalope physics step
    useBeforePhysicsStep(() => {
        const characterRigidBody = jackalopeRef.current.rigidBody

        if (!characterRigidBody) return

        const characterCollider = characterRigidBody.collider(0)

        const { forward, backward, left, right, jump, sprint } = getKeyboardControls() as KeyControls
        
        // Combine keyboard and gamepad input
        const moveForward = forward || (gamepadState.leftStick.y < 0)
        const moveBackward = backward || (gamepadState.leftStick.y > 0)
        const moveLeft = left || (gamepadState.leftStick.x < 0)
        const moveRight = right || (gamepadState.leftStick.x > 0)
        const isJumping = jump || gamepadState.buttons.jump
        const isSprinting = sprint || gamepadState.buttons.leftStickPress

        // Store movement intent for prediction/reconciliation
        movementIntent.current = {
            forward: moveForward,
            backward: moveBackward,
            left: moveLeft, 
            right: moveRight,
            jump: isJumping,
            sprint: isSprinting
        }

        const speed = walkSpeed * (isSprinting ? runSpeed / walkSpeed : 1)
        
        // Update movement state for animations
        const isMoving = moveForward || moveBackward || moveLeft || moveRight
        setIsWalking(isMoving && !isSprinting)
        setIsRunning(isMoving && isSprinting)

        const grounded = characterController.current.computedGrounded()

        // x and z movement
        _frontVector.set(0, 0, Number(moveBackward) - Number(moveForward))
        _sideVector.set(Number(moveLeft) - Number(moveRight), 0, 0)

        const cameraWorldDirection = camera.getWorldDirection(_cameraWorldDirection)
        const cameraYaw = Math.atan2(cameraWorldDirection.x, cameraWorldDirection.z)

        _direction.subVectors(_frontVector, _sideVector).normalize().multiplyScalar(speed)
        _direction.applyAxisAngle(up, cameraYaw).multiplyScalar(-1)

        const horizontalVelocitySmoothing = velocityXZSmoothing * (grounded ? accelerationTimeGrounded : accelerationTimeAirborne)
        const horizontalVelocityLerpFactor = 1 - Math.pow(horizontalVelocitySmoothing, 0.116)
        horizontalVelocity.current = {
            x: THREE.MathUtils.lerp(horizontalVelocity.current.x, _direction.x, horizontalVelocityLerpFactor),
            z: THREE.MathUtils.lerp(horizontalVelocity.current.z, _direction.z, horizontalVelocityLerpFactor),
        }

        if (Math.abs(horizontalVelocity.current.x) < velocityXZMin) {
            horizontalVelocity.current.x = 0
        }
        if (Math.abs(horizontalVelocity.current.z) < velocityXZMin) {
            horizontalVelocity.current.z = 0
        }

        // jumping and gravity
        if (isJumping && grounded) {
            jumping.current = true
            holdingJump.current = true
            jumpTime.current = clock.elapsedTime
            jumpVelocity.current = maxJumpVelocity * (jumpForce / 0.5) // Scale jump velocity based on jumpForce
        }

        if (!isJumping && grounded) {
            jumping.current = false
        }

        if (jumping.current && holdingJump.current && !isJumping) {
            if (jumpVelocity.current > minJumpVelocity) {
                jumpVelocity.current = minJumpVelocity
            }
        }

        if (!isJumping && grounded) {
            jumpVelocity.current = 0
        } else {
            jumpVelocity.current += jumpGravity * 0.116
        }

        holdingJump.current = isJumping

        // compute movement direction
        const movementDirection = {
            x: horizontalVelocity.current.x,
            y: jumpVelocity.current,
            z: horizontalVelocity.current.z,
        }

        // compute collider movement and update rigid body
        characterController.current.computeColliderMovement(characterCollider, movementDirection)

        const translation = characterRigidBody.translation()
        const newPosition = _characterTranslation.copy(translation as THREE.Vector3)
        const movement = characterController.current.computedMovement()
        newPosition.add(new THREE.Vector3(movement.x, movement.y, movement.z))

        // If we need to reconcile with server position
        if (pendingReconciliation.current) {
            // Blend between our predicted position and server position with appropriate strength
            newPosition.lerp(serverPosition.current, reconciliationStrength.current)
            
            // Debug output
            if (reconciliationStrength.current > 0.1) {
                console.log(`Applied reconciliation with strength ${reconciliationStrength.current.toFixed(2)}`);
                console.log(`New position: (${newPosition.x.toFixed(2)}, ${newPosition.y.toFixed(2)}, ${newPosition.z.toFixed(2)})`);
            }
            
            // Reset flags - reconciliation applied
            pendingReconciliation.current = false;
            reconciliationStrength.current = 0.3; // Reset to default
        }

        characterRigidBody.setNextKinematicTranslation(newPosition)
    })

    // Frame update for jackalope
    useFrame((_, delta) => {
        const characterRigidBody = jackalopeRef.current.rigidBody

        if (!characterRigidBody) return

        // For onMove callback
        const currentPos = characterRigidBody.translation() as THREE.Vector3
        
        // Only report position changes if there's a callback function provided
        if (onMove && characterRigidBody) {
            onMove(currentPos)
        }

        // Update camera FOV based on running status (not used in third-person)
        if (!thirdPersonView && camera instanceof THREE.PerspectiveCamera) {
            const { sprint } = getKeyboardControls() as KeyControls
            const isSprinting = sprint || gamepadState.buttons.leftStickPress
            
            if (isSprinting) {
                camera.fov = THREE.MathUtils.lerp(camera.fov, 100, 0.05)
            } else {
                camera.fov = THREE.MathUtils.lerp(camera.fov, 90, 0.05)
            }
            
            camera.updateProjectionMatrix()
        }

        // Send position to multiplayer system if connected
        if (connectionManager && connectionManager.isReadyToSend() && 
            (Date.now() - lastStateTime.current > 50)) { // 20 updates per second
            lastStateTime.current = Date.now();
            
            const position = characterRigidBody.translation();
            const rotation = characterRigidBody.rotation(); 
            const velocity = characterRigidBody.linvel();
            
            connectionManager.sendPlayerUpdate({
                position: [position.x, position.y, position.z],
                rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
                velocity: [velocity.x, velocity.y, velocity.z],
                sequence: Date.now(),
                playerType: 'jackalope'
            });
        }

        // Update model target position regardless of view mode
        try {
            const position = characterRigidBody.translation();
            
            // Only update if the position is valid
            if (position && !Number.isNaN(position.x) && !Number.isNaN(position.y) && !Number.isNaN(position.z)) {
                // Create target position (adding offset to raise jackalope out of ground)
                _modelTargetPosition.set(position.x, position.y, position.z);
                
                // Debug output every 5 seconds to avoid log spam
                if (Date.now() % 5000 < 20) {
                    console.log(`Jackalope local model position: (${_modelTargetPosition.x.toFixed(2)}, ${_modelTargetPosition.y.toFixed(2)}, ${_modelTargetPosition.z.toFixed(2)})`);
                }
            }
        } catch (error) {
            console.error("Error updating jackalope model target position:", error);
        }

        // Update jackalope geometric model position with smoothing (only when geometric model is visible)
        if (visible && !thirdPersonView && jackalopModelRef.current && jackalopeRef.current && jackalopeRef.current.rigidBody) {
            try {
                // First time setup
                if (_lastModelPosition.lengthSq() === 0) {
                    _lastModelPosition.copy(_modelTargetPosition);
                    jackalopModelRef.current.position.copy(_modelTargetPosition);
                } else {
                    // Smoother interpolation for position - use slower rate for more stability
                    const lerpFactor = 0.5;
                    jackalopModelRef.current.position.lerp(_modelTargetPosition, lerpFactor);
                    _lastModelPosition.copy(jackalopModelRef.current.position);
                }
                
                // Calculate model rotation based on movement direction
                if (isWalking || isRunning) {
                    // Get velocity for direction
                    const velocity = characterRigidBody.linvel();
                    if (velocity && velocity.x !== 0 && velocity.z !== 0) {
                        _jackalopDirection.set(velocity.x, 0, velocity.z).normalize();
                        
                        if (_jackalopDirection.length() > 0.1) {
                            // Calculate target rotation
                            const targetRotation = Math.atan2(_jackalopDirection.x, _jackalopDirection.z);
                            
                            // Apply smooth rotation
                            const currentRotY = jackalopModelRef.current.rotation.y;
                            const newRotY = THREE.MathUtils.lerp(
                                currentRotY,
                                targetRotation,
                                0.1 // Smooth rotation factor
                            );
                            
                            jackalopModelRef.current.rotation.y = newRotY;
                            
                            // Save rotation for third-person camera
                            jackalopRotation.current.setFromEuler(new THREE.Euler(0, newRotY, 0));
                        }
                    }
                }
            } catch (error) {
                console.error("Error updating jackalope model:", error);
            }
        }

        // Update animation based on movement state
        if (isRunning) {
            setCurrentAnimation('run');
        } else if (isWalking) {
            setCurrentAnimation('walk');
        } else {
            setCurrentAnimation('idle');
        }
    });

    // Expose methods to parent through ref
    useImperativeHandle(ref, () => ({
        ...jackalopeRef.current,
        // Add any custom methods here if needed
        getPosition: () => {
            return jackalopeRef.current?.rigidBody?.translation() as THREE.Vector3;
        },
        getRotation: () => {
            return jackalopRotation.current;
        }
    }));

    // Handle third-person mode switching
    useEffect(() => {
        // Lock/unlock pointer based on view mode
        if (thirdPersonView) {
            // Exit pointer lock when switching to third-person
            if (document.pointerLockElement) {
                document.exitPointerLock();
            }
        }
    }, [thirdPersonView]);

    return (
        <>
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
                        <CapsuleCollider args={[0.5, 0.3]} /> {/* Smaller collider for jackalope */}
                    </RigidBody>
                </Component>
            </Entity>
            
            {/* Only show geometric model when NOT in third-person view but still visible */}
            {visible && !thirdPersonView && (
                <group ref={jackalopModelRef}>
                    {/* Jackalope body - white bunny */}
                    <mesh position={[0, 0.3, 0]} castShadow>
                        <capsuleGeometry args={[0.3, 0.4, 4, 8]} />
                        <meshStandardMaterial color="#ffffff" />
                    </mesh>
                    
                    {/* Jackalope head */}
                    <mesh position={[0, 0.8, 0.2]} castShadow>
                        <sphereGeometry args={[0.25, 16, 16]} />
                        <meshStandardMaterial color="#ffffff" />
                    </mesh>
                    
                    {/* Jackalope ears - left */}
                    <mesh position={[-0.1, 1.1, 0.2]} rotation={[0.2, 0, -0.1]} castShadow>
                        <capsuleGeometry args={[0.03, 0.4, 4, 8]} />
                        <meshStandardMaterial color="#ffffff" />
                    </mesh>
                    
                    {/* Jackalope ears - right */}
                    <mesh position={[0.1, 1.1, 0.2]} rotation={[0.2, 0, 0.1]} castShadow>
                        <capsuleGeometry args={[0.03, 0.4, 4, 8]} />
                        <meshStandardMaterial color="#ffffff" />
                    </mesh>
                    
                    {/* Jackalope tiny antlers - left */}
                    <mesh position={[-0.1, 1, 0.3]} rotation={[0.4, 0, -0.5]} castShadow>
                        <cylinderGeometry args={[0.01, 0.02, 0.2, 8]} />
                        <meshStandardMaterial color="#8B4513" />
                    </mesh>
                    
                    {/* Jackalope tiny antlers - right */}
                    <mesh position={[0.1, 1, 0.3]} rotation={[0.4, 0, 0.5]} castShadow>
                        <cylinderGeometry args={[0.01, 0.02, 0.2, 8]} />
                        <meshStandardMaterial color="#8B4513" />
                    </mesh>
                    
                    {/* Jackalope front legs */}
                    <mesh position={[-0.15, 0.15, 0.1]} rotation={[0.3, 0, 0]} castShadow>
                        <capsuleGeometry args={[0.06, 0.25, 4, 8]} />
                        <meshStandardMaterial color="#ffffff" />
                    </mesh>
                    <mesh position={[0.15, 0.15, 0.1]} rotation={[0.3, 0, 0]} castShadow>
                        <capsuleGeometry args={[0.06, 0.25, 4, 8]} />
                        <meshStandardMaterial color="#ffffff" />
                    </mesh>
                    
                    {/* Jackalope back legs (slightly larger for jumping) */}
                    <mesh position={[-0.15, 0.15, -0.2]} rotation={[-0.3, 0, 0]} castShadow>
                        <capsuleGeometry args={[0.08, 0.3, 4, 8]} />
                        <meshStandardMaterial color="#ffffff" />
                    </mesh>
                    <mesh position={[0.15, 0.15, -0.2]} rotation={[-0.3, 0, 0]} castShadow>
                        <capsuleGeometry args={[0.08, 0.3, 4, 8]} />
                        <meshStandardMaterial color="#ffffff" />
                    </mesh>
                    
                    {/* Jackalope tail */}
                    <mesh position={[0, 0.3, -0.35]} castShadow>
                        <sphereGeometry args={[0.1, 8, 8]} />
                        <meshStandardMaterial color="#ffffff" />
                    </mesh>
                    
                    {/* Eyes */}
                    <mesh position={[-0.12, 0.85, 0.4]} castShadow>
                        <sphereGeometry args={[0.03, 8, 8]} />
                        <meshStandardMaterial color="#ff0000" />
                    </mesh>
                    <mesh position={[0.12, 0.85, 0.4]} castShadow>
                        <sphereGeometry args={[0.03, 8, 8]} />
                        <meshStandardMaterial color="#ff0000" />
                    </mesh>
                </group>
            )}
            
            {/* Show JackalopeModel in third-person view */}
            {visible && thirdPersonView && (
                <JackalopeModel
                    animation={currentAnimation}
                    visible={visible}
                    position={[_modelTargetPosition.x, _modelTargetPosition.y + 0.3, _modelTargetPosition.z]}
                    rotation={[0, Math.PI + (Math.PI/2), 0]} // Adjusted rotation to match remote view
                    scale={[2, 2, 2]} // Match scale with remote view
                />
            )}
        </>
    )
}) 