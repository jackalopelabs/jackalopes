# Jackalopes

A 3D first-person shooter game built with React Three Fiber, Rapier physics, and TypeScript.

## Features

- First-person character controller with smooth movement and physics
- Kinematic character controller with automatic stepping and sliding
- Physics-based shooting mechanics with colorful sphere projectiles
- Gamepad support with configurable controls
- 3D environment with physics-based collision
- Post-processing effects for visual enhancements
- Multiplayer functionality with real-time shooting across different browsers/devices
- WordPress plugin integration for scalable multiplayer server

## Technology Stack

- React & React Three Fiber for 3D rendering
- Rapier physics engine for realistic physics simulation
- Three.js for 3D graphics
- TypeScript for type safety
- Vite for fast development and building
- WebSockets for multiplayer communication
- WordPress plugin (PHP/Ratchet) for production multiplayer server
- LocalStorage for cross-browser communication during development

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- For multiplayer: Either the test server or a WordPress installation (local or remote)

### Installation

1. Clone the repository
   ```
   git clone https://github.com/yourusername/jackalopes.git
   cd jackalopes
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Choose a multiplayer server option:

   **Option A: Development Test Server**
   ```
   cd jackalopes-server
   node server.js --network
   ```

   **Option B: WordPress Plugin Server (Recommended for Production)**
   - Install the WordPress plugin (see "WordPress Plugin Installation" section below)
   - Start the server from WordPress admin or using the standalone script

4. Start the development server
   ```
   npm run dev
   ```

5. Open your browser at the URL shown in the terminal output. Vite will automatically find an available port, typically starting with `http://localhost:5173/` and incrementing if ports are already in use.

### WordPress Plugin Installation

The multiplayer functionality is powered by a WordPress plugin that can be installed in several ways:

#### Via Composer (Recommended)

1. Add the repository to your WordPress site's `composer.json`:
   ```json
   "repositories": [
       {
           "type": "vcs",
           "url": "https://github.com/yourusername/jackalopes-server"
       }
   ]
   ```

2. Require the package:
   ```bash
   composer require jackalopes/jackalopes-server
   ```

3. Activate the plugin in WordPress admin.

#### Manual Installation

1. Copy the `jackalopes-server` directory to your WordPress plugins directory
2. Run `composer install` within the plugin directory to install dependencies
3. Activate the plugin in WordPress admin

#### Configuration

1. Navigate to "Jackalopes" in the WordPress admin menu
2. Configure the server port, max connections, and other settings
3. Start the server from the dashboard

### Testing Multiplayer Functionality

To test multiplayer features:

1. Open multiple browser windows pointing to the same URL
2. Enable multiplayer in the settings menu in each window
3. Use the test buttons (UNIVERSAL BROADCAST, TEST SHOT) to verify cross-browser communication
4. Shots fired in one window should appear in all connected windows

## Controls

- WASD: Movement
- Space: Jump
- Shift: Sprint
- Mouse: Look around
- Left Mouse Button: Shoot projectiles
- Escape: Release pointer lock

### Gamepad Support

- Left Stick: Movement
- Right Stick: Look around
- A/Cross Button: Jump
- L3/Left Stick Press: Sprint
- R2/Right Trigger: Shoot

## Multiplayer Architecture

The multiplayer system consists of:

1. **Client Components**:
   - ConnectionManager - WebSocket client for server communication
   - MultiplayerManager - React components for multiplayer state management
   - Client-side prediction and reconciliation systems
   - Network state synchronization

2. **Server Components** (WordPress Plugin):
   - WebSocket server built on Ratchet
   - Session management and player authentication
   - Game state persistence with WordPress database
   - REST API endpoints for game/server statistics

3. **Communication Protocol**:
   - JSON-based messaging protocol
   - Support for game snapshots and state synchronization
   - Hybrid localStorage/WebSocket approach for cross-browser testing

## Multiplayer Development Process

The multiplayer functionality was developed through an iterative process that addressed several technical challenges:

### Development Challenges and Solutions

#### Challenge 1: Event Propagation Across Clients
Initially, shooting events from one client weren't being properly received by other clients.

**Solution:**
- Added unique identifiers (shotId) to each shooting event
- Implemented logging throughout the event chain to track message flow
- Enhanced the server's broadcast system to ensure all clients receive events

#### Challenge 2: Duplicate Shot Handling
Shots were sometimes processed multiple times, creating duplicate visual effects.

**Solution:**
- Created a global tracking mechanism using `window.__processedShots` to store already-processed shots
- Implemented shot deduplication based on unique IDs at multiple levels
- Added validation to ensure messages contain all required fields before processing

#### Challenge 3: Cross-Browser Communication
Different browser instances weren't reliably communicating through WebSockets alone.

**Solution:**
- Implemented a hybrid approach using both WebSockets and localStorage
- Created a universal broadcasting system that works across different browsers
- Added multiple test buttons for troubleshooting different communication methods

#### Challenge 4: Synchronization and State Management
Keeping track of remote shots state consistently across clients.

**Solution:**
- Used React's useRef to prevent closure issues in event handlers
- Implemented polling mechanisms to regularly check for updates from other sources
- Added reference tracking to ensure state updates properly reflect the latest data

## Character Models and Animations

The game features two main character types:

### Character Models
- **Merc**: Humanoid soldier character with red color scheme
- **Jackalope**: Rabbit-like character with blue color scheme

Character models are 3D GLB files stored in `src/assets/characters/`:
- `merc.glb` - The humanoid merc character model with embedded animations
- `jackalope.glb` - The jackalope character model with embedded animations

### Animation System

Characters support various animations including:
- `idle` - Default standing pose
- `walk` - Walking animation
- `run` - Running animation
- `jump` - Jumping animation
- `shoot` - Shooting animation

The animation system uses THREE.js AnimationMixer to blend between different animation states. Animation clips are loaded from:
1. Embedded animations within the GLB model files
2. External FBX animation files in `src/assets/characters/animations/` (legacy support)

### Animation Loading Process

The character model components (`MercModel.tsx` and `JackalopeModel.tsx`) handle:
1. Loading the GLB model with GLTFLoader
2. Extracting and cataloging embedded animations
3. Creating an AnimationMixer to play animations
4. Switching animations based on character state (walking, running, etc.)

### Model Fallbacks

To ensure the game always works even if model loading fails:
- Each character has a geometric fallback model created with THREE.js primitives
- The fallback uses the same color scheme as the full model (red for Merc, blue for Jackalope)
- The ModelLoader component preloads models at startup to minimize loading times

## Building for Production

```
npm run build
```