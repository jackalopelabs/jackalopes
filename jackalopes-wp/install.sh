#!/bin/bash

# Jackalopes WordPress Plugin Installation Script

echo "=== Jackalopes WordPress Plugin Installation ==="
echo ""

# Check if composer is installed
if ! command -v composer &> /dev/null; then
    echo "Error: Composer is required but not installed."
    echo "Please install Composer first: https://getcomposer.org/download/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm is required but not installed."
    echo "Please install Node.js first: https://nodejs.org/"
    exit 1
fi

echo "Installing PHP dependencies..."
composer install

echo "Building the game..."
cd game
npm install
npm run build
cd ..

echo ""
echo "=== Installation Complete ==="
echo ""
echo "The Jackalopes WordPress plugin has been installed."
echo ""
echo "To use the plugin, make sure it's activated in your WordPress admin panel."
echo "Then, use the [jackalopes] shortcode to embed the game in any post or page."
echo ""
echo "For more information, see the README.md file."