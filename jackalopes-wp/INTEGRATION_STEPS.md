# Full Game Integration Steps

This document outlines the exact steps needed to integrate the full Jackalopes 3D game into the WordPress plugin, replacing the simplified placeholder version.

## 1. Backup Current Implementation

```bash
# Create backup of the current WordPress plugin implementation
mkdir -p jackalopes-wp/game/backup
cp -r jackalopes-wp/game/src/* jackalopes-wp/game/backup/
```

## 2. Copy Full Game Files

```bash
# Copy the full game codebase from standalone to WordPress plugin
# (Be careful not to overwrite WordPress-specific files)
cp -r /Users/masonlawlor/Sites/games/jackalopes/src/assets jackalopes-wp/game/src/
cp -r /Users/masonlawlor/Sites/games/jackalopes/src/common jackalopes-wp/game/src/
cp -r /Users/masonlawlor/Sites/games/jackalopes/src/components jackalopes-wp/game/src/
cp -r /Users/masonlawlor/Sites/games/jackalopes/src/effects jackalopes-wp/game/src/
cp -r /Users/masonlawlor/Sites/games/jackalopes/src/game jackalopes-wp/game/src/
cp -r /Users/masonlawlor/Sites/games/jackalopes/src/network jackalopes-wp/game/src/
cp -r /Users/masonlawlor/Sites/games/jackalopes/src/types.d.ts jackalopes-wp/game/src/
cp -r /Users/masonlawlor/Sites/games/jackalopes/src/utils jackalopes-wp/game/src/

# Don't overwrite these files as they have WordPress-specific changes:
# - main.tsx (entry point)
# - index.css (styles)
# - types/ directory (type definitions)
# - hooks/useConnection.ts (connection hook)
```

## 3. Copy Static Assets to Public Directory

```bash
# Copy all static assets (models, textures, sounds, etc.)
mkdir -p jackalopes-wp/game/public/assets
cp -r /Users/masonlawlor/Sites/games/jackalopes/public/* jackalopes-wp/game/public/
```

## 4. Create WordPress Adapter for App.tsx

```bash
# Rename the current App.tsx to WordPress-specific name
mv jackalopes-wp/game/src/App.tsx jackalopes-wp/game/src/WordPressApp.tsx

# Copy the full game App.tsx
cp /Users/masonlawlor/Sites/games/jackalopes/src/App.tsx jackalopes-wp/game/src/
```

## 5. Update Main Entry Point

Edit `jackalopes-wp/game/src/main.tsx` to use the full game implementation:

```typescript
// Import the full game App
import App from './App';

// Import the WordPress-specific wrapper
import WordPressApp from './WordPressApp';

// Initialize Jackalopes game function for WordPress
window.initJackalopesGame = (containerId, options) => {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container element with ID "${containerId}" not found`);
    return;
  }

  // Get WordPress settings
  const serverUrl = options?.serverUrl || 'ws://localhost:8082';
  const isFullscreen = options?.fullscreen || false;
  const assetsUrl = options?.assetsUrl || '';

  // Set up game settings for access by components
  window.jackalopesGameSettings = {
    serverUrl,
    isFullscreen,
    assetsUrl,
    containerId,
    isWordPress: true
  };

  // Render the full game App for WordPress
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

// For development environment, render directly
if (import.meta.env.DEV && !window.jackalopesGameSettings) {
  // Mount to #root for dev mode
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
```

## 6. Add WordPress Adapter in App.tsx

Edit the beginning of the full `App.tsx` to integrate with WordPress:

```typescript
// Add import at the top
import { useEffect } from 'react';

// Add near the beginning of App component
export function App() {
  // Get WordPress settings if available
  const wpSettings = typeof window !== 'undefined' ? window.jackalopesGameSettings : null;
  
  // Set up WordPress integration
  useEffect(() => {
    if (wpSettings) {
      console.log('Running in WordPress mode with settings:', wpSettings);
      
      // Apply fullscreen if requested
      if (wpSettings.isFullscreen) {
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
      }
      
      // Apply WordPress-specific cleanup
      return () => {
        if (wpSettings.isFullscreen) {
          document.documentElement.style.overflow = '';
          document.body.style.overflow = '';
        }
      };
    }
  }, []);
  
  // Existing App code continues...
```

## 7. Adapt Asset Loading

Update `jackalopes-wp/game/src/assets/index.ts` to use WordPress asset paths:

```typescript
// Add near the top of assets/index.ts
import { getAssetPath } from '../utils/assetLoader';

// Update paths to use WordPress asset resolution when available
const resolveAssetPath = (path: string): string => {
  if (typeof window !== 'undefined' && window.jackalopesGameSettings?.assetsUrl) {
    return getAssetPath(path);
  }
  return path; // Return regular path for development
};

// Update all asset path definitions to use resolveAssetPath
export const MercModelPath = resolveAssetPath('/assets/characters/merc.glb');
export const JackalopeModelPath = resolveAssetPath('/assets/characters/jackalope.glb');
// ... continue for all other assets
```

## 8. Update Connection Logic

Update `jackalopes-wp/game/src/network/ConnectionManager.ts` to use WordPress server URL:

```typescript
// Add near constructor
constructor(serverUrl?: string) {
  // Use WordPress server URL if available
  const wpSettings = typeof window !== 'undefined' ? window.jackalopesGameSettings : null;
  this.serverUrl = serverUrl || (wpSettings?.serverUrl) || 'ws://localhost:8082';
  
  // Continue with existing code...
}
```

## 9. Testing

1. Test in development mode:
```bash
cd jackalopes-wp/game
npm run dev
```

2. Build for WordPress:
```bash
cd jackalopes-wp/game
npm run build
```

3. Test in WordPress with PHP server:
```bash
cd jackalopes-wp
php -S localhost:8000 serve.php
```

## 10. Troubleshooting

### Asset Loading Issues
- Check browser console for 404 errors
- Verify asset paths (WordPress paths vs. development paths)
- Check MIME type configuration
- Try using absolute URLs for assets

### WebSocket Connection Issues
- Check if jackalopes-server plugin is running
- Verify WebSocket URL in console
- Check for CORS issues

### Rendering Issues
- Check for CSS conflicts with WordPress theme
- Ensure container element has proper dimensions
- Verify THREE.js is initializing correctly 