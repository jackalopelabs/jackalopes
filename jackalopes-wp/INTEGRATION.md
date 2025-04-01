# Integrating the Existing Jackalopes Game

This guide explains how to transfer the existing Jackalopes ThreeJS game into this WordPress plugin.

## Step 1: Transfer Game Files

Copy the following files/directories from the existing game to the plugin:

```
# Source: Original Jackalopes Game
# Destination: jackalopes-wp/game/src/

src/App.tsx         -> game/src/App.tsx
src/components/     -> game/src/components/
src/hooks/          -> game/src/hooks/
src/utils/          -> game/src/utils/
src/types/          -> game/src/types/
src/assets/         -> game/public/assets/ (static assets)
```

## Step 2: Update Entry Point

Modify the main.tsx file to align with WordPress integration:

1. Keep the existing `window.initJackalopesGame` function
2. Update the App component props to include the proper WordPress settings:

```typescript
<App 
  serverUrl={serverUrl}
  isFullscreen={isFullscreen}
  isWordPress={true}
  assetsUrl={wpSettings.assetsUrl || ''}
/>
```

## Step 3: Update Asset Paths

Update asset loading paths to use WordPress URLs:

```typescript
// Change from
import modelFile from './assets/model.glb';

// To
const getAssetPath = (path: string) => {
  return window.jackalopesGameSettings?.assetsUrl 
    ? window.jackalopesGameSettings.assetsUrl + path
    : './assets/' + path;
};

const modelFile = getAssetPath('model.glb');
```

## Step 4: Update WebSocket Connection Logic

Modify the connection logic to use WordPress-provided server URL:

```typescript
// In your ConnectionManager or similar component:
const serverUrl = props.serverUrl || 
                 window.jackalopesGameSettings?.serverUrl || 
                 'ws://localhost:8082';
```

## Step 5: Add WordPress-Specific Features

Add WordPress-specific features and optimizations:

1. Add fullscreen toggle functionality
2. Add responsive container sizing
3. Add WordPress admin settings integration

## Step 6: Build and Test

Build the game for WordPress:

```bash
cd jackalopes-wp/game
npm install
npm run build
```

Test the WordPress plugin by activating it and using the `[jackalopes]` shortcode.

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