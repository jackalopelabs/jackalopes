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

✅ **Game Implementation**
- Created basic ThreeJS game with physics (Rapier)
- Implemented environment, player, and ground components
- Set up proper asset loading
- Added debug tools and performance monitoring
- Ensured responsiveness and fullscreen capabilities

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
│   │   ├── main.tsx        # Entry point
│   │   ├── components/     # Game components
│   │   └── index.css       # Styles
│   ├── dist/               # Built game files
│   ├── public/             # Static assets
│   ├── package.json        # NPM dependencies
│   └── vite.config.js      # Vite configuration
├── vendor/                 # Composer dependencies (generated)
├── composer.json           # Composer configuration
├── jackalopes-wp.php       # Main plugin file
├── README.md               # Plugin documentation
├── test.html               # Test file for non-WordPress testing
└── uninstall.php           # Cleanup on uninstall
```

## Next Steps

### 1. Complete Game Code Transfer
The next step is to transfer the complete game code from the existing Jackalopes project:

- Copy the remaining game components and features
- Implement full game mechanics
- Ensure all assets are properly loaded
- Test gameplay in WordPress environment

### 2. Testing & Deployment
Before finalizing, thorough testing is needed:

- Test the plugin on a WordPress site with the shortcode
- Test multiplayer functionality with the jackalopes-server plugin
- Verify compatibility with Roots/Sage/Trellis/Lima/Tailwind/Acorn
- Optimize performance for different devices
- Package for distribution

## Current Implementation Details

### Basic Game Components
We've implemented a basic version of the game with the following components:

1. **Physics-Based Environment**
   - Rapier physics for realistic interactions
   - Ground plane with collision detection
   - Directional lighting and environment setup

2. **Player Entity**
   - Basic player object with physics
   - Animation system ready for extension

3. **WordPress Integration**
   - Environment detection (WordPress vs standalone)
   - Asset path management for WordPress context
   - Server URL configuration

4. **UI Components**
   - Connection status indicator
   - Debug tools (toggle with F3)
   - WordPress mode indicator
   - Loading screen

### Testing the Implementation

A test HTML file has been created (`test.html`) that simulates how the WordPress plugin will function. This allows for testing without needing a full WordPress environment.

To test:
1. Run a local web server in the plugin directory
2. Open `test.html` in a browser
3. The game should load with physics and basic functionality
4. Test the fullscreen and debug toggles

### Building the Game

The game can be built using:

```bash
cd jackalopes-wp/game
npm install
npm run build
```

This will create the necessary files in the `dist` directory that will be loaded by WordPress when the shortcode is used.

## Conclusion

We have successfully created the WordPress plugin framework and a basic implementation of the Jackalopes ThreeJS game. The next step is to integrate the complete game code from the existing project into this framework.

The plugin is structured following modern WordPress development practices and provides all the necessary hooks for integration with the Roots/Sage/Trellis/Lima/Tailwind/Acorn stack.

To complete the implementation, follow the steps in INTEGRATION.md to transfer the full game code from the existing project.
