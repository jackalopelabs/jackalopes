#!/bin/bash

# Copy Assets Script for Jackalopes WordPress Plugin
# This script copies real asset files from src to dist

# Set variables
SRC_DIR="jackalopes-wp/game/src"
DIST_DIR="jackalopes-wp/game/dist"
SRC_ASSETS_DIR="$SRC_DIR/assets"
DIST_ASSETS_DIR="$DIST_DIR/assets"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print header
echo -e "${GREEN}====================================${NC}"
echo -e "${GREEN}Jackalopes Asset Copier${NC}"
echo -e "${GREEN}====================================${NC}"

# Check if source directory exists
if [ ! -d "$SRC_ASSETS_DIR" ]; then
  echo -e "${RED}Error: $SRC_ASSETS_DIR directory not found!${NC}"
  exit 1
fi

# Check if dist directory exists
if [ ! -d "$DIST_DIR" ]; then
  echo -e "${RED}Error: $DIST_DIR directory not found!${NC}"
  echo -e "${YELLOW}Please run 'npm run build' in the game directory first.${NC}"
  exit 1
fi

# Create necessary directories in dist
echo -e "${YELLOW}Creating asset directories in dist...${NC}"
mkdir -p "$DIST_ASSETS_DIR/environment/lowpoly_nature"
mkdir -p "$DIST_ASSETS_DIR/characters"
mkdir -p "$DIST_ASSETS_DIR/characters/animations"
mkdir -p "$DIST_ASSETS_DIR/models"
mkdir -p "$DIST_ASSETS_DIR/textures"
mkdir -p "$DIST_ASSETS_DIR/sounds"

# Copy environment assets
echo -e "${YELLOW}Copying environment assets...${NC}"
if [ -d "$SRC_ASSETS_DIR/environment/lowpoly_nature" ]; then
  echo -e "${YELLOW}Copying lowpoly_nature models...${NC}"
  cp -f "$SRC_ASSETS_DIR/environment/lowpoly_nature/"*.gltf "$DIST_ASSETS_DIR/environment/lowpoly_nature/"
  echo -e "${GREEN}lowpoly_nature models copied.${NC}"
else
  echo -e "${RED}lowpoly_nature directory not found in source.${NC}"
fi

# Copy character models
echo -e "${YELLOW}Copying character models...${NC}"
if [ -d "$SRC_ASSETS_DIR/characters" ]; then
  cp -f "$SRC_ASSETS_DIR/characters/"*.glb "$DIST_ASSETS_DIR/characters/" 2>/dev/null || :
  echo -e "${GREEN}Character models copied.${NC}"
else
  echo -e "${RED}Characters directory not found in source.${NC}"
fi

# Copy animations
echo -e "${YELLOW}Copying animations...${NC}"
if [ -d "$SRC_ASSETS_DIR/characters/animations" ]; then
  cp -f "$SRC_ASSETS_DIR/characters/animations/"*.fbx "$DIST_ASSETS_DIR/characters/animations/" 2>/dev/null || :
  echo -e "${GREEN}Animations copied.${NC}"
else
  echo -e "${RED}Animations directory not found in source.${NC}"
fi

# Copy FPS models to root of dist
echo -e "${YELLOW}Copying FPS model...${NC}"
if [ -f "$SRC_ASSETS_DIR/fps.glb" ]; then
  cp -f "$SRC_ASSETS_DIR/fps.glb" "$DIST_DIR/" 2>/dev/null || :
  echo -e "${GREEN}FPS model copied.${NC}"
elif [ -f "$SRC_DIR/fps.glb" ]; then
  cp -f "$SRC_DIR/fps.glb" "$DIST_DIR/" 2>/dev/null || :
  echo -e "${GREEN}FPS model copied from src root.${NC}"
else
  echo -e "${RED}FPS model not found.${NC}"
fi

# Copy fallback models
echo -e "${YELLOW}Copying fallback models...${NC}"
if [ -d "$SRC_ASSETS_DIR/models" ]; then
  cp -f "$SRC_ASSETS_DIR/models/"*.glb "$DIST_ASSETS_DIR/models/" 2>/dev/null || :
  echo -e "${GREEN}Fallback models copied.${NC}"
else
  echo -e "${RED}Models directory not found in source.${NC}"
fi

echo -e "${GREEN}Asset copying complete!${NC}"
echo -e "${YELLOW}If you're still having issues, please check that all required assets exist in your src directory.${NC}" 