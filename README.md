# Jackalopes

A 3D first-person shooter game built with React Three Fiber, Rapier physics, and TypeScript.

## Features

- First-person character controller with smooth movement and physics
- Kinematic character controller with automatic stepping and sliding
- Physics-based shooting mechanics with colorful sphere projectiles
- Gamepad support with configurable controls
- 3D environment with physics-based collision
- Post-processing effects for visual enhancements

## Technology Stack

- React & React Three Fiber for 3D rendering
- Rapier physics engine for realistic physics simulation
- Three.js for 3D graphics
- TypeScript for type safety
- Vite for fast development and building

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

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

3. Start the development server
   ```
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

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

## Building for Production

```
npm run build
```

The built files will be in the `dist` directory.

## Physics System

The game uses Rapier's kinematic character controller for player movement with:
- Auto-stepping for navigating small obstacles
- Sliding along walls
- Ground snapping
- Jump mechanics with variable height based on button press duration

## Project Structure

- `src/` - Source code
  - `game/` - Game-specific components
    - `player.tsx` - Player controller and movement
    - `ball.tsx` - Physics-based ball object
    - `sphere-tool.tsx` - Projectile shooting mechanics
    - `platforms.tsx` - Level platforms
  - `common/` - Shared components and hooks
  - `App.tsx` - Main application component

## License

This project is licensed under the MIT License - see the LICENSE file for details.
