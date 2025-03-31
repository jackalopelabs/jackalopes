# Spatial Audio Implementation Plan

This document outlines the steps to implement spatial audio so players can hear each other's actions in 3D space.

## To-Do List

- [x] Fix Safari audio compatibility by adding MP3 alternatives for OGG files
- [x] Create remote player audio component to handle sounds from other players
- [x] Add audio mute controls to UI for testing with multiple browsers
- [x] Implement audio position sync via the network system
- [x] Add event system to trigger remote player sounds (footsteps, shots, etc.)
- [x] Fix gunshot sounds to respect audio mute settings
- [x] Fix remote player footsteps to correctly distinguish between walking/running
- [x] Fix remote player gunshots not being heard
- [x] Enhance sound propagation with improved volume and distance settings
- [x] Add debugging tools for audio events
- [x] Fix issue where walking played both walking AND running sounds
- [x] Fix persisting sound after player stops moving
- [x] Fix walking sounds being incorrectly overridden by running sounds 
- [x] Fix gun sounds not playing consistently across browsers
- [x] Fix movement speed detection to properly distinguish walking and running
- [x] Fix running sound playing when player is walking
- [x] Significantly increase movement speed threshold for running (8.0 units/sec)
- [x] Added colored console logs for easier debugging of sound states 
- [x] Fix remote players flashing between merc and jackalope character types when moving
- [x] Fix rotation flipping in remote jackalopes (models briefly turning backwards every few seconds)
- [x] Reduce jackalope footstep volume by 75% to balance sound levels
- [ ] Add audio occlusion/obstruction for more realistic spatial audio
- [ ] Optimize audio performance with culling based on distance

## Detailed Implementation Steps

### 1. Create RemotePlayerAudio Component ✅
- [x] Create a new component for remote player audio handling
- [x] Add support for different audio types (footsteps, weapon sounds)
- [x] Implement 3D spatial positioning

### 2. Implement Audio Mute Controls ✅
- [x] Add mute button to main UI
- [x] Create global audio settings with mute option
- [x] Save mute preference to localStorage
- [x] Add individual volume controls for different sound categories
- [x] Fix weapon sounds to respect mute settings

### 3. Network System Integration ✅
- [x] Extend existing network events to include audio triggers
- [x] Send position data along with audio events
- [x] Add timestamp for proper synchronization
- [x] Improve remote player state detection (walking vs running)
- [x] Add unique IDs for shot events to prevent duplicates
- [x] Add cross-browser shot event support via localStorage
- [x] Add redundant shot detection methods for reliability
- [x] Fix movement speed detection for better walking vs running classification
- [x] Double the running speed threshold to 8.0 units/second
- [ ] Implement latency compensation

### 4. Audio Event System ✅
- [x] Create event emitter/listener for audio events
- [x] Add distinct event types for different sounds
- [x] Implement throttling to prevent audio spam
- [x] Fix gun shot events to properly trigger audio
- [x] Improve error handling for audio playback
- [x] Add fallback mechanisms for audio that fails to play
- [x] Add retry mechanism for critical audio events
- [x] Add manual shot trigger helpers for debugging
- [ ] Add distance-based culling to save resources

### 5. Testing and Optimization
- [x] Test with Safari browser compatibility
- [x] Test audio mute controls for all sound types
- [x] Test cross-browser audio (Chrome → Safari, vice versa)
- [x] Fix walking sounds not playing with proper state detection
- [x] Fix gunshot sounds not playing reliably
- [x] Fix walking playing both walking and running sounds
- [x] Add global debug functions for manual audio testing
- [x] Fix persistence of running sounds after player stops moving
- [x] Add strict state validation to ensure sound states match movement
- [x] Add colored console logs to help identify sound state issues
- [ ] Test with multiple browsers simultaneously
- [ ] Measure performance impact
- [ ] Optimize buffer usage and audio loading
- [ ] Add audio pooling for frequently used sounds

### 6. Recent Fixes (2023-07-07)
- [x] Fixed running sounds playing incorrectly during walking
- [x] Fixed walking sounds not playing at all for remote players
- [x] Fixed gunshot sounds not being heard from other players
- [x] Increased sound volumes for better audibility at distance
- [x] Added better debugging tools for tracking audio events
- [x] Improved error handling for audio playback failures
- [x] Added test playback of sounds during initialization to ensure loading
- [x] Ensured only one movement sound plays at a time (running OR walking, not both)
- [x] Added cross-browser shot event propagation via localStorage
- [x] Added auto-retry mechanism for remote shot events
- [x] Increased gunshot volume for better audibility
- [x] Added dual-mechanism detection for gunshots (events + prop checking)
- [x] Added global debugging helpers for manually triggering shot sounds
- [x] Fixed multiple redundant state issues in RemotePlayer component
- [x] Completely rewrote movement state detection logic with stricter conditions
- [x] Fixed running sound playing during walking with rigid state management
- [x] Increased movement speed threshold to better distinguish walking/running
- [x] Added explicit boolean checks to prevent ambiguous state conditions
- [x] Doubled the running speed threshold from 4.0 to 8.0 units/second
- [x] Added colored console logs for easier debugging of sound states 