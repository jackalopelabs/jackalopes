import { useThree, useFrame } from '@react-three/fiber';
import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Sounds } from '../assets';

interface RemotePlayerAudioProps {
  playerId: string;
  position: THREE.Vector3 | { x: number, y: number, z: number };
  isWalking?: boolean;
  isRunning?: boolean;
  isShooting?: boolean;
}

// Audio settings interface - same as in FootstepAudio for consistency
interface AudioSettings {
  masterVolume: number;
  footstepsEnabled: boolean;
  walkingVolume: number;
  runningVolume: number;
  spatialAudioEnabled: boolean;
  remoteSoundsEnabled?: boolean; // New setting for muting just remote players
}

/**
 * RemotePlayerAudio component creates spatial audio for other players
 * 
 * This attaches different sounds to remote players and positions them in 3D space
 * so they can be heard relative to the listener (local player).
 */
export const RemotePlayerAudio: React.FC<RemotePlayerAudioProps> = ({ 
  playerId, 
  position, 
  isWalking = false, 
  isRunning = false,
  isShooting = false 
}) => {
  // Get camera to use its audio listener
  const { camera } = useThree();
  
  // References for audio objects
  const audioGroupRef = useRef<THREE.Group>(null);
  const walkingSoundRef = useRef<THREE.PositionalAudio | null>(null);
  const runningSoundRef = useRef<THREE.PositionalAudio | null>(null);
  const shotSoundRef = useRef<THREE.PositionalAudio | null>(null);
  
  // Track when audio is loaded
  const [walkingAudioLoaded, setWalkingAudioLoaded] = useState(false);
  const [runningAudioLoaded, setRunningAudioLoaded] = useState(false);
  const [shotAudioLoaded, setShotAudioLoaded] = useState(false);
  
  // Track audio settings
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    masterVolume: 1.0,
    footstepsEnabled: true,
    walkingVolume: 0.3,
    runningVolume: 0.4,
    spatialAudioEnabled: true,
    remoteSoundsEnabled: true
  });

  // Store the current movement state to detect changes
  const prevStateRef = useRef({ isWalking, isRunning, isShooting });
  
  // Track when a shot was fired to play it once
  const shotFiredTimeRef = useRef(0);
  
  // Listen for audio settings changes
  useEffect(() => {
    const handleAudioSettingsChanged = (event: CustomEvent<AudioSettings>) => {
      setAudioSettings({
        ...event.detail,
        // Preserve remoteSoundsEnabled if not included in the event
        remoteSoundsEnabled: event.detail.remoteSoundsEnabled !== undefined
          ? event.detail.remoteSoundsEnabled
          : audioSettings.remoteSoundsEnabled
      });
      
      // Apply volume settings immediately
      if (walkingSoundRef.current) {
        walkingSoundRef.current.setVolume(event.detail.walkingVolume * event.detail.masterVolume * 0.7); // Slightly quieter than local sounds
      }
      
      if (runningSoundRef.current) {
        runningSoundRef.current.setVolume(event.detail.runningVolume * event.detail.masterVolume * 0.7);
      }
      
      if (shotSoundRef.current) {
        // Weapon sounds should be louder but still use master volume
        shotSoundRef.current.setVolume(0.3 * event.detail.masterVolume);
      }
    };
    
    // Register event listener
    window.addEventListener('audioSettingsChanged', handleAudioSettingsChanged as EventListener);
    
    // Listen for remote player audio mute toggle
    const handleRemoteSoundsToggle = (event: CustomEvent<{enabled: boolean}>) => {
      setAudioSettings(prev => ({
        ...prev,
        remoteSoundsEnabled: event.detail.enabled
      }));
      
      // Stop all sounds immediately if disabled
      if (!event.detail.enabled) {
        if (walkingSoundRef.current?.isPlaying) walkingSoundRef.current.stop();
        if (runningSoundRef.current?.isPlaying) runningSoundRef.current.stop();
        if (shotSoundRef.current?.isPlaying) shotSoundRef.current.stop();
      }
    };
    
    window.addEventListener('remoteSoundsToggled', handleRemoteSoundsToggle as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('audioSettingsChanged', handleAudioSettingsChanged as EventListener);
      window.removeEventListener('remoteSoundsToggled', handleRemoteSoundsToggle as EventListener);
    };
  }, []);
  
  // Set up audio system on component mount
  useEffect(() => {
    if (!audioGroupRef.current) return;
    
    console.log(`Setting up remote player audio system for player: ${playerId}`);
    
    // Find existing audio listener on camera
    const listener = camera.children.find(child => child instanceof THREE.AudioListener) as THREE.AudioListener;
    
    if (!listener) {
      console.error('No audio listener found on camera for remote player audio');
      return;
    }
    
    // Create audio loader
    const audioLoader = new THREE.AudioLoader();
    
    // Create positional audio for walking
    const walkingSound = new THREE.PositionalAudio(listener);
    audioGroupRef.current.add(walkingSound);
    walkingSoundRef.current = walkingSound;
    
    // Create positional audio for running
    const runningSound = new THREE.PositionalAudio(listener);
    audioGroupRef.current.add(runningSound);
    runningSoundRef.current = runningSound;
    
    // Create positional audio for weapon shots
    const shotSound = new THREE.PositionalAudio(listener);
    audioGroupRef.current.add(shotSound);
    shotSoundRef.current = shotSound;
    
    // Configure spatial audio for better distance effects
    const configureSpatialAudio = (audio: THREE.PositionalAudio) => {
      audio.setDistanceModel('exponential');
      audio.setRolloffFactor(1.8); // Slightly reduced rolloff for better audibility
      audio.setRefDistance(7); // Can be heard clearly within this distance
      audio.setMaxDistance(60); // Will be barely audible beyond this distance
    };
    
    // Configure all audio objects
    [walkingSound, runningSound, shotSound].forEach(configureSpatialAudio);
    
    // Load walking sound
    console.log(`Loading walking sound for remote player ${playerId}`);
    audioLoader.load(Sounds.Footsteps.MercWalking.path, 
      (buffer) => {
        console.log(`Walking sound loaded successfully for player ${playerId}`);
        walkingSound.setBuffer(buffer);
        walkingSound.setLoop(true);
        walkingSound.setVolume(audioSettings.walkingVolume * audioSettings.masterVolume * 0.9); // Increase volume for walking
        setWalkingAudioLoaded(true);
        
        // Test play walking sound once to make sure it's loaded
        setTimeout(() => {
          try {
            const testVolume = walkingSound.getVolume();
            walkingSound.setVolume(0.1); // Low volume for test
            walkingSound.play();
            setTimeout(() => {
              walkingSound.stop();
              walkingSound.setVolume(testVolume);
            }, 300);
          } catch (error) {
            console.error(`Error testing walking sound: ${error}`);
          }
        }, 1500);
      },
      undefined,
      (error) => console.error(`Error loading remote player walking sound: ${error}`)
    );
    
    // Load running sound
    console.log(`Loading running sound for remote player ${playerId}`);
    audioLoader.load(Sounds.Footsteps.MercRunning.path,
      (buffer) => {
        console.log(`Running sound loaded successfully for player ${playerId}`);
        runningSound.setBuffer(buffer);
        runningSound.setLoop(true);
        runningSound.setVolume(audioSettings.runningVolume * audioSettings.masterVolume * 0.8);
        setRunningAudioLoaded(true);
      },
      undefined,
      (error) => console.error(`Error loading remote player running sound: ${error}`)
    );
    
    // Load shot sound with priority - we need this to work properly
    console.log(`Loading shot sound for remote player ${playerId}`);
    audioLoader.load(Sounds.Weapons.MercShot.path,
      (buffer) => {
        console.log(`Shot sound loaded successfully for player ${playerId}, duration:`, buffer.duration);
        shotSound.setBuffer(buffer);
        shotSound.setLoop(false); // Shot sound should only play once
        shotSound.setVolume(0.6 * audioSettings.masterVolume); // INCREASED weapon volume for better feedback
        
        // Configure shot sound specifically - more audible
        shotSound.setRefDistance(15); // Can be heard clearly from further away
        shotSound.setRolloffFactor(1.2); // Less dramatic rolloff for gunshots
        shotSound.setMaxDistance(120); // Gunshots can be heard from very far
        
        setShotAudioLoaded(true);
        
        // Test play the shot sound once to ensure it's working
        setTimeout(() => {
          try {
            console.log(`Testing shot sound for player ${playerId}`);
            const testVolume = shotSound.getVolume();
            shotSound.setVolume(0.1); // Low volume for test
            shotSound.play();
            // Restore original volume after test
            setTimeout(() => {
              shotSound.setVolume(testVolume);
            }, 200);
          } catch (error) {
            console.error(`Error testing shot sound: ${error}`);
          }
        }, 2000);
      },
      (progress) => {
        if (progress.loaded === progress.total) {
          console.log(`Shot sound loading complete for player ${playerId}`);
        }
      },
      (error) => console.error(`Error loading remote player shot sound: ${error}`)
    );
    
    // Cleanup on unmount
    return () => {
      if (walkingSoundRef.current) {
        walkingSoundRef.current.stop();
      }
      if (runningSoundRef.current) {
        runningSoundRef.current.stop();
      }
      if (shotSoundRef.current) {
        shotSoundRef.current.stop();
      }
    };
  }, [camera, playerId]);
  
  // Add handler for shot events
  useEffect(() => {
    const handleRemoteShot = (event: CustomEvent<{playerId: string, position: {x: number, y: number, z: number}}>) => {
      // Log all shot events to debug
      console.log(`Shot event received for player ${event.detail.playerId}, my player: ${playerId}`);
      
      // Only play shot sound if it's for this player
      if (event.detail.playerId !== playerId) {
        return;
      }
      
      console.log(`Processing shot for my player ${playerId}`);
      
      // Update shot fired time
      shotFiredTimeRef.current = Date.now();
      
      // Play the shot sound
      if (shotSoundRef.current && shotAudioLoaded && audioSettings.remoteSoundsEnabled) {
        console.log(`Playing shot sound for remote player ${playerId}`);
        
        // Ensure shot sound is correctly initialized
        if (shotSoundRef.current.source) {
          // If there's already a sound playing, stop it
          try {
            shotSoundRef.current.stop();
          } catch (e) {
            // Ignore errors when stopping
          }
        }
        
        // Start playback
        try {
          shotSoundRef.current.play();
        } catch (e) {
          console.error(`Error playing shot sound for ${playerId}:`, e);
        }
      } else {
        console.warn(`Cannot play shot sound for ${playerId}: loaded=${shotAudioLoaded}, enabled=${audioSettings.remoteSoundsEnabled}`);
      }
    };
    
    // Register event listener
    window.addEventListener('remoteShotFired', handleRemoteShot as EventListener);
    
    // Log registration
    console.log(`Registered shot event listener for player ${playerId}`);
    
    // Clean up
    return () => {
      window.removeEventListener('remoteShotFired', handleRemoteShot as EventListener);
    };
  }, [playerId, shotAudioLoaded, audioSettings.remoteSoundsEnabled]);
  
  // Update audio position and play/stop as needed
  useFrame(() => {
    if (!audioGroupRef.current) return;
    
    // Skip processing if remote sounds are disabled
    if (!audioSettings.remoteSoundsEnabled || !audioSettings.footstepsEnabled) {
      // Make sure all sounds are stopped
      if (walkingSoundRef.current?.isPlaying) walkingSoundRef.current.stop();
      if (runningSoundRef.current?.isPlaying) runningSoundRef.current.stop();
      return;
    }
    
    // Convert position to Vector3 if it's not already
    const pos = position instanceof THREE.Vector3 
      ? position 
      : new THREE.Vector3(position.x, position.y, position.z);
    
    // Update audio group position to match remote player
    audioGroupRef.current.position.copy(pos);
    
    // Log once in a while
    if (Math.random() < 0.005) {
      console.log(`Remote player ${playerId} audio position:`, pos);
      console.log('Remote player state:', { isWalking, isRunning, isShooting });
      
      if (walkingSoundRef.current) {
        console.log(`Walking sound playing: ${walkingSoundRef.current.isPlaying}, loaded: ${walkingAudioLoaded}`);
      }
      if (runningSoundRef.current) {
        console.log(`Running sound playing: ${runningSoundRef.current.isPlaying}, loaded: ${runningAudioLoaded}`);
      }
    }
    
    // Handle sound state changes
    const prevState = prevStateRef.current;
    
    // Handle walking sound - ONLY play walking when isWalking is true AND isRunning is false
    if (walkingSoundRef.current && walkingAudioLoaded) {
      if (isWalking && !isRunning) {
        // Start walking sound if it's not playing
        if (!walkingSoundRef.current.isPlaying) {
          console.log(`Starting walking sound for remote player ${playerId}`);
          try {
            walkingSoundRef.current.play();
          } catch (e) {
            console.error(`Error playing walking sound: ${e}`);
            // Try to reinitialize the sound
            if (walkingSoundRef.current.source === null || walkingSoundRef.current.source === undefined) {
              console.log('Walking sound source is null, trying to reinitialize');
              walkingSoundRef.current.setVolume(audioSettings.walkingVolume * audioSettings.masterVolume * 0.9);
              walkingSoundRef.current.play();
            }
          }
        }
      } else if (walkingSoundRef.current.isPlaying) {
        // Stop walking sound if not walking or if running
        walkingSoundRef.current.stop();
      }
    }
    
    // Handle running sound - ONLY play running when isRunning is true
    if (runningSoundRef.current && runningAudioLoaded) {
      if (isRunning) {
        // Start running sound if it's not playing
        if (!runningSoundRef.current.isPlaying) {
          console.log(`Starting running sound for remote player ${playerId}`);
          try {
            runningSoundRef.current.play();
          } catch (e) {
            console.error(`Error playing running sound: ${e}`);
            // Try to reinitialize the sound
            if (runningSoundRef.current.source === null || runningSoundRef.current.source === undefined) {
              console.log('Running sound source is null, trying to reinitialize');
              runningSoundRef.current.setVolume(audioSettings.runningVolume * audioSettings.masterVolume * 0.8);
              runningSoundRef.current.play();
            }
          }
        }
      } else if (runningSoundRef.current.isPlaying) {
        // Stop running sound when not running
        runningSoundRef.current.stop();
      }
    }
    
    // Handle shooting - check if the shooting state has changed to true OR if isShooting is true (direct prop)
    // This way we can handle both event-based and prop-based shooting triggers
    if ((isShooting && !prevState.isShooting) || isShooting) {
      // Only play if the shot sound is loaded and enough time has passed since last shot
      const now = Date.now();
      if (shotSoundRef.current && shotAudioLoaded && now - shotFiredTimeRef.current > 300) {
        console.log(`Playing gunshot for remote player ${playerId} based on isShooting prop`);
        shotFiredTimeRef.current = now;
        
        // Make sure we're not already playing
        if (shotSoundRef.current.isPlaying) {
          try {
            shotSoundRef.current.stop();
          } catch (e) {
            // Ignore stop errors
          }
        }
        
        try {
          shotSoundRef.current.play();
        } catch (e) {
          console.error(`Error playing shot from prop: ${e}`);
          // Try to reinitialize
          if (shotSoundRef.current.source === null || shotSoundRef.current.source === undefined) {
            console.log('Shot sound source is null, trying to reinitialize');
            shotSoundRef.current.setVolume(0.6 * audioSettings.masterVolume);
            shotSoundRef.current.play();
          }
        }
      }
    }
    
    // Update previous state reference
    prevStateRef.current = { isWalking, isRunning, isShooting };
  });
  
  // Render an audio group that we'll position with the remote player
  return <group ref={audioGroupRef} />;
}; 