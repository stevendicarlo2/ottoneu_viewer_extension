// Popup JavaScript for Ottoneu Viewer Extension

document.addEventListener('DOMContentLoaded', function() {
    // Initialize popup
    initializePopup();
    
    // Add event listeners
    setupEventListeners();
    
    // Load saved data
    loadStoredData();
});

function initializePopup() {
    console.log('Ottoneu Viewer popup initialized');
    updateStatus('Extension loaded successfully!');
}

function setupEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', handleRefresh);
    }
    
    // Settings button
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', handleSettings);
    }
}

async function handleRefresh() {
    const refreshBtn = document.getElementById('refresh-btn');
    const originalText = refreshBtn.textContent;
    
    try {
        // Show loading state
        refreshBtn.classList.add('loading');
        refreshBtn.textContent = 'Refreshing';
        updateStatus('Refreshing data...');
        
        // Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab.url.includes('ottoneu.fangraphs.com')) {
            updateStatus('Please navigate to an Ottoneu page first!');
            return;
        }
        
        // Send message to content script to refresh data
        try {
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'refreshData' });
            
            if (response && response.success) {
                updateStatus('Data refreshed successfully!');
                loadStoredData(); // Reload the displayed data
            } else {
                updateStatus('Failed to refresh data. Please try again.');
            }
        } catch (error) {
            console.error('Error communicating with content script:', error);
            updateStatus('Content script not available. Refresh the page and try again.');
        }
        
    } catch (error) {
        console.error('Error during refresh:', error);
        updateStatus('Error occurred during refresh.');
    } finally {
        // Reset button state
        refreshBtn.classList.remove('loading');
        refreshBtn.textContent = originalText;
    }
}

function handleSettings() {
    // For now, just show a simple alert
    // In the future, this could open a settings page
    updateStatus('Settings functionality coming soon!');
}

async function loadStoredData() {
    try {
        // Load data from Chrome storage
        const result = await chrome.storage.local.get(['teamValue', 'salaryCap']);
        
        // Update UI with stored data
        const teamValueEl = document.getElementById('team-value');
        const salaryCapEl = document.getElementById('salary-cap');
        
        if (teamValueEl) {
            teamValueEl.textContent = result.teamValue || '--';
        }
        
        if (salaryCapEl) {
            salaryCapEl.textContent = result.salaryCap || '--';
        }
        
    } catch (error) {
        console.error('Error loading stored data:', error);
    }
}

function updateStatus(message) {
    const statusEl = document.getElementById('status-text');
    if (statusEl) {
        statusEl.textContent = message;
    }
}

// Listen for storage changes to update UI in real-time
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.teamValue) {
            const teamValueEl = document.getElementById('team-value');
            if (teamValueEl) {
                teamValueEl.textContent = changes.teamValue.newValue || '--';
            }
        }
        
        if (changes.salaryCap) {
            const salaryCapEl = document.getElementById('salary-cap');
            if (salaryCapEl) {
                salaryCapEl.textContent = changes.salaryCap.newValue || '--';
            }
        }
    }
});

// Handle errors gracefully
window.addEventListener('error', function(event) {
    console.error('Popup error:', event.error);
    updateStatus('An error occurred. Please try again.');
});