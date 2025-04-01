<?php
/**
 * Simple PHP server script for testing the Jackalopes WordPress plugin locally
 * 
 * Run with: php -S localhost:8000 serve.php
 */

// Get the requested URI
$uri = $_SERVER['REQUEST_URI'];
$file = __DIR__ . $uri;

// Check if file exists and is not a directory
if (file_exists($file) && !is_dir($file)) {
    // Get file extension
    $extension = pathinfo($file, PATHINFO_EXTENSION);
    
    // Set content type based on file extension
    switch ($extension) {
        case 'js':
            header('Content-Type: application/javascript');
            break;
        case 'css':
            header('Content-Type: text/css');
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
        case 'glb':
        case 'gltf':
            header('Content-Type: model/gltf+json');
            break;
        case 'mp3':
            header('Content-Type: audio/mpeg');
            break;
        case 'wav':
            header('Content-Type: audio/wav');
            break;
    }
    
    // Output file content
    readfile($file);
    exit;
}

// If no specific file requested, serve test.html
if ($uri === '/' || $uri === '') {
    readfile(__DIR__ . '/test.html');
    exit;
}

// Return 404 for non-existent files
http_response_code(404);
echo "404 Not Found"; 