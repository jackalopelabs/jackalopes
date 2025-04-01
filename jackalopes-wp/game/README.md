# Jackalopes Game for WordPress

This directory contains the React/Three.js game that is embedded in WordPress via the Jackalopes plugin.

## Development

### Prerequisites

- Node.js 16 or higher
- npm or yarn

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Structure

- `src/` - Source code for the game
  - `App.tsx` - Main game component
  - `main.tsx` - Entry point and WordPress integration
  - `index.css` - Styles
- `dist/` - Built game files (generated)
- `vite.config.js` - Vite configuration

## WordPress Integration

The game is integrated with WordPress through the `main.tsx` file, which exports a global initialization function:

```typescript
window.initJackalopesGame = (containerId, options) => {
  // Initialize the game in the specified container
};
```

This function is called by the WordPress plugin when the shortcode is rendered.

## Environment Detection

The game detects whether it's running in WordPress or standalone mode:

```typescript
// Check if running in WordPress
const isWordPress = !!window.jackalopesGameSettings;

// Use WordPress settings if available
const serverUrl = options.server || 
                  window.jackalopesGameSettings?.serverUrl || 
                  'ws://localhost:8082';
```

## Asset Loading

When running in WordPress, assets are loaded using the URL provided by WordPress:

```typescript
// In WordPress mode
const assetUrl = window.jackalopesGameSettings?.assetsUrl + 'model.glb';

// In development mode
const assetUrl = './assets/model.glb';
```

## Building for WordPress

To build the game for WordPress:

```bash
npm run build
```

This will create optimized files in the `dist/` directory. The WordPress plugin will automatically load these files when the shortcode is used. 