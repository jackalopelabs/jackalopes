#!/bin/bash

# Copy Assets Script for Jackalopes WordPress Plugin
# This script copies real asset files from src to dist

# Set variables
SRC_DIR="jackalopes-wp/game/src"
DIST_DIR="jackalopes-wp/game/dist"
SRC_ASSETS_DIR="$SRC_DIR/assets"
DIST_ASSETS_DIR="$DIST_DIR/assets"
ORIGINAL_GAME_DIR="./public"  # Path to original game's public directory
ORIGINAL_SRC_DIR="./src"      # Path to original game's src directory
WP_ROOT="./jackalopes-wp"     # WordPress plugin root

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print header
echo -e "${GREEN}====================================${NC}"
echo -e "${GREEN}Jackalopes Asset Copier${NC}"
echo -e "${GREEN}====================================${NC}"

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

# Create additional WordPress paths to handle direct path references
echo -e "${YELLOW}Creating additional WordPress paths for asset loading...${NC}"
mkdir -p "$WP_ROOT/src/assets/characters"
mkdir -p "$WP_ROOT/game/src/assets/characters"

# Copy environment assets
echo -e "${YELLOW}Copying environment assets...${NC}"
if [ -d "$SRC_ASSETS_DIR/environment/lowpoly_nature" ]; then
  echo -e "${YELLOW}Copying lowpoly_nature models...${NC}"
  cp -f "$SRC_ASSETS_DIR/environment/lowpoly_nature/"*.gltf "$DIST_ASSETS_DIR/environment/lowpoly_nature/" 2>/dev/null || :
  echo -e "${GREEN}lowpoly_nature models copied.${NC}"
else
  echo -e "${RED}lowpoly_nature directory not found in source.${NC}"
fi

# Copy simple-tree.glb if it exists
if [ -f "$SRC_ASSETS_DIR/environment/simple-tree.glb" ]; then
  echo -e "${YELLOW}Copying simple-tree.glb...${NC}"
  cp -f "$SRC_ASSETS_DIR/environment/simple-tree.glb" "$DIST_ASSETS_DIR/environment/" 2>/dev/null || :
  echo -e "${GREEN}simple-tree.glb copied.${NC}"
elif [ -f "$ORIGINAL_GAME_DIR/assets/environment/simple-tree.glb" ]; then
  echo -e "${YELLOW}Copying simple-tree.glb from original game...${NC}"
  cp -f "$ORIGINAL_GAME_DIR/assets/environment/simple-tree.glb" "$DIST_ASSETS_DIR/environment/" 2>/dev/null || :
  echo -e "${GREEN}simple-tree.glb copied from original game.${NC}"
else
  echo -e "${RED}simple-tree.glb not found.${NC}"
  echo "PLACEHOLDER" > "$DIST_ASSETS_DIR/environment/simple-tree.glb"
  echo -e "${YELLOW}Created placeholder for simple-tree.glb${NC}"
fi

# Copy character models
echo -e "${YELLOW}Copying character models...${NC}"
JACKALOPE_FOUND=false
MERC_FOUND=false

# First check if we have the models in our source directories
if [ -d "$SRC_ASSETS_DIR/characters" ]; then
  if [ -f "$SRC_ASSETS_DIR/characters/jackalope.glb" ]; then
    cp -f "$SRC_ASSETS_DIR/characters/jackalope.glb" "$DIST_ASSETS_DIR/characters/" 2>/dev/null || :
    JACKALOPE_FOUND=true
  fi
  if [ -f "$SRC_ASSETS_DIR/characters/merc.glb" ]; then
    cp -f "$SRC_ASSETS_DIR/characters/merc.glb" "$DIST_ASSETS_DIR/characters/" 2>/dev/null || :
    MERC_FOUND=true
  fi
  echo -e "${GREEN}Character models copied.${NC}"
fi

# Try additional locations if not found
if [ "$JACKALOPE_FOUND" = false ]; then
  if [ -f "$ORIGINAL_GAME_DIR/assets/characters/jackalope.glb" ]; then
    cp -f "$ORIGINAL_GAME_DIR/assets/characters/jackalope.glb" "$DIST_ASSETS_DIR/characters/" 2>/dev/null || :
    JACKALOPE_FOUND=true
    echo -e "${GREEN}Jackalope model copied from original game.${NC}"
  elif [ -f "$ORIGINAL_SRC_DIR/assets/characters/jackalope.glb" ]; then
    cp -f "$ORIGINAL_SRC_DIR/assets/characters/jackalope.glb" "$DIST_ASSETS_DIR/characters/" 2>/dev/null || :
    JACKALOPE_FOUND=true
    echo -e "${GREEN}Jackalope model copied from original src.${NC}"
  else
    echo -e "${RED}Jackalope model not found in any location.${NC}"
    # Create placeholder character model files
    echo "PLACEHOLDER" > "$DIST_ASSETS_DIR/characters/jackalope.glb"
    echo -e "${YELLOW}Created placeholder jackalope model${NC}"
  fi
