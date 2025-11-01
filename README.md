# Ottoneu Viewer Extension

A Chrome extension that enhances the Ottoneu fantasy football experience by providing improved visual formatting for game data.

## Features

### Game State Formatting
The extension automatically formats player information based on their game status:

- **Games Not Started**:
  - Player names are **bold**
  - Scores are **bold** and show `--` instead of `0.00`
  - Points are displayed in italic gray text
  - Easy to identify players you need to watch

- **Games Completed**:
  - Player names appear normal weight
  - Scores appear normal weight
  - Shows actual points scored

- **BYE Week**:
  - Player names appear normal
  - Scores show `--`
  - Points are displayed in italic gray text

- **Bench Players**:
  - Entire row is faded (70% opacity)
  - Light gray background
  - Hover effect increases opacity to 90%
  - Smart score handling:
    - Shows `--` for unstarted games or BYE weeks
    - Shows actual score (including `0.00`) for completed games
  - Overrides other formatting (bench players are prioritized)

### How It Works

The extension analyzes the game information for each player:
- Looks for `W` (win), `L` (loss), or `T` (tie) indicators with scores to identify completed games
- Detects future game times (e.g., "Sun 1:00pm DEN") for games not yet started
- Identifies "BYE" text for players on bye weeks
- Detects bench players by checking for `data-position="Bench"` or position text "BN"
- Distinguishes between unplayed games (show `--`) and completed games with 0 points (show `0.00`)

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension will automatically activate on Ottoneu pages

## Usage

The extension works automatically on Ottoneu fantasy football pages. Simply:

1. Navigate to any Ottoneu game page with player matchups
2. The extension will automatically apply formatting based on game states
3. Formatting updates every 30 seconds or when page content changes

## Testing

Open `test_formatting.html` in your browser to see a demonstration of the formatting features with sample data.

## Files

- `manifest.json` - Extension configuration
- `content.js` - Main content script with formatting logic
- `background.js` - Background service worker
- `popup.html/js/css` - Extension popup interface
- `test_formatting.html` - Demo page for testing formatting

## Permissions

- `activeTab` - Access to the current Ottoneu tab
- `storage` - Store extracted data locally
- `host_permissions` - Access to ottoneu.fangraphs.com

## Technical Details

The extension uses:
- MutationObserver to detect dynamic content changes
- CSS classes and inline styles for formatting
- Regular expressions to parse game status information
- Chrome storage API for data persistence
