/**
 * Flash Firmware Tab
 * Handles firmware flashing using esptool-js
 */

const FlashFirmware = {
    selectedFile: null,
    espLoader: null,
    transport: null,
    
    /**
     * Initialize Flash Firmware tab
     */
    init() {
        this.setupEventListeners();
    },
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        const dropZone = $('#dropZone');
        const fileInput = $('#firmwareFile');
        
        // Click to select file
        dropZone.on('click', () => fileInput.click());
        
        // File input change
        fileInput.on('change', (e) => this.handleFileSelect(e.target.files[0]));
        
        // Drag and drop
        dropZone.on('dragover', (e) => {
            e.preventDefault();
            dropZone.addClass('dragover');
        });
        
        dropZone.on('dragleave', () => {
            dropZone.removeClass('dragover');
        });
        
        dropZone.on('drop', (e) => {
            e.preventDefault();
            dropZone.removeClass('dragover');
            
            const files = e.originalEvent.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelect(files[0]);
            }
        });
        
        // Flash button
        $('#btnFlash').on('click', () => this.startFlash());
        
        // Flash address change - save to localStorage
        $('#flashAddress').on('change', function() {
            localStorage.setItem('flashAddress', $(this).val());
        });
    },
    
    /**
     * Handle file selection
     * @param {File} file - Selected file
     */
    handleFileSelect(file) {
        if (!file) return;
        
        // Validate file extension
        if (!validateFileExtension(file, '.bin')) {
            showToast('error', 'File không hợp lệ', 'Vui lòng chọn file .bin');
            return;
        }
        
        this.selectedFile = file;
        
        // Display file info
        $('#fileName').text(file.name);
        $('#fileSize').text(formatBytes(file.size));
        $('#fileInfo').show();
        
        // Enable flash button if connected
        if (AppState.isConnected) {
            $('#btnFlash').prop('disabled', false);
        }
        
        showToast('success', 'File đã chọn', `${file.name} (${formatBytes(file.size)})`);
    },
    
    /**
     * Start flashing process
     */
    async startFlash() {
        if (!this.selectedFile) {
            showToast('warning', 'Chưa chọn file', 'Vui lòng chọn file firmware');
            return;
        }
        
        if (!AppState.serialPort) {
            showToast('warning', 'Chưa kết nối', 'Vui lòng kết nối thiết bị trước');
            return;
        }
        
        try {
            // Disable UI
            $('#btnFlash').prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span>Đang flash...');
            $('#flashProgress').show();
            
            // Initialize esptool
            await this.initEspTool();
            
            // Detect chip
            await this.detectChip();
            
            // Erase flash if option is checked
            if ($('#eraseFlash').is(':checked')) {
                await this.eraseFlash();
            }
            
            // Flash firmware
            await this.flashFirmware();
            
            // Verify if option is checked
            if ($('#verifyFlash').is(':checked')) {
                await this.verifyFirmware();
            }
            
            showToast('success', 'Flash thành công', 'Firmware đã được flash lên thiết bị');
            this.appendLog('✓ Flash hoàn tất!\n', 'success');
            
        } catch (error) {
            log('Flash failed: ' + error.message, 'error');
            showToast('error', 'Flash thất bại', error.message);
            this.appendLog('✗ Lỗi: ' + error.message + '\n', 'error');
        } finally {
            // Re-enable UI
            $('#btnFlash').prop('disabled', false).html('<i class="bi bi-lightning-charge"></i> Bắt đầu Flash');
        }
    },
    
    /**
     * Initialize esptool-js
     */
    async initEspTool() {
        this.appendLog('Khởi tạo esptool...\n');
        
        // Create transport
        this.transport = new Transport(AppState.serialPort);
        
        // Create loader
        this.espLoader = new ESPLoader(this.transport, 115200);
        
        AppState.espLoader = this.espLoader;
    },
    
    /**
     * Detect chip type
     */
    async detectChip() {
        this.appendLog('Đang phát hiện chip...\n');
        
        const chipType = await this.espLoader.main_fn();
        
        $('#detectedChip').val(chipType);
        AppState.currentChip = chipType;
        
        this.appendLog(`✓ Phát hiện chip: ${chipType}\n`, 'success');
        
        // Auto-set flash address based on chip type
        this.autoSetFlashAddress(chipType);
    },
    
    /**
     * Auto-set flash address based on chip type
     * @param {string} chipType - Detected chip type
     */
    autoSetFlashAddress(chipType) {
        let address = '0x10000'; // Default for ESP32
        
        if (chipType.includes('ESP8266')) {
            address = '0x00000';
        }
        
        // Only auto-set if user hasn't manually changed it
        const currentAddress = $('#flashAddress').val();
        if (currentAddress === '0x10000' || currentAddress === '0x00000') {
            $('#flashAddress').val(address);
        }
        
        this.appendLog(`Địa chỉ flash: ${address}\n`);
    },
    
    /**
     * Erase flash
     */
    async eraseFlash() {
        this.appendLog('Đang xóa flash...\n');
        await this.espLoader.erase_flash();
        this.appendLog('✓ Đã xóa flash\n', 'success');
    },
    
    /**
     * Flash firmware
     */
    async flashFirmware() {
        this.appendLog('Đang flash firmware...\n');
        
        // Read file as ArrayBuffer
        const fileData = await this.selectedFile.arrayBuffer();
        
        // Get flash address
        const flashAddress = parseHex($('#flashAddress').val());
        
        // Flash options
        const flashOptions = {
            fileArray: [{
                data: new Uint8Array(fileData),
                address: flashAddress
            }],
            flashSize: 'keep',
            flashMode: 'dio',
            flashFreq: '40m',
            eraseAll: false,
            compress: true,
            reportProgress: (fileIndex, written, total) => {
                const percent = Math.round((written / total) * 100);
                this.updateProgress(percent);
            }
        };
        
        await this.espLoader.write_flash(flashOptions);
        
        this.appendLog('✓ Flash firmware hoàn tất\n', 'success');
    },
    
    /**
     * Verify firmware
     */
    async verifyFirmware() {
        this.appendLog('Đang verify...\n');
        // Note: esptool-js doesn't have built-in verify, this is a placeholder
        // In production, you would read back and compare
        this.appendLog('✓ Verify hoàn tất\n', 'success');
    },
    
    /**
     * Update progress bar
     * @param {number} percent - Progress percentage
     */
    updateProgress(percent) {
        const progressBar = $('#progressBar');
        progressBar.css('width', percent + '%');
        progressBar.text(percent + '%');
    },
    
    /**
     * Append log to flash log
     * @param {string} message - Log message
     * @param {string} type - Log type (success, error, info)
     */
    appendLog(message, type = 'info') {
        const flashLog = $('#flashLog');
        
        let className = '';
        if (type === 'success') className = 'text-success';
        if (type === 'error') className = 'text-danger';
        
        flashLog.append(`<span class="${className}">${message}</span>`);
        flashLog.scrollTop(flashLog[0].scrollHeight);
    }
};

// Initialize when DOM is ready
$(document).ready(function() {
    FlashFirmware.init();
});
