/**
 * ESP Flash Tools - Main Application
 * Handles app initialization, tab switching, and global utilities
 */

// Global App State
const AppState = {
    serialPort: null,
    reader: null,
    writer: null,
    isConnected: false,
    currentChip: null,
    currentTab: 'monitor',
    espLoader: null
};

// Initialize app when DOM is ready
$(document).ready(function() {
    console.log('ESP Flash Tools initialized');
    
    // Check Web Serial API support
    checkWebSerialSupport();
    
    // Setup event listeners
    setupGlobalEventListeners();
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Load saved settings from localStorage
    loadSettings();
});

/**
 * Check if browser supports Web Serial API
 */
function checkWebSerialSupport() {
    if (!('serial' in navigator)) {
        showToast('error', 'Không hỗ trợ', 
            'Trình duyệt của bạn không hỗ trợ Web Serial API. Vui lòng sử dụng Chrome hoặc Edge phiên bản mới nhất.');
        
        // Disable all connect buttons
        $('#btnConnect, #btnDisconnect').prop('disabled', true);
    } else {
        console.log('Web Serial API supported');
    }
}

/**
 * Setup global event listeners
 */
function setupGlobalEventListeners() {
    // Tab switching
    $('button[data-bs-toggle="tab"]').on('shown.bs.tab', function(e) {
        const tabId = $(e.target).attr('data-bs-target').substring(1);
        AppState.currentTab = tabId;
        console.log('Switched to tab:', tabId);
        
        // Save current tab to localStorage
        localStorage.setItem('lastTab', tabId);
    });
    
    // Restore last active tab
    const lastTab = localStorage.getItem('lastTab');
    if (lastTab) {
        $(`#${lastTab}-tab`).tab('show');
    }
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    $(document).on('keydown', function(e) {
        // Ctrl+K: Clear log (when in Serial Monitor)
        if (e.ctrlKey && e.key === 'k' && AppState.currentTab === 'monitor') {
            e.preventDefault();
            $('#btnClearLog').click();
        }
        
        // Ctrl+S: Save log (when in Serial Monitor)
        if (e.ctrlKey && e.key === 's' && AppState.currentTab === 'monitor') {
            e.preventDefault();
            $('#btnSaveLog').click();
        }
    });
}

/**
 * Load saved settings from localStorage
 */
function loadSettings() {
    // Load baudrate
    const savedBaudrate = localStorage.getItem('baudrate');
    if (savedBaudrate) {
        $('#baudrate').val(savedBaudrate);
    }
    
    // Load flash address
    const savedFlashAddress = localStorage.getItem('flashAddress');
    if (savedFlashAddress) {
        $('#flashAddress').val(savedFlashAddress);
    }
    
    // Load auto-scroll preference
    const autoScroll = localStorage.getItem('autoScroll');
    if (autoScroll !== null) {
        $('#autoScroll').prop('checked', autoScroll === 'true');
    }
    
    // Load timestamp preference
    const showTimestamp = localStorage.getItem('showTimestamp');
    if (showTimestamp !== null) {
        $('#showTimestamp').prop('checked', showTimestamp === 'true');
    }
}

/**
 * Show toast notification
 * @param {string} type - success, error, warning, info
 * @param {string} title - Toast title
 * @param {string} message - Toast message
 */
function showToast(type, title, message) {
    const toast = $('#toastNotification');
    const toastInstance = new bootstrap.Toast(toast[0]);
    
    // Set icon based on type
    const icons = {
        success: 'bi-check-circle-fill text-success',
        error: 'bi-x-circle-fill text-danger',
        warning: 'bi-exclamation-triangle-fill text-warning',
        info: 'bi-info-circle-fill text-info'
    };
    
    $('#toastIcon').attr('class', `bi me-2 ${icons[type] || icons.info}`);
    $('#toastTitle').text(title);
    $('#toastBody').text(message);
    
    // Add type class to toast
    toast.removeClass('toast-success toast-error toast-warning toast-info');
    toast.addClass(`toast-${type}`);
    
    toastInstance.show();
}

/**
 * Show loading spinner
 * @param {string} message - Loading message
 */
function showLoading(message = 'Đang xử lý...') {
    const spinner = $(`
        <div class="spinner-overlay" id="loadingSpinner">
            <div class="text-center">
                <div class="spinner-border text-light" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="text-light mt-3">${message}</p>
            </div>
        </div>
    `);
    $('body').append(spinner);
}

/**
 * Hide loading spinner
 */
function hideLoading() {
    $('#loadingSpinner').remove();
}

/**
 * Format bytes to human readable format
 * @param {number} bytes - Number of bytes
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted string
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format hex address
 * @param {number} address - Address number
 * @returns {string} Formatted hex string
 */
function formatHex(address) {
    return '0x' + address.toString(16).toUpperCase().padStart(6, '0');
}

/**
 * Parse hex string to number
 * @param {string} hexString - Hex string (with or without 0x prefix)
 * @returns {number} Parsed number
 */
function parseHex(hexString) {
    return parseInt(hexString.replace('0x', ''), 16);
}

/**
 * Download file
 * @param {Blob|ArrayBuffer} data - File data
 * @param {string} filename - File name
 * @param {string} mimeType - MIME type
 */
function downloadFile(data, filename, mimeType = 'application/octet-stream') {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Get current timestamp
 * @returns {string} Formatted timestamp
 */
function getTimestamp() {
    const now = new Date();
    return now.toTimeString().split(' ')[0] + '.' + now.getMilliseconds().toString().padStart(3, '0');
}

/**
 * Validate file extension
 * @param {File} file - File object
 * @param {string} extension - Expected extension (e.g., '.bin')
 * @returns {boolean} True if valid
 */
function validateFileExtension(file, extension) {
    return file.name.toLowerCase().endsWith(extension.toLowerCase());
}

/**
 * Update connection status UI
 * @param {boolean} connected - Connection status
 */
function updateConnectionStatus(connected) {
    AppState.isConnected = connected;
    
    if (connected) {
        $('#connectionStatus')
            .removeClass('bg-secondary')
            .addClass('bg-success connected')
            .html('<i class="bi bi-circle-fill"></i> Đã kết nối');
        
        $('#btnConnect').hide();
        $('#btnDisconnect').show();
    } else {
        $('#connectionStatus')
            .removeClass('bg-success connected')
            .addClass('bg-secondary')
            .html('<i class="bi bi-circle-fill"></i> Chưa kết nối');
        
        $('#btnConnect').show();
        $('#btnDisconnect').hide();
    }
}

/**
 * Log to console with timestamp
 * @param {string} message - Log message
 * @param {string} level - Log level (info, warn, error)
 */
function log(message, level = 'info') {
    const timestamp = getTimestamp();
    const prefix = `[${timestamp}]`;
    
    switch(level) {
        case 'warn':
            console.warn(prefix, message);
            break;
        case 'error':
            console.error(prefix, message);
            break;
        default:
            console.log(prefix, message);
    }
}
