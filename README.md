# 🌳 Gia Phả | Genealogy Management App

Một ứng dụng web quản lý gia phả dòng họ chuyên nghiệp, hiện đại. Sử dụng React, Vite, TailwindCSS cho Frontend và Google Apps Script (Google Sheets) làm Backend Serverless.

## 🌟 Tính năng nổi bật
- **Giao diện Premium (Rich Aesthetics):** Thiết kế Glassmorphism sang trọng, tông màu vàng đồng/gỗ cổ điển phù hợp với tính trang nghiêm của gia phả.
- **Cây Phả Hệ Trực Quan:** Vẽ sơ đồ phả hệ nhiều đời tự động. Hỗ trợ hiển thị thành viên gốc, người phối ngẫu (vợ/chồng), con nuôi, con riêng.
- **Công cụ xưng hô (Kinship Calculator):** Tự động tính toán vai vế và cách xưng hô chuẩn xác giữa 2 thành viên bất kỳ (áp dụng linh hoạt cho cả quan hệ huyết thống và quan hệ qua vợ/chồng chéo thế hệ).
- **Lịch sự kiện & Báo tử:** Tự động tính toán ngày giỗ, lịch sinh nhật. Quản lý hồ sơ người đã khuất tiện lợi.

---

## 🚀 Hướng dẫn Cài đặt & Cấu hình cho Người Mới

Ứng dụng này sử dụng **Google Sheets** làm cơ sở dữ liệu và **Google Apps Script (GAS)** làm API Backend. Cấu trúc này giúp bạn **không mất chi phí duy trì Server hay Database**.

### Bước 1: Chuẩn bị Database (Google Sheets)
1. Tạo một file Google Sheets mới trên Google Drive của bạn (Khuyên dùng tài khoản dòng họ).
2. Tạo các Sheet (Trang tính) với cấu trúc cột khớp với dữ liệu trong ứng dụng. Bạn có thể tự định nghĩa theo cấu trúc JSON của thành viên hoặc export dữ liệu mẫu từ Frontend vào Sheets.

### Bước 2: Cấu hình Backend (Google Apps Script)
1. Mở file Google Sheets vừa tạo.
2. Trên thanh menu, chọn **Tiện ích mở rộng (Extensions)** > **Apps Script**.
3. Copy toàn bộ nội dung trong file `backend_script.gs` của dự án này và dán vào trình soạn thảo Apps Script (ghi đè lên file `Mã.gs` hoặc `Code.gs` mặc định).
4. Lưu ý: Nếu trong code `backend_script.gs` có hằng số `SHEET_ID`, hãy sửa nó thành ID file Google Sheets của bạn. *(ID nằm trong URL của file Sheets: `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`)*.
5. Bấm nút 💾 **Lưu (Save)**.
6. **Cấp quyền & Triển khai API (Deploy):**
   - Bấm nút xanh **Triển khai (Deploy)** ở góc trên bên phải > Chọn **Triển khai mới (New deployment)**.
   - Nhấn vào biểu tượng ⚙️ (bánh răng) và chọn loại là **Ứng dụng web (Web app)**.
   - Điền mô tả (VD: "API v1").
   - Mục **Thực thi dưới dạng (Execute as)**: Bắt buộc chọn "Tôi" (Me).
   - Mục **Ai có quyền truy cập (Who has access)**: Bắt buộc chọn "Bất kỳ ai" (Anyone).
   - Bấm **Triển khai (Deploy)**. Hệ thống sẽ yêu cầu cấp quyền truy cập (Authorize access). Chọn tài khoản Google của bạn -> `Advanced (Nâng cao)` -> `Go to... (Đi tới...)` -> `Allow (Cho phép)`.
7. Triển khai hoàn tất, hãy **Copy URL Ứng dụng web (Web app URL)**. Trông nó sẽ giống như thế này: `https://script.google.com/macros/s/AKfycb.../exec`.

*(Lưu ý quan trọng: Mỗi khi bạn sửa code trong Apps Script, bạn BẮT BUỘC phải thực hiện lại quy trình Triển khai mới (New deployment) thì các thay đổi mới có hiệu lực).*

### Bước 3: Cấu hình Frontend (Máy tính của bạn)
1. Mở Terminal/Command Prompt, tải dự án về máy:
   ```bash
   git clone <URL_CUA_REPO>
   cd honhaminh
   ```
2. Cài đặt các thư viện Node.js cần thiết (Yêu cầu đã cài Node.js):
   ```bash
   npm install
   ```
3. Khai báo biến môi trường:
   - Tạo một file tên là `.env` ngay tại thư mục gốc của dự án.
   - Mở file `.env` và dán URL API mà bạn đã copy ở Bước 2 vào như sau:
   ```env
   VITE_GAS_URL=https://script.google.com/macros/s/<ID_CUA_BAN>/exec
   VITE_FAMILY_TITLE="Gia Phả Dòng Họ..."
   VITE_FAMILY_SUBTITLE="Quê quán / Tên nhánh..."
   ```

### Bước 4: Chạy & Trải Nghiệm
Khởi động môi trường phát triển (Dev server) bằng lệnh:
```bash
npm run dev
```
Trình duyệt sẽ hiển thị địa chỉ local (thường là `http://localhost:5173`). Bạn click vào đó để sử dụng phần mềm. Mọi dữ liệu bạn thêm/sửa/xóa giờ đây sẽ được lưu thẳng vào Google Sheets của bạn!

---

## 🛠️ Đưa lên Internet (Production Deployment)
Khi bạn đã nhập xong dữ liệu và muốn gửi link web cho họ hàng cùng xem:
1. Mở terminal, chạy lệnh đóng gói dự án:
   ```bash
   npm run build
   ```
2. Hệ thống sẽ tự động nén code và tạo ra thư mục `dist`.
3. Bạn mang toàn bộ nội dung trong thư mục `dist` này upload lên các dịch vụ lưu trữ Web tĩnh Miễn Phí như **Vercel**, **Netlify**, hoặc **GitHub Pages**.
4. Xong! Bạn sẽ có một đường link website xịn xò để gửi cho mọi người.
