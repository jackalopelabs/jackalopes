# Jackalopes WordPress Plugin

A WordPress plugin that integrates the Jackalopes 3D first-person shooter game into WordPress sites.

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
- Use WASD to move (in full implementation)
- Mouse to look (in full implementation)
- Click to shoot (in full implementation)

## Multiplayer Functionality

For multiplayer functionality, you'll need to install the [Jackalopes Server](https://github.com/yourusername/jackalopes-server) plugin. Once installed:

1. Navigate to Jackalopes Server in the WordPress admin menu
2. Start the WebSocket server
3. The Jackalopes game will automatically connect to the server

## Configuration

1. Navigate to "Jackalopes" in the WordPress admin menu
2. Configure global settings:
   - Default game height
   - WebSocket server URL (if not using the Jackalopes Server plugin)

## Integration with Sage/Trellis/Roots

This plugin is designed to work seamlessly with Sage 11 themes. When using Blade templates, you can embed the game with:

```php
{!! do_shortcode('[jackalopes]') !!}
```

## Troubleshooting

- **Game doesn't appear**: Check if your browser supports WebGL. Try a different browser.
- **Multiplayer not working**: Verify that the WebSocket server is running and accessible.
- **Performance issues**: Adjust game quality settings in the admin interface.
- **Asset loading errors**: Check browser console for 404 errors on game assets.

## License

GPL-2.0-or-later

## Credits

- Built with [React Three Fiber](https://github.com/pmndrs/react-three-fiber)
- Physics by [Rapier](https://github.com/pmndrs/react-three-rapier)
- 3D rendering with [Three.js](https://threejs.org/)
- Development by [Mason Lawlor](https://jackalope.io) 