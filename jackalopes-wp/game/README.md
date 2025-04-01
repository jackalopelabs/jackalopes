# Jackalopes Game - WordPress Plugin

This is the WordPress plugin version of the Jackalopes game, designed for integration into WordPress sites.

## Structure

The plugin has two main components:

1. **WordPress Plugin**: PHP files for WordPress integration
2. **Game Frontend**: React application (in the `/game` directory)

## Features

- WordPress shortcode `[jackalopes]` for embedding the game
- Admin settings for server configuration
- WebSocket server for multiplayer functionality
- Full compatibility with the standalone game

## Development Setup

### Prerequisites

- Node.js (v14+)
- npm or yarn
- Local WordPress environment (recommended: Local by Flywheel)

### Installing for Development

1. Clone the repository into your WordPress plugins directory:
   ```
   git clone https://github.com/yourusername/jackalopes-wp.git wp-content/plugins/jackalopes
   ```

2. Install frontend dependencies:
   ```
   cd wp-content/plugins/jackalopes/game
   npm install
   ```

3. Build the frontend assets:
   ```
   npm run build
   ```

4. Activate the plugin in WordPress admin

### Development Workflow

1. Start the development server:
   ```
   cd wp-content/plugins/jackalopes/game
   npm run dev
   ```

2. The frontend will be available at:
   - http://localhost:3000/ (standalone development)
   - http://localhost:3000/test.html (test page with WordPress simulation)

3. For WordPress integration testing, add the shortcode to a WordPress page:
   ```
   [jackalopes]
   ```

## Architecture

The plugin integrates with WordPress as follows:

- **WordPress Integration** (`main.php`): Registers shortcodes, enqueues scripts
- **Admin Interface** (`admin/`): Settings pages for configuration
- **Game Frontend** (`game/`): React application compiled to static files
- **WebSocket Server** (`server/`): Multiplayer functionality

## Configuration

In WordPress admin:

1. Go to **Jackalopes Settings**
2. Configure the WebSocket server URL
3. Set additional game options

## Building for Production

```
cd wp-content/plugins/jackalopes/game
npm run build
```

The compiled files will be in the `game/dist` directory and automatically loaded by WordPress.

## Deployment

1. Upload the entire `jackalopes-wp` directory to your WordPress plugins directory
2. Activate the plugin in WordPress admin
3. Configure settings if necessary
4. Add the shortcode `[jackalopes]` to any page or post

## Differences from Standalone Version

The WordPress plugin version:

1. Uses WordPress's authentication system
2. Can restrict game features based on user roles
3. Integrates with WordPress's REST API
4. Stores game data in WordPress database

## Troubleshooting

- **Game not appearing**: Ensure the shortcode is correctly placed
- **Multiplayer not working**: Check server URL in settings
- **Game assets not loading**: Check browser console for path errors 