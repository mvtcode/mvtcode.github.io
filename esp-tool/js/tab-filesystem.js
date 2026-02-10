/**
 * File System Tab Module
 * Scans SPIFFS/LittleFS partitions and lists files using pattern matching
 */

const FileSystemTab = {
    partitionInfo: null,
    fileList: [],

    /**
     * Initialize File System tab
     */
    init() {
        console.log('File System tab initialized');
        
        // Event listeners
        $('#btnReadFileSystem').on('click', () => this.readFileSystem());
        $('#btnExportFileList').on('click', () => this.exportToCSV());
    },

    /**
     * Read file system from SPIFFS partition
     */
    async readFileSystem() {
        if (!AppState.isConnected) {
            showToast('warning', 'Chưa kết nối', 'Vui lòng kết nối thiết bị trước');
            return;
        }

        try {
            showLoading('Đang quét file system...');
            
            // Step 1: Find SPIFFS partition
            log('Finding SPIFFS partition...');
            const partition = await this.findFileSystemPartition();
            
            if (!partition) {
                hideLoading();
                showToast('error', 'Không tìm thấy', 'Không tìm thấy SPIFFS partition. Hãy đọc Partition Table trước.');
                return;
            }

            this.partitionInfo = partition;
            this.updatePartitionInfo(partition);
            
            // Step 2: Read partition metadata area (first 64KB)
            log(`Reading partition at ${formatHex(partition.offset)}...`);
            const metadataSize = Math.min(64 * 1024, partition.size); // Read first 64KB
            const data = await this.readPartitionData(partition.offset, metadataSize);
            
            // Step 3: Scan for files
            log('Scanning for files...');
            this.fileList = this.scanForFiles(data);
            
            // Step 4: Display results
            this.displayFileList();
            
            hideLoading();
            
            if (this.fileList.length > 0) {
                showToast('success', 'Thành công', `Tìm thấy ${this.fileList.length} file`);
                $('#btnExportFileList').prop('disabled', false);
            } else {
                showToast('warning', 'Không tìm thấy file', 'Không phát hiện được file nào. Partition có thể trống hoặc sử dụng format khác.');
            }
            
        } catch (error) {
            hideLoading();
            log('Error reading file system: ' + error.message, 'error');
            showToast('error', 'Lỗi', 'Không thể đọc file system: ' + error.message);
        }
    },

    /**
     * Find SPIFFS/LittleFS partition from partition table
     */
    async findFileSystemPartition() {
        // Check if partition table is already loaded
        if (!PartitionTableTab.partitions || PartitionTableTab.partitions.length === 0) {
            // Try to read partition table
            await PartitionTableTab.readPartitionTable();
        }

        const partitions = PartitionTableTab.partitions;
        if (!partitions || partitions.length === 0) {
            return null;
        }

        // Find SPIFFS partition (type=data, subtype=spiffs)
        const spiffsPartition = partitions.find(p => 
            p.type === 'data' && (p.subtype === 'spiffs' || p.subtype === 'fat')
        );

        return spiffsPartition;
    },

    /**
     * Read partition data
     */
    async readPartitionData(offset, size) {
        const transport = AppState.espLoader.transport;
        const blockSize = 4096; // 4KB blocks
        const numBlocks = Math.ceil(size / blockSize);
        
        let allData = new Uint8Array(size);
        let currentOffset = 0;

        for (let i = 0; i < numBlocks; i++) {
            const readSize = Math.min(blockSize, size - currentOffset);
            const data = await AppState.espLoader.readFlash(offset + currentOffset, readSize);
            allData.set(new Uint8Array(data), currentOffset);
            currentOffset += readSize;
        }

        return allData;
    },

    /**
     * Scan for files using pattern matching
     * SPIFFS object index entries contain: filename (32 bytes) + metadata
     */
    scanForFiles(data) {
        const files = [];
        const minFilenameLength = 3;
        const maxFilenameLength = 32;
        
        // Scan through data looking for potential filenames
        for (let i = 0; i < data.length - maxFilenameLength - 8; i++) {
            // Look for printable ASCII strings that could be filenames
            const potentialFilename = this.extractPotentialFilename(data, i, maxFilenameLength);
            
            if (potentialFilename && potentialFilename.length >= minFilenameLength) {
                // Check if this looks like a valid filename
                if (this.isValidFilename(potentialFilename)) {
                    // Try to extract size (4 bytes after filename, little-endian)
                    const sizeOffset = i + maxFilenameLength;
                    if (sizeOffset + 4 <= data.length) {
                        const size = data[sizeOffset] | 
                                   (data[sizeOffset + 1] << 8) | 
                                   (data[sizeOffset + 2] << 16) | 
                                   (data[sizeOffset + 3] << 24);
                        
                        // Validate size (should be reasonable)
                        if (size > 0 && size < 10 * 1024 * 1024) { // Max 10MB
                            const confidence = this.calculateConfidence(potentialFilename, size);
                            
                            // Avoid duplicates
                            if (!files.find(f => f.name === potentialFilename)) {
                                files.push({
                                    name: potentialFilename,
                                    size: size,
                                    confidence: confidence,
                                    type: this.getFileType(potentialFilename)
                                });
                            }
                        }
                    }
                }
            }
        }

        // Sort by confidence and filename
        return files.sort((a, b) => {
            if (a.confidence !== b.confidence) {
                const order = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2 };
                return order[a.confidence] - order[b.confidence];
            }
            return a.name.localeCompare(b.name);
        });
    },

    /**
     * Extract potential filename from data
     */
    extractPotentialFilename(data, offset, maxLength) {
        let filename = '';
        
        for (let i = 0; i < maxLength; i++) {
            const byte = data[offset + i];
            
            // Null terminator
            if (byte === 0) {
                break;
            }
            
            // Printable ASCII (including /, ., -, _)
            if ((byte >= 32 && byte <= 126) || byte === 47 || byte === 46 || byte === 45 || byte === 95) {
                filename += String.fromCharCode(byte);
            } else {
                // Non-printable character, not a valid filename
                return null;
            }
        }
        
        return filename.length > 0 ? filename : null;
    },

    /**
     * Check if string looks like a valid filename
     */
    isValidFilename(str) {
        // Must start with / for SPIFFS
        if (!str.startsWith('/')) {
            return false;
        }
        
        // Should have a file extension or be a path
        const hasExtension = /\.[a-zA-Z0-9]{1,5}$/.test(str);
        const isPath = str.split('/').length > 2;
        
        if (!hasExtension && !isPath) {
            return false;
        }
        
        // Should not have invalid characters
        const invalidChars = /[<>:"|?*\x00-\x1F]/;
        if (invalidChars.test(str)) {
            return false;
        }
        
        return true;
    },

    /**
     * Calculate confidence level
     */
    calculateConfidence(filename, size) {
        let score = 0;
        
        // Has common extension
        const commonExtensions = ['.html', '.css', '.js', '.json', '.txt', '.ico', '.png', '.jpg', '.gif', '.svg'];
        if (commonExtensions.some(ext => filename.endsWith(ext))) {
            score += 3;
        }
        
        // Reasonable size
        if (size >= 10 && size <= 1024 * 1024) {
            score += 2;
        }
        
        // Has directory structure
        if (filename.split('/').length > 2) {
            score += 1;
        }
        
        // Determine confidence
        if (score >= 5) return 'HIGH';
        if (score >= 3) return 'MEDIUM';
        return 'LOW';
    },

    /**
     * Get file type from extension
     */
    getFileType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        
        const types = {
            'html': 'HTML',
            'htm': 'HTML',
            'css': 'CSS',
            'js': 'JavaScript',
            'json': 'JSON',
            'txt': 'Text',
            'ico': 'Icon',
            'png': 'Image',
            'jpg': 'Image',
            'jpeg': 'Image',
            'gif': 'Image',
            'svg': 'SVG',
            'xml': 'XML',
            'pdf': 'PDF',
            'zip': 'Archive'
        };
        
        return types[ext] || 'Unknown';
    },

    /**
     * Update partition info display
     */
    updatePartitionInfo(partition) {
        $('#fsPartitionName').val(partition.name);
        $('#fsPartitionOffset').val(formatHex(partition.offset));
        $('#fsPartitionSize').val(formatBytes(partition.size));
    },

    /**
     * Display file list in table
     */
    displayFileList() {
        const tbody = $('#fileListBody');
        tbody.empty();
        
        if (this.fileList.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="4" class="text-center text-muted">
                        <i class="bi bi-inbox"></i> Không tìm thấy file nào
                    </td>
                </tr>
            `);
            $('#fsSummary').text('0 files, 0 B');
            return;
        }
        
        let totalSize = 0;
        
        this.fileList.forEach(file => {
            const confidenceBadge = this.getConfidenceBadge(file.confidence);
            
            tbody.append(`
                <tr>
                    <td><code>${file.name}</code></td>
                    <td>${formatBytes(file.size)}</td>
                    <td><span class="badge bg-secondary">${file.type}</span></td>
                    <td>${confidenceBadge}</td>
                </tr>
            `);
            
            totalSize += file.size;
        });
        
        $('#fsSummary').text(`${this.fileList.length} files, ${formatBytes(totalSize)}`);
    },

    /**
     * Get confidence badge HTML
     */
    getConfidenceBadge(confidence) {
        const badges = {
            'HIGH': '<span class="badge bg-success">HIGH</span>',
            'MEDIUM': '<span class="badge bg-warning">MEDIUM</span>',
            'LOW': '<span class="badge bg-danger">LOW</span>'
        };
        return badges[confidence] || '<span class="badge bg-secondary">UNKNOWN</span>';
    },

    /**
     * Export file list to CSV
     */
    exportToCSV() {
        if (this.fileList.length === 0) {
            showToast('warning', 'Không có dữ liệu', 'Chưa có danh sách file để export');
            return;
        }
        
        let csv = 'Filename,Size (bytes),Size (human),Type,Confidence\n';
        
        this.fileList.forEach(file => {
            csv += `"${file.name}",${file.size},"${formatBytes(file.size)}","${file.type}","${file.confidence}"\n`;
        });
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        downloadFile(blob, `filesystem_${timestamp}.csv`, 'text/csv');
        
        showToast('success', 'Đã export', 'File CSV đã được tải xuống');
    }
};

// Initialize when DOM is ready
$(document).ready(function() {
    FileSystemTab.init();
});
