// Add type declarations for global properties
declare global {
  interface Window {
    __playerShots?: Record<string, () => boolean>;
    __triggerShot?: (id?: string) => string;
  }
}

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
      audio.setRolloffFactor(1.5); // Reduced rolloff for better audibility at distance
      audio.setRefDistance(8); // Can be heard clearly within this distance
      audio.setMaxDistance(70); // Will be barely audible beyond this distance
    };
    
    // Configure all audio objects
    [walkingSound, runningSound].forEach(configureSpatialAudio);
    
    // Special configuration for gunshots - more audible at greater distances
    shotSound.setDistanceModel('exponential');
    shotSound.setRolloffFactor(1.0); // Less rolloff for shots to carry further
    shotSound.setRefDistance(15); // Can be heard clearly from further away
    shotSound.setMaxDistance(150); // Gunshots can be heard from very far
    
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
        shotSound.setVolume(1.0 * audioSettings.masterVolume); // INCREASED weapon volume for better feedback
        setShotAudioLoaded(true);
        
        // Immediately signal system that shot sound is ready
        window.dispatchEvent(new CustomEvent('shotSoundReady', {
          detail: { playerId, timestamp: Date.now() }
        }));
        
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
        console.log(`Shot event for ${event.detail.playerId}, but I am ${playerId} - ignoring`);
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
        
        // Increase volume for better audibility
        shotSoundRef.current.setVolume(1.0 * audioSettings.masterVolume);
        
        // Start playback
        try {
          shotSoundRef.current.play();
          
          // Let the system know we played a shot (for debugging)
          window.dispatchEvent(new CustomEvent('shotSoundPlayed', {
            detail: { playerId, timestamp: Date.now() }
          }));
          
          console.log(`Shot sound playback started for ${playerId}`);
        } catch (e) {
          console.error(`Error playing shot sound for ${playerId}:`, e);
          
          // Try again after a short delay
          setTimeout(() => {
            try {
              console.log(`Retrying shot sound playback for ${playerId}`);
              shotSoundRef.current?.play();
            } catch (retryError) {
              console.error(`Retry failed for shot sound:`, retryError);
            }
          }, 100);
        }
      } else {
        console.warn(`Cannot play shot sound for ${playerId}: loaded=${shotAudioLoaded}, enabled=${audioSettings.remoteSoundsEnabled}`);
      }
    };
    
    // Register event listener
    window.addEventListener('remoteShotFired', handleRemoteShot as EventListener);
    
    // Also handle isShooting prop directly for redundancy
    const checkShootingProp = () => {
      if (isShooting && shotSoundRef.current && shotAudioLoaded && audioSettings.remoteSoundsEnabled) {
        const now = Date.now();
        if (now - shotFiredTimeRef.current > 300) {
          console.log(`Playing shot sound via prop check for ${playerId}`);
          shotFiredTimeRef.current = now;
          
          try {
            // Ensure we're not already playing
            if (shotSoundRef.current.isPlaying) {
              shotSoundRef.current.stop();
            }
            
            // Set high volume and play
            shotSoundRef.current.setVolume(1.0 * audioSettings.masterVolume);
            shotSoundRef.current.play();
          } catch (e) {
            console.error(`Error playing shot via prop:`, e);
          }
        }
      }
    };
    
    // Check prop immediately
    checkShootingProp();
    
    // And set up an interval to check regularly
    const shootingCheckInterval = setInterval(checkShootingProp, 300);
    
    // Log registration
    console.log(`Registered shot event listener for player ${playerId}`);
    
    // Clean up
    return () => {
      window.removeEventListener('remoteShotFired', handleRemoteShot as EventListener);
      clearInterval(shootingCheckInterval);
    };
  }, [playerId, shotAudioLoaded, audioSettings.remoteSoundsEnabled, isShooting, audioSettings.masterVolume]);
  
  // Also listen for direct shot events via window.__shotBroadcast
  useEffect(() => {
    const handleManualShotBroadcast = () => {
      // Add a global helper that other systems can call to simulate shots for this player
      if (!window.__playerShots) {
        window.__playerShots = {};
      }
      
      // Add a function for this player to the global object
      window.__playerShots[playerId] = () => {
        if (shotSoundRef.current && shotAudioLoaded) {
          console.log(`Manual shot trigger for player ${playerId}`);
          
          try {
            // Stop if playing
            if (shotSoundRef.current.isPlaying) {
              shotSoundRef.current.stop();
            }
            
            // Play at full volume
            shotSoundRef.current.setVolume(1.0);
            shotSoundRef.current.play();
            
            return true;
          } catch (e) {
            console.error('Error in manual shot:', e);
            return false;
          }
        }
        return false;
      };
      
      return () => {
        // Clean up global function when unmounting
        if (window.__playerShots && window.__playerShots[playerId]) {
          delete window.__playerShots[playerId];
        }
      };
    };
    
    // Register the helper
    handleManualShotBroadcast();
  }, [playerId, shotAudioLoaded]);

  // Add the global shot handler object as a window property
  useEffect(() => {
    // Create the global helper for manually triggering shots
    if (!window.__triggerShot) {
      // Global function to manually trigger a shot for debugging
      window.__triggerShot = (id?: string) => {
        const targetId = id || playerId;
        
        // Create a custom event
        const event = new CustomEvent('remoteShotFired', {
          detail: {
            playerId: targetId,
            shotId: `manual-${Date.now()}`,
            timestamp: Date.now(),
            position: position instanceof THREE.Vector3
              ? { x: position.x, y: position.y, z: position.z }
              : position
          }
        });
        
        // Dispatch the event
        window.dispatchEvent(event);
        
        // Log the manual trigger
        console.log(`Manually triggered shot for player ${targetId}`);
        
        // Return success
        return `Shot triggered for ${targetId}`;
      };
    }
    
    return () => {
      // Don't remove the global helper, as other components might use it
    };
  }, [playerId, position]);
  
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
    
    // Only log occasionally to reduce spam (reduced frequency)
    if (Math.random() < 0.002) {
      console.log(`Remote player ${playerId} audio state:`, { 
        isWalking, 
        isRunning,
        walkingPlaying: walkingSoundRef.current?.isPlaying || false,
        runningPlaying: runningSoundRef.current?.isPlaying || false
      });
    }
    
    // Handle sound state changes
    const prevState = prevStateRef.current;
    
    // SIMPLIFIED SOUND CONTROL LOGIC FOR CLARITY
    
    // First, determine which sound should be playing
    const shouldPlayWalking = isWalking === true && isRunning !== true;
    const shouldPlayRunning = isRunning === true;
    
    // Log on state changes to help diagnose issues
    if (prevState.isWalking !== isWalking || prevState.isRunning !== isRunning) {
      console.log(`%c🎧 ${playerId} movement state changed:`, 'background: #333; color: #ff0; font-weight: bold', {
        isWalking, 
        isRunning, 
        shouldPlayWalking,
        shouldPlayRunning
      });
    }
    
    // 1. Handle walking sound
    if (walkingSoundRef.current && walkingAudioLoaded) {
      if (shouldPlayWalking) {
        // Should play walking sound
        if (!walkingSoundRef.current.isPlaying) {
          console.log(`%c🚶 ${playerId}: Starting WALKING sound`, 'background: #060; color: white; font-weight: bold');
          try {
            walkingSoundRef.current.play();
          } catch (e) {
            console.error(`Error playing walking sound: ${e}`);
          }
        }
      } else {
        // Should NOT play walking sound
        if (walkingSoundRef.current.isPlaying) {
          console.log(`%c🛑 ${playerId}: Stopping WALKING sound`, 'background: #900; color: white; font-weight: bold');
          walkingSoundRef.current.stop();
        }
      }
    }
    
    // 2. Handle running sound
    if (runningSoundRef.current && runningAudioLoaded) {
      if (shouldPlayRunning) {
        // Should play running sound
        if (!runningSoundRef.current.isPlaying) {
          console.log(`%c🏃 ${playerId}: Starting RUNNING sound`, 'background: #600; color: white; font-weight: bold');
          try {
            runningSoundRef.current.play();
          } catch (e) {
            console.error(`Error playing running sound: ${e}`);
          }
        }
      } else {
        // Should NOT play running sound
        if (runningSoundRef.current.isPlaying) {
          console.log(`%c🛑 ${playerId}: Stopping RUNNING sound`, 'background: #900; color: white; font-weight: bold');
          runningSoundRef.current.stop();
        }
      }
    }
    
    // Handle shooting - check for shooting state from both prop and events
    // We check both direct state change and continuous shooting
    if (isShooting) {
      // Only play if the shot sound is loaded and enough time has passed since last shot
      const now = Date.now();
      if (shotSoundRef.current && shotAudioLoaded && now - shotFiredTimeRef.current > 300) {
        shotFiredTimeRef.current = now;
        
        if (!shotSoundRef.current.isPlaying) {
          console.log(`Playing gunshot for ${playerId}`);
          try {
            shotSoundRef.current.setVolume(1.0 * audioSettings.masterVolume);
            shotSoundRef.current.play();
          } catch (e) {
            console.error(`Error playing shot: ${e}`);
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