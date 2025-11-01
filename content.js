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
            salaryColumns: '.salary, .player-salary, [data-salary]'
        },
        refreshInterval: 30000 // 30 seconds
    };
    
    // State management
    let isInitialized = false;
    let extractedData = {};
    
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
        
        // Set up observers for dynamic content
        setupMutationObserver();
        
        // Listen for messages from popup
        setupMessageListener();
        
        // Periodic data refresh
        setInterval(extractPageData, CONFIG.refreshInterval);
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
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Check if any added nodes contain relevant data
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const hasRelevantData = 
                                node.querySelector && (
                                    node.querySelector(CONFIG.selectors.teamValue) ||
                                    node.querySelector(CONFIG.selectors.salaryCap) ||
                                    node.querySelector(CONFIG.selectors.playerRows)
                                );
                            
                            if (hasRelevantData) {
                                shouldRefresh = true;
                            }
                        }
                    });
                }
            });
            
            if (shouldRefresh) {
                setTimeout(extractPageData, 1000); // Delay to allow content to settle
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    function setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('Content script received message:', request);
            
            switch (request.action) {
                case 'refreshData':
                    extractPageData();
                    sendResponse({ success: true, data: extractedData });
                    break;
                    
                case 'getData':
                    sendResponse({ success: true, data: extractedData });
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
            
            return true; // Keep message channel open for async response
        });
    }
    
    // Enhanced UI features (optional)
    function addEnhancedUI() {
        // This could add visual enhancements to the Ottoneu pages
        // For example: highlighting certain players, adding quick stats, etc.
        
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
        `;
        document.head.appendChild(style);
    }
    
    // Call enhanced UI setup
    addEnhancedUI();
    
})();