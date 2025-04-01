<?php
/**
 * Simple development server for testing the Jackalopes WordPress plugin
 */

// Set headers to allow local development
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Parse the URL path
$request_uri = $_SERVER['REQUEST_URI'];
$path = parse_url($request_uri, PHP_URL_PATH);

// Serve static files from the game/dist directory
if (strpos($path, '/game/') === 0) {
    $file_path = __DIR__ . '/game/dist' . substr($path, 5);
    if (file_exists($file_path)) {
        $extension = pathinfo($file_path, PATHINFO_EXTENSION);
        
        // Set appropriate content type
        switch ($extension) {
            case 'js':
                header('Content-Type: application/javascript');
                break;
            case 'css':
                header('Content-Type: text/css');
                break;
            case 'html':
                header('Content-Type: text/html');
                break;
            case 'json':
                header('Content-Type: application/json');
                break;
            case 'png':
                header('Content-Type: image/png');
                break;
            case 'jpg':
            case 'jpeg':
                header('Content-Type: image/jpeg');
                break;
            case 'svg':
                header('Content-Type: image/svg+xml');
                break;
        }
        
        readfile($file_path);
        exit;
    }
}

// Simulate WordPress shortcode
if ($path === '/' || $path === '/index.php') {
    ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Jackalopes WordPress Plugin Test</title>
    <script>
        // Simulate WordPress plugin settings
        window.jackalopesGameSettings = {
            ajaxUrl: 'http://localhost:8000/wp-admin/admin-ajax.php',
            pluginUrl: 'http://localhost:8000/wp-content/plugins/jackalopes/',
            assetsUrl: 'http://localhost:8000/game/dist/assets/',
            serverUrl: 'ws://localhost:8082',
            debug: true,
            nonce: 'test-nonce',
            sessionKey: 'JACKALOPES-TEST-SESSION'
        };
    </script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f7f7f7;
        }
        header {
            background-color: #2c3e50;
            color: white;
            padding: 1rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .content {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        .game-container {
            background-color: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            padding: 1rem;
            margin-bottom: 2rem;
            min-height: 500px;
            position: relative;
        }
        h1, h2 {
            color: #2c3e50;
        }
        .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100%;
            font-size: 1.5rem;
            color: #7f8c8d;
        }
    </style>
</head>
<body>
    <header>
        <h1>WordPress Test Environment</h1>
    </header>
    <div class="content">
        <h2>Jackalopes Game</h2>
        <p>This is a test environment for the Jackalopes WordPress plugin.</p>
        
        <div class="game-container">
            <div id="jackalopes-game" style="width: 100%; height: 500px;">
                <div class="jackalopes-loading loading">
                    Loading game...
                </div>
            </div>
        </div>
    </div>
    
    <script src="/game/dist/assets/main.js" type="module"></script>
    <script type="module">
        // Import the module first to ensure it's fully loaded
        import '/game/dist/assets/main.js';
        
        // Wait for next tick to ensure the module has registered the global function
        setTimeout(() => {
            // Initialize the game using the global function
            if (typeof window.initJackalopesGame === 'function') {
                window.initJackalopesGame('jackalopes-game', {
                    fullscreen: false,
                    server: 'ws://localhost:8082'
                });
            } else {
                console.error('Jackalopes game initialization function not found. Make sure all assets are properly loaded.');
            }
        }, 100);
    </script>
</body>
</html>
    <?php
    exit;
}

// Fallback - 404 Not Found
header('HTTP/1.0 404 Not Found');
echo '404 - Page not found'; 