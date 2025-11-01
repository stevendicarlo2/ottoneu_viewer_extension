// Ottoneu Game Formatter - Content Script
// Automatically formats player tables based on game states

(function() {
  'use strict';

  // State management
  let formattingTimeout = null;
  let isFormatting = false;

  // Configuration
  const CONFIG = {
    selectors: {
      gameDetailsTables: '.game-details-table, table[class*="game"], table[class*="details"]',
      homePlayerCell: '.home-team-position-player',
      awayPlayerCell: '.away-team-position-player',
      homePointsCell: '.game-page-home-team-text.game-page-points',
      awayPointsCell: '.game-page-away-team-text.game-page-points',
      gameInfo: '.player-game-info'
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  function initialize() {
    console.log('Ottoneu Game Formatter loaded');

    // Add CSS styles
    addFormattingStyles();

    applyGameStateFormatting();

    // Set up observers for dynamic content
    setupMutationObserver();
  }

  function addFormattingStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Game state styles */
      .game-not-started {
        font-weight: bold !important;
      }

      .game-not-started .game-page-points {
        font-style: italic !important;
        color: #6c757d !important;
      }

      /* Bench player styles */
      .bench-player {
        opacity: 0.7 !important;
        background-color: #f8f9fa !important;
        transition: opacity 0.3s ease !important;
      }

      .bench-player:hover {
        opacity: 0.9 !important;
      }

      .bench-player .game-page-points {
        color: #6c757d !important;
        font-style: italic !important;
      }
    `;
    document.head.appendChild(style);
  }

  function applyGameStateFormatting() {
    // Prevent concurrent formatting runs
    if (isFormatting) return;
    isFormatting = true;

    try {
      // Find all game details tables
      const gameDetailsTables = document.querySelectorAll(CONFIG.selectors.gameDetailsTables);

      gameDetailsTables.forEach(table => {
        const rows = table.querySelectorAll('tbody tr');

        rows.forEach(row => {
          // Process both home and away players in each row
          processPlayerInRow(row, 'home');
          processPlayerInRow(row, 'away');
        });
      });
    } finally {
      isFormatting = false;
    }
  }

  function processPlayerInRow(row, teamSide) {
    let playerCell, pointsCell;

    if (teamSide === 'home') {
      playerCell = row.querySelector(CONFIG.selectors.homePlayerCell);
      pointsCell = row.querySelector(CONFIG.selectors.homePointsCell);
    } else {
      playerCell = row.querySelector(CONFIG.selectors.awayPlayerCell);
      pointsCell = row.querySelector(CONFIG.selectors.awayPointsCell);
    }

    if (!playerCell || !pointsCell) return;

    // Check if player is on bench
    const isOnBench = checkIfPlayerOnBench(playerCell, row);

    if (isOnBench) {
      applyBenchPlayerFormatting(row, playerCell, pointsCell);
      return; // Skip game status formatting for bench players
    }

    const gameInfo = playerCell.querySelector(CONFIG.selectors.gameInfo);
    if (!gameInfo) return;

    const gameStatus = determineGameStatus(gameInfo);

    // Apply formatting based on game status
    applyPlayerFormatting(playerCell, pointsCell, gameStatus);
  }

  function checkIfPlayerOnBench(playerCell, row) {
    // Check data-position attribute
    const position = playerCell.getAttribute('data-position');
    if (position && position.toLowerCase() === 'bench') {
      return true;
    }

    // Check position text content
    const positionCell = row.querySelector('.game-details-position .position');
    if (positionCell) {
      const positionText = positionCell.textContent.trim().toLowerCase();
      if (positionText === 'bn' || positionText === 'bench') {
        return true;
      }
    }

    return false;
  }

  // Helper functions for code deduplication
  function clearFormatting(row, playerCell, pointsCell) {
    const classes = ['game-completed', 'game-not-started', 'game-bye', 'bench-player'];
    [playerCell, pointsCell].forEach(el => el.classList.remove(...classes));
    if (row) row.classList.remove('bench-player');

    // Reset inline styles
    const resetStyles = { fontWeight: '', fontStyle: '', color: '' };
    Object.assign(pointsCell.style, resetStyles);

    // Reset player link styles
    const playerLinks = playerCell.querySelectorAll('.player-link-desktop a, .player-link-mobile a');
    playerLinks.forEach(link => link.style.fontWeight = '');
  }

  function setScoreDisplay(pointsCell, score, isStyled = false, fontWeight = '') {
    pointsCell.textContent = score;
    if (isStyled) {
      pointsCell.style.fontStyle = 'italic';
      pointsCell.style.color = '#6c757d';
    }
    if (fontWeight) {
      pointsCell.style.fontWeight = fontWeight;
    }
  }

  function applyBenchPlayerFormatting(row, playerCell, pointsCell) {
    const currentScore = pointsCell.textContent.trim();
    clearFormatting(row, playerCell, pointsCell);

    // Add bench styling
    [row, playerCell, pointsCell].forEach(el => el.classList.add('bench-player'));

    // Handle score display - show "--" for unstarted games with 0 score
    const gameInfo = playerCell.querySelector(CONFIG.selectors.gameInfo);
    const gameStatus = gameInfo ? determineGameStatus(gameInfo) : 'not-started';
    const shouldShowDash = (gameStatus === 'not-started' || gameStatus === 'bye') && parseFloat(currentScore) === 0;

    setScoreDisplay(pointsCell, shouldShowDash ? '--' : currentScore, shouldShowDash);
  }

  function determineGameStatus(gameInfoElement) {
    const gameText = gameInfoElement.textContent.trim();

    // Check for completed games (W, L, or T with score)
    if (gameText.includes('W ') || gameText.includes('L ') || gameText.includes('T ')) {
      return 'completed';
    }

    // Check for BYE week
    if (gameText.includes('BYE')) {
      return 'bye';
    }

    // Check for future games (contains day and time)
    if (/\w{3}\s+\d{1,2}:\d{2}(am|pm)/i.test(gameText)) {
      return 'not-started';
    }

    return 'unknown';
  }

  function applyPlayerFormatting(playerCell, pointsCell, gameStatus) {
    const row = playerCell.closest('tr');
    const currentScore = pointsCell.textContent.trim();
    clearFormatting(row, playerCell, pointsCell);

    // Add status class
    const statusClass = `game-${gameStatus}`;
    [playerCell, pointsCell].forEach(el => el.classList.add(statusClass));

    const playerLinks = playerCell.querySelectorAll('.player-link-desktop a, .player-link-mobile a');
    const isZeroScore = parseFloat(currentScore) === 0;

    switch (gameStatus) {
      case 'completed':
        setScoreDisplay(pointsCell, currentScore);
        break;

      case 'not-started':
        // Make player links bold
        playerLinks.forEach(link => link.style.fontWeight = 'bold');
        // Show "--" for zero scores, otherwise show score in bold
        if (isZeroScore) {
          setScoreDisplay(pointsCell, '--', true, 'bold');
        } else {
          setScoreDisplay(pointsCell, currentScore, false, 'bold');
        }
        break;

      case 'bye':
        setScoreDisplay(pointsCell, isZeroScore ? '--' : currentScore, isZeroScore);
        break;

      default:
        setScoreDisplay(pointsCell, currentScore);
        break;
    }
  }

  function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldRefresh = false;

      mutations.forEach((mutation) => {
        // Only process if we're not currently formatting
        if (isFormatting) return;

        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if any added nodes contain relevant data
          mutation.addedNodes.forEach((node) => {
                      if (node.nodeType === Node.ELEMENT_NODE) {
                          const hasRelevantData =
                              node.querySelector && (
                                  node.querySelector(CONFIG.selectors.gameDetailsTables) ||
                                  node.classList.contains('game-details-table')
                              );

                          if (hasRelevantData) {
                              shouldRefresh = true;
                          }
                      }
          });
        }

        // Also check for text changes in score cells
        if (mutation.type === 'characterData' || mutation.type === 'childList') {
          const target = mutation.target;
          if (target && target.closest) {
                      const scoreCell = target.closest('.game-page-points');
                      if (scoreCell) {
                          shouldRefresh = true;
                      }
          }
        }
      });

      if (shouldRefresh) {
        debouncedApplyFormatting();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function debouncedApplyFormatting() {
    // Clear any existing timeout
    if (formattingTimeout) {
      clearTimeout(formattingTimeout);
    }

    // Set a new timeout to apply formatting after a brief delay
    formattingTimeout = setTimeout(() => {
      applyGameStateFormatting();
    }, 500);
  }

})();
