#!/bin/bash

# Build script for Jackalopes WordPress Plugin
# This script runs all the necessary steps to build and deploy the game

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print header
echo -e "${GREEN}====================================${NC}"
echo -e "${GREEN}Jackalopes WordPress Plugin Builder${NC}"
echo -e "${GREEN}====================================${NC}"

# Step 1: Build the game
echo -e "${YELLOW}Step 1: Building game...${NC}"
cd game && npm run build && cd ..
if [ $? -ne 0 ]; then
  echo -e "${RED}Build failed! Exiting.${NC}"
  exit 1
fi
echo -e "${GREEN}Build successful.${NC}"

# Step 2: Fix asset paths
echo -e "${YELLOW}Step 2: Fixing asset paths...${NC}"
./fix-assets.sh
if [ $? -ne 0 ]; then
  echo -e "${RED}Asset path fixing failed! Exiting.${NC}"
  exit 1
fi
echo -e "${GREEN}Asset paths fixed.${NC}"

# Step 3: Copy files to WordPress plugin directory if path is provided
if [ ! -z "$1" ]; then
  WP_PLUGIN_DIR="$1"
  echo -e "${YELLOW}Step 3: Copying to WordPress plugin directory: $WP_PLUGIN_DIR${NC}"
  
  # Ensure directory exists
  if [ ! -d "$WP_PLUGIN_DIR" ]; then
    echo -e "${RED}WordPress plugin directory not found! Creating it...${NC}"
    mkdir -p "$WP_PLUGIN_DIR"
  fi
  
  # Copy plugin files
  echo -e "${YELLOW}Copying WordPress plugin files...${NC}"
  cp -r * "$WP_PLUGIN_DIR/"
  
  echo -e "${GREEN}Files copied to WordPress plugin directory.${NC}"
else
  echo -e "${YELLOW}No WordPress plugin directory specified. Plugin files not copied.${NC}"
  echo -e "${YELLOW}To copy files, run: ./build.sh /path/to/wordpress/wp-content/plugins/jackalopes-wp${NC}"
fi

echo -e "${GREEN}====================================${NC}"
echo -e "${GREEN}Build and deployment completed.${NC}"
echo -e "${GREEN}====================================${NC}"

# Print instructions
echo -e "${YELLOW}Instructions:${NC}"
echo -e "1. Activate the 'Jackalopes' plugin in your WordPress admin"
echo -e "2. Add the [jackalopes] shortcode to any page or post"
echo -e "3. For the best experience, ensure the jackalopes-server plugin is also installed and activated" 