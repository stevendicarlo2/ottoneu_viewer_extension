#!/bin/bash

# Script to generate PNG icons from SVG template
# Requires ImageMagick (install with: brew install imagemagick)

if ! command -v convert &> /dev/null; then
    echo "ImageMagick is required but not installed."
    echo "Install it with: brew install imagemagick"
    exit 1
fi

echo "Generating PNG icons from SVG template..."

# Define sizes
sizes=(16 32 48 128)

# Convert SVG to PNG for each size
for size in "${sizes[@]}"; do
    echo "Generating ${size}x${size} icon..."
    convert -background transparent -size ${size}x${size} "icon-template.svg" "icon${size}.png"
done

echo "Icon generation complete!"
echo "Generated files:"
for size in "${sizes[@]}"; do
    echo "  - icon${size}.png"
done