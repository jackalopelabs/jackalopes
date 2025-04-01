# Jackalopes WordPress Plugin

A WordPress plugin that integrates the Jackalopes 3D first-person shooter game into any WordPress site using a simple shortcode.

## Features

- Easy integration into any WordPress site using a shortcode
- Seamless integration with the jackalopes-server for multiplayer functionality
- Responsive design that works on mobile and desktop
- Configuration options through shortcode attributes
- Performance optimizations for WordPress environments

## Installation

### Method 1: Build from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/jackalopes.git
   cd jackalopes/jackalopes-wp
   ```

2. Install dependencies:
   ```bash
   cd game
   npm install
   cd ..
   ```

3. Build and deploy:
   ```bash
   # Option 1: Build only
   ./build.sh
   
   # Option 2: Build and copy to WordPress plugins directory
   ./build.sh /path/to/wordpress/wp-content/plugins/jackalopes-wp
   ```

4. Activate the plugin in your WordPress admin panel.

5. Add the shortcode to any page or post:
   ```
   [jackalopes]
   ```

### Method 2: Manual Installation

1. Download the latest release zip file.
2. In your WordPress admin, go to Plugins > Add New > Upload Plugin.
3. Upload the zip file and activate the plugin.
4. Add the shortcode `[jackalopes]` to any page or post.

## Usage

### Basic Usage

Simply add the shortcode to any page or post:

```
[jackalopes]
```

### Advanced Usage

The shortcode accepts optional attributes to customize the game:

```
[jackalopes width="800px" height="600px" fullscreen="true" server="ws://your-server.com/websocket/"]
```

#### Available Attributes

| Attribute | Description | Default |
|-----------|-------------|---------|
| width | Width of the game container | 100% |
| height | Height of the game container | 600px |
| fullscreen | Enable fullscreen mode | false |
| server | WebSocket server URL | Auto-detected |

## Troubleshooting

### Missing Asset Files

If you encounter 404 errors for assets (like models, textures, etc.), you need to ensure all assets are correctly copied to the plugin directory:

1. Run the asset fixer script:
   ```bash
   ./fix-assets.sh
   ```

2. Make sure the original game's public directory structure is accessible to copy assets from:
   ```
   ../public/
   ```

### WebSocket Connection Issues

If you're having issues with the multiplayer functionality:

1. Ensure the jackalopes-server plugin is installed and activated.
2. Verify the WebSocket server is running.
3. Check for any firewall or proxy configuration that might block WebSocket connections.

## Development

### Local Testing

You can test the plugin locally using the included development server:

```bash
cd jackalopes-wp
php -S localhost:8000 serve.php
```

Then open your browser to http://localhost:8000

### Building for Development

During development, you can use the Vite development server for faster iteration:

```bash
cd game
npm run dev
```

## Integration with Trellis/Sage/Bedrock

For integration with a Roots stack (Trellis/Sage/Bedrock):

1. Add the plugin to your Bedrock composer.json:
   ```json
   "repositories": [
     {
       "type": "vcs",
       "url": "https://github.com/yourusername/jackalopes"
     }
   ],
   "require": {
     "yourusername/jackalopes-wp": "dev-main"
   }
   ```

2. Deploy using Trellis:
   ```bash
   trellis deploy production
   ```

## License

GPL-2.0-or-later

## Current Implementation Status

- ✅ WordPress Plugin Framework (Complete)
- ✅ Game Shortcode System (Complete)
- ✅ Asset Loading System (Complete)
- ✅ WebSocket Integration (Complete)
- ✅ Basic ThreeJS Game Implementation (Complete)
- ⚠️ Full Game Implementation (In Progress)
- ⚠️ Asset Transfer (Pending)

## Description

Jackalopes is a 3D first-person shooter game built with React Three Fiber, Rapier physics, and TypeScript. This WordPress plugin allows you to easily embed the game in any WordPress post or page using a simple shortcode.

## Features

- Embed the Jackalopes game in any post or page using `[jackalopes]` shortcode
- Multiplayer functionality when used with the [Jackalopes Server](https://github.com/yourusername/jackalopes-server) plugin
- Admin interface for configuring game settings
- Responsive design that works on different screen sizes
- Compatible with Roots/Sage/Trellis/Lima/Tailwind/Acorn LEMP stacks

## Requirements

- WordPress 6.0 or higher
- PHP 8.1 or higher
- Modern browser with WebGL support

## Installation

### Via Composer (Recommended)

1. Add the repository to your `composer.json` file:

```json
"repositories": [
    {
        "type": "vcs",
        "url": "https://github.com/yourusername/jackalopes-wp"
    }
]
```

2. Require the package:

```bash
composer require jackalopelabs/jackalopes-wp
```

3. Activate the plugin in WordPress admin.

### Manual Installation

1. Download the plugin zip file.
2. Upload to your WordPress plugins directory.
3. Activate the plugin in WordPress admin.

## Usage

Use the shortcode `[jackalopes]` to embed the game in any post or page:

```
[jackalopes]
```

### Shortcode Attributes

You can customize the game display with these attributes:

```
[jackalopes width="800px" height="500px" fullscreen="true"]
```

- `width`: Set the width of the game container (default: 100%)
- `height`: Set the height of the game container (default: 600px)
- `fullscreen`: Enable fullscreen mode (default: false)
- `server`: Specify a custom WebSocket server URL (optional)

## Testing and Development

### Local Testing Without WordPress

For quick testing without a WordPress environment:

1. Build the game:
   ```bash
   cd game
   npm install
   npm run build
   ```

2. Start the test server:
   ```bash
   php -S localhost:8000 serve.php
   ```

3. Open your browser and navigate to `http://localhost:8000`

