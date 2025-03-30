import { useEffect, useState } from 'react';
import { useControls, folder } from 'leva';

/**
 * AudioController component allows for controlling and debugging audio settings
 * This component doesn't render anything visible but provides UI controls
 * for adjusting audio parameters
 */
export const AudioController = () => {
  const [audioInitialized, setAudioInitialized] = useState(false);
  
  // Set up Leva controls for audio settings
  const { 
    masterVolume,
    footstepsEnabled,
    walkingVolume, 
    runningVolume,
    spatialAudioEnabled
  } = useControls('Audio Settings', {
    masterVolume: {
      value: 1.0, 
      min: 0, 
      max: 1,
      step: 0.05,
    },
    footstepsEnabled: {
      value: true,
      label: 'Footsteps Enabled'
    },
    spatialAudioEnabled: {
      value: true,
      label: 'Spatial Audio'
    },
    footsteps: folder({
      walkingVolume: {
        value: 0.3, 
        min: 0, 
        max: 1,
        step: 0.05,
        label: 'Walking Volume'
      },
      runningVolume: {
        value: 0.4, 
        min: 0, 
        max: 1,
        step: 0.05,
        label: 'Running Volume'
      }
    }, { collapsed: false })
  });
  
  // When settings change, broadcast them as custom events
  useEffect(() => {
    if (!audioInitialized) {
      setAudioInitialized(true);
      return;
    }
    
    // Dispatch event with the current audio settings
    window.dispatchEvent(new CustomEvent('audioSettingsChanged', {
      detail: {
        masterVolume,
        footstepsEnabled,
        walkingVolume,
        runningVolume,
        spatialAudioEnabled
      }
    }));
    
    console.log('Audio settings updated:', {
      masterVolume,
      footstepsEnabled,
      walkingVolume,
      runningVolume,
      spatialAudioEnabled
    });
  }, [masterVolume, footstepsEnabled, walkingVolume, runningVolume, spatialAudioEnabled, audioInitialized]);
  
  // This component doesn't render anything visible
  return null;
}; 