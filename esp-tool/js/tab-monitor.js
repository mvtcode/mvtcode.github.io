/**
 * Serial Monitor Tab
 * Handles serial communication display and interaction
 */

const SerialMonitor = {
    terminal: null,
    buffer: [],
    maxBufferSize: 10000, // Maximum lines in buffer
    isReading: false,
    
    /**
     * Initialize Serial Monitor
     */
    init() {
        this.terminal = $('#terminal');
        this.setupEventListeners();
    },
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Send button
        $('#btnSend').on('click', () => this.sendCommand());
        
        // Enter key in input
        $('#serialInput').on('keypress', (e) => {
            if (e.which === 13) { // Enter key
                this.sendCommand();
            }
        });
        
        // Clear log button
        $('#btnClearLog').on('click', () => this.clearLog());
        
        // Save log button
        $('#btnSaveLog').on('click', () => this.saveLog());
        
        // Search functionality
        $('#searchLog').on('input', (e) => this.searchLog(e.target.value));
        
        // Auto-scroll checkbox
        $('#autoScroll').on('change', (e) => {
            localStorage.setItem('autoScroll', e.target.checked);
        });
        
        // Timestamp checkbox
        $('#showTimestamp').on('change', (e) => {
            localStorage.setItem('showTimestamp', e.target.checked);
        });
    },
    
    /**
     * Start reading from serial port
     */
    async startReading() {
        if (this.isReading) return;
        
        this.isReading = true;
        await SerialManager.startReading((data) => this.appendToTerminal(data));
    },
    
    /**
     * Stop reading from serial port
     */
    stopReading() {
        this.isReading = false;
    },
    
    /**
     * Append data to terminal
     * @param {string} data - Data to append
     */
    appendToTerminal(data) {
        const showTimestamp = $('#showTimestamp').is(':checked');
        const autoScroll = $('#autoScroll').is(':checked');
        
        // Add to buffer
        const lines = data.split('\n');
        lines.forEach(line => {
            if (line.trim()) {
                this.buffer.push({
                    timestamp: new Date(),
                    text: line
                });
            }
        });
        
        // Limit buffer size
        if (this.buffer.length > this.maxBufferSize) {
            this.buffer = this.buffer.slice(-this.maxBufferSize);
        }
        
        // Format output
        let output = '';
        if (showTimestamp) {
            output = `<span class="timestamp">[${getTimestamp()}]</span>`;
        }
        output += data;
        
        // Append to terminal
        this.terminal.append(output);
        
        // Auto-scroll
        if (autoScroll) {
            this.terminal.scrollTop(this.terminal[0].scrollHeight);
        }
    },
    
    /**
     * Send command to serial port
     */
    async sendCommand() {
        const input = $('#serialInput');
        const command = input.val();
        
        if (!command) return;
        
        const lineEnding = $('#lineEnding').val();
        const fullCommand = command + lineEnding;
        
        const success = await SerialManager.write(fullCommand);
        
        if (success) {
            // Echo command to terminal
            this.appendToTerminal(`> ${command}\n`);
            
            // Clear input
            input.val('');
        }
    },
    
    /**
     * Clear terminal log
     */
    clearLog() {
        this.terminal.empty();
        this.buffer = [];
        showToast('info', 'Đã xóa', 'Log đã được xóa');
    },
    
    /**
     * Save log to file
     */
    saveLog() {
        if (this.buffer.length === 0) {
            showToast('warning', 'Log trống', 'Không có dữ liệu để lưu');
            return;
        }
        
        // Format log content
        const content = this.buffer.map(entry => {
            const timestamp = entry.timestamp.toISOString();
            return `[${timestamp}] ${entry.text}`;
        }).join('\n');
        
        // Generate filename
        const now = new Date();
        const filename = `serial_log_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}.txt`;
        
        // Download file
        downloadFile(content, filename, 'text/plain');
        
        showToast('success', 'Đã lưu', `Log đã được lưu vào ${filename}`);
    },
    
    /**
     * Search and highlight text in log
     * @param {string} searchText - Text to search
     */
    searchLog(searchText) {
        if (!searchText) {
            // Remove all highlights
            this.terminal.html(this.terminal.text());
            return;
        }
        
        const content = this.terminal.text();
        const regex = new RegExp(searchText, 'gi');
        const highlighted = content.replace(regex, match => `<span class="highlight">${match}</span>`);
        
        this.terminal.html(highlighted);
    }
};

// Initialize when DOM is ready
$(document).ready(function() {
    SerialMonitor.init();
});
