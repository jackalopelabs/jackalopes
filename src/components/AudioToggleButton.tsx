import React, { useState, useEffect } from 'react';
import { WeaponSoundSettings } from './WeaponSoundEffects';

interface AudioToggleButtonProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  initialState?: boolean;
  showRemoteToggle?: boolean;
}

/**
 * AudioToggleButton - A floating button to toggle audio mute/unmute
 * 
 * This component provides a simple UI to quickly mute/unmute all sounds
 * and optionally toggle remote player sounds separately
 */
export const AudioToggleButton: React.FC<AudioToggleButtonProps> = ({
  position = 'bottom-right',
  initialState = true,
  showRemoteToggle = true
}) => {
  // State for master audio (all sounds)
  const [audioEnabled, setAudioEnabled] = useState(initialState);
  // State for remote player sounds only
  const [remoteSoundsEnabled, setRemoteSoundsEnabled] = useState(initialState);
  
  // Load saved preferences on mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('audioSettings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        // If we have saved settings, use those instead of initialState
        if (settings.muteAll !== undefined) {
          setAudioEnabled(!settings.muteAll);
          // Also update WeaponSoundSettings directly
          WeaponSoundSettings.setMuted(settings.muteAll);
        }
        if (settings.remoteSoundsEnabled !== undefined) {
          setRemoteSoundsEnabled(settings.remoteSoundsEnabled);
        }
      }
    } catch (error) {
      console.error('Error loading audio preferences:', error);
    }
  }, []);
  
  // Position styles based on the position prop
  const getPositionStyle = () => {
    switch (position) {
      case 'top-left':
        return { top: '20px', left: '20px' };
      case 'top-right':
        return { top: '20px', right: '20px' };
      case 'bottom-left':
        return { bottom: '20px', left: '20px' };
      case 'bottom-right':
      default:
        return { bottom: '20px', right: '20px' };
    }
  };
  
  // Toggle master audio
  const toggleAudio = () => {
    const newState = !audioEnabled;
    setAudioEnabled(newState);
    
    // Always update localStorage
    try {
      const savedSettings = localStorage.getItem('audioSettings');
      const settings = savedSettings ? JSON.parse(savedSettings) : {};
      
      // Update with new state
      settings.muteAll = !newState;
      localStorage.setItem('audioSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving audio preferences:', error);
    }
    
    // Update WeaponSoundSettings directly
    WeaponSoundSettings.setMuted(!newState);
    
    // Dispatch event that AudioController listens for
    window.dispatchEvent(new CustomEvent('audioSettingsChanged', {
      detail: {
        masterVolume: newState ? 1.0 : 0.0,
        footstepsEnabled: true,
        walkingVolume: 0.3,
        runningVolume: 0.4,
        spatialAudioEnabled: true,
        remoteSoundsEnabled
      }
    }));
  };
  
  // Toggle remote sounds only
  const toggleRemoteSounds = () => {
    const newState = !remoteSoundsEnabled;
    setRemoteSoundsEnabled(newState);
    
    // Update localStorage
    try {
      const savedSettings = localStorage.getItem('audioSettings');
      const settings = savedSettings ? JSON.parse(savedSettings) : {};
      
      // Update with new state
      settings.remoteSoundsEnabled = newState;
      localStorage.setItem('audioSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving audio preferences:', error);
    }
    
    // Dispatch specific event for remote sounds
    window.dispatchEvent(new CustomEvent('remoteSoundsToggled', {
      detail: {
        enabled: newState && audioEnabled // Only enable if master audio is also enabled
      }
    }));
  };
  
  return (
    <div style={{
      position: 'fixed',
      ...getPositionStyle(),
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      zIndex: 1000
    }}>
      {/* Master audio toggle button */}
      <button 
        onClick={toggleAudio}
        style={{
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          backgroundColor: audioEnabled ? 'rgba(0, 150, 0, 0.7)' : 'rgba(150, 0, 0, 0.7)',
          border: 'none',
          color: 'white',
          fontSize: '24px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
        }}
        title={audioEnabled ? 'Mute All Sound' : 'Unmute Sound'}
      >
        {audioEnabled ? '🔊' : '🔇'}
      </button>
      
      {/* Remote audio toggle button (optional) */}
      {showRemoteToggle && (
        <button 
          onClick={toggleRemoteSounds}
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            backgroundColor: remoteSoundsEnabled && audioEnabled 
              ? 'rgba(0, 100, 150, 0.7)' 
              : 'rgba(100, 0, 150, 0.7)',
            border: 'none',
            color: 'white',
            fontSize: '20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
            opacity: audioEnabled ? 1 : 0.5 // Dim when master audio is off
          }}
          title={remoteSoundsEnabled ? 'Mute Remote Player Sounds' : 'Unmute Remote Player Sounds'}
          disabled={!audioEnabled} // Disable when master audio is off
        >
          {remoteSoundsEnabled ? '👥🔊' : '👥🔇'}
        </button>
      )}
    </div>
  );
}; 