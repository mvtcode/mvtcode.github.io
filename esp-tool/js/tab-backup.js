/**
 * Backup/Restore Tab
 * Handles flash backup and restore operations
 */

const BackupRestore = {
    currentMetadata: null,
    
    /**
     * Initialize Backup/Restore tab
     */
    init() {
        this.setupEventListeners();
    },
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Backup button
        $('#btnBackup').on('click', () => this.startBackup());
        
        // Restore file selection
        $('#restoreFile').on('change', (e) => this.handleRestoreFileSelect(e.target.files[0]));
        
        // Restore button
        $('#btnRestore').on('click', () => this.startRestore());
        
        // Partial backup checkbox
        $('#partialBackup').on('change', function() {
            if ($(this).is(':checked')) {
                $('#partialBackupOptions').show();
            } else {
                $('#partialBackupOptions').hide();
            }
        });
    },
    
    /**
     * Start backup process
     */
    async startBackup() {
        if (!AppState.espLoader) {
            showToast('warning', 'Chưa kết nối', 'Vui lòng kết nối và phát hiện chip trước');
            return;
        }
        
        try {
            // Disable UI
            $('#btnBackup').prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span>Đang backup...');
            $('#backupProgress').show();
            
            // Get chip info
            const chipType = AppState.currentChip || await AppState.espLoader.chip.get_chip_description();
            const flashSize = await this.getFlashSize();
            
            $('#backupChipType').val(chipType);
            $('#backupFlashSize').val(formatBytes(flashSize));
            
            // Determine backup range
            let offset = 0;
            let size = flashSize;
            
            if ($('#partialBackup').is(':checked')) {
                offset = parseHex($('#backupOffset').val());
                size = parseHex($('#backupSize').val());
            }
            
            // Read flash
            const flashData = await this.readFlash(offset, size);
            
            // Create metadata
            const metadata = {
                chipType: chipType,
                flashSize: flashSize,
                backupDate: new Date().toISOString(),
                flashAddress: formatHex(offset),
                size: size,
                partial: $('#partialBackup').is(':checked')
            };
            
            // Generate filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
            const binFilename = `esp_backup_${timestamp}.bin`;
            const metaFilename = `esp_backup_${timestamp}.json`;
            
            // Download files
            downloadFile(flashData, binFilename, 'application/octet-stream');
            downloadFile(JSON.stringify(metadata, null, 2), metaFilename, 'application/json');
            
            showToast('success', 'Backup thành công', `Đã lưu ${binFilename} và ${metaFilename}`);
            
        } catch (error) {
            log('Backup failed: ' + error.message, 'error');
            showToast('error', 'Backup thất bại', error.message);
        } finally {
            // Re-enable UI
            $('#btnBackup').prop('disabled', false).html('<i class="bi bi-cloud-download"></i> Backup Flash');
            $('#backupProgress').hide();
        }
    },
    
    /**
     * Get flash size
     * @returns {Promise<number>} Flash size in bytes
     */
    async getFlashSize() {
        // Flash size detection based on chip
        const flashId = await AppState.espLoader.flash_id();
        const sizeId = (flashId >> 16) & 0xFF;
        
        // Convert size ID to bytes
        const flashSizeMap = {
            0x12: 256 * 1024,      // 256KB
            0x13: 512 * 1024,      // 512KB
            0x14: 1024 * 1024,     // 1MB
            0x15: 2048 * 1024,     // 2MB
            0x16: 4096 * 1024,     // 4MB
            0x17: 8192 * 1024,     // 8MB
            0x18: 16384 * 1024     // 16MB
        };
        
        return flashSizeMap[sizeId] || 4096 * 1024; // Default 4MB
    },
    
    /**
     * Read flash memory
     * @param {number} offset - Start offset
     * @param {number} size - Size to read
     * @returns {Promise<Uint8Array>} Flash data
     */
    async readFlash(offset, size) {
        const blockSize = 0x1000; // 4KB blocks
        const data = new Uint8Array(size);
        
        for (let i = 0; i < size; i += blockSize) {
            const currentBlockSize = Math.min(blockSize, size - i);
            const block = await AppState.espLoader.read_flash(offset + i, currentBlockSize);
            data.set(new Uint8Array(block), i);
            
            // Update progress
            const percent = Math.round(((i + currentBlockSize) / size) * 100);
            this.updateBackupProgress(percent);
        }
        
        return data;
    },
    
    /**
     * Update backup progress bar
     * @param {number} percent - Progress percentage
     */
    updateBackupProgress(percent) {
        const progressBar = $('#backupProgressBar');
        progressBar.css('width', percent + '%');
        progressBar.text(percent + '%');
    },
    
    /**
     * Handle restore file selection
     * @param {File} file - Selected backup file
     */
    async handleRestoreFileSelect(file) {
        if (!file) return;
        
        if (!validateFileExtension(file, '.bin')) {
            showToast('error', 'File không hợp lệ', 'Vui lòng chọn file .bin');
            return;
        }
        
        // Try to load metadata
        const metaFilename = file.name.replace('.bin', '.json');
        await this.loadMetadata(metaFilename);
        
        // Enable restore button
        $('#btnRestore').prop('disabled', false);
    },
    
    /**
     * Load metadata from JSON file
     * @param {string} filename - Metadata filename
     */
    async loadMetadata(filename) {
        // Note: Can't automatically load the JSON file, user needs to select it
        // This is a limitation of web browsers for security
        // For now, we'll just show a placeholder
        
        $('#restoreMetadata').show();
        $('#metaChipType').text('Không có metadata');
        $('#metaFlashSize').text('N/A');
        $('#metaBackupDate').text('N/A');
        
        // Show warning if chip types don't match
        if (AppState.currentChip) {
            $('#restoreWarning').show();
        }
    },
    
    /**
     * Start restore process
     */
    async startRestore() {
        const file = $('#restoreFile')[0].files[0];
        
        if (!file) {
            showToast('warning', 'Chưa chọn file', 'Vui lòng chọn file backup');
            return;
        }
        
        if (!AppState.espLoader) {
            showToast('warning', 'Chưa kết nối', 'Vui lòng kết nối thiết bị trước');
            return;
        }
        
        // Confirm action
        if (!confirm('Restore sẽ ghi đè toàn bộ flash. Bạn có chắc chắn muốn tiếp tục?')) {
            return;
        }
        
        try {
            // Disable UI
            $('#btnRestore').prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span>Đang restore...');
            $('#restoreProgress').show();
            
            // Read file
            const fileData = await file.arrayBuffer();
            
            // Erase flash first
            await AppState.espLoader.erase_flash();
            
            // Write flash
            const flashOptions = {
                fileArray: [{
                    data: new Uint8Array(fileData),
                    address: 0x0
                }],
                flashSize: 'keep',
                flashMode: 'dio',
                flashFreq: '40m',
                eraseAll: false,
                compress: true,
                reportProgress: (fileIndex, written, total) => {
                    const percent = Math.round((written / total) * 100);
                    this.updateRestoreProgress(percent);
                }
            };
            
            await AppState.espLoader.write_flash(flashOptions);
            
            showToast('success', 'Restore thành công', 'Flash đã được restore');
            
        } catch (error) {
            log('Restore failed: ' + error.message, 'error');
            showToast('error', 'Restore thất bại', error.message);
        } finally {
            // Re-enable UI
            $('#btnRestore').prop('disabled', false).html('<i class="bi bi-cloud-upload"></i> Restore Flash');
            $('#restoreProgress').hide();
        }
    },
    
    /**
     * Update restore progress bar
     * @param {number} percent - Progress percentage
     */
    updateRestoreProgress(percent) {
        const progressBar = $('#restoreProgressBar');
        progressBar.css('width', percent + '%');
        progressBar.text(percent + '%');
    }
};

// Initialize when DOM is ready
$(document).ready(function() {
    BackupRestore.init();
});
