/**
 * Partition Table Tab
 * Reads and displays ESP32 partition table
 */

const PartitionTable = {
    partitions: [],
    
    /**
     * Initialize Partition Table tab
     */
    init() {
        this.setupEventListeners();
    },
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Read partitions button
        $('#btnReadPartitions').on('click', () => this.readPartitionTable());
        
        // Export button
        $('#btnExportPartitions').on('click', () => this.exportToCSV());
    },
    
    /**
     * Read partition table from flash
     */
    async readPartitionTable() {
        if (!AppState.espLoader) {
            showToast('warning', 'Chưa kết nối', 'Vui lòng kết nối và phát hiện chip trước');
            return;
        }
        
        try {
            showLoading('Đang đọc partition table...');
            
            // Read partition table from offset 0x8000 (default for ESP32)
            const partitionTableOffset = 0x8000;
            const partitionTableSize = 0xC00; // 3KB
            
            const data = await AppState.espLoader.read_flash(partitionTableOffset, partitionTableSize);
            
            // Parse partition table
            this.partitions = this.parsePartitionTable(new Uint8Array(data));
            
            // Display partitions
            this.displayPartitions();
            
            // Enable export button
            $('#btnExportPartitions').prop('disabled', false);
            
            hideLoading();
            showToast('success', 'Đọc thành công', `Tìm thấy ${this.partitions.length} partitions`);
            
        } catch (error) {
            hideLoading();
            log('Failed to read partition table: ' + error.message, 'error');
            showToast('error', 'Đọc thất bại', error.message);
        }
    },
    
    /**
     * Parse partition table binary data
     * @param {Uint8Array} data - Partition table data
     * @returns {Array} Array of partition objects
     */
    parsePartitionTable(data) {
        const partitions = [];
        const PARTITION_ENTRY_SIZE = 32;
        
        // Check magic bytes
        const magic1 = (data[0] << 8) | data[1];
        if (magic1 !== 0xAA50) {
            throw new Error('Invalid partition table magic bytes');
        }
        
        // Parse each partition entry
        for (let i = 0; i < data.length; i += PARTITION_ENTRY_SIZE) {
            const magic = (data[i] << 8) | data[i + 1];
            
            // End of partition table
            if (magic === 0xFFFF || magic === 0x0000) break;
            if (magic !== 0xAA50) continue;
            
            const type = data[i + 2];
            const subtype = data[i + 3];
            const offset = (data[i + 4] | (data[i + 5] << 8) | (data[i + 6] << 16) | (data[i + 7] << 24)) >>> 0;
            const size = (data[i + 8] | (data[i + 9] << 8) | (data[i + 10] << 16) | (data[i + 11] << 24)) >>> 0;
            
            // Read name (null-terminated string)
            let name = '';
            for (let j = 12; j < 28; j++) {
                if (data[i + j] === 0) break;
                name += String.fromCharCode(data[i + j]);
            }
            
            const flags = (data[i + 28] | (data[i + 29] << 8) | (data[i + 30] << 16) | (data[i + 31] << 24)) >>> 0;
            
            partitions.push({
                name: name || 'unnamed',
                type: this.getPartitionTypeName(type),
                subtype: this.getPartitionSubtypeName(type, subtype),
                offset: offset,
                size: size,
                flags: flags
            });
        }
        
        return partitions;
    },
    
    /**
     * Get partition type name
     * @param {number} type - Type code
     * @returns {string} Type name
     */
    getPartitionTypeName(type) {
        const types = {
            0x00: 'app',
            0x01: 'data'
        };
        return types[type] || `0x${type.toString(16)}`;
    },
    
    /**
     * Get partition subtype name
     * @param {number} type - Type code
     * @param {number} subtype - Subtype code
     * @returns {string} Subtype name
     */
    getPartitionSubtypeName(type, subtype) {
        if (type === 0x00) { // App
            const subtypes = {
                0x00: 'factory',
                0x10: 'ota_0',
                0x11: 'ota_1',
                0x12: 'ota_2',
                0x13: 'ota_3',
                0x20: 'test'
            };
            return subtypes[subtype] || `ota_${subtype - 0x10}`;
        } else if (type === 0x01) { // Data
            const subtypes = {
                0x00: 'ota',
                0x01: 'phy',
                0x02: 'nvs',
                0x03: 'coredump',
                0x04: 'nvs_keys',
                0x05: 'efuse',
                0x80: 'esphttpd',
                0x81: 'fat',
                0x82: 'spiffs'
            };
            return subtypes[subtype] || `0x${subtype.toString(16)}`;
        }
        return `0x${subtype.toString(16)}`;
    },
    
    /**
     * Display partitions in table
     */
    displayPartitions() {
        const container = $('#partitionTableContainer');
        
        if (this.partitions.length === 0) {
            container.html('<div class="alert alert-warning">Không tìm thấy partition nào</div>');
            return;
        }
        
        let html = `
            <table class="table table-striped table-hover table-partition">
                <thead>
                    <tr>
                        <th>Tên</th>
                        <th>Type</th>
                        <th>SubType</th>
                        <th>Offset</th>
                        <th>Size</th>
                        <th>Flags</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        this.partitions.forEach(p => {
            html += `
                <tr>
                    <td><strong>${p.name}</strong></td>
                    <td>${p.type}</td>
                    <td>${p.subtype}</td>
                    <td>${formatHex(p.offset)}</td>
                    <td>${formatBytes(p.size)}</td>
                    <td>0x${p.flags.toString(16)}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        container.html(html);
    },
    
    /**
     * Export partition table to CSV
     */
    exportToCSV() {
        if (this.partitions.length === 0) {
            showToast('warning', 'Không có dữ liệu', 'Vui lòng đọc partition table trước');
            return;
        }
        
        // Create CSV content
        let csv = 'Name,Type,SubType,Offset,Size\n';
        
        this.partitions.forEach(p => {
            csv += `${p.name},${p.type},${p.subtype},${formatHex(p.offset)},${formatHex(p.size)}\n`;
        });
        
        // Download CSV
        const filename = 'partition_table.csv';
        downloadFile(csv, filename, 'text/csv');
        
        showToast('success', 'Export thành công', `Đã lưu ${filename}`);
    }
};

// Initialize when DOM is ready
$(document).ready(function() {
    PartitionTable.init();
});
