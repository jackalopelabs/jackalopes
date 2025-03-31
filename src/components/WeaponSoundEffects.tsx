import { useThree } from '@react-three/fiber';
import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Sounds } from '../assets';

// Add a global volume control for weapon sounds
// This can be adjusted from anywhere in the app
export const WeaponSoundSettings = {
  volume: 0.1, // Default volume (quieter than before)
  setVolume: (value: number) => {
    // Ensure volume is between 0 and 1
    WeaponSoundSettings.volume = Math.min(1, Math.max(0, value));
    console.log(`Weapon sound volume set to: ${WeaponSoundSettings.volume}`);
  }
};

/**
 * WeaponSoundEffects component handles weapon-related sound effects
 */
export const WeaponSoundEffects = () => {
  // Get camera to attach audio listener
  const { camera } = useThree();
  
  // Track if audio is loaded
  const [shotAudioLoaded, setShotAudioLoaded] = useState(false);
  
  // Web Audio API context and buffer
  const audioContextRef = useRef<AudioContext | null>(null);
  const shotBufferRef = useRef<AudioBuffer | null>(null);
  
  // Set up audio system on component mount
  useEffect(() => {
    console.log('Setting up weapon sound effects system with Web Audio API');
    console.log('Merc shot sound file path:', Sounds.Weapons.MercShot.path);
    
    // Fallback using HTML5 Audio for browsers with Web Audio API issues
    const createAudioElementFallback = () => {
      console.log('Creating HTML5 Audio fallback');
      
      // Create a pool of HTML5 Audio elements for rapid firing
      const audioPool: HTMLAudioElement[] = [];
      const POOL_SIZE = 8;
      
      for (let i = 0; i < POOL_SIZE; i++) {
        const audio = new Audio(Sounds.Weapons.MercShot.path);
        audio.volume = WeaponSoundSettings.volume; // Use global volume setting
        audio.preload = 'auto';
        audioPool.push(audio);
      }
      
      // Load the first audio to check if it works
      audioPool[0].addEventListener('canplaythrough', () => {
        console.log('HTML5 Audio fallback loaded successfully');
        setShotAudioLoaded(true);
        
        // Test play
        setTimeout(() => {
          console.log('Testing HTML5 Audio fallback...');
          const testAudio = new Audio(Sounds.Weapons.MercShot.path);
          testAudio.volume = WeaponSoundSettings.volume * 0.5; // Half of current volume for test
          testAudio.play();
        }, 1000);
      });
      
      audioPool[0].addEventListener('error', (e) => {
        console.error('HTML5 Audio fallback loading error:', e);
      });
      
      // Define the playback function
      window.__playMercShot = () => {
        console.log('Playing shot with HTML5 Audio fallback');
        // Find a non-playing audio element
        let audio = audioPool.find(a => a.paused);
        
        // If all are playing, create a new one
        if (!audio) {
          audio = new Audio(Sounds.Weapons.MercShot.path);
          audio.volume = WeaponSoundSettings.volume; // Use global volume setting
        }
        
        // Play the sound
        audio.currentTime = 0;
        audio.play().catch(e => console.error('Error playing HTML5 Audio:', e));
      };
    };
    
    // Create Audio Context
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) {
      console.error('Web Audio API not supported in this browser');
      // Create audio fallback using HTML5 Audio
      createAudioElementFallback();
      return;
    }
    
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    
    // Load the sound file
    fetch(Sounds.Weapons.MercShot.path)
      .then(response => {
        console.log('Shot sound file fetch response:', response.status, response.statusText);
        if (!response.ok) {
          throw new Error(`Failed to fetch sound: ${response.status} ${response.statusText}`);
        }
        return response.arrayBuffer();
      })
      .then(arrayBuffer => {
        console.log('Decoding audio data, size:', arrayBuffer.byteLength);
        return audioContext.decodeAudioData(arrayBuffer);
      })
      .then(audioBuffer => {
        console.log('Audio data decoded successfully, duration:', audioBuffer.duration);
        shotBufferRef.current = audioBuffer;
        setShotAudioLoaded(true);
        
        // Test play once
        setTimeout(() => {
          console.log('Testing shot sound...');
          playShotSound(WeaponSoundSettings.volume * 0.5); // Half of current volume for test
        }, 1000);
      })
      .catch(error => {
        console.error('Error loading shot sound:', error);
        // Try fallback method
        createAudioElementFallback();
      });
    
    // Function to play the shot sound using Web Audio API
    const playShotSound = (volume = WeaponSoundSettings.volume) => { // Use global volume setting
      if (!audioContextRef.current || !shotBufferRef.current) {
        console.warn('Audio context or buffer not ready');
        return;
      }
      
      try {
        // Resume context if it's suspended (browser autoplay policy)
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }
        
        // Create a new source for each play (required for Web Audio API)
        const source = audioContextRef.current.createBufferSource();
        source.buffer = shotBufferRef.current;
        
        // Create a gain node to control volume
        const gainNode = audioContextRef.current.createGain();
        gainNode.gain.value = volume;
        
        // Connect the nodes: source -> gain -> destination
        source.connect(gainNode);
        gainNode.connect(audioContextRef.current.destination);
        
        // Start playing
        source.start(0);
        console.log(`Shot sound played with Web Audio API (volume: ${volume})`);
        
        // Clean up when done
        source.onended = () => {
          source.disconnect();
          gainNode.disconnect();
          console.log('Shot sound playback completed');
        };
      } catch (e) {
        console.error('Error playing shot sound with Web Audio API:', e);
      }
    };
    
    // Listen for mouse down events (when the player shoots)
    const handleShot = (event: MouseEvent) => {
      // Less restrictive check to ensure the sound plays in more scenarios
      if (event.button === 0) {
        console.log(`Mouse ${event.type} event detected, playing shot sound`);
        playShotSound();
      }
    };
    
    // Create a custom event to test if event handling works
    const testShotEvent = new CustomEvent('shotFired');
    const testShot = () => {
      console.log('Testing shot event dispatch...');
      window.dispatchEvent(testShotEvent);
    };
    
    // Create a named function for the shotFired event to allow proper cleanup
    const handleShotFired = () => {
      console.log('shotFired event received');
      playShotSound();
    };
    
    // Test shot after 2 seconds
    setTimeout(testShot, 2000);
    
    // Listen on both window and document to catch all possible events
    // Add multiple event types to catch all ways of firing
    window.addEventListener('mousedown', handleShot);
    document.addEventListener('mousedown', handleShot);
    window.addEventListener('pointerdown', handleShot);
    document.addEventListener('pointerdown', handleShot);
    window.addEventListener('shotFired', handleShotFired);
    
    // Universal method to play the shot sound
    window.__playMercShot = () => {
      console.log('Global __playMercShot called directly');
      playShotSound();
    };
    
    // Add a method to adjust volume at runtime
    window.__setWeaponVolume = (volume: number) => {
      WeaponSoundSettings.setVolume(volume);
      console.log(`Weapon volume set to ${WeaponSoundSettings.volume}`);
    };
    
    // Cleanup on unmount
    return () => {
      // Remove all event listeners
      window.removeEventListener('mousedown', handleShot);
      document.removeEventListener('mousedown', handleShot);
      window.removeEventListener('pointerdown', handleShot);
      document.removeEventListener('pointerdown', handleShot);
      window.removeEventListener('shotFired', handleShotFired);
      window.__playMercShot = undefined;
      window.__setWeaponVolume = undefined;
      
      // Close audio context
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [camera]);
  
  // This component doesn't render anything
  return null;
};

// Add TypeScript declaration for window.__playMercShot and __setWeaponVolume
declare global {
  interface Window {
    __playMercShot?: () => void;
    __setWeaponVolume?: (volume: number) => void;
  }
} 