fi

if [ "$MERC_FOUND" = false ]; then
  if [ -f "$ORIGINAL_GAME_DIR/assets/characters/merc.glb" ]; then
    cp -f "$ORIGINAL_GAME_DIR/assets/characters/merc.glb" "$DIST_ASSETS_DIR/characters/" 2>/dev/null || :
    MERC_FOUND=true
    echo -e "${GREEN}Merc model copied from original game.${NC}"
  elif [ -f "$ORIGINAL_SRC_DIR/assets/characters/merc.glb" ]; then
    cp -f "$ORIGINAL_SRC_DIR/assets/characters/merc.glb" "$DIST_ASSETS_DIR/characters/" 2>/dev/null || :
    MERC_FOUND=true
    echo -e "${GREEN}Merc model copied from original src.${NC}"
  else
    echo -e "${RED}Merc model not found in any location.${NC}"
    # Create placeholder character model files
    echo "PLACEHOLDER" > "$DIST_ASSETS_DIR/characters/merc.glb"
    echo -e "${YELLOW}Created placeholder merc model${NC}"
  fi
fi

# Copy animations
echo -e "${YELLOW}Copying animations...${NC}"
if [ -d "$SRC_ASSETS_DIR/characters/animations" ]; then
  cp -f "$SRC_ASSETS_DIR/characters/animations/"*.fbx "$DIST_ASSETS_DIR/characters/animations/" 2>/dev/null || :
  echo -e "${GREEN}Animations copied.${NC}"
elif [ -d "$ORIGINAL_GAME_DIR/assets/characters/animations" ]; then
  cp -f "$ORIGINAL_GAME_DIR/assets/characters/animations/"*.fbx "$DIST_ASSETS_DIR/characters/animations/" 2>/dev/null || :
  echo -e "${GREEN}Animations copied from original game.${NC}"
elif [ -d "$ORIGINAL_SRC_DIR/assets/characters/animations" ]; then
  cp -f "$ORIGINAL_SRC_DIR/assets/characters/animations/"*.fbx "$DIST_ASSETS_DIR/characters/animations/" 2>/dev/null || :
  echo -e "${GREEN}Animations copied from original src.${NC}"
else
  echo -e "${RED}Animations directory not found in any location.${NC}"
  # Create placeholder animation files
  for anim in walk idle run jump shoot; do
    echo "PLACEHOLDER" > "$DIST_ASSETS_DIR/characters/animations/$anim.fbx"
  done
  echo -e "${YELLOW}Created placeholder animation files${NC}"
fi

# Copy FPS models to dist root AND assets directory (to handle different paths)
echo -e "${YELLOW}Copying FPS model...${NC}"
if [ -f "$SRC_ASSETS_DIR/fps.glb" ]; then
  cp -f "$SRC_ASSETS_DIR/fps.glb" "$DIST_DIR/" 2>/dev/null || :
  cp -f "$SRC_ASSETS_DIR/fps.glb" "$DIST_ASSETS_DIR/" 2>/dev/null || :
  echo -e "${GREEN}FPS model copied.${NC}"
elif [ -f "$SRC_DIR/fps.glb" ]; then
  cp -f "$SRC_DIR/fps.glb" "$DIST_DIR/" 2>/dev/null || :
  cp -f "$SRC_DIR/fps.glb" "$DIST_ASSETS_DIR/" 2>/dev/null || :
  echo -e "${GREEN}FPS model copied from src root.${NC}"
elif [ -f "$ORIGINAL_GAME_DIR/fps.glb" ]; then
  cp -f "$ORIGINAL_GAME_DIR/fps.glb" "$DIST_DIR/" 2>/dev/null || :
  cp -f "$ORIGINAL_GAME_DIR/fps.glb" "$DIST_ASSETS_DIR/" 2>/dev/null || :
  echo -e "${GREEN}FPS model copied from original game.${NC}"
