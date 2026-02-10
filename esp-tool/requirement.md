# ESP Web Tool – Requirements Summary

Public web tool chạy trên trình duyệt (Chrome / Edge), deploy bằng GitHub Pages,
sử dụng Web Serial API + esptool-js, không cần backend.

---

## Tab 1 – Serial Monitor

### Chức năng chính

- Mở / đóng Serial Monitor
- Hiển thị log realtime từ chip
- Gửi text xuống chip (TX)
- Chọn baudrate

### Logic kỹ thuật

- Sử dụng Web Serial API trực tiếp
- Read loop từ `ReadableStream`
- Write bằng `WritableStream`
- Text decode bằng `TextDecoder`

### UX / UI

- Chọn baudrate (115200, 460800, 921600…)
- Auto-scroll terminal
- Clear log
- Timestamp (optional)
- Limit buffer size (tránh memory leak)

### Giới hạn

- Không decode log ESP-IDF level
- Hạn chế điều khiển RTS/DTR realtime

---

## Tab 2 – Flash Firmware (.bin)

### Chức năng chính

- User chọn cổng COM (Web Serial)
- User chọn file firmware `.bin`
- Detect chip tự động (ESP32 / ESP32-S3 / ESP32-C3 / ESP8266)
- Flash firmware lên chip

### Logic kỹ thuật

- Sử dụng `esptool-js`
- Detect chip sau khi `loader.main()`
- Flash address:
  - Auto mode:
    - ESP32 / ESP32-S3 / ESP32-C3 → `0x10000`
    - ESP8266 → `0x00000`
  - Cho phép user override address thủ công
- Flash options:
  - `compress: true`
  - `flashSize: "keep"`
  - `flashMode: "dio"`
  - `flashFreq: "40m"`

### UX / UI

- Progress bar hiển thị % flashing (onProgress)
- Log realtime
- Disable nút khi đang flash
- Hướng dẫn giữ nút **BOOT** khi connect nếu cần
- Warning khi firmware có dấu hiệu không phù hợp chip (không block)

### Giới hạn / lưu ý

- Không guarantee `.bin` đúng chip 100%
- Chỉ flash application firmware (single bin)

---

## Tab 3 – Backup / Restore Firmware (Raw Flash)

### Định nghĩa

- Backup là **RAW FLASH SNAPSHOT**
- Dùng để:
  - Backup trước khi flash firmware khác
  - Rollback firmware
  - Clone sang chip **cùng loại + cùng flash size**
- Không đảm bảo chạy trên chip khác loại

### Backup – chức năng

- Detect chip type
- Detect flash size
- Read toàn bộ flash (`readFlash`)
- Lưu backup ra file cho user

### Backup – output format (khuyến nghị)

**File 1: `backup_YYYYMMDD_HHMMSS.bin`**

- Raw flash data

**File 2: `backup_YYYYMMDD_HHMMSS.json`** (metadata)

```json
{
  "chip": "ESP32",
  "flashSize": "4MB",
  "backupDate": "2024-01-15T10:30:00Z",
  "flashAddress": "0x00000",
  "partial": false
}
```

### Restore – chức năng

- User chọn file backup `.bin`
- Hiển thị metadata (nếu có file `.json` cùng tên)
- Warning nếu chip type không khớp
- Confirm trước khi restore
- Write flash (`writeFlash`)

---

## Tab 4 – File System Explorer (SPIFFS)

### Vấn đề

User muốn xem danh sách file đã upload lên ESP32/ESP8266 bằng `pio run --target uploadfs` mà không cần đọc toàn bộ nội dung file.

### Yêu cầu

- List danh sách file từ SPIFFS partition
- Hiển thị filename và size
- Không cần đọc file content
- Export danh sách ra CSV

### Giải pháp

**Approach: Pattern Matching (không parse đầy đủ SPIFFS binary format)**

