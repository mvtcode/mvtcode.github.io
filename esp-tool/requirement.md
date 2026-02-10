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
