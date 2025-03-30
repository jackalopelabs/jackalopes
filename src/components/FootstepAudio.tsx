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
  
  // Track when audio is loaded
  const [walkingAudioLoaded, setWalkingAudioLoaded] = useState(false);
  const [runningAudioLoaded, setRunningAudioLoaded] = useState(false);
  
  // Set up audio system on component mount
  useEffect(() => {
    // Create audio listener
    const listener = new THREE.AudioListener();
    camera.add(listener);
    listenerRef.current = listener;
    
    // Create audio loader
    const audioLoader = new THREE.AudioLoader();
    audioLoaderRef.current = audioLoader;
    
    // Create positional audio for walking
    const walkingSound = new THREE.PositionalAudio(listener);
    walkingSoundRef.current = walkingSound;
    
    // Create positional audio for running
    const runningSound = new THREE.PositionalAudio(listener);
    runningSoundRef.current = runningSound;
    
    // Load walking sound
    audioLoader.load(Sounds.Footsteps.MercWalking, (buffer) => {
      walkingSound.setBuffer(buffer);
      walkingSound.setRefDistance(5); // Distance at which volume begins to drop
      walkingSound.setRolloffFactor(1); // How quickly sound fades with distance
      walkingSound.setLoop(true);
      walkingSound.setVolume(0.5);
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
      runningSound.setRefDistance(8); // Slightly farther distance for running sound
      runningSound.setRolloffFactor(1);
      runningSound.setLoop(true);
      runningSound.setVolume(0.7); // Slightly louder
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
      }
      if (runningSoundRef.current) {
        runningSoundRef.current.stop();
      }
      camera.remove(listener);
    };
  }, [camera]);
  
  // Update audio position and play/stop as needed
  useFrame(() => {
    if (!playerRef.current || !playerRef.current.rigidBody) return;
    
    // Get player position
    const position = playerRef.current.rigidBody.translation();
    
    // Update position of audio sources
    if (walkingSoundRef.current) {
      walkingSoundRef.current.position.set(position.x, position.y, position.z);
      
      // Play/stop walking sound based on player state
      if (isWalking && walkingAudioLoaded && !walkingSoundRef.current.isPlaying) {
        walkingSoundRef.current.play();
      } else if (!isWalking && walkingSoundRef.current.isPlaying) {
        walkingSoundRef.current.stop();
      }
    }
    
    if (runningSoundRef.current) {
      runningSoundRef.current.position.set(position.x, position.y, position.z);
      
      // Play/stop running sound based on player state
      if (isRunning && runningAudioLoaded && !runningSoundRef.current.isPlaying) {
        runningSoundRef.current.play();
      } else if (!isRunning && runningSoundRef.current.isPlaying) {
        runningSoundRef.current.stop();
      }
    }
  });
  
  // This component doesn't render anything
  return null;
}; 