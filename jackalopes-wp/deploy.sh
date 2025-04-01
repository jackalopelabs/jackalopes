#!/bin/bash

# Jackalopes WordPress Plugin Deployment Script
# This script builds the game and copies all necessary files to the WordPress plugin directory

# Set variables
GAME_DIR="game"
DIST_DIR="$GAME_DIR/dist"
ORIGINAL_GAME_DIR="../"  # Path to original game directory (adjust as needed)
ORIGINAL_PUBLIC_DIR="../public"  # Path to original game's public directory

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print header
echo -e "${GREEN}====================================${NC}"
echo -e "${GREEN}Jackalopes WordPress Plugin Deployment${NC}"
echo -e "${GREEN}====================================${NC}"

# Build the game
echo -e "${YELLOW}Building game...${NC}"
cd $GAME_DIR && npm run build && cd ..
if [ $? -ne 0 ]; then
  echo -e "${RED}Build failed! Exiting.${NC}"
  exit 1
fi
echo -e "${GREEN}Build successful.${NC}"

# Create asset directories if they don't exist
echo -e "${YELLOW}Creating asset directories...${NC}"
mkdir -p $DIST_DIR/assets/models
mkdir -p $DIST_DIR/assets/textures
mkdir -p $DIST_DIR/assets/sounds
mkdir -p $DIST_DIR/assets/images
mkdir -p $DIST_DIR/assets/environment

# Copy assets from original game's public directory if it exists
if [ -d "$ORIGINAL_PUBLIC_DIR" ]; then
  echo -e "${YELLOW}Copying assets from original game...${NC}"
  
  # Copy models
  echo -e "${YELLOW}Copying models...${NC}"
  cp -r $ORIGINAL_PUBLIC_DIR/*.glb $DIST_DIR/ 2>/dev/null || :
  cp -r $ORIGINAL_PUBLIC_DIR/*.gltf $DIST_DIR/ 2>/dev/null || :
  cp -r $ORIGINAL_PUBLIC_DIR/models/* $DIST_DIR/assets/models/ 2>/dev/null || :
  
  # Copy textures
  echo -e "${YELLOW}Copying textures...${NC}"
  cp -r $ORIGINAL_PUBLIC_DIR/textures/* $DIST_DIR/assets/textures/ 2>/dev/null || :
  cp -r $ORIGINAL_PUBLIC_DIR/*.png $DIST_DIR/ 2>/dev/null || :
  cp -r $ORIGINAL_PUBLIC_DIR/*.jpg $DIST_DIR/ 2>/dev/null || :
  
  # Copy sounds
  echo -e "${YELLOW}Copying sounds...${NC}"
  cp -r $ORIGINAL_PUBLIC_DIR/sounds/* $DIST_DIR/assets/sounds/ 2>/dev/null || :
  cp -r $ORIGINAL_PUBLIC_DIR/*.mp3 $DIST_DIR/ 2>/dev/null || :
  cp -r $ORIGINAL_PUBLIC_DIR/*.wav $DIST_DIR/ 2>/dev/null || :
  
  # Copy environment assets
  echo -e "${YELLOW}Copying environment assets...${NC}"
  cp -r $ORIGINAL_PUBLIC_DIR/environment $DIST_DIR/assets/ 2>/dev/null || :
  
  # Copy any other assets
  echo -e "${YELLOW}Copying other assets...${NC}"
  cp -r $ORIGINAL_PUBLIC_DIR/assets/* $DIST_DIR/assets/ 2>/dev/null || :
  
  echo -e "${GREEN}Assets copied.${NC}"
else
  echo -e "${RED}Original game public directory not found. Skipping asset copy.${NC}"
fi

# Copy additional assets from WordPress plugin's own public directory
echo -e "${YELLOW}Copying assets from WordPress plugin...${NC}"
cp -r $GAME_DIR/public/* $DIST_DIR/ 2>/dev/null || :

echo -e "${GREEN}Deployment completed.${NC}" 