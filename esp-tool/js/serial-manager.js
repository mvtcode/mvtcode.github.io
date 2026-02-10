/**
 * Serial Port Manager
 * Handles Web Serial API connection and communication
 */

const SerialManager = {
    port: null,
    reader: null,
    writer: null,
    readableStreamClosed: null,
    writableStreamClosed: null,
    
    /**
     * Connect to serial port
     * @param {number} baudrate - Baud rate
     * @returns {Promise<boolean>} Success status
     */
    async connect(baudrate = 115200) {
        try {
            // Request port from user
            this.port = await navigator.serial.requestPort();
            
            // Open port with specified baudrate
            await this.port.open({ baudRate: baudrate });
            
            log('Serial port connected at ' + baudrate + ' baud');
            
            // Setup reader and writer
            const textDecoder = new TextDecoderStream();
            this.readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
            this.reader = textDecoder.readable.getReader();
            
            const textEncoder = new TextEncoderStream();
            this.writableStreamClosed = textEncoder.readable.pipeTo(this.port.writable);
            this.writer = textEncoder.writable.getWriter();
            
            // Update app state
            AppState.serialPort = this.port;
            AppState.reader = this.reader;
            AppState.writer = this.writer;
            
            updateConnectionStatus(true);
            showToast('success', 'Kết nối thành công', 'Đã kết nối với thiết bị ESP');
            
            // Auto-detect chip type if DriverTab is available
            if (typeof DriverTab !== 'undefined') {
                await DriverTab.autoDetectAndSuggest(this.port);
            }
            
            // Show helpful message for Serial Monitor
            setTimeout(() => {
                showToast('info', 'Đã kết nối', 'Nếu không thấy log, hãy nhấn nút RESET trên board ESP để khởi động lại chip.');
            }, 1000);
            
            return true;
        } catch (error) {
            log('Failed to connect: ' + error.message, 'error');
            
            // Check if error is due to no device selected
            if (error.name === 'NotFoundError') {
                // User cancelled the port selection
                log('User cancelled port selection');
            } else {
                showToast('error', 'Lỗi kết nối', 'Không thể kết nối với thiết bị: ' + error.message);
                
                // Suggest driver installation if DriverTab is available
                if (typeof DriverTab !== 'undefined') {
                    setTimeout(() => {
                        DriverTab.suggestDriver();
                    }, 1000);
                }
            }
            
            return false;
        }
    },
    
    /**
     * Disconnect from serial port
     * @returns {Promise<boolean>} Success status
     */
    async disconnect() {
        try {
            // Cancel reader
            if (this.reader) {
                await this.reader.cancel();
                await this.readableStreamClosed.catch(() => {});
                this.reader = null;
            }
            
            // Close writer
            if (this.writer) {
                await this.writer.close();
                await this.writableStreamClosed;
                this.writer = null;
            }
            
            // Close port
            if (this.port) {
                await this.port.close();
                this.port = null;
            }
            
            // Update app state
            AppState.serialPort = null;
            AppState.reader = null;
            AppState.writer = null;
            
            updateConnectionStatus(false);
            showToast('info', 'Đã ngắt kết nối', 'Đã ngắt kết nối với thiết bị');
            
            log('Serial port disconnected');
            return true;
        } catch (error) {
            log('Failed to disconnect: ' + error.message, 'error');
            showToast('error', 'Lỗi ngắt kết nối', error.message);
            return false;
        }
    },
    
    /**
     * Write data to serial port
     * @param {string} data - Data to write
     * @returns {Promise<boolean>} Success status
     */
    async write(data) {
        if (!this.writer) {
            showToast('warning', 'Chưa kết nối', 'Vui lòng kết nối thiết bị trước');
            return false;
        }
        
        try {
            await this.writer.write(data);
            return true;
        } catch (error) {
            log('Failed to write: ' + error.message, 'error');
            showToast('error', 'Lỗi ghi dữ liệu', error.message);
            return false;
        }
    },
    
    /**
     * Read data from serial port
     * @param {Function} callback - Callback function to handle received data
     */
    async startReading(callback) {
        if (!this.reader) {
            showToast('warning', 'Chưa kết nối', 'Vui lòng kết nối thiết bị trước');
            return;
        }
        
        try {
            while (true) {
                const { value, done } = await this.reader.read();
                if (done) {
                    log('Reader closed');
                    break;
                }
                if (value) {
                    callback(value);
                }
            }
        } catch (error) {
            log('Read error: ' + error.message, 'error');
        }
    },
    
    /**
     * Check if connected
     * @returns {boolean} Connection status
     */
    isConnected() {
        return this.port !== null && this.port.readable !== null;
    }
};

// Event listeners for connect/disconnect buttons
$(document).ready(function() {
    $('#btnConnect').on('click', async function() {
        const baudrate = parseInt($('#baudrate').val());
        const connected = await SerialManager.connect(baudrate);
        
        // Always start reading after successful connection
        if (connected) {
            SerialMonitor.startReading();
        }
    });
    
    $('#btnDisconnect').on('click', async function() {
        await SerialManager.disconnect();
    });
    
    // Save baudrate to localStorage when changed
    $('#baudrate').on('change', function() {
        localStorage.setItem('baudrate', $(this).val());
    });
});