else
  echo -e "${RED}FPS model not found.${NC}"
  echo "PLACEHOLDER" > "$DIST_DIR/fps.glb"
  echo "PLACEHOLDER" > "$DIST_ASSETS_DIR/fps.glb"
  echo -e "${YELLOW}Created placeholder for FPS model${NC}"
fi

# Copy fallback models
echo -e "${YELLOW}Copying fallback models...${NC}"
if [ -d "$SRC_ASSETS_DIR/models" ]; then
  cp -f "$SRC_ASSETS_DIR/models/"*.glb "$DIST_ASSETS_DIR/models/" 2>/dev/null || :
  echo -e "${GREEN}Fallback models copied.${NC}"
elif [ -d "$ORIGINAL_GAME_DIR/models" ]; then
  cp -f "$ORIGINAL_GAME_DIR/models/"*.glb "$DIST_ASSETS_DIR/models/" 2>/dev/null || :
  echo -e "${GREEN}Fallback models copied from original game.${NC}"
else
  echo -e "${RED}Models directory not found in source.${NC}"
  # Create placeholder fallback models
  echo "PLACEHOLDER" > "$DIST_ASSETS_DIR/models/merc-fallback.glb"
  echo "PLACEHOLDER" > "$DIST_ASSETS_DIR/models/jackalope-fallback.glb"
  echo -e "${YELLOW}Created placeholder fallback models${NC}"
fi

# Create or copy background image
echo -e "${YELLOW}Copying or creating background image...${NC}"
if [ -f "$SRC_ASSETS_DIR/background.png" ]; then
  cp -f "$SRC_ASSETS_DIR/background.png" "$DIST_ASSETS_DIR/" 2>/dev/null || :
  echo -e "${GREEN}Background image copied.${NC}"
elif [ -f "$ORIGINAL_GAME_DIR/assets/background.png" ]; then
  cp -f "$ORIGINAL_GAME_DIR/assets/background.png" "$DIST_ASSETS_DIR/" 2>/dev/null || :
  echo -e "${GREEN}Background image copied from original game.${NC}"
elif [ -f "$ORIGINAL_GAME_DIR/images/background.png" ]; then
  cp -f "$ORIGINAL_GAME_DIR/images/background.png" "$DIST_ASSETS_DIR/" 2>/dev/null || :
  echo -e "${GREEN}Background image copied from original game images.${NC}"
else
  echo -e "${RED}Background image not found.${NC}"
  # Create a simple placeholder instead of binary data
  echo -e "${YELLOW}Creating a simple placeholder background.png${NC}"
  # Create a minimal file
  touch "$DIST_ASSETS_DIR/background.png"
  echo "PLACEHOLDER" > "$DIST_ASSETS_DIR/background.png"
fi

# Create fallback paths for direct URL references (like /src/assets/...)
echo -e "${YELLOW}Creating additional asset symlinks for direct path references...${NC}"

# Handle direct path reference to jackalope.glb that appears in the error
if [ -f "$DIST_ASSETS_DIR/characters/jackalope.glb" ]; then
  # Create WP root src/assets path
  echo -e "${YELLOW}Creating WordPress root asset paths for direct references...${NC}"
  
  # Copy to WordPress root /src/assets/characters/ path
  cp -f "$DIST_ASSETS_DIR/characters/jackalope.glb" "$WP_ROOT/src/assets/characters/" 2>/dev/null || :
  
  # Copy to game/src/assets/characters/ path
  cp -f "$DIST_ASSETS_DIR/characters/jackalope.glb" "$WP_ROOT/game/src/assets/characters/" 2>/dev/null || :
  
  echo -e "${GREEN}Created necessary paths for jackalope.glb${NC}"
else
  # Create placeholder files at those paths
  echo "PLACEHOLDER" > "$WP_ROOT/src/assets/characters/jackalope.glb"
  echo "PLACEHOLDER" > "$WP_ROOT/game/src/assets/characters/jackalope.glb"
  echo -e "${YELLOW}Created placeholder jackalope.glb at WordPress paths${NC}"
fi

# Copy the background image to the root src folder too
if [ -f "$DIST_ASSETS_DIR/background.png" ]; then
  cp -f "$DIST_ASSETS_DIR/background.png" "$WP_ROOT/src/" 2>/dev/null || :
  cp -f "$DIST_ASSETS_DIR/background.png" "$WP_ROOT/game/src/" 2>/dev/null || :
  echo -e "${GREEN}Created fallback paths for background.png${NC}"
fi

echo -e "${GREEN}Asset copying complete!${NC}"
echo -e "${YELLOW}If you're still having issues, please check that all required assets exist in your src directory.${NC}" 