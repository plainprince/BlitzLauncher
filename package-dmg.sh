#!/bin/bash

set -e

APP_NAME="minecraft-launcher"
APP_PATH="target/gluonfx/aarch64-darwin/${APP_NAME}.app"
DIST_DIR="target/dist"
DMG_NAME="${APP_NAME}.dmg"

# Check if .app exists
if [ ! -d "$APP_PATH" ]; then
    echo "❌ .app not found at $APP_PATH"
    exit 1
fi

# Create dist directory
mkdir -p "$DIST_DIR"

# Copy .app to dist
cp -R "$APP_PATH" "$DIST_DIR"

# Create DMG
hdiutil create -volname "$APP_NAME" \
  -srcfolder "$DIST_DIR/${APP_NAME}.app" \
  -ov -format UDZO "$DIST_DIR/$DMG_NAME"

echo "✅ DMG created: $DIST_DIR/$DMG_NAME"