# Jackalopes WordPress Plugin Development Plan

## Project Directive

Convert the existing Jackalopes ThreeJS game into a WordPress plugin that can be easily integrated into a Roots/Sage 11/Trellis/Lima/Tailwind4/Acorn5 LEMP stack. The plugin should:

- Maintain all existing game functionality and structure
- Be deployable via a simple `[jackalopes]` shortcode
- Be Composer-ready for modern WordPress development
- Work seamlessly with the existing jackalopes-server multiplayer plugin
- Be optimized for deployment on a DigitalOcean Ubuntu 22 droplet

## Implementation Status

### Completed

✅ **Plugin Structure**
- Created Jackalopes-WP directory structure
- Set up main plugin file with WordPress headers and activation hooks
- Created composer.json for dependency management
- Set up autoloading with PSR-4 structure

✅ **WordPress Integration**
- Created shortcode registration system for `[jackalopes]`
- Implemented asset loading mechanism for game files
- Set up admin interface with settings page
- Added REST API endpoints for game data
- Implemented integrations with jackalopes-server plugin

✅ **Game Framework**
- Created Vite/React/TypeScript configuration for game
- Set up build process optimized for WordPress
- Created responsive game container
- Added environment detection (WordPress vs standalone)
- Implemented WebSocket connection handling

✅ **Game Integration**
- Created the WebSocket connection manager
- Implemented asset loading system for WordPress
- Added cross-browser communication
- Implemented player management
- Created basic game components with physics

✅ **Testing Environment**
- Created standalone testing server (serve.php)
- Implemented test HTML page
- Added debugging helpers and console tools
- Successfully built and tested the basic game

### In Progress

⚠️ **Full Game Implementation**
- [ ] Transfer complete game mechanics from original project
- [ ] Set up asset directories for models and textures
- [ ] Implement complete player controls
- [ ] Add sound effects and background music

⚠️ **Deployment & Documentation**
- [ ] Create installation documentation for WP environment
- [ ] Test in Roots/Sage/Trellis environment
- [ ] Create release package
- [ ] Optimize for WordPress performance

### Framework and File Structure

```
jackalopes-wp/
├── admin/                  # Admin UI components
│   ├── admin.php           # Admin page registration
│   ├── css/                # Admin CSS files
│   └── js/                 # Admin JavaScript files
├── includes/               # WordPress integration
│   ├── shortcodes.php      # Shortcode registration
│   └── assets.php          # Asset loading
├── src/                    # PSR-4 autoloaded classes
│   ├── Plugin.php          # Main plugin class
│   └── Game.php            # Game wrapper class
├── game/                   # The React/ThreeJS application
│   ├── src/                # Game source files
│   │   ├── App.tsx         # Main game component
│   │   ├── components/     # Game components
│   │   ├── hooks/          # React hooks
│   │   ├── types/          # Type definitions
│   │   └── utils/          # Utility functions
│   ├── dist/               # Built game files
│   ├── public/             # Static assets
│   ├── package.json        # NPM dependencies
│   └── vite.config.js      # Vite configuration
├── vendor/                 # Composer dependencies (generated)
├── composer.json           # Composer configuration
├── jackalopes-wp.php       # Main plugin file
├── README.md               # Plugin documentation
├── INTEGRATION.md          # Integration guide
├── test.html               # Test file for non-WordPress testing
├── serve.php               # Local test server
└── uninstall.php           # Cleanup on uninstall
```

## Current Implementation

The WordPress plugin framework is fully functional and includes:

1. **WordPress Shortcode System**:
   - The `[jackalopes]` shortcode is implemented and can be customized with attributes
   - Asset loading is properly handled within WordPress
   - Integration with the jackalopes-server plugin is seamless

2. **Basic ThreeJS Game**:
   - 3D scene with physics using Rapier
   - Player entity with basic movement
   - Environment rendering with lighting
   - Camera controls (first and third person)
   - Debug tools and statistics
   
3. **Multiplayer Framework**:
   - WebSocket connection manager
   - Cross-browser communication
   - Player synchronization system
   - Event broadcasting
   - Server integration

4. **WordPress Integration**:
   - Asset path handling for WordPress environment
   - Server URL configuration
   - Debug tools and console commands
   - Responsive container with fullscreen support

## Testing the Implementation

You can test the current implementation using the following steps:

1. Build the game:
   ```bash
   cd jackalopes-wp/game
   npm install
   npm run build
   ```

2. Start the test server:
   ```bash
   cd ..
   php -S localhost:8000 serve.php
   ```

3. Open your browser to http://localhost:8000

For multiplayer testing, the jackalopes-server needs to be running:
   ```bash
   cd jackalopes-server
   node server.js
   ```

## Next Steps

To complete the implementation, follow the steps in INTEGRATION.md to:

1. Transfer the complete game mechanics from the original Jackalopes project
2. Copy assets to the public directory
3. Implement complete gameplay features
4. Test in a WordPress environment with Roots/Sage/Trellis/Lima/Tailwind/Acorn

## Conclusion

The WordPress plugin framework is ready and a basic version of the game is functioning within this framework. The core integration work is complete, with proper handling of assets, WebSocket connections, and WordPress environments.

The remaining work is primarily transferring the full game mechanics and assets from the original project, following the integration guide in INTEGRATION.md.
