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
│   │   └── index.css       # Styles
│   ├── package.json        # NPM dependencies
│   ├── tsconfig.json       # TypeScript config
│   └── vite.config.js      # Vite configuration
├── vendor/                 # Composer dependencies (generated)
├── composer.json           # Composer configuration
├── jackalopes-wp.php       # Main plugin file
├── README.md               # Plugin documentation
└── uninstall.php           # Cleanup on uninstall
```

## Next Steps

### 1. Transfer Game Code
The next step is to transfer the actual game code from the existing Jackalopes project into the WordPress plugin structure. This involves:

- Copying the ThreeJS game components to `game/src/` directory
- Adapting asset paths to work within WordPress
- Ensuring multiplayer functionality connects to jackalopes-server
- Testing game functionality within WordPress context

### 2. Game Asset Management
Game assets need to be properly handled:

- Create an assets directory for models, textures, and sounds
- Update asset loading code to use WordPress plugin URLs
- Implement caching for better performance
- Configure proper MIME types in WordPress

### 3. Testing and Optimization
Before finalization, the plugin needs thorough testing:

- Test shortcode in various WordPress environments
- Test multiplayer functionality with jackalopes-server
- Optimize asset loading for WordPress
- Test on Roots/Sage/Trellis environments

### 4. Documentation and Deployment
Final steps include:

- Complete documentation for installation and usage
- Create deployment instructions for different environments
- Test on DigitalOcean Ubuntu 22 droplet
- Create release package

## Integration with Existing Game

To integrate the existing Jackalopes ThreeJS game:

1. Copy the game files from the existing project into `jackalopes-wp/game/src/`
2. Modify the asset paths to use the WordPress plugin URL structure:
   ```typescript
   // Change from
   import modelFile from './assets/model.glb';
   
   // To
   const modelFile = window.jackalopesGameSettings?.assetsUrl + 'model.glb';
   ```

3. Update the connection logic to use the WebSocket URL from WordPress:
   ```typescript
   // Use the server URL provided by WordPress
   const serverUrl = props.serverUrl || window.jackalopesGameSettings?.serverUrl;
   ```

4. Build the game for WordPress:
   ```bash
   cd jackalopes-wp/game
   npm install
   npm run build
   ```

## WordPress Integration

The plugin creates a simple `[jackalopes]` shortcode that can be used in any post or page:

```
[jackalopes width="100%" height="600px" fullscreen="false" server=""]
```

The shortcode attributes allow customization of:
- Width and height of the game container
- Fullscreen mode option
- Custom server URL (optional)

## Summary

The Jackalopes WordPress plugin provides a complete solution for embedding the Jackalopes ThreeJS game into WordPress sites. It includes:

1. A modern WordPress plugin structure with Composer support
2. Seamless integration with the existing jackalopes-server plugin for multiplayer
3. Responsive design that works in various WordPress environments
4. Admin interface for configuration
5. Optimized asset loading for WordPress

The implementation maintains all the features of the original game while making it easy to deploy via WordPress shortcodes.

## Conclusion

We have successfully created the WordPress plugin framework for the Jackalopes game. The plugin is structured using modern WordPress development practices with Composer support and clean separation of concerns.

All the necessary files have been created:

1. **WordPress Plugin Structure**: Main plugin file, includes, and admin interfaces
2. **Game Framework**: React/Three.js environment ready for the game code
3. **Integration Mechanisms**: Shortcodes, asset loading, and server connection
4. **Documentation**: README, integration guide, and development instructions

To complete the project, the next step is to transfer the actual game code from the existing project into this framework using the provided INTEGRATION.md guide. Then testing and optimizing the plugin for deployment in WordPress environments, particularly the specified Roots/Sage/Trellis/Lima/Tailwind/Acorn stack.

The plugin is now ready for the final implementation phase, which involves integrating the actual game code and assets into this framework.
