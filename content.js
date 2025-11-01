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

    // Apply initial formatting with delay to ensure DOM is ready
    setTimeout(() => {
      applyGameStateFormatting();
    }, 1000);

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

  function applyBenchPlayerFormatting(row, playerCell, pointsCell) {
    // Store the original score if not already stored
    if (!pointsCell.hasAttribute('data-original-score')) {
      const originalScore = pointsCell.textContent.trim();
      if (originalScore !== '--' && originalScore !== '') {
        pointsCell.setAttribute('data-original-score', originalScore);
      }
    }

    const originalScore = pointsCell.getAttribute('data-original-score') || pointsCell.textContent.trim();

    // Remove other formatting classes first
    playerCell.classList.remove('game-completed', 'game-not-started', 'game-bye');
    pointsCell.classList.remove('game-completed', 'game-not-started', 'game-bye');
    row.classList.remove('game-completed', 'game-not-started', 'game-bye');

    // Add bench styling
    row.classList.add('bench-player');
    playerCell.classList.add('bench-player');
    pointsCell.classList.add('bench-player');

    // Reset styles
    const playerLinks = playerCell.querySelectorAll('.player-link-desktop a, .player-link-mobile a');
    playerLinks.forEach(link => {
      link.style.fontWeight = '';
    });
    pointsCell.style.fontWeight = '';
    pointsCell.style.fontStyle = '';
    pointsCell.style.color = '';

    // Handle bench player score display based on game status
    const gameInfo = playerCell.querySelector(CONFIG.selectors.gameInfo);
    if (gameInfo) {
      const gameStatus = determineGameStatus(gameInfo);
      if (gameStatus === 'not-started' || gameStatus === 'bye') {
        // Game hasn't started or is BYE - show --
        const numericScore = parseFloat(originalScore);
        if (numericScore === 0) {
          pointsCell.textContent = '--';
          pointsCell.style.fontStyle = 'italic';
          pointsCell.style.color = '#6c757d';
        } else {
          pointsCell.textContent = originalScore;
        }
      } else {
        // Game completed - show actual score (including 0 if they scored 0)
        pointsCell.textContent = originalScore;
      }
    } else {
      // No game info available - assume not started, show -- for zero scores
      const numericScore = parseFloat(originalScore);
      if (numericScore === 0) {
        pointsCell.textContent = '--';
        pointsCell.style.fontStyle = 'italic';
        pointsCell.style.color = '#6c757d';
      } else {
        pointsCell.textContent = originalScore;
      }
    }
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
    // Get the row element for bench formatting cleanup
    const row = playerCell.closest('tr');

    // Store the original score if not already stored
    if (!pointsCell.hasAttribute('data-original-score')) {
      const originalScore = pointsCell.textContent.trim();
      if (originalScore !== '--' && originalScore !== '') {
        pointsCell.setAttribute('data-original-score', originalScore);
      }
    }

    const originalScore = pointsCell.getAttribute('data-original-score') || pointsCell.textContent.trim();

    // Remove existing formatting classes (including bench)
    playerCell.classList.remove('game-completed', 'game-not-started', 'game-bye', 'bench-player');
    pointsCell.classList.remove('game-completed', 'game-not-started', 'game-bye', 'bench-player');
    if (row) row.classList.remove('bench-player');

    // Reset inline styles
    pointsCell.style.fontWeight = '';
    pointsCell.style.fontStyle = '';
    pointsCell.style.color = '';

    // Reset player link styles
    const playerLinks = playerCell.querySelectorAll('.player-link-desktop a, .player-link-mobile a');
    playerLinks.forEach(link => {
      link.style.fontWeight = '';
    });

    // Apply formatting based on game status
    switch (gameStatus) {
      case 'completed':
        // Completed games - keep normal weight
        playerCell.classList.add('game-completed');
        pointsCell.classList.add('game-completed');
        pointsCell.textContent = originalScore;
        break;

      case 'not-started':
        // Active players - make bold
        playerCell.classList.add('game-not-started');
        pointsCell.classList.add('game-not-started');

        // Make player links bold for active players
        playerLinks.forEach(link => {
          link.style.fontWeight = 'bold';
        });

        // Replace score with "--" for unstarted games (only if score is 0 or 0.00)
        const numericScore = parseFloat(originalScore);
        if (numericScore === 0) {
          pointsCell.textContent = '--';
          pointsCell.style.fontStyle = 'italic';
          pointsCell.style.color = '#6c757d';
          pointsCell.style.fontWeight = 'bold';
        } else {
          // Keep the actual score if it's not zero, but make it bold
          pointsCell.textContent = originalScore;
          pointsCell.style.fontWeight = 'bold';
        }
        break;

      case 'bye':
        // Style for BYE week players
        playerCell.classList.add('game-bye');
        pointsCell.classList.add('game-bye');

        const byeScore = parseFloat(originalScore);
        if (byeScore === 0) {
          pointsCell.textContent = '--';
          pointsCell.style.fontStyle = 'italic';
          pointsCell.style.color = '#6c757d';
        } else {
          pointsCell.textContent = originalScore;
        }
        break;

      default:
        // Unknown status - restore original score
        pointsCell.textContent = originalScore;
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
