# 🌳 Gia Phả | Genealogy Management App

Một ứng dụng web quản lý gia phả dòng họ chuyên nghiệp, hiện đại. Sử dụng React, Vite, TailwindCSS cho Frontend và Google Apps Script (Google Sheets) làm Backend Serverless.

## 🌟 Tính năng nổi bật
- **Giao diện Premium (Rich Aesthetics):** Thiết kế Glassmorphism sang trọng, tông màu vàng đồng/gỗ cổ điển phù hợp với tính trang nghiêm của gia phả.
- **Cây Phả Hệ Trực Quan:** Vẽ sơ đồ phả hệ nhiều đời tự động. Hỗ trợ hiển thị thành viên gốc, người phối ngẫu (vợ/chồng), con nuôi, con riêng.
- **Công cụ xưng hô (Kinship Calculator):** Tự động tính toán vai vế và cách xưng hô chuẩn xác giữa 2 thành viên bất kỳ (áp dụng linh hoạt cho cả quan hệ huyết thống và quan hệ qua vợ/chồng chéo thế hệ).
- **Lịch sự kiện & Báo tử:** Tự động tính toán ngày giỗ, lịch sinh nhật. Quản lý hồ sơ người đã khuất tiện lợi. Admin có thể thêm sự kiện tùy chỉnh (Giỗ Tổ, Họp Họ...) dùng chung cho cả dòng họ hoặc gắn riêng cho một thành viên.
- **Âm lịch & Dương lịch song song:** Mọi ngày sinh/ngày mất/sự kiện đều có thể nhập theo Dương lịch hoặc Âm lịch; hệ thống tự quy đổi qua lại và hiển thị cả 2 loại lịch trên Lịch Sự Kiện (đúng phong tục: ngày giỗ theo Âm lịch sẽ tự "dời" ngày Dương lịch tương ứng mỗi năm).

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

## 🔔 Nhắc lịch Giỗ / Sinh nhật qua Email (Tùy chọn)

Vì Backend chạy trên Google Apps Script, nó vẫn hoạt động được trên server của Google kể cả khi không ai mở web app, nên hoàn toàn có thể tự động gửi email nhắc lịch mà không cần thêm Server nào khác.

1. **Điền email liên hệ:** Mở hồ sơ một thành viên trên web (cần đăng nhập Admin) > **Sửa hồ sơ** > điền vào ô **Email liên hệ**. Ai có điền email sẽ nhận được thư nhắc lịch.
   - Nếu Sheet của bạn được tạo **trước khi** có tính năng này, hãy mở Apps Script editor, chọn hàm `ensureEmailColumn` ở dropdown trên thanh công cụ rồi bấm **Run** (chỉ 1 lần) để thêm cột `email` vào Sheet `Members`.
2. **Bật gửi tự động:** Trong Apps Script editor, chọn hàm `createDailyReminderTrigger` ở dropdown rồi bấm **Run** (chỉ 1 lần). Lần đầu chạy, Google sẽ yêu cầu cấp quyền gửi email thay bạn — chọn tài khoản > `Advanced` > `Go to...` > `Allow`.
3. Từ đó, mỗi ngày lúc khoảng 7h sáng, hệ thống sẽ tự kiểm tra và gửi email tới tất cả người có điền email nếu có sinh nhật/ngày giỗ/sự kiện tùy chỉnh (Giỗ Tổ, Họp Họ...) nào trong vòng 3 ngày tới (chỉnh hằng số `REMINDER_DAYS_AHEAD` trong `backend_script.gs` nếu muốn đổi số ngày).
4. Muốn gửi thử ngay để kiểm tra: chọn hàm `checkAndSendReminders` rồi bấm **Run**.

*(Lưu ý: Gmail cá nhân giới hạn ~100 email/ngày; tài khoản Google Workspace giới hạn ~1500 email/ngày — thừa sức cho quy mô một dòng họ.)*

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
