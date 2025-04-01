# Integrating the Existing Jackalopes Game

This guide explains how to transfer the existing Jackalopes ThreeJS game into this WordPress plugin.

## Current Progress

### Completed Steps
- ✅ Created utilities for WordPress integration (`assetLoader.ts`)
- ✅ Implemented WebSocket connection manager (`connectionManager.ts`)
- ✅ Added React hooks for connections (`useConnection.ts`)
- ✅ Created shared type definitions
- ✅ Updated entry point for WordPress compatibility
- ✅ Implemented cross-browser communication
- ✅ Added global debug helpers

### Next Steps
- [ ] Transfer full game components
- [ ] Implement complete gameplay mechanics
- [ ] Copy assets to the public directory

## Step 1: Transfer Game Files

Copy the following files/directories from the existing game to the plugin:

```
# Source: Original Jackalopes Game
# Destination: jackalopes-wp/game/src/

src/App.tsx         -> game/src/App.tsx (already adapted)
src/components/     -> game/src/components/ (basic components already created)
src/hooks/          -> game/src/hooks/ (integration hooks created)
src/utils/          -> game/src/utils/ (connection utilities created)
src/types/          -> game/src/types/ (type definitions created)
src/assets/         -> game/public/assets/ (static assets)
```

## Step 2: Asset Setup

Ensure the following asset structure is set up:

```
game/public/assets/
├── models/          # 3D models (GLB/GLTF files)
├── textures/        # Texture images
├── sounds/          # Audio files
├── images/          # UI and other images
```

## Step 3: Update Entry Point

The main.tsx file has been updated to:
1. Provide WordPress integration via `window.initJackalopesGame`
2. Set up global debug helpers
3. Handle both WordPress and standalone development modes
4. Support cross-browser session management

## Step 4: Update WebSocket Connection Logic

The connection manager has been created to:
1. Use the WordPress-provided server URL
2. Implement proper connection events
3. Handle authentication and session joining
4. Provide shot and respawn events

## Step 5: Add WordPress-Specific Features

WordPress integration features implemented:
1. Fullscreen toggle functionality
2. Asset path resolution for WordPress
3. Server URL configuration
4. Debug level control

## Step 6: Testing

To test the WordPress plugin:

### 1. Local Testing
```bash
# Start the PHP server
php -S localhost:8000 serve.php

# Open in browser
open http://localhost:8000
```

### 2. Building for WordPress
```bash
cd jackalopes-wp/game
npm run build
```

### 3. WordPress Installation
1. Place the plugin in WordPress plugins directory
2. Activate via WordPress admin
3. Add shortcode to a page: `[jackalopes]`

## Troubleshooting

### Asset Loading Issues

If assets don't load correctly:

1. Check the browser console for 404 errors
2. Verify asset paths in the built JavaScript
3. Make sure WordPress is serving the correct MIME types
4. Try using absolute URLs for assets

### WebSocket Connection Issues

If multiplayer doesn't work:

1. Check if jackalopes-server plugin is active and running
2. Verify WebSocket URL in the browser console
3. Check for CORS issues
4. Ensure proper firewall settings 