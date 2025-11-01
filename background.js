// Background script for Ottoneu Viewer Extension
// Handles extension lifecycle, background tasks, and cross-tab communication

// Extension installation and updates
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Ottoneu Viewer Extension installed/updated');
    
    if (details.reason === 'install') {
        // First-time installation
        console.log('First-time installation');
        initializeExtension();
    } else if (details.reason === 'update') {
        // Extension updated
        console.log('Extension updated to version', chrome.runtime.getManifest().version);
        handleExtensionUpdate(details.previousVersion);
    }
});

// Extension startup
chrome.runtime.onStartup.addListener(() => {
    console.log('Extension started');
    initializeExtension();
});

function initializeExtension() {
    // Set default storage values
    chrome.storage.local.get(['initialized'], (result) => {
        if (!result.initialized) {
            const defaultSettings = {
                initialized: true,
                autoRefresh: true,
                refreshInterval: 30000,
                notifications: true,
                version: chrome.runtime.getManifest().version
            };
            
            chrome.storage.local.set(defaultSettings, () => {
                console.log('Default settings initialized');
            });
        }
    });
}

function handleExtensionUpdate(previousVersion) {
    // Handle version-specific updates
    const currentVersion = chrome.runtime.getManifest().version;
    
    // Clear cache on major updates
    if (previousVersion && previousVersion.split('.')[0] !== currentVersion.split('.')[0]) {
        chrome.storage.local.clear(() => {
            console.log('Storage cleared due to major version update');
            initializeExtension();
        });
    }
    
    // Update version in storage
    chrome.storage.local.set({ version: currentVersion });
}

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);
    
    switch (request.action) {
        case 'getData':
            handleGetData(sendResponse);
            break;
            
        case 'saveData':
            handleSaveData(request.data, sendResponse);
            break;
            
        case 'clearData':
            handleClearData(sendResponse);
            break;
            
        case 'getSettings':
            handleGetSettings(sendResponse);
            break;
            
        case 'saveSettings':
            handleSaveSettings(request.settings, sendResponse);
            break;
            
        default:
            sendResponse({ success: false, error: 'Unknown action' });
    }
    
    return true; // Keep message channel open for async response
});

function handleGetData(sendResponse) {
    chrome.storage.local.get(['teamValue', 'salaryCap', 'players'], (result) => {
        if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
            sendResponse({ success: true, data: result });
        }
    });
}

function handleSaveData(data, sendResponse) {
    // Add timestamp to data
    const dataWithTimestamp = {
        ...data,
        lastUpdated: Date.now()
    };
    
    chrome.storage.local.set(dataWithTimestamp, () => {
        if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
            console.log('Data saved successfully');
            sendResponse({ success: true });
            
            // Notify other parts of the extension about data update
            broadcastDataUpdate(dataWithTimestamp);
        }
    });
}

function handleClearData(sendResponse) {
    const keysToKeep = ['initialized', 'autoRefresh', 'refreshInterval', 'notifications', 'version'];
    
    chrome.storage.local.get(null, (allData) => {
        const dataToKeep = {};
        keysToKeep.forEach(key => {
            if (allData[key] !== undefined) {
                dataToKeep[key] = allData[key];
            }
        });
        
        chrome.storage.local.clear(() => {
            chrome.storage.local.set(dataToKeep, () => {
                if (chrome.runtime.lastError) {
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    console.log('Data cleared successfully');
                    sendResponse({ success: true });
                }
            });
        });
    });
}

function handleGetSettings(sendResponse) {
    chrome.storage.local.get(['autoRefresh', 'refreshInterval', 'notifications'], (result) => {
        if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
            sendResponse({ success: true, settings: result });
        }
    });
}

function handleSaveSettings(settings, sendResponse) {
    chrome.storage.local.set(settings, () => {
        if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
            console.log('Settings saved successfully');
            sendResponse({ success: true });
        }
    });
}

function broadcastDataUpdate(data) {
    // Send update to all Ottoneu tabs
    chrome.tabs.query({ url: 'https://ottoneu.fangraphs.com/*' }, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                action: 'dataUpdated',
                data: data
            }).catch(error => {
                // Ignore errors for tabs that don't have content script loaded
                console.debug('Could not send message to tab', tab.id, error);
            });
        });
    });
}

// Tab management
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Inject content script when Ottoneu pages are loaded
    if (changeInfo.status === 'complete' && 
        tab.url && 
        tab.url.includes('ottoneu.fangraphs.com')) {
        
        console.log('Ottoneu page loaded:', tab.url);
        
        // The content script will be automatically injected due to manifest.json configuration
        // But we can send a message to initialize if needed
        setTimeout(() => {
            chrome.tabs.sendMessage(tabId, { action: 'initialize' }).catch(() => {
                // Content script might not be ready yet, ignore error
            });
        }, 1000);
    }
});

// Periodic cleanup of old data
setInterval(() => {
    chrome.storage.local.get(['lastUpdated'], (result) => {
        const lastUpdated = result.lastUpdated;
        const now = Date.now();
        const oneWeek = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
        
        // Clear data if it's older than a week
        if (lastUpdated && (now - lastUpdated) > oneWeek) {
            console.log('Clearing old data (older than 1 week)');
            handleClearData(() => {});
        }
    });
}, 24 * 60 * 60 * 1000); // Check daily

// Handle extension icon badge
function updateBadge(text, color = '#007bff') {
    chrome.action.setBadgeText({ text: text });
    chrome.action.setBadgeBackgroundColor({ color: color });
}

// Listen for storage changes to update badge
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.teamValue) {
        const teamValue = changes.teamValue.newValue;
        if (teamValue) {
            // Show team value in badge (first 3 characters)
            const badgeText = teamValue.toString().substring(0, 3);
            updateBadge(badgeText);
        } else {
            updateBadge('');
        }
    }
});

// Error handling
chrome.runtime.onSuspend.addListener(() => {
    console.log('Extension suspending');
});

chrome.runtime.onSuspendCanceled.addListener(() => {
    console.log('Extension suspend canceled');
});

// Initialize badge on startup
chrome.storage.local.get(['teamValue'], (result) => {
    if (result.teamValue) {
        const badgeText = result.teamValue.toString().substring(0, 3);
        updateBadge(badgeText);
    }
});