1. **Detect SPIFFS partition** từ Partition Table
2. **Đọc metadata area** (first 64KB) của partition
3. **Scan for filenames** sử dụng pattern matching:
   - Tìm printable ASCII strings (potential filenames)
   - Validate với heuristics (phải bắt đầu bằng `/`, có extension)
   - Extract size information (4 bytes sau filename)
4. **Confidence scoring**:
   - HIGH: có extension phổ biến, size hợp lý, có directory structure
   - MEDIUM: có extension, size hợp lý
   - LOW: các trường hợp khác
5. **Display results** trong table với filename, size, type, confidence
6. **Export CSV** cho user

### Kỹ thuật

- SPIFFS partition detection từ Partition Table
- Pattern matching với printable ASCII (32-126)
- Heuristic validation cho filenames
- Confidence scoring algorithm
- CSV export functionality

### Giới hạn / lưu ý

- **Tính năng thử nghiệm**, độ chính xác không 100%
- Chỉ hỗ trợ **SPIFFS**, chưa hỗ trợ LittleFS
- Có thể có **false positives**
- Không đọc file content, chỉ metadata
- Cần test với ESP board thật để verify

### UI/UX

- Alert warning về tính năng thử nghiệm
- Partition info (name, offset, size)
- File list table với 4 columns: Filename, Size, Type, Confidence
- Summary: tổng số file và tổng size
- Info box giải thích về confidence levels
- Export CSV button

---

## Tab 5 – Partition Table Viewer

### Chức năng

- Đọc partition table từ offset 0x8000
- Parse binary format
- Validate magic bytes (0xAA50)
- Hiển thị thông tin partitions
- Export ra CSV

---

## Tab 6 – NVS Editor

### Chức năng

- Tìm NVS partition từ partition table
- Đọc và parse NVS data
- Hiển thị key-value pairs
- Hỗ trợ nhiều kiểu dữ liệu (U8, I8, U16, I16, U32, I32, String, Blob)
- Export ra CSV
- Warning về rủi ro khi edit

### Giới hạn

- Chỉ **đọc**, chưa implement **write**

---

## Tab 7 – Driver (USB-to-Serial)

### Vấn đề

User gặp khó khăn khi không biết cài driver nào cho ESP board, đặc biệt trên macOS.

### Yêu cầu

- Hướng dẫn xác định chip USB-to-Serial trên board
- Cung cấp link download driver chính thức
- Hướng dẫn cài đặt chi tiết cho từng OS
- Đặc biệt: hướng dẫn disable SIP trên macOS

### Giải pháp

**4 loại chip phổ biến:**

1. **CH340/CH341** - Phổ biến nhất, rẻ
2. **FTDI (FT232, FT231X)** - Chất lượng cao
3. **CP210x (CP2102, CP2104)** - Silicon Labs
4. **PL2303** - Prolific (cảnh báo về chip fake)

**Tính năng:**

- Chip identification images để user đối chiếu
- Download links cho Windows/macOS/Linux
- Step-by-step installation guides trong modals
- macOS: hướng dẫn disable/enable SIP
- Linux: built-in driver info
- Legal disclaimer

**Auto-detection:**

- VID/PID database mapping
- Auto-detect chip type khi kết nối
- Auto-suggest driver khi connection fails
- Auto-switch to Driver tab nếu không tìm thấy port

### Kỹ thuật

- VID/PID chip detection database
- Bootstrap modals cho installation guides
- Integration với serial-manager.js
- Auto-suggestion system

---

## Technical Stack

- **Frontend**: Vanilla HTML/CSS/JavaScript
- **UI Framework**: Bootstrap 5.3.0
- **Icons**: Bootstrap Icons 1.11.3
- **JavaScript Library**: jQuery 3.7.1
- **ESP Tool**: esptool-js 0.4.0
- **Browser API**: Web Serial API
- **Deployment**: GitHub Pages (HTTPS required)

---

## Browser Support

