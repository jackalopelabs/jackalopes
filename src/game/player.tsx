import Rapier from '@dimforge/rapier3d-compat'
import { KeyboardControls, PerspectiveCamera, PointerLockControls, useKeyboardControls, useGLTF, useAnimations } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, RigidBodyProps, useBeforePhysicsStep, useRapier } from '@react-three/rapier'
import { useEffect, useRef, useState, useMemo, forwardRef, useImperativeHandle } from 'react'
import { useGamepad } from '../common/hooks/use-gamepad'
import * as THREE from 'three'
import { Component, Entity, EntityType } from './ecs'

// Update import to use MultiplayerManager
import { ConnectionManager } from '../network/ConnectionManager'
import { useMultiplayer } from '../network/MultiplayerManager'
import { MercModel } from './MercModel' // Import our new MercModel component
import { JackalopeModel } from './JackalopeModel' // Import the JackalopeModel
import { FpsArmsModelPath } from '../assets' // Import FPS arms model path

const _direction = new THREE.Vector3()
const _frontVector = new THREE.Vector3()
const _sideVector = new THREE.Vector3()
const _characterLinvel = new THREE.Vector3()
const _characterTranslation = new THREE.Vector3()
const _cameraWorldDirection = new THREE.Vector3()
const _cameraPosition = new THREE.Vector3()

const normalFov = 90
const sprintFov = 100

const characterShapeOffset = 0.1
const autoStepMaxHeight = 2
const autoStepMinWidth = 0.05
const accelerationTimeAirborne = 0.2
const accelerationTimeGrounded = 0.025
const timeToJumpApex = 2
const maxJumpHeight = 0.5
const minJumpHeight = 0.2
const velocityXZSmoothing = 0.1
const velocityXZMin = 0.0001
const jumpGravity = -(2 * maxJumpHeight) / Math.pow(timeToJumpApex, 2)
const maxJumpVelocity = Math.abs(jumpGravity) * timeToJumpApex
const minJumpVelocity = Math.sqrt(2 * Math.abs(jumpGravity) * minJumpHeight)

const up = new THREE.Vector3(0, 1, 0)

// Add these outside the component for rotation calculation
const _playerDirection = new THREE.Vector3();
const _lastModelPosition = new THREE.Vector3();
const _modelTargetPosition = new THREE.Vector3();

export type PlayerControls = {
    children: React.ReactNode
}

export type PlayerProps = RigidBodyProps & {
    onMove?: (position: THREE.Vector3) => void
    walkSpeed?: number
    runSpeed?: number
    jumpForce?: number
    connectionManager?: ConnectionManager // Add optional ConnectionManager for multiplayer
    visible?: boolean // Add visibility option for third-person view
    thirdPersonView?: boolean // Flag for third-person camera mode
    playerType?: 'merc' | 'jackalope' // Add player type to determine which model to use
}

