import { useThree, useFrame } from '@react-three/fiber';
import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Sounds } from '../assets';

interface FootstepAudioProps {
  playerRef: React.RefObject<any>;
  isWalking: boolean;
  isRunning: boolean;
}

/**
 * FootstepAudio component creates spatial audio for player footsteps
 * It attaches to the player and plays different sounds for walking and running
 */
export const FootstepAudio: React.FC<FootstepAudioProps> = ({ playerRef, isWalking, isRunning }) => {
  // Get camera to attach audio listener
  const { camera } = useThree();
  
  // References for audio objects
  const listenerRef = useRef<THREE.AudioListener | null>(null);
  const walkingSoundRef = useRef<THREE.PositionalAudio | null>(null);
  const runningSoundRef = useRef<THREE.PositionalAudio | null>(null);
  const audioLoaderRef = useRef<THREE.AudioLoader | null>(null);
  
  // Create a ref for the audio group to position it with the player
  const audioGroupRef = useRef<THREE.Group>(null);
  
  // Track when audio is loaded
  const [walkingAudioLoaded, setWalkingAudioLoaded] = useState(false);
  const [runningAudioLoaded, setRunningAudioLoaded] = useState(false);
  
  // Set up audio system on component mount
  useEffect(() => {
    if (!audioGroupRef.current) return;
    
    // Create audio listener if not already present on camera
    let listener: THREE.AudioListener;
    if (!camera.children.some(child => child instanceof THREE.AudioListener)) {
      listener = new THREE.AudioListener();
      camera.add(listener);
    } else {
      // Use existing listener if present
      listener = camera.children.find(child => child instanceof THREE.AudioListener) as THREE.AudioListener;
    }
    
    listenerRef.current = listener;
    
    // Create audio loader
    const audioLoader = new THREE.AudioLoader();
    audioLoaderRef.current = audioLoader;
    
    // Create positional audio for walking and add to audio group
    const walkingSound = new THREE.PositionalAudio(listener);
    audioGroupRef.current.add(walkingSound);
    walkingSoundRef.current = walkingSound;
    
    // Create positional audio for running and add to audio group
    const runningSound = new THREE.PositionalAudio(listener);
    audioGroupRef.current.add(runningSound);
    runningSoundRef.current = runningSound;
    
    // Load walking sound
    audioLoader.load(Sounds.Footsteps.MercWalking, (buffer) => {
      walkingSound.setBuffer(buffer);
      walkingSound.setRefDistance(2); // Reduce reference distance for better spatialization
      walkingSound.setRolloffFactor(2); // Increase rolloff for more dramatic distance effect
      walkingSound.setMaxDistance(30); // Maximum distance at which the sound can be heard
      walkingSound.setLoop(true);
      walkingSound.setVolume(0.3); // Lower volume for better mix
      setWalkingAudioLoaded(true);
      console.log('Walking sound loaded successfully');
    }, 
    undefined, // Progress callback
    (error) => {
      console.error('Error loading walking sound:', error);
    });
    
    // Load running sound
    audioLoader.load(Sounds.Footsteps.MercRunning, (buffer) => {
      runningSound.setBuffer(buffer);
      runningSound.setRefDistance(3); // Reduce reference distance for better spatialization
      runningSound.setRolloffFactor(2); // Increase rolloff for more dramatic distance effect
      runningSound.setMaxDistance(40); // Maximum distance at which the sound can be heard
      runningSound.setLoop(true);
      runningSound.setVolume(0.4); // Lower volume for better mix
      setRunningAudioLoaded(true);
      console.log('Running sound loaded successfully');
    },
    undefined,
    (error) => {
      console.error('Error loading running sound:', error);
    });
    
    // Cleanup on unmount
    return () => {
      if (walkingSoundRef.current) {
        walkingSoundRef.current.stop();
        audioGroupRef.current?.remove(walkingSoundRef.current);
      }
      if (runningSoundRef.current) {
        runningSoundRef.current.stop();
        audioGroupRef.current?.remove(runningSoundRef.current);
      }
      // Only remove the listener if we created it
      if (listener && !camera.userData.persistentListener) {
        camera.remove(listener);
      }
    };
  }, [camera, audioGroupRef.current]);
  
  // Update audio position and play/stop as needed
  useFrame(() => {
    if (!playerRef.current || !playerRef.current.rigidBody || !audioGroupRef.current) return;
    
    // Get player position
    const position = playerRef.current.rigidBody.translation();
    
    // Check if position is valid (not NaN or undefined)
    if (position && !Number.isNaN(position.x) && !Number.isNaN(position.y) && !Number.isNaN(position.z)) {
      // Update audio group position to match player
      audioGroupRef.current.position.set(position.x, position.y, position.z);
      
      // Debug position occasionally
      if (Math.random() < 0.005) {
        console.log('Footstep audio position:', position);
      }
      
      // Play/stop walking sound based on player state
      if (walkingSoundRef.current) {
        if (isWalking && walkingAudioLoaded && !walkingSoundRef.current.isPlaying) {
          walkingSoundRef.current.play();
          console.log('Started playing walking sound');
        } else if (!isWalking && walkingSoundRef.current.isPlaying) {
          walkingSoundRef.current.stop();
          console.log('Stopped playing walking sound');
        }
      }
      
      // Play/stop running sound based on player state
      if (runningSoundRef.current) {
        if (isRunning && runningAudioLoaded && !runningSoundRef.current.isPlaying) {
          runningSoundRef.current.play();
          console.log('Started playing running sound');
        } else if (!isRunning && runningSoundRef.current.isPlaying) {
          runningSoundRef.current.stop();
          console.log('Stopped playing running sound');
        }
      }
    }
  });
  
  // Render an audio group that we'll position with the player
  return <group ref={audioGroupRef} />;
}; 