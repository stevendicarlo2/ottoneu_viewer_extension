# Icon Generation Instructions

## Using the SVG Template

The `icon-template.svg` file contains a simple baseball-themed icon design for the Ottoneu Viewer extension.

## Generating PNG Icons

### Method 1: Using ImageMagick (Recommended)

1. Install ImageMagick:
   ```bash
   brew install imagemagick
   ```

2. Run the generation script:
   ```bash
   cd icons
   ./generate-icons.sh
   ```

### Method 2: Using Online Converter

1. Go to an SVG to PNG converter like https://convertio.co/svg-png/
2. Upload the `icon-template.svg` file
3. Convert to PNG and download files for each required size:
   - 16x16 pixels → save as `icon16.png`
   - 32x32 pixels → save as `icon32.png`
   - 48x48 pixels → save as `icon48.png`
   - 128x128 pixels → save as `icon128.png`

### Method 3: Using Design Software

Open the SVG in:
- Adobe Illustrator
- Inkscape (free)
- Figma (web-based)

Export as PNG in the required sizes.

## Required Files

The extension needs these PNG files in the `icons/` directory:
- `icon16.png` - For extension menu
- `icon32.png` - For extension management page
- `icon48.png` - For extension management page
- `icon128.png` - For Chrome Web Store

## Custom Design

Feel free to modify the SVG template or create entirely new icons that better represent your extension's purpose.