export const Player = forwardRef<EntityType, PlayerProps>(({ onMove, walkSpeed = 0.1, runSpeed = 0.15, jumpForce = 0.5, connectionManager, visible = false, thirdPersonView = false, playerType = 'merc', ...props }, ref) => {
    const playerRef = useRef<EntityType>(null!)
    const gltf = useGLTF(FpsArmsModelPath)
    const { actions } = useAnimations(gltf.animations, gltf.scene)
    
    // Debug log for FPS arms model loading
    useEffect(() => {
        if (gltf?.scene) {
            console.log('FPS arms model loaded successfully:', gltf.scene);
            console.log('FPS arms animations:', Object.keys(actions));
        } else {
            console.error('Failed to load FPS arms model');
        }
    }, [gltf.scene, actions]);
    
    // For client-side prediction
    const lastStateTime = useRef(0)
    const pendingReconciliation = useRef(false)
    const reconciliationStrength = useRef(0.3) // Default reconciliation strength
    const serverPosition = useRef(new THREE.Vector3())
    const movementIntent = useRef({ forward: false, backward: false, left: false, right: false, jump: false, sprint: false })
    
    // Add a ref for the player's rotation (for the third-person camera)
    const playerRotation = useRef(new THREE.Quaternion())

    const rapier = useRapier()
    const camera = useThree((state) => state.camera)
    const clock = useThree((state) => state.clock)

    const characterController = useRef<Rapier.KinematicCharacterController>(null!)

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

    // For tracking the last animation state change time to prevent flicker
    const lastAnimationChange = useRef(0)
    const animationChangeDebounce = 300 // ms

    // Animation state for Mixamo model
    const [currentAnimation, setCurrentAnimation] = useState('idle')
    
    // Add logging when animation state changes
    useEffect(() => {
        console.log(`Animation state changed: walking=${isWalking}, running=${isRunning}, animation=${currentAnimation}`);
    }, [isWalking, isRunning, currentAnimation])

    // Add a reference for the model
    const playerModelRef = useRef<THREE.Group>(null);

    useEffect(() => {
        const { world } = rapier

        characterController.current = world.createCharacterController(characterShapeOffset)
        characterController.current.enableAutostep(autoStepMaxHeight, autoStepMinWidth, true)
        characterController.current.setSlideEnabled(true)
        characterController.current.enableSnapToGround(0.1)
        characterController.current.setApplyImpulsesToDynamicBodies(true)

        // Stop all animations initially
        Object.values(actions).forEach(action => action?.stop())
        
        // Initialize with idle animation
        console.log('Initializing with idle animation');
        setIsWalking(false);
        setIsRunning(false);
        setCurrentAnimation('idle');

        return () => {
            world.removeCharacterController(characterController.current)
            characterController.current = null!
        }
    }, [])

    // Handle shooting animation
    useEffect(() => {
        const handleShoot = () => {
            if (document.pointerLockElement) {
                const fireAction = actions['Rig|Saiga_Fire']
                if (fireAction) {
                    fireAction.setLoop(THREE.LoopOnce, 1)
                    fireAction.reset().play()
                }
                
                // For now, continue using the walk animation for shooting
                // until a shoot animation is added
                setCurrentAnimation('walk')
            }
        }

        window.addEventListener('pointerdown', handleShoot)
        return () => window.removeEventListener('pointerdown', handleShoot)
    }, [actions])

    useBeforePhysicsStep(() => {
        const characterRigidBody = playerRef.current.rigidBody

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
        
        // Update movement state for animations with velocity threshold
        const isMoving = moveForward || moveBackward || moveLeft || moveRight
        
        // Add a velocity-based check to make sure we're actually moving
        // This prevents animation flicker when keys are released
        const velocity = Math.sqrt(
            Math.pow(horizontalVelocity.current.x, 2) + 
            Math.pow(horizontalVelocity.current.z, 2)
        )
        
        // Simplified animation states based directly on input and velocity
        if (isMoving && velocity > 0.02) {
            setIsWalking(true && !isSprinting)
            setIsRunning(true && isSprinting)
        } else if (velocity < 0.01) {
            // Reset to idle state when truly stopped
            setIsWalking(false) 
            setIsRunning(false)
        }

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
        newPosition.add(movement)

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

    // Call this in useFrame to ensure frequent checks
    useFrame((_, delta) => {
        const characterRigidBody = playerRef.current.rigidBody
        if (!characterRigidBody) {
            return
        }

        _characterLinvel.copy(characterRigidBody.linvel() as THREE.Vector3)
        const currentSpeed = _characterLinvel.length()

        const { forward, backward, left, right } = getKeyboardControls() as KeyControls
        const isMoving = forward || backward || left || right
        const isSprinting = getKeyboardControls().sprint || gamepadState.buttons.leftStickPress

        // Calculate velocity magnitude for better animation state detection
        const velocityMagnitude = Math.sqrt(
            Math.pow(horizontalVelocity.current.x, 2) + 
            Math.pow(horizontalVelocity.current.z, 2)
        );
        
        // Log velocity occasionally for debugging
        if (Math.random() < 0.01) {
            console.log(`Player velocity: ${velocityMagnitude.toFixed(4)}`);
        }
        
        // Clear state when velocity is very low
        if (velocityMagnitude < 0.01) {
            if (isWalking || isRunning) {
                console.log(`Player stopped moving, velocity: ${velocityMagnitude.toFixed(4)}`);
                setIsWalking(false);
                setIsRunning(false);
            }
        } 
        // Set walking/running based on input state and velocity
        else if (velocityMagnitude > 0.02 && isMoving) {
            if (isSprinting && !isRunning) {
                console.log(`Player started running, velocity: ${velocityMagnitude.toFixed(4)}`);
                setIsRunning(true);
                setIsWalking(false);
            } else if (!isSprinting && !isWalking) {
                console.log(`Player started walking, velocity: ${velocityMagnitude.toFixed(4)}`);
                setIsWalking(true);
                setIsRunning(false);
            }
        }

        const translation = characterRigidBody.translation()
        onMove?.(translation as THREE.Vector3)
        const cameraPosition = _cameraPosition.set(translation.x, translation.y + 1, translation.z)
        const cameraEuler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
        
        // Different sensitivities for horizontal and vertical aiming
        const CAMERA_SENSITIVITY_X = 0.04
        const CAMERA_SENSITIVITY_Y = 0.03
        
        // Apply gamepad right stick for camera rotation
        if (gamepadState.connected && (Math.abs(gamepadState.rightStick.x) > 0 || Math.abs(gamepadState.rightStick.y) > 0)) {
            // Update Euler angles
            cameraEuler.y -= gamepadState.rightStick.x * CAMERA_SENSITIVITY_X
            cameraEuler.x = THREE.MathUtils.clamp(
                cameraEuler.x - gamepadState.rightStick.y * CAMERA_SENSITIVITY_Y,
                -Math.PI / 2,
                Math.PI / 2
            )
            
            // Apply the new rotation while maintaining up vector
            camera.quaternion.setFromEuler(cameraEuler)
        }
        
        camera.position.lerp(cameraPosition, delta * 30)
        
        // FOV change for sprint
        if (camera instanceof THREE.PerspectiveCamera) {
            camera.fov = THREE.MathUtils.lerp(camera.fov, isSprinting && currentSpeed > 0.1 ? sprintFov : normalFov, 10 * delta)
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
                playerType: playerType // Use the playerType prop when sending updates
            });
        }

        // Update player model position with smoothing
        if ((thirdPersonView || visible) && playerModelRef.current && playerRef.current && playerRef.current.rigidBody) {
            try {
                const position = playerRef.current.rigidBody.translation();
                
                // Only update if the position is valid
                if (position && !Number.isNaN(position.x) && !Number.isNaN(position.y) && !Number.isNaN(position.z)) {
                    // Create target position
                    _modelTargetPosition.set(position.x, position.y, position.z);
                    
                    // First time setup
                    if (_lastModelPosition.lengthSq() === 0) {
                        _lastModelPosition.copy(_modelTargetPosition);
                        playerModelRef.current.position.copy(_modelTargetPosition);
                    } else {
                        // Smoother interpolation for position - use slower rate for more stability
                        const lerpFactor = thirdPersonView ? 0.15 : 0.5; // Slower in third-person for stability
                        playerModelRef.current.position.lerp(_modelTargetPosition, lerpFactor);
                        _lastModelPosition.copy(playerModelRef.current.position);
                    }
                    
                    if (thirdPersonView) {
                        // Get camera direction for model rotation but only in third-person mode
                        const cameraWorldDirection = camera.getWorldDirection(_playerDirection);
                        
                        // Only use X and Z components for yaw calculation to prevent tipping
                        const cameraYaw = Math.atan2(cameraWorldDirection.x, cameraWorldDirection.z);
                        
                        // Smoothly interpolate rotation to prevent jittering
                        const currentYaw = playerModelRef.current.rotation.y;
                        const targetYaw = cameraYaw;
                        
                        // Calculate shortest path for rotation
                        let deltaYaw = targetYaw - currentYaw;
                        while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2;
                        while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2;
                        
                        // Very slow rotation interpolation for stability
                        playerModelRef.current.rotation.y = currentYaw + deltaYaw * 0.08;
                    }
                }
            } catch (error) {
                console.error("Error updating player model position:", error);
            }
        }
    })
    
    // Set the current animation based on movement state
    useEffect(() => {
        // Update animation based on movement state
        if (isRunning) {
            console.log('Setting run animation');
            setCurrentAnimation('run');
        } else if (isWalking) {
            console.log('Setting walk animation');
            setCurrentAnimation('walk');
        } else {
            console.log('Setting idle animation');
            setCurrentAnimation('idle');
        }
        
        // Log the current animation state for debugging
        console.log(`Animation state changed: walking=${isWalking}, running=${isRunning}, animation=${currentAnimation}`);
    }, [isWalking, isRunning]);

    // Handle movement animations
    useEffect(() => {
        const walkAction = actions['Rig|Saiga_Walk']
        const runAction = actions['Rig|Saiga_Run']

        if (isRunning) {
            walkAction?.stop()
            runAction?.play()
        } else if (isWalking) {
            runAction?.stop()
            walkAction?.play()
        } else {
            walkAction?.stop()
            runAction?.stop()
        }
    }, [isWalking, isRunning, actions])

    // Set up reconciliation handler if connection manager is provided
    useEffect(() => {
        if (connectionManager) {
            // Listen for server state updates to reconcile
            const handleServerState = (state: any) => {
                // Check if we need to apply corrections
                if (state.serverCorrection || (state.positionError && state.positionError > 0.25)) {
                    console.log(`Applying server correction - Error: ${state.positionError?.toFixed(3) || 'unknown'}`);
                
                    // We got an authoritative update from server
                    serverPosition.current.set(
                        state.position[0],
                        state.position[1],
                        state.position[2]
                    );
                    
                    // Calculate correction strength based on error magnitude
                    const correctionStrength = Math.min(0.8, Math.max(0.1, 
                        state.positionError ? state.positionError * 0.2 : 0.3
                    ));
                    
                    console.log(`Correction strength: ${correctionStrength.toFixed(2)}`);
                    
                    // Apply with appropriate strength
                    if (pendingReconciliation.current) {
                        // Already waiting for a correction, make this one stronger
                        pendingReconciliation.current = true;
                        reconciliationStrength.current = Math.max(reconciliationStrength.current, correctionStrength);
                    } else {
                        // First correction for this update
                        pendingReconciliation.current = true;
                        reconciliationStrength.current = correctionStrength;
                    }
                } else if (state.position) {
                    // No major correction needed, but store server position anyway
                    // for smaller corrections
                    serverPosition.current.set(
                        state.position[0],
                        state.position[1],
                        state.position[2]
                    );
                    
                    // Small correction (less than threshold)
                    if (state.positionError && state.positionError > 0.05) {
                        // Use a gentler correction for small errors
                        pendingReconciliation.current = true;
                        reconciliationStrength.current = 0.05;
                    }
                }
            };
            
            connectionManager.on('server_state_update', handleServerState);
            
            return () => {
                connectionManager.off('server_state_update', handleServerState);
            };
        }
    }, [connectionManager]);

    // Add getRotationQuaternion method to the player's ref
    useImperativeHandle(ref, () => ({
        ...playerRef.current,
        getRotationQuaternion: () => {
            // Calculate rotation based on camera direction
            const cameraWorldDirection = camera.getWorldDirection(new THREE.Vector3());
            const cameraYaw = Math.atan2(cameraWorldDirection.x, cameraWorldDirection.z);
            
            // Create and return a quaternion
            return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
        }
    }), [camera]);

    // Expose the ref
    useEffect(() => {
        if (ref) {
            // @ts-ignore - TypeScript doesn't handle this pattern well
            ref.current = playerRef.current;
        }
    }, [ref]);

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
            <Entity isPlayer ref={playerRef}>
                <Component name="rigidBody">
                    <RigidBody
                        {...props}
                        colliders={false}
                        mass={1}
                        type="kinematicPosition"
                        enabledRotations={[false, false, false]}
                    >
                        <object3D name="player" />
                        <CapsuleCollider args={[1, 0.5]} />
                    </RigidBody>
                </Component>
            </Entity>
            
            {/* Render player model when in third-person view or visible is true */}
            {(thirdPersonView || visible) && playerType === 'merc' && (
                <group ref={playerModelRef}>
                    {/* Player head */}
                    <mesh position={[0, 1.7, 0]} castShadow>
                        <sphereGeometry args={[0.4, 16, 16]} />
                        <meshStandardMaterial color="#4287f5" />
                    </mesh>
                    
                    {/* Player body */}
                    <mesh position={[0, 0.9, 0]} castShadow>
                        <capsuleGeometry args={[0.4, 1.2, 4, 8]} />
                        <meshStandardMaterial color="#4287f5" />
                    </mesh>
                    
                    {/* Player arm - left */}
                    <mesh position={[-0.6, 0.9, 0]} rotation={[0, 0, -Math.PI / 4]} castShadow>
                        <capsuleGeometry args={[0.15, 0.6, 4, 8]} />
                        <meshStandardMaterial color="#4287f5" />
                    </mesh>
                    
                    {/* Player arm - right - adjusted position for holding a weapon */}
                    <mesh position={[0.55, 0.95, 0.3]} rotation={[0.3, 0, Math.PI / 4]} castShadow>
                        <capsuleGeometry args={[0.15, 0.6, 4, 8]} />
                        <meshStandardMaterial color="#4287f5" />
                    </mesh>
                    
                    {/* Weapon model */}
                    <group position={[0.7, 0.95, 0.6]} rotation={[-0.1, 0, 0]}>
                        {/* Main body of the weapon */}
                        <mesh castShadow position={[0.3, 0, 0]}>
                            <cylinderGeometry args={[0.08, 0.12, 0.5, 8]} />
                            <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
                        </mesh>
                        
                        {/* Handle */}
                        <mesh castShadow position={[0.15, -0.1, 0]} rotation={[0, 0, Math.PI/2 - 0.5]}>
                            <cylinderGeometry args={[0.03, 0.03, 0.2, 8]} />
                            <meshStandardMaterial color="#222222" metalness={0.3} roughness={0.7} />
                        </mesh>
                    </group>
                </group>
            )}
            
            {visible && thirdPersonView && playerType === 'merc' && ( // Show the Mixamo model in third-person view for merc
                <MercModel 
                    animation={currentAnimation} 
                    visible={visible}
                    position={[0, -0.9, 0]} // Adjusted position to better match the ground
                    rotation={[0, Math.PI, 0]} // Rotated to face forward
                />
            )}
            
            {visible && thirdPersonView && playerType === 'jackalope' && ( // Show the Jackalope model in third-person view
                <JackalopeModel
                    animation={currentAnimation}
                    visible={visible}
                    position={[0, 0, 0]} // Position for jackalope model
                    rotation={[0, Math.PI, 0]} // Rotated to face forward
                    scale={[1, 1, 1]} // Default scale
                />
            )}
            
            {!thirdPersonView && (
                <PerspectiveCamera
                    makeDefault
                    fov={normalFov}
                    position={[0, 0.75, 0]}
                >
                    {/* Move arms model inside camera to ensure it's attached to camera view */}
                    {playerType === 'merc' && (
                        <group position={[0, -0.5, -0.6]}>
                            {/* Add a debug sphere to help visualize the position */}
                            <mesh position={[0, 0, 0]}>
                                <sphereGeometry args={[0.05, 16, 16]} />
                                <meshStandardMaterial color="red" />
                            </mesh>
                            
                            <primitive 
                                object={gltf.scene} 
                                position={[0, 0, 0]}
                                rotation={[0, Math.PI, 0]}
                                scale={1.2} // Increase scale for better visibility
                            />
                        </group>
                    )}
                </PerspectiveCamera>
            )}
            
            {document.pointerLockElement && !thirdPersonView && (
                <PointerLockControls />
            )}
        </>
    )
})

