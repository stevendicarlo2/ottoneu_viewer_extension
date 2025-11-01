// Content script for Ottoneu Viewer Extension
// This script runs on Ottoneu pages to extract and enhance data

(function() {
    'use strict';

    console.log('Ottoneu Viewer content script loaded');

    // Configuration
    const CONFIG = {
        selectors: {
            teamValue: '[data-test="team-value"], .team-value, #team-value',
            salaryCap: '[data-test="salary-cap"], .salary-cap, #salary-cap',
            playerRows: '.player-row, tr[data-player-id]',
            salaryColumns: '.salary, .player-salary, [data-salary]',
            gameDetailsTables: '.game-details-table, table[class*="game"], table[class*="details"]',
            homePlayerCell: '.home-team-position-player',
            awayPlayerCell: '.away-team-position-player',
            homePointsCell: '.game-page-home-team-text.game-page-points',
            awayPointsCell: '.game-page-away-team-text.game-page-points',
            gameInfo: '.player-game-info'
        },
        refreshInterval: 30000 // 30 seconds
    };

    // State management
    let isInitialized = false;
    let extractedData = {};
    let formattingTimeout = null;
    let isFormatting = false;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    function initialize() {
        if (isInitialized) return;
        isInitialized = true;

        console.log('Initializing Ottoneu Viewer on:', window.location.href);

        // Extract initial data
        extractPageData();

        // Apply game state formatting with delay to ensure DOM is ready
        setTimeout(() => {
            applyGameStateFormatting();
        }, 1000);

        // Set up observers for dynamic content
        setupMutationObserver();

        // Listen for messages from popup
        setupMessageListener();

        // Periodic data refresh (less frequent to reduce conflicts)
        setInterval(() => {
            extractPageData();
            debouncedApplyFormatting();
        }, CONFIG.refreshInterval);
    }

    function extractPageData() {
        try {
            const newData = {};

            // Extract team value
            const teamValueEl = findElement(CONFIG.selectors.teamValue);
            if (teamValueEl) {
                newData.teamValue = cleanCurrency(teamValueEl.textContent);
            }

            // Extract salary cap
            const salaryCapEl = findElement(CONFIG.selectors.salaryCap);
            if (salaryCapEl) {
                newData.salaryCap = cleanCurrency(salaryCapEl.textContent);
            }

            // Extract player data
            newData.players = extractPlayerData();

            // Check if data has changed
            if (JSON.stringify(newData) !== JSON.stringify(extractedData)) {
                extractedData = newData;
                saveDataToStorage(newData);
                console.log('Extracted Ottoneu data:', newData);
            }

        } catch (error) {
            console.error('Error extracting page data:', error);
        }
    }

    function extractPlayerData() {
        const players = [];
        const playerRows = document.querySelectorAll(CONFIG.selectors.playerRows);

        playerRows.forEach(row => {
            try {
                const player = {
                    name: extractPlayerName(row),
                    salary: extractPlayerSalary(row),
                    position: extractPlayerPosition(row),
                    team: extractPlayerTeam(row)
                };

                if (player.name) {
                    players.push(player);
                }
            } catch (error) {
                console.warn('Error extracting player data from row:', error);
            }
        });

        return players;
    }

    function extractPlayerName(row) {
        const nameSelectors = [
            '.player-name a',
            '.name a',
            'td:first-child a',
            '[data-player-name]'
        ];

        for (const selector of nameSelectors) {
            const element = row.querySelector(selector);
            if (element) {
                return element.textContent.trim();
            }
        }

        return null;
    }

    function extractPlayerSalary(row) {
        const salarySelectors = [
            '.salary',
            '.player-salary',
            '[data-salary]',
            'td[data-stat="salary"]'
        ];

        for (const selector of salarySelectors) {
            const element = row.querySelector(selector);
            if (element) {
                return cleanCurrency(element.textContent);
            }
        }

        return null;
    }

    function extractPlayerPosition(row) {
        const positionSelectors = [
            '.position',
            '.player-position',
            '[data-position]',
            'td[data-stat="position"]'
        ];

        for (const selector of positionSelectors) {
            const element = row.querySelector(selector);
            if (element) {
                return element.textContent.trim();
            }
        }

        return null;
    }

    function extractPlayerTeam(row) {
        const teamSelectors = [
            '.team',
            '.player-team',
            '[data-team]',
            'td[data-stat="team"]'
        ];

        for (const selector of teamSelectors) {
            const element = row.querySelector(selector);
            if (element) {
                return element.textContent.trim();
            }
        }

        return null;
    }

    function findElement(selectors) {
        const selectorList = selectors.split(', ');
        for (const selector of selectorList) {
            const element = document.querySelector(selector.trim());
            if (element) return element;
        }
        return null;
    }

    function cleanCurrency(text) {
        if (!text) return null;

        // Remove currency symbols and extra whitespace
        return text.replace(/[$,\s]/g, '').trim() || null;
    }

    function saveDataToStorage(data) {
        try {
            chrome.storage.local.set(data, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error saving to storage:', chrome.runtime.lastError);
                } else {
                    console.log('Data saved to storage');
                }
            });
        } catch (error) {
            console.error('Error accessing chrome storage:', error);
        }
    }

    function setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            let shouldRefresh = false;

            mutations.forEach((mutation) => {
                // Only process if we're not currently formatting to avoid conflicts
                if (isFormatting) return;

                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Check if any added nodes contain relevant data
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const hasRelevantData =
                                node.querySelector && (
                                    node.querySelector(CONFIG.selectors.teamValue) ||
                                    node.querySelector(CONFIG.selectors.salaryCap) ||
                                    node.querySelector(CONFIG.selectors.playerRows) ||
                                    node.querySelector(CONFIG.selectors.gameDetailsTables) ||
                                    node.classList.contains('game-details-table')
                                );

                            if (hasRelevantData) {
                                shouldRefresh = true;
                            }
                        }
                    });
                }

                // Also check for text changes in score cells that might indicate live updates
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
            characterData: true // Watch for text changes in score cells
        });
    }

    function setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('Content script received message:', request);

            switch (request.action) {
                case 'refreshData':
                    extractPageData();
                    debouncedApplyFormatting();
                    sendResponse({ success: true, data: extractedData });
                    break;

                case 'getData':
                    sendResponse({ success: true, data: extractedData });
                    break;

                case 'refreshFormatting':
                    debouncedApplyFormatting();
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }

            return true; // Keep message channel open for async response
        });
    }

    // Enhanced UI features for game state visualization
    function addEnhancedUI() {
        // Add CSS for game state formatting
        const style = document.createElement('style');
        style.textContent = `
            .ottoneu-viewer-highlight {
                background-color: #fff3cd !important;
                border-left: 3px solid #ffc107 !important;
            }

            .ottoneu-viewer-badge {
                background: #007bff;
                color: white;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 11px;
                margin-left: 5px;
            }

            /* Game state styles */
            .game-not-started {
                font-weight: bold !important;
            }

            .game-not-started .game-page-points {
                font-style: italic !important;
            }

            .game-not-started .game-page-points::after {
                content: " --" !important;
                font-weight: normal !important;
            }

            .game-not-started .game-page-points {
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

        // Apply game state formatting
        applyGameStateFormatting();
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

    function debouncedApplyFormatting() {
        // Clear any existing timeout
        if (formattingTimeout) {
            clearTimeout(formattingTimeout);
        }

        // Set a new timeout to apply formatting after a brief delay
        formattingTimeout = setTimeout(() => {
            applyGameStateFormatting();
        }, 500); // 500ms delay to allow DOM to settle
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
        const playerId = playerCell.getAttribute('data-player-id');

        // Apply formatting based on game status
        applyPlayerFormatting(playerCell, pointsCell, gameStatus, playerId);
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

        // Check for bench-related class names
        if (playerCell.classList.contains('bench-player') ||
            row.classList.contains('bench-row')) {
            return true;
        }

        return false;
    }

    function applyBenchPlayerFormatting(row, playerCell, pointsCell) {
        // Store the original score if not already stored
        if (!pointsCell.hasAttribute('data-original-score')) {
            const originalScore = pointsCell.textContent.trim();
            // Only store if it's a valid score (not already modified)
            if (originalScore !== '--' && originalScore !== '') {
                pointsCell.setAttribute('data-original-score', originalScore);
            }
        }

        // Get the original score
        const originalScore = pointsCell.getAttribute('data-original-score') || pointsCell.textContent.trim();

        // Remove other formatting classes first
        playerCell.classList.remove('game-completed', 'game-not-started', 'game-bye');
        pointsCell.classList.remove('game-completed', 'game-not-started', 'game-bye');
        row.classList.remove('game-completed', 'game-not-started', 'game-bye');

        // Add bench styling to the entire row
        row.classList.add('bench-player');

        // Also add to individual cells for specificity
        playerCell.classList.add('bench-player');
        pointsCell.classList.add('bench-player');

        // Reset player link styles that might conflict
        const playerLinks = playerCell.querySelectorAll('.player-link-desktop a, .player-link-mobile a');
        playerLinks.forEach(link => {
            link.style.fontWeight = '';
        });

        // Reset inline styles
        pointsCell.style.fontWeight = '';
        pointsCell.style.fontStyle = '';
        pointsCell.style.color = '';

        // Handle bench player score display
        // Only show -- for bench players if they haven't played (games not started)
        // If they actually scored 0 points, show the 0
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

    function removeBenchFormatting(row, playerCell, pointsCell) {
        // Remove bench styling
        row.classList.remove('bench-player');
        playerCell.classList.remove('bench-player');
        pointsCell.classList.remove('bench-player');
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

    function applyPlayerFormatting(playerCell, pointsCell, gameStatus, playerId) {
        // Get the row element for bench formatting cleanup
        const row = playerCell.closest('tr');

        // Store the original score if not already stored
        if (!pointsCell.hasAttribute('data-original-score')) {
            const originalScore = pointsCell.textContent.trim();
            // Only store if it's a valid score (not already modified)
            if (originalScore !== '--' && originalScore !== '') {
                pointsCell.setAttribute('data-original-score', originalScore);
            }
        }

        // Get the original score
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

                // Restore original score (no bold styling)
                pointsCell.textContent = originalScore;
                break;

            case 'not-started':
                // Active players - make bold and add styling for games not started
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

                // Replace score with "--" for BYE players (only if score is 0 or 0.00)
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

    // Call enhanced UI setup
    addEnhancedUI();

})();