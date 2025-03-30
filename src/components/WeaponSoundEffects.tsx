import { useThree } from '@react-three/fiber';
import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Sounds } from '../assets';

/**
 * WeaponSoundEffects component handles weapon-related sound effects
 */
export const WeaponSoundEffects = () => {
  // Get camera to attach audio listener
  const { camera } = useThree();
  
  // References for audio objects
  const listenerRef = useRef<THREE.AudioListener | null>(null);
  const shotSoundRef = useRef<THREE.Audio | null>(null);
  
  // Track if audio is loaded
  const [shotAudioLoaded, setShotAudioLoaded] = useState(false);
  
  // Set up audio system on component mount
  useEffect(() => {
    console.log('Setting up weapon sound effects system');
    console.log('Merc shot sound file path:', Sounds.Weapons.MercShot);
    
    // Create audio listener if not already present on camera
    let listener: THREE.AudioListener;
    
    // Check for existing global audio listeners to prevent duplicates
    const existingListener = camera.children.find(child => child instanceof THREE.AudioListener);
    
    if (existingListener) {
      console.log('Using existing audio listener for weapon sounds');
      listener = existingListener as THREE.AudioListener;
    } else {
      console.log('Creating new audio listener for weapon sounds');
      listener = new THREE.AudioListener();
      camera.add(listener);
      // Mark this listener as the main audio listener for the app
      camera.userData.mainAudioListener = listener;
    }
    
    listenerRef.current = listener;
    
    // Create audio loader
    const audioLoader = new THREE.AudioLoader();
    
    // Create standard audio for shot sound (non-positional)
    const shotSound = new THREE.Audio(listener);
    shotSoundRef.current = shotSound;
    console.log('Created shot sound object');
    
    // Try to verify file exists before loading
    fetch(Sounds.Weapons.MercShot)
      .then(response => {
        console.log('Shot sound file fetch response:', response.status, response.statusText);
        if (!response.ok) {
          console.warn(`Shot sound file may not exist at path: ${Sounds.Weapons.MercShot}`);
        } else {
          console.log('Shot sound file exists, proceeding with loading');
        }
      })
      .catch(error => {
        console.error('Error checking shot sound file:', error);
      });
    
    // Load shot sound
    console.log('Loading merc shot sound from:', Sounds.Weapons.MercShot);
    audioLoader.load(Sounds.Weapons.MercShot, 
      (buffer) => {
        console.log('Merc shot sound buffer loaded successfully, size:', buffer.duration);
        shotSound.setBuffer(buffer);
        shotSound.setVolume(0.5); // Set a reasonable volume
        setShotAudioLoaded(true);
        console.log('Merc shot sound configured successfully');
        
        // Test play the sound once when loaded to ensure it works
        setTimeout(() => {
          console.log('Testing shot sound...');
          if (shotSound.buffer) {
            if (shotSound.isPlaying) {
              shotSound.stop();
            }
            shotSound.play();
            console.log('Shot sound test played');
          } else {
            console.warn('Shot sound buffer not available for test play');
          }
        }, 1000);
      }, 
      (progress) => {
        console.log('Merc shot sound loading progress:', Math.round(progress.loaded / progress.total * 100) + '%');
      },
      (error) => {
        console.error('Error loading merc shot sound:', error);
        // Try alternative loading approach
        console.log('Trying alternative loading method for merc shot sound');
        tryAlternativeAudioLoading(
          Sounds.Weapons.MercShot,
          (buffer) => {
            shotSound.setBuffer(buffer);
            shotSound.setVolume(0.5);
            setShotAudioLoaded(true);
            console.log('Merc shot sound loaded with alternative method');
          },
          (altError) => {
            console.error('Alternative merc shot sound loading also failed:', altError);
          }
        );
      }
    );
    
    // Alternative loading approach for browsers that might struggle with OGG files
    const tryAlternativeAudioLoading = (url: string, onSuccess: (buffer: AudioBuffer) => void, onError: (error: any) => void) => {
      console.log(`Trying alternative loading for ${url}`);
      
      fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
          }
          return response.arrayBuffer();
        })
        .then(arrayBuffer => {
          // Create AudioContext and decode the buffer
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          return audioContext.decodeAudioData(arrayBuffer);
        })
        .then(audioBuffer => {
          onSuccess(audioBuffer);
        })
        .catch(error => {
          console.error(`Alternative loading failed for ${url}:`, error);
          onError(error);
        });
    };
    
    // Handle shot events
    const playShot = () => {
      console.log('playShot function called', { loaded: shotAudioLoaded, shotSound: !!shotSoundRef.current });
      if (shotSoundRef.current && shotAudioLoaded) {
        if (shotSoundRef.current.isPlaying) {
          // If already playing, stop and reset to play again immediately
          console.log('Shot sound already playing, stopping first');
          shotSoundRef.current.stop();
        }
        shotSoundRef.current.play();
        console.log('Playing shot sound effect');
      } else {
        console.warn('Shot sound not loaded yet or not available', { 
          soundRef: !!shotSoundRef.current, 
          audioLoaded: shotAudioLoaded 
        });
      }
    };
    
    // Listen for mouse down events (when the player shoots)
    const handleShot = (event: MouseEvent) => {
      // Only trigger on left mouse button and if pointer is locked (player is actively controlling)
      if (event.button === 0 && document.pointerLockElement) {
        console.log('Mouse down event detected, playing shot sound');
        playShot();
      }
    };
    
    // Create a custom event to test if event handling works
    const testShotEvent = new CustomEvent('shotFired');
    const testShot = () => {
      console.log('Testing shot event dispatch...');
      window.dispatchEvent(testShotEvent);
    };
    
    // Test shot after 2 seconds
    setTimeout(testShot, 2000);
    
    // Listen to both window mousedown and our custom shotFired event
    window.addEventListener('pointerdown', handleShot);
    window.addEventListener('shotFired', () => {
      console.log('shotFired event received');
      playShot();
    });
    
    // Set up a global reference so other parts of the code can trigger the shot sound
    window.__playMercShot = () => {
      console.log('__playMercShot global function called');
      playShot();
    };
    
    // Cleanup on unmount
    return () => {
      if (shotSoundRef.current) {
        shotSoundRef.current.stop();
      }
      window.removeEventListener('pointerdown', handleShot);
      window.removeEventListener('shotFired', playShot);
      window.__playMercShot = undefined;
      
      // Only remove the listener if we created it
      if (listener && !camera.userData.persistentListener) {
        camera.remove(listener);
      }
    };
  }, [camera]);
  
  // This component doesn't render anything
  return null;
};

// Add TypeScript declaration for window.__playMercShot
declare global {
  interface Window {
    __playMercShot?: () => void;
  }
} 