type KeyControls = {
    forward: boolean
    backward: boolean
    left: boolean
    right: boolean
    sprint: boolean
    jump: boolean
}

const controls = [
    { name: 'forward', keys: ['ArrowUp', 'w', 'W'] },
    { name: 'backward', keys: ['ArrowDown', 's', 'S'] },
    { name: 'left', keys: ['ArrowLeft', 'a', 'A'] },
    { name: 'right', keys: ['ArrowRight', 'd', 'D'] },
    { name: 'jump', keys: ['Space'] },
    { name: 'sprint', keys: ['Shift'] },
]

type PlayerControlsProps = {
    children: React.ReactNode
    thirdPersonView?: boolean
}

export const PlayerControls = ({ children, thirdPersonView = false }: PlayerControlsProps) => {
    // Track whether pointer lock was released due to third-person toggle
    const [pointerLockDisabled, setPointerLockDisabled] = useState(false);
    
    // Effect to handle mode switching
    useEffect(() => {
        if (thirdPersonView) {
            setPointerLockDisabled(true);
            
            // When switching to third-person, release pointer lock
            if (document.pointerLockElement) {
                document.exitPointerLock();
            }
        } else {
            // Add a small delay before re-enabling pointer lock
            // to prevent immediately re-locking when toggling modes
            const timeout = setTimeout(() => {
                setPointerLockDisabled(false);
            }, 500);
            
            return () => clearTimeout(timeout);
        }
    }, [thirdPersonView]);
    
    return (
        <KeyboardControls map={controls}>
            {children}
            {/* Only use pointer lock controls in first-person view */}
            {!thirdPersonView && !pointerLockDisabled && <PointerLockControls makeDefault />}
        </KeyboardControls>
    )
}

// Preload the model to ensure it's cached
useGLTF.preload(FpsArmsModelPath)