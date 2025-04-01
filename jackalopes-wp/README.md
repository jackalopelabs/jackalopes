# Jackalopes WordPress Plugin

A WordPress plugin that integrates the Jackalopes 3D first-person shooter game into WordPress sites.

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

## Troubleshooting

- **Game doesn't appear**: Check if your browser supports WebGL. Try a different browser.
- **Multiplayer not working**: Verify that the WebSocket server is running and accessible.
- **Performance issues**: Use the console commands to lower graphics quality.
- **Asset loading errors**: Check browser console for 404 errors on game assets.

## Implementation Notes

This plugin uses a modern architecture with:

- React and ThreeJS for the game engine
- WebSockets for real-time multiplayer
- Composer for PHP dependency management
- Vite for frontend builds

The game is implemented as a standalone React application that is integrated into WordPress via a shortcode system and asset loading utilities.

## License

GPL-2.0-or-later

## Credits

- Built with [React Three Fiber](https://github.com/pmndrs/react-three-fiber)
- Physics by [Rapier](https://github.com/pmndrs/react-three-rapier)
- 3D rendering with [Three.js](https://threejs.org/)
- Development by [Mason Lawlor](https://jackalope.io) 