- ✅ Chrome 89+
- ✅ Edge 89+
- ❌ Safari (no Web Serial API)
- ❌ Firefox (no Web Serial API)

---

## Deployment

- GitHub Pages
- HTTPS tự động (required cho Web Serial API)
- URL: `https://mvtcode.github.io/esp-tool/`

---

## Future Enhancements

### File System Tab

- LittleFS support
- File content reading
- File download functionality
- Improved SPIFFS parser với magic byte validation
- Upload file lên SPIFFS

### General

- OTA Update Support
- Multi-file Flash (bootloader + partition table + app)
- NVS Write functionality
- Firmware validation (magic bytes, chip compatibility)
- Log filtering theo ESP-IDF log level
- English i18n

---

## Conversation History & Decisions

### 2026-02-10: Driver Tab Implementation

**Request**: Thêm tab Driver để hướng dẫn cài driver USB-to-Serial

**Decisions**:

- Tạo chip identification images bằng AI
- Chỉ link đến driver chính thức (không host driver)
- Focus vào macOS vì phức tạp nhất (SIP)
- Thêm auto-detection và auto-suggestion

**Result**: Tab Driver hoàn chỉnh với 4 chip types, installation guides, và auto-detection

### 2026-02-10: File System Tab Implementation

**Request**: Đọc danh sách file từ SPIFFS partition (uploaded bằng `pio run --target uploadfs`)

**Problem**: SPIFFS binary format phức tạp, không có magic bytes cố định, nhiều versions khác nhau

**Approach Discussion**:

- Option 1: Parse đầy đủ SPIFFS binary format → Quá phức tạp, 1-2 ngày
- Option 2: Backup toàn bộ partition + dùng tool bên ngoài → Đơn giản nhưng không tiện
- **Option 3 (Selected)**: Pattern matching để scan filenames → Khả thi trong 1-2 giờ

**Decisions**:

- Chỉ list filename + size, không đọc content
- Sử dụng pattern matching thay vì parse đầy đủ
- Thêm confidence scoring (HIGH/MEDIUM/LOW)
- Disclaimer về độ chính xác
- Chỉ support SPIFFS trước, LittleFS sau

**Implementation Details**:

- Scan first 64KB (metadata area)
- Tìm printable ASCII strings bắt đầu bằng `/`
- Validate với heuristics (extension, size, path structure)
- Extract size từ 4 bytes sau filename (little-endian)
- Filter false positives bằng confidence scoring

**Result**: Tab File System hoàn chỉnh, cần test với ESP board thật

---

## Known Issues & Workarounds

### SPIFFS File Detection

- **Issue**: Pattern matching có thể miss một số file hoặc có false positives
- **Workaround**: Dùng confidence scoring để filter, fallback to backup entire partition

### macOS Driver Installation

- **Issue**: Cần disable SIP, rủi ro bảo mật
- **Workaround**: Hướng dẫn enable lại SIP sau khi cài driver

### Web Serial API Limitations

- **Issue**: Chỉ Chrome/Edge support
- **Workaround**: Hiển thị warning rõ ràng cho Safari/Firefox users

---

## Testing Notes

### File System Tab

- ⚠️ Chưa test với ESP board thật
- ⚠️ Cần verify pattern matching accuracy
- ⚠️ Cần test với different SPIFFS configurations

### Driver Tab

- ✅ UI tested in browser
- ✅ Modal functionality working
- ⚠️ Auto-detection cần test với real USB devices

---

## Design Philosophy

1. **Client-side only** - Không cần backend, chạy hoàn toàn trên browser
2. **Progressive enhancement** - Bắt đầu với basic features, thêm advanced features sau
3. **User-friendly** - Vietnamese UI, clear instructions, helpful warnings
4. **Safe by default** - Confirm dialogs, warnings, disclaimers
5. **Experimental features** - Mark clearly, provide fallbacks
6. **Open source** - Deploy on GitHub Pages, code public