### Game Development

1. Make changes to the game source in `game/src/`
2. For development mode with hot reloading:
   ```bash
   cd game
   npm run dev
   ```
3. For WordPress testing, build the game:
   ```bash
   npm run build
   ```

### Game Controls

- Press `F3` to toggle FPS and debug stats
- Press `C` to switch between first-person and third-person views
- Use WASD to move (when fully implemented)
- Mouse to look (when fully implemented)
- Click to shoot (when fully implemented)

### Console Debugging

The following debug functions are available in the browser console:

```javascript
// Set debug level (0-3)
window.__setDebugLevel(2);

// Set graphics quality
window.__setGraphicsQuality('high'); // 'auto', 'high', 'medium', 'low'

// Toggle network logs
window.__toggleNetworkLogs(true);
```

## Plugin Architecture

```
jackalopes-wp/
├── admin/                  # Admin UI components
├── includes/               # WordPress integration
│   ├── shortcodes.php      # Shortcode registration
│   └── assets.php          # Asset loading
├── src/                    # PHP Classes
│   ├── Plugin.php          # Main plugin class
│   └── Game.php            # Game integration class
├── game/                   # The React/ThreeJS app
│   ├── src/                # Game source files
│   │   ├── App.tsx         # Main game component
│   │   ├── components/     # Game components
│   │   ├── hooks/          # React hooks
│   │   ├── types/          # Type definitions
│   │   └── utils/          # Utility functions
│   ├── public/             # Static assets
│   └── dist/               # Built game files
└── vendor/                 # Composer dependencies
```

## Multiplayer Functionality

For multiplayer functionality, you'll need to install the [Jackalopes Server](https://github.com/yourusername/jackalopes-server) plugin. Once installed:

1. Navigate to Jackalopes Server in the WordPress admin menu
2. Start the WebSocket server
3. The Jackalopes game will automatically connect to the server

### Setting Up Multiplayer for Testing

1. Start the server:
   ```bash
   cd jackalopes-server
   node server.js
   ```

2. Open multiple browser tabs to test multiplayer
3. Each tab will be assigned a different player type (jackalope/merc)

## Implementation Notes

This plugin uses a modern architecture with:

- React and ThreeJS for the game engine
- WebSockets for real-time multiplayer
- Composer for PHP dependency management
- Vite for frontend builds

The game is implemented as a standalone React application that is integrated into WordPress via a shortcode system and asset loading utilities.

## Credits

- Built with [React Three Fiber](https://github.com/pmndrs/react-three-fiber)
- Physics by [Rapier](https://github.com/pmndrs/react-three-rapier)
- 3D rendering with [Three.js](https://threejs.org/)
- Development by [Mason Lawlor](https://jackalope.io)

## Asset Handling

The plugin includes an automated asset handling system that addresses potential issues with 3D models and textures during the build process:

### Automatic Asset Copying

After each build, the `copy-assets.sh` script runs automatically to:

1. Copy 3D models, textures, and other assets from source to distribution
2. Look for assets in multiple locations (plugin src, original game src, original game public)
3. Create placeholder files for any missing assets to prevent 404 errors
4. Set up fallback paths for specific problematic assets

### Manual Asset Fixing

If you encounter missing assets in your WordPress deployment, you can run the asset fixer script manually:

```bash
cd /path/to/jackalopes
./jackalopes-wp/copy-assets.sh
```

### Asset Troubleshooting

If you see 404 errors for specific assets in the browser console:

1. First check that the asset exists in `jackalopes-wp/game/src/assets/`
2. If not, copy it from the original game's `public/` or `src/assets/` directory
3. Run the copy-assets.sh script manually
4. Rebuild the plugin with `npm run build --prefix jackalopes-wp/game`

The script creates placeholder files for missing assets to prevent JavaScript errors, but for optimal game experience, you should provide the actual model files. 