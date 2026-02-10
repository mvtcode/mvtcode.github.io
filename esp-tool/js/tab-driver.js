/**
 * Driver Tab Module
 * Handles USB-to-Serial driver information and installation guides
 */

const DriverTab = {
    // VID/PID mapping for common USB-to-Serial chips
    CHIP_DATABASE: {
        // CH340/CH341
        '1a86:7523': { name: 'CH340', type: 'ch340' },
        '1a86:5523': { name: 'CH341', type: 'ch340' },
        
        // FTDI
        '0403:6001': { name: 'FT232R', type: 'ftdi' },
        '0403:6010': { name: 'FT2232', type: 'ftdi' },
        '0403:6011': { name: 'FT4232', type: 'ftdi' },
        '0403:6014': { name: 'FT232H', type: 'ftdi' },
        '0403:6015': { name: 'FT231X', type: 'ftdi' },
        
        // CP210x
        '10c4:ea60': { name: 'CP2102', type: 'cp210x' },
        '10c4:ea70': { name: 'CP2105', type: 'cp210x' },
        '10c4:ea71': { name: 'CP2108', type: 'cp210x' },
        
        // PL2303
        '067b:2303': { name: 'PL2303', type: 'pl2303' }
    },

    /**
     * Initialize Driver tab
     */
    init() {
        console.log('Driver tab initialized');
    },

    /**
     * Detect chip type from VID/PID
     * @param {number} vendorId - USB Vendor ID
     * @param {number} productId - USB Product ID
     * @returns {Object|null} Chip info or null
     */
    detectChipType(vendorId, productId) {
        const vid = vendorId.toString(16).padStart(4, '0');
        const pid = productId.toString(16).padStart(4, '0');
        const key = `${vid}:${pid}`;
        
        return this.CHIP_DATABASE[key] || null;
    },

    /**
     * Show macOS installation guide in modal
     * @param {string} chipType - Chip type (ch340, cp210x, etc.)
     */
    showMacOSGuide(chipType) {
        let title = '';
        let content = '';

        if (chipType === 'ch340') {
            title = 'Hướng dẫn cài driver CH340 trên macOS';
            content = `
                <div class="installation-guide">
                    <h6>Bước 1: Tải driver</h6>
                    <p>Download driver từ: <a href="http://www.wch-ic.com/downloads/CH34XSER_MAC_ZIP.html" target="_blank">WCH Official</a></p>
                    
                    <h6>Bước 2: Tắt System Integrity Protection (SIP)</h6>
                    <ol>
                        <li>Restart Mac và giữ <kbd>Cmd + R</kbd> để vào Recovery Mode</li>
                        <li>Mở Terminal từ menu Utilities</li>
                        <li>Chạy lệnh: <code>csrutil disable</code></li>
                        <li>Restart lại Mac</li>
                    </ol>
                    
                    <h6>Bước 3: Cài driver</h6>
                    <ol>
                        <li>Giải nén file ZIP đã tải</li>
                        <li>Chạy file <code>CH34xVCPDriver.pkg</code></li>
                        <li>Follow hướng dẫn cài đặt</li>
                        <li>Nếu gặp cảnh báo security, vào <strong>System Preferences → Security & Privacy</strong> và click <strong>Allow</strong></li>
                    </ol>
                    
                    <h6>Bước 4: Bật lại SIP (Khuyến nghị)</h6>
                    <ol>
                        <li>Restart Mac và giữ <kbd>Cmd + R</kbd></li>
                        <li>Mở Terminal</li>
                        <li>Chạy lệnh: <code>csrutil enable</code></li>
                        <li>Restart lại Mac</li>
                    </ol>
                    
                    <h6>Bước 5: Kiểm tra</h6>
                    <p>Cắm ESP board vào USB và chạy lệnh trong Terminal:</p>
                    <pre><code>ls /dev/tty.*</code></pre>
                    <p>Bạn sẽ thấy <code>/dev/tty.usbserial-xxxx</code> hoặc <code>/dev/tty.wchusbserial-xxxx</code></p>
                    
                    <div class="alert alert-warning mt-3">
                        <i class="bi bi-exclamation-triangle"></i>
                        <strong>Lưu ý:</strong> Từ macOS Big Sur trở lên, có thể cần approve driver trong System Preferences → Security & Privacy.
                    </div>
                </div>
            `;
        } else if (chipType === 'cp210x') {
            title = 'Hướng dẫn cài driver CP210x trên macOS';
            content = `
                <div class="installation-guide">
                    <h6>Bước 1: Tải driver</h6>
                    <p>Download driver từ: <a href="https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers" target="_blank">Silicon Labs Official</a></p>
                    
                    <h6>Bước 2: Cài driver</h6>
                    <ol>
                        <li>Giải nén file ZIP đã tải</li>
                        <li>Chạy file <code>SiLabsUSBDriverDisk.dmg</code></li>
                        <li>Chạy <code>Install CP210x VCP Driver.app</code></li>
                        <li>Follow hướng dẫn cài đặt</li>
                    </ol>
                    
                    <h6>Bước 3: Approve Extension (macOS 10.13+)</h6>
                    <ol>
                        <li>Vào <strong>System Preferences → Security & Privacy</strong></li>
                        <li>Click tab <strong>General</strong></li>
                        <li>Click nút <strong>Allow</strong> bên cạnh message "System software from Silicon Laboratories..."</li>
                        <li>Restart Mac</li>
                    </ol>
                    
                    <h6>Bước 4: Kiểm tra</h6>
                    <p>Cắm ESP board vào USB và chạy lệnh trong Terminal:</p>
                    <pre><code>ls /dev/tty.*</code></pre>
                    <p>Bạn sẽ thấy <code>/dev/tty.SLAB_USBtoUART</code></p>
                    
                    <div class="alert alert-info mt-3">
                        <i class="bi bi-info-circle"></i>
                        <strong>Tip:</strong> CP210x driver thường dễ cài hơn CH340 vì không cần tắt SIP.
                    </div>
                </div>
            `;
        }

        // Create and show modal
        const modalHtml = `
            <div class="modal fade" id="macOSGuideModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"><i class="bi bi-apple"></i> ${title}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            ${content}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Đóng</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        $('#macOSGuideModal').remove();
        
        // Add modal to body
        $('body').append(modalHtml);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('macOSGuideModal'));
        modal.show();
    },

    /**
     * Suggest driver when no port found
     * Called from SerialManager when connection fails
     */
    suggestDriver() {
        showToast('warning', 'Không tìm thấy thiết bị', 
            'Vui lòng kiểm tra tab Driver để cài driver phù hợp');
        
        // Auto switch to Driver tab
        setTimeout(() => {
            const driverTab = new bootstrap.Tab(document.getElementById('driver-tab'));
            driverTab.show();
        }, 1000);
    },

    /**
     * Auto-detect chip and show suggestion
     * @param {SerialPort} port - Web Serial API port object
     */
    async autoDetectAndSuggest(port) {
        try {
            const info = port.getInfo();
            const chip = this.detectChipType(info.usbVendorId, info.usbProductId);
            
            if (chip) {
                console.log(`Detected chip: ${chip.name} (${chip.type})`);
                
                // Show info toast
                showToast('info', 'Chip được phát hiện', 
                    `Đã phát hiện chip ${chip.name}. Nếu gặp vấn đề kết nối, hãy kiểm tra tab Driver.`);
                
                return chip;
            } else {
                console.log(`Unknown chip: VID=${info.usbVendorId.toString(16)}, PID=${info.usbProductId.toString(16)}`);
                return null;
            }
        } catch (error) {
            console.error('Error detecting chip:', error);
            return null;
        }
    }
};

// Initialize when DOM is ready
$(document).ready(function() {
    DriverTab.init();
});
