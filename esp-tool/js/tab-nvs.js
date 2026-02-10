/**
 * NVS Editor Tab
 * Reads and displays NVS (Non-Volatile Storage) key-value pairs
 */

const NVSEditor = {
    nvsData: [],
    nvsPartition: null,
    
    /**
     * Initialize NVS Editor tab
     */
    init() {
        this.setupEventListeners();
    },
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Read NVS button
        $('#btnReadNVS').on('click', () => this.readNVS());
        
        // Export button
        $('#btnExportNVS').on('click', () => this.exportToCSV());
    },
    
    /**
     * Read NVS partition
     */
    async readNVS() {
        if (!AppState.espLoader) {
            showToast('warning', 'Chưa kết nối', 'Vui lòng kết nối và phát hiện chip trước');
            return;
        }
        
        // Check if partition table has been read
        if (PartitionTable.partitions.length === 0) {
            showToast('warning', 'Chưa đọc partition table', 'Vui lòng đọc partition table trước (Tab Partition Table)');
            return;
        }
        
        try {
            showLoading('Đang đọc NVS...');
            
            // Find NVS partition
            this.nvsPartition = PartitionTable.partitions.find(p => p.subtype === 'nvs');
            
            if (!this.nvsPartition) {
                throw new Error('Không tìm thấy NVS partition');
            }
            
            // Read NVS partition data
            const nvsData = await AppState.espLoader.read_flash(
                this.nvsPartition.offset,
                this.nvsPartition.size
            );
            
            // Parse NVS data
            this.nvsData = this.parseNVS(new Uint8Array(nvsData));
            
            // Display NVS entries
            this.displayNVS();
            
            // Enable export button
            $('#btnExportNVS').prop('disabled', false);
            
            hideLoading();
            showToast('success', 'Đọc thành công', `Tìm thấy ${this.nvsData.length} entries`);
            
        } catch (error) {
            hideLoading();
            log('Failed to read NVS: ' + error.message, 'error');
            showToast('error', 'Đọc thất bại', error.message);
        }
    },
    
    /**
     * Parse NVS binary data
     * @param {Uint8Array} data - NVS partition data
     * @returns {Array} Array of NVS entries
     */
    parseNVS(data) {
        const entries = [];
        const PAGE_SIZE = 0x1000; // 4KB
        const ENTRY_SIZE = 32;
        
        // Parse each page
        for (let pageOffset = 0; pageOffset < data.length; pageOffset += PAGE_SIZE) {
            // Check page state (first 4 bytes)
            const pageState = data.readUInt32LE ? data.readUInt32LE(pageOffset) : this.readUInt32LE(data, pageOffset);
            
            // Skip empty or erased pages
            if (pageState === 0xFFFFFFFF || pageState === 0x00000000) continue;
            
            // Parse entries in this page (skip 32-byte header)
            for (let entryOffset = pageOffset + 32; entryOffset < pageOffset + PAGE_SIZE; entryOffset += ENTRY_SIZE) {
                const entry = this.parseNVSEntry(data, entryOffset);
                
                if (entry && entry.key) {
                    entries.push(entry);
                }
            }
        }
        
        return entries;
    },
    
    /**
     * Parse single NVS entry
     * @param {Uint8Array} data - NVS data
     * @param {number} offset - Entry offset
     * @returns {Object|null} Parsed entry or null
     */
    parseNVSEntry(data, offset) {
        // Check if entry is valid (not erased)
        const ns = data[offset];
        if (ns === 0xFF) return null;
        
        const type = data[offset + 1];
        const span = data[offset + 2];
        const chunkIndex = data[offset + 3];
        
        // Read CRC32
        const crc32 = this.readUInt32LE(data, offset + 4);
        
        // Read key (max 15 bytes, null-terminated)
        let key = '';
        for (let i = 0; i < 16; i++) {
            const char = data[offset + 8 + i];
            if (char === 0) break;
            key += String.fromCharCode(char);
        }
        
        if (!key) return null;
        
        // Read value based on type
        const value = this.readNVSValue(data, offset + 24, type);
        
        return {
            namespace: ns,
            type: this.getNVSTypeName(type),
            key: key,
            value: value,
            span: span,
            crc32: crc32
        };
    },
    
    /**
     * Read NVS value based on type
     * @param {Uint8Array} data - NVS data
     * @param {number} offset - Value offset
     * @param {number} type - Value type
     * @returns {string} Formatted value
     */
    readNVSValue(data, offset, type) {
        switch (type) {
            case 0x01: // U8
                return data[offset].toString();
            case 0x11: // I8
                return new Int8Array([data[offset]])[0].toString();
            case 0x02: // U16
                return this.readUInt16LE(data, offset).toString();
            case 0x12: // I16
                return new Int16Array([this.readUInt16LE(data, offset)])[0].toString();
            case 0x04: // U32
                return this.readUInt32LE(data, offset).toString();
            case 0x14: // I32
                return new Int32Array([this.readUInt32LE(data, offset)])[0].toString();
            case 0x21: // String
                let str = '';
                for (let i = 0; i < 8; i++) {
                    const char = data[offset + i];
                    if (char === 0) break;
                    str += String.fromCharCode(char);
                }
                return str;
            case 0x42: // Blob
                return this.toHexString(data.slice(offset, offset + 8));
            default:
                return 'Unknown type';
        }
    },
    
    /**
     * Get NVS type name
     * @param {number} type - Type code
     * @returns {string} Type name
     */
    getNVSTypeName(type) {
        const types = {
            0x01: 'U8',
            0x11: 'I8',
            0x02: 'U16',
            0x12: 'I16',
            0x04: 'U32',
            0x14: 'I32',
            0x08: 'U64',
            0x18: 'I64',
            0x21: 'String',
            0x42: 'Blob'
        };
        return types[type] || `0x${type.toString(16)}`;
    },
    
    /**
     * Display NVS entries in table
     */
    displayNVS() {
        const container = $('#nvsTableContainer');
        
        if (this.nvsData.length === 0) {
            container.html('<div class="alert alert-warning">Không tìm thấy NVS entry nào</div>');
            return;
        }
        
        let html = `
            <table class="table table-striped table-hover">
                <thead>
                    <tr>
                        <th>Namespace</th>
                        <th>Key</th>
                        <th>Type</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        this.nvsData.forEach(entry => {
            html += `
                <tr>
                    <td>${entry.namespace}</td>
                    <td><span class="nvs-key">${entry.key}</span></td>
                    <td><span class="nvs-type">${entry.type}</span></td>
                    <td><span class="nvs-value">${entry.value}</span></td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        container.html(html);
    },
    
    /**
     * Export NVS to CSV
     */
    exportToCSV() {
        if (this.nvsData.length === 0) {
            showToast('warning', 'Không có dữ liệu', 'Vui lòng đọc NVS trước');
            return;
        }
        
        // Create CSV content
        let csv = 'Namespace,Key,Type,Value\n';
        
        this.nvsData.forEach(entry => {
            csv += `${entry.namespace},${entry.key},${entry.type},"${entry.value}"\n`;
        });
        
        // Download CSV
        const filename = 'nvs_data.csv';
        downloadFile(csv, filename, 'text/csv');
        
        showToast('success', 'Export thành công', `Đã lưu ${filename}`);
    },
    
    // Helper functions for reading binary data
    readUInt16LE(data, offset) {
        return data[offset] | (data[offset + 1] << 8);
    },
    
    readUInt32LE(data, offset) {
        return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
    },
    
    toHexString(data) {
        return Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ');
    }
};

// Initialize when DOM is ready
$(document).ready(function() {
    NVSEditor.init();
});
