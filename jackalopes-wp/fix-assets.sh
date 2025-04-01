#!/bin/bash

# Fix Assets Script for Jackalopes WordPress Plugin
# This script fixes asset paths to ensure they are correctly loaded in WordPress

# Set variables
DIST_DIR="game/dist"
ASSETS_DIR="$DIST_DIR/assets"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print header
echo -e "${GREEN}====================================${NC}"
echo -e "${GREEN}Jackalopes Asset Path Fixer${NC}"
echo -e "${GREEN}====================================${NC}"

# Check if dist directory exists
if [ ! -d "$DIST_DIR" ]; then
  echo -e "${RED}Error: $DIST_DIR directory not found!${NC}"
  echo -e "${YELLOW}Please run 'npm run build' in the game directory first.${NC}"
  exit 1
fi

# Create the environment directory if it doesn't exist
echo -e "${YELLOW}Creating environment directory...${NC}"
mkdir -p "$ASSETS_DIR/environment/lowpoly_nature"

# Copy assets from the original game repository public directory
if [ -d "../public" ]; then
  echo -e "${YELLOW}Copying environment assets from original game...${NC}"
  if [ -d "../public/environment" ]; then
    cp -r ../public/environment/* "$ASSETS_DIR/environment/" 2>/dev/null || :
  fi
  
  if [ -d "../public/assets/environment" ]; then
    cp -r ../public/assets/environment/* "$ASSETS_DIR/environment/" 2>/dev/null || :
  fi
  
  # Copy background.png if it exists
  if [ -f "../public/images/background.png" ]; then
    cp "../public/images/background.png" "$ASSETS_DIR/" 2>/dev/null || :
  fi
  
  # Copy glb models if they exist
  if [ -f "../public/fps.glb" ]; then
    cp "../public/fps.glb" "$DIST_DIR/" 2>/dev/null || :
  fi
  
  echo -e "${GREEN}Assets copied from original game.${NC}"
else
  echo -e "${RED}Original game public directory not found.${NC}"
fi

# Create placeholder files for missing assets
echo -e "${YELLOW}Creating placeholder files for missing assets...${NC}"

# Create placeholder for missing background image
if [ ! -f "$ASSETS_DIR/background.png" ]; then
  echo -e "${YELLOW}Creating placeholder background.png...${NC}"
  echo "PLACEHOLDER" > "$ASSETS_DIR/background.png"
fi

# Create placeholder for missing FPS model
if [ ! -f "$DIST_DIR/fps.glb" ]; then
  echo -e "${YELLOW}Creating placeholder fps.glb...${NC}"
  echo "PLACEHOLDER" > "$DIST_DIR/fps.glb"
fi

# Create placeholder tree models
echo -e "${YELLOW}Creating placeholder tree models...${NC}"
for tree in BirchTree_1 BirchTree_2 BirchTree_3 BirchTree_4 BirchTree_5 \
            BirchTree_Dead_1 BirchTree_Dead_2 BirchTree_Dead_3 BirchTree_Dead_4 BirchTree_Dead_5 \
            Bush_1 Bush_2 CommonTree_1 PalmTree_1 PineTree_1 Rock_1 Rock_2 Grass_1; do
  echo "PLACEHOLDER" > "$ASSETS_DIR/environment/lowpoly_nature/${tree}.gltf"
done

echo -e "${GREEN}Asset path fixing completed.${NC}"
echo -e "${YELLOW}Note: Some placeholder files were created. For a full game experience, copy actual assets from the original game.${NC}" 