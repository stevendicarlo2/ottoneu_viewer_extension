// Ottoneu Game Formatter - Content Script
// Automatically formats player tables based on game states

// Utilities
function throttle<T extends (...args: any[]) => void>(func: T, delay: number): T {
  let lastExecution = 0;
  let timeoutId: number | null = null;

  return ((...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastExecution = now - lastExecution;

    if (timeSinceLastExecution >= delay) {
      // Execute immediately if enough time has passed
      lastExecution = now;
      func(...args);
    } else {
      // Schedule execution for the remaining time
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        lastExecution = Date.now();
        func(...args);
        timeoutId = null;
      }, delay - timeSinceLastExecution);
    }
  }) as T;
}

// Configuration
interface Config {
  selectors: {
    gameDetailsTables: string;
    homePlayerCell: string;
    awayPlayerCell: string;
    homePointsCell: string;
    awayPointsCell: string;
    gameInfo: string;
  };
}

const CONFIG: Config = {
    selectors: {
      gameDetailsTables: '.game-details-table, table[class*="game"], table[class*="details"]',
      homePlayerCell: '.home-team-position-player',
      awayPlayerCell: '.away-team-position-player',
      homePointsCell: '.game-page-home-team-text.game-page-points',
      awayPointsCell: '.game-page-away-team-text.game-page-points',
      gameInfo: '.player-game-info'
    }
  };

type GameStatus = 'completed' | 'notStarted' | 'inProgress' | 'bye';
type TeamSide = 'home' | 'away';

interface DisplayInfo {
  gameStatus: GameStatus | undefined;
  isBenchPlayer: boolean;
}

// Exhaustiveness check helper
function assertUnreachable(_x: never): never {
  throw new Error("Didn't expect to get here");
}

(function(): void {
  'use strict';

  // State management
  let isFormatting = false;
  let mutationObserver: MutationObserver | null = null;

  // Configuration

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  function initialize(): void {
    console.log('Ottoneu Game Formatter loaded');

    // CSS styles are now loaded via manifest.json content_scripts

    applyGameStateFormatting();

    // Set up observers for dynamic content
    createMutationObserver();
    startObserving();
  }

  function applyGameStateFormatting(): void {
    console.log('Applying formatting');

    // Prevent concurrent formatting runs
    if (isFormatting) return;
    isFormatting = true;

    // Temporarily disconnect observer to prevent feedback loop
    mutationObserver?.disconnect();

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

      // Reconnect observer after our changes are complete
      startObserving();
    }
  }

  function processPlayerInRow(row: Element, teamSide: TeamSide): void {
    let playerCell: HTMLElement | null;
    let pointsCell: HTMLElement | null;

    if (teamSide === 'home') {
      playerCell = row.querySelector<HTMLElement>(CONFIG.selectors.homePlayerCell);
      pointsCell = row.querySelector<HTMLElement>(CONFIG.selectors.homePointsCell);
    } else {
      playerCell = row.querySelector<HTMLElement>(CONFIG.selectors.awayPlayerCell);
      pointsCell = row.querySelector<HTMLElement>(CONFIG.selectors.awayPointsCell);
    }

    if (!playerCell || !pointsCell) return;

    // Check if player is on bench
    const isBenchPlayer = checkIfPlayerOnBench(playerCell, row);

    const gameInfo = playerCell.querySelector<HTMLElement>(CONFIG.selectors.gameInfo);
    const gameStatus = gameInfo ? determineGameStatus(gameInfo) : undefined;

    const displayInfo: DisplayInfo = {
      gameStatus,
      isBenchPlayer
    };

    applyPlayerFormatting(playerCell, pointsCell, displayInfo);
  }

  function checkIfPlayerOnBench(playerCell: HTMLElement, row: Element): boolean {
    // Check data-position attribute
    const position = playerCell.getAttribute('data-position');
    if (position && position.toLowerCase() === 'bench') {
      return true;
    }

    // Check position text content
    const positionCell = row.querySelector<HTMLElement>('.game-details-position .position');
    if (positionCell) {
      const positionText = positionCell.textContent?.trim().toLowerCase();
      if (positionText === 'bn' || positionText === 'bench') {
        return true;
      }
    }

    return false;
  }

  // Helper functions for code deduplication
  function clearFormatting(playerCell: HTMLElement, pointsCell: HTMLElement): void {
    const classes = ['game-completed', 'game-notStarted', 'game-inProgress', 'game-bye', 'bench-player'];

    // Clear classes from player and points cells
    [playerCell, pointsCell].forEach(el => el.classList.remove(...classes));
  }

  function setScoreDisplay(
    pointsCell: HTMLElement,
    score: string
  ): void {
    pointsCell.textContent = score;
  }

  function determineGameStatus(gameInfoElement: HTMLElement): GameStatus | undefined {
    const gameText = gameInfoElement.textContent?.trim() ?? '';

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
      return 'notStarted';
    }

    return undefined;
  }

  function applyPlayerFormatting(
    playerCell: HTMLElement,
    pointsCell: HTMLElement,
    displayInfo: DisplayInfo
  ): void {
    const currentScore = pointsCell.textContent?.trim() ?? '';
    clearFormatting(playerCell, pointsCell);

    const { gameStatus, isBenchPlayer } = displayInfo;
    const isZeroScore = parseFloat(currentScore) === 0;

    // Add classes to playerCell and pointsCell
    const classesToAdd: string[] = [];
    if (isBenchPlayer) {
      classesToAdd.push('bench-player');
    }
    if (gameStatus) {
      classesToAdd.push(`game-${gameStatus}`);
    }

    [playerCell, pointsCell].forEach(el => el.classList.add(...classesToAdd));

    switch (gameStatus) {
      case 'completed':
      case 'inProgress':
      case undefined:
        // Score is already correct, just apply CSS styling
        break;

      case 'notStarted':
      case 'bye':
        // Show "--" for zero scores, otherwise keep current score
        if (isZeroScore) {
          setScoreDisplay(pointsCell, '--');
        }
        break;

      default:
        // Exhaustiveness check - this will cause a compile error if any cases are missing
        assertUnreachable(gameStatus);
    }
  }

  function shouldRefreshFromMutation(mutation: MutationRecord): boolean {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      // Check if any added nodes contain relevant data
      const hasRelevantData = Array.from(mutation.addedNodes).some((node) => {
        if (node.nodeType === Node.ELEMENT_NODE && node instanceof Element) {
          return node.querySelector(CONFIG.selectors.gameDetailsTables) ||
                 node.classList.contains('game-details-table');
        }
        return false;
      });

      if (hasRelevantData) {
        return true;
      }
    }

    // Also check for text changes in score cells
    if (mutation.type === 'characterData' || mutation.type === 'childList') {
      const target = mutation.target;
      if (target instanceof Element) {
        const scoreCell = target.closest('.game-page-points');
        if (scoreCell) {
          return true;
        }
      }
    }

    return false;
  }

  function createMutationObserver(): void {
    //
    mutationObserver = new MutationObserver(throttle((mutations) => {
      // Only process if we're not currently formatting
      if (isFormatting) return;

      const shouldRefresh = mutations.some(shouldRefreshFromMutation);

      if (shouldRefresh) {
        applyGameStateFormatting();
      }
    }, 500));
  }

  function startObserving(): void {
    mutationObserver?.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
})();