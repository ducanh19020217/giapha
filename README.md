# 🌳 Gia Phả | Genealogy Management App

Một ứng dụng web quản lý gia phả dòng họ chuyên nghiệp, hiện đại. Sử dụng React, Vite, TailwindCSS cho Frontend và Google Apps Script (Google Sheets) làm Backend Serverless.

## 🌟 Tính năng nổi bật
- **Giao diện Premium (Rich Aesthetics):** Thiết kế Glassmorphism sang trọng, tông màu vàng đồng/gỗ cổ điển phù hợp với tính trang nghiêm của gia phả.
- **Cây Phả Hệ Trực Quan:** Vẽ sơ đồ phả hệ nhiều đời tự động. Hỗ trợ hiển thị thành viên gốc, người phối ngẫu (vợ/chồng), con nuôi, con riêng.
- **Công cụ xưng hô (Kinship Calculator):** Tự động tính toán vai vế và cách xưng hô chuẩn xác giữa 2 thành viên bất kỳ (áp dụng linh hoạt cho cả quan hệ huyết thống và quan hệ qua vợ/chồng chéo thế hệ).
- **Lịch sự kiện & Báo tử:** Tự động tính toán ngày giỗ, lịch sinh nhật. Quản lý hồ sơ người đã khuất tiện lợi. Admin có thể thêm sự kiện tùy chỉnh (Giỗ Tổ, Họp Họ...) dùng chung cho cả dòng họ hoặc gắn riêng cho một thành viên.
- **Âm lịch & Dương lịch song song:** Mọi ngày sinh/ngày mất/sự kiện đều có thể nhập theo Dương lịch hoặc Âm lịch; hệ thống tự quy đổi qua lại và hiển thị cả 2 loại lịch trên Lịch Sự Kiện (đúng phong tục: ngày giỗ theo Âm lịch sẽ tự "dời" ngày Dương lịch tương ứng mỗi năm).
- **Ảnh đại diện lưu trên Google Drive:** Admin upload ảnh trực tiếp từ trang hồ sơ; ảnh được tự động resize xuống ~500px (WebP, hoặc JPEG nếu trình duyệt cũ không hỗ trợ) rồi lưu vào thư mục `GiaPha_Avatars` trên Drive của tài khoản đang chạy Script — không cần dịch vụ lưu trữ ảnh bên ngoài.
- **Đăng nhập đa tài khoản:** Mỗi chi/nhánh có thể có 1 tài khoản quản trị riêng (thay vì dùng chung 1 mật khẩu). Mật khẩu được băm (SHA-256 + salt) trước khi lưu, có khóa tạm sau 5 lần đăng nhập sai.
- **Thùng rác (xóa mềm):** Xóa thành viên/sự kiện giờ chỉ ẩn đi, khôi phục lại được trong "Trang Quản Trị" — không còn mất dữ liệu do xóa nhầm. Có nút "Xóa vĩnh viễn" riêng nếu thực sự muốn xóa hẳn.
- **Nhật ký thao tác:** Ghi lại ai đã thêm/sửa/xóa gì và khi nào, xem trong "Trang Quản Trị".
- **Đề xuất chỉnh sửa từ khách:** Người xem không có tài khoản Admin vẫn có thể gửi đề xuất sửa 1 hồ sơ (tên, ngày sinh, nghề nghiệp, tiểu sử...); Admin duyệt trong "Trang Quản Trị" trước khi áp dụng thật.
- **Thống kê dòng họ:** Trang tổng quan số thành viên, số đời, tỷ lệ nam/nữ, số người còn sống/đã khuất, tuổi thọ trung bình, số thành viên theo từng thế hệ.
- **Sao lưu tự động & Nhắc lịch qua Telegram:** Tự động sao lưu Google Sheet hàng tuần sang Drive; nhắc lịch giỗ/sinh nhật có thể gửi qua Telegram Bot thay vì (hoặc thêm vào) email.

---

## 🚀 Hướng dẫn Cài đặt & Cấu hình cho Người Mới

Ứng dụng này sử dụng **Google Sheets** làm cơ sở dữ liệu và **Google Apps Script (GAS)** làm API Backend. Cấu trúc này giúp bạn **không mất chi phí duy trì Server hay Database**.

### Bước 1: Tạo file Google Sheets trên Drive
1. Vào [Google Drive](https://drive.google.com) (khuyên dùng tài khoản chung của dòng họ).
2. Bấm **+ Mới (New)** > **Google Trang tính (Google Sheets)** > **Bảng tính trống (Blank spreadsheet)**.
3. Đổi tên file (VD: `GiaPha_Database`).

> Bạn **không cần** tự tạo các Sheet hay tiêu đề cột. Script sẽ tự tạo đầy đủ các Sheet `Members`, `Spouses`, `Events`, `Users`, `Sessions`, `AuditLog`, `PendingEdits` kèm tiêu đề cột ở Bước 2.

### Bước 2: Cấu hình Backend (Google Apps Script)
1. Mở file Google Sheets vừa tạo.
2. Trên thanh menu, chọn **Tiện ích mở rộng (Extensions)** > **Apps Script**.
3. Copy toàn bộ nội dung trong file `backend_script.gs` của dự án này và dán vào trình soạn thảo Apps Script (ghi đè lên file `Mã.gs` hoặc `Code.gs` mặc định).
   - Script được gắn trực tiếp vào file Sheet này nên **không cần điền ID của Sheet**.
   - Nên sửa hằng số `ADMIN_PASSWORD` ở đầu file thành mật khẩu riêng trước khi chạy bước tiếp theo.
4. Bấm nút 💾 **Lưu (Save)**.
5. **Khởi tạo dữ liệu:** Ở dropdown chọn hàm trên thanh công cụ, chọn **`runOneTimeSetup`** > bấm **Chạy (Run)** (chỉ 1 lần).
   - Lần đầu Google sẽ yêu cầu cấp quyền: chọn tài khoản -> `Advanced (Nâng cao)` -> `Go to... (Đi tới...)` -> `Allow (Cho phép)`.
   - Quay lại tab Google Sheets, bạn sẽ thấy các Sheet đã được tạo và tài khoản đăng nhập `admin` đã có trong Sheet `Users`. (Sheet `Spouses` sẽ tự xuất hiện khi app đọc dữ liệu lần đầu.)
6. **Triển khai API (Deploy):**
   - Bấm nút xanh **Triển khai (Deploy)** ở góc trên bên phải > Chọn **Triển khai mới (New deployment)**.
   - Nhấn vào biểu tượng ⚙️ (bánh răng) và chọn loại là **Ứng dụng web (Web app)**.
   - Điền mô tả (VD: "API v1").
   - Mục **Thực thi dưới dạng (Execute as)**: Bắt buộc chọn "Tôi" (Me).
   - Mục **Ai có quyền truy cập (Who has access)**: Bắt buộc chọn "Bất kỳ ai" (Anyone).
   - Bấm **Triển khai (Deploy)**. Nếu được hỏi cấp quyền lần nữa, làm tương tự như trên.
7. Triển khai hoàn tất, hãy **Copy URL Ứng dụng web (Web app URL)**. Trông nó sẽ giống như thế này: `https://script.google.com/macros/s/AKfycb.../exec`.

*(Lưu ý quan trọng: Mỗi khi sửa code trong Apps Script, bạn phải cập nhật lại bản triển khai thì thay đổi mới có hiệu lực: **Triển khai > Quản lý phiên bản triển khai (Manage deployments)** > bấm ✏️ > **Phiên bản (Version): New version** > **Triển khai**. Cách này giữ nguyên URL web app. Nếu tạo "Triển khai mới", URL sẽ đổi và phải cập nhật lại file `.env`.)*

*(Lưu ý về quyền: tính năng upload ảnh đại diện dùng Google Drive, nên Google có thể yêu cầu cấp quyền thêm — làm tương tự bước `Advanced` -> `Go to...` -> `Allow` ở trên.)*

### Bước 3: Cấu hình & Chạy Frontend (Máy tính của bạn)
Yêu cầu: đã cài [Node.js](https://nodejs.org) phiên bản 20 trở lên (kiểm tra bằng lệnh `node -v`).

1. Mở Terminal/Command Prompt, tải dự án về máy:
   ```bash
   git clone <URL_CUA_REPO>
   cd giapha
   ```
2. Cài đặt các thư viện cần thiết (chỉ cần làm lần đầu, hoặc khi có thư viện mới):
   ```bash
   npm install
   ```
3. Khai báo biến môi trường:
   - Tạo một file tên là `.env` ngay tại thư mục gốc của dự án.
   - Dán URL API đã copy ở Bước 2 vào như sau:
   ```env
   VITE_GAS_URL=https://script.google.com/macros/s/<ID_CUA_BAN>/exec
   VITE_FAMILY_TITLE="Gia Phả Dòng Họ..."
   VITE_FAMILY_SUBTITLE="Quê quán / Tên nhánh..."
   ```
   - Mỗi lần sửa file `.env`, phải tắt dev server (Ctrl + C) rồi chạy lại mới có hiệu lực.

### Bước 4: Chạy & Trải Nghiệm
Khởi động môi trường phát triển (Dev server) bằng lệnh:
```bash
npm run dev
```
Terminal sẽ hiển thị địa chỉ:
- `Local: http://localhost:5173` — mở trên chính máy tính đang chạy.
- `Network: http://192.168.x.x:5173` — mở trên điện thoại/máy khác **cùng mạng Wi-Fi** để thử giao diện mobile.

Mọi dữ liệu bạn thêm/sửa/xóa sẽ được lưu thẳng vào Google Sheets của bạn. Để tắt dev server, bấm **Ctrl + C** trong Terminal.

Đăng nhập Admin lần đầu bằng tài khoản mặc định: **username `admin`**, **mật khẩu = giá trị hằng số `ADMIN_PASSWORD`** trong `backend_script.gs` (mặc định là `admin`) — vào **Trang Quản Trị > Đổi mật khẩu** để đổi ngay sau khi đăng nhập lần đầu.

---

## ⚠️ Nâng cấp từ bản cũ (đã cài trước khi có Thùng rác/Đăng nhập đa tài khoản/...)

Nếu bạn đã có sẵn 1 file Google Sheets + Apps Script đang chạy từ trước, làm theo các bước sau để cập nhật an toàn, KHÔNG mất dữ liệu cũ:

1. Mở Google Sheets của bạn > **Tiện ích mở rộng > Apps Script**.
2. Chọn toàn bộ code cũ, xóa đi, dán đè bằng toàn bộ nội dung file `backend_script.gs` mới trong dự án này. Bấm **Lưu**.
3. Ở dropdown hàm trên thanh công cụ, chọn **`runOneTimeSetup`** rồi bấm **Run** (chỉ 1 lần). Hàm này tự tạo các Sheet mới (`Users`, `Sessions`, `AuditLog`, `PendingEdits`) và tự thêm các cột mới (`isDeleted`, `telegramChatId`...) vào Sheet `Members`/`Events` cũ — dữ liệu thành viên hiện có không bị đụng tới.
   - Hàm này cũng tự tạo 1 tài khoản đăng nhập mặc định: username `admin`, mật khẩu = giá trị `ADMIN_PASSWORD` hiện có trong code của bạn. **Đăng nhập xong nhớ đổi mật khẩu ngay** (Trang Quản Trị > Đổi mật khẩu).
4. Bấm **Triển khai > Quản lý phiên bản triển khai (Manage deployments)** > bấm biểu tượng ✏️ ở bản deploy đang dùng > **Phiên bản (Version): New version** > **Triển khai (Deploy)**. (Không cần tạo "New deployment" mới vì URL web app sẽ không đổi — chỉ cần cập nhật phiên bản của deployment hiện có.)
5. Kéo code mới của Frontend về (`git pull` hoặc tải lại project), chạy lại `npm install` (nếu có thư viện mới) rồi `npm run dev`/`npm run build` như bình thường — không cần đổi gì trong file `.env`.

---

## 🔔 Nhắc lịch Giỗ / Sinh nhật qua Email & Telegram (Tùy chọn)

Vì Backend chạy trên Google Apps Script, nó vẫn hoạt động được trên server của Google kể cả khi không ai mở web app, nên hoàn toàn có thể tự động gửi nhắc lịch mà không cần thêm Server nào khác.

1. **Điền thông tin nhận nhắc:** Mở hồ sơ một thành viên trên web (cần đăng nhập Admin) > **Sửa hồ sơ** > điền vào ô **Email liên hệ** và/hoặc **Telegram Chat ID**.
   - Nếu Sheet của bạn được tạo trước khi có các tính năng này, chạy hàm `runOneTimeSetup` trong Apps Script editor (xem mục "Nâng cấp từ bản cũ" ở trên) để tự thêm cột còn thiếu.
   - Để nhận qua Telegram: tạo 1 Bot miễn phí qua [@BotFather](https://t.me/BotFather) trên Telegram để lấy Token, điền vào hằng số `TELEGRAM_BOT_TOKEN` trong `backend_script.gs`, rồi Triển khai lại. Mỗi thành viên muốn nhận tin thì nhắn cho Bot đó 1 tin bất kỳ, rồi lấy "Chat ID" của mình (VD: qua Bot [@userinfobot](https://t.me/userinfobot)) điền vào hồ sơ.
2. **Bật gửi tự động:** Trong Apps Script editor, chọn hàm `createDailyReminderTrigger` ở dropdown rồi bấm **Run** (chỉ 1 lần). Lần đầu chạy, Google sẽ yêu cầu cấp quyền gửi email thay bạn — chọn tài khoản > `Advanced` > `Go to...` > `Allow`.
3. Từ đó, mỗi ngày lúc khoảng 7h sáng, hệ thống sẽ tự kiểm tra và gửi nhắc tới tất cả người có điền email/Telegram Chat ID nếu có sinh nhật/ngày giỗ/sự kiện tùy chỉnh (Giỗ Tổ, Họp Họ...) nào trong vòng 3 ngày tới (chỉnh hằng số `REMINDER_DAYS_AHEAD` trong `backend_script.gs` nếu muốn đổi số ngày).
4. Muốn gửi thử ngay để kiểm tra: chọn hàm `checkAndSendReminders` rồi bấm **Run**.

*(Lưu ý: Gmail cá nhân giới hạn ~100 email/ngày; tài khoản Google Workspace giới hạn ~1500 email/ngày — thừa sức cho quy mô một dòng họ.)*

---

## 🗑️ Thùng rác, 📜 Nhật ký, 📝 Đề xuất chỉnh sửa, 👥 Tài khoản (Trang Quản Trị)

Đăng nhập Admin > bấm nút **"Trang Quản Trị"** ở Trang Chủ để vào khu vực quản trị mở rộng:

- **Đề xuất chờ duyệt:** Xem các đề xuất chỉnh sửa hồ sơ do khách gửi lên (nút "Đề xuất chỉnh sửa" trên trang hồ sơ mỗi thành viên) — Duyệt để áp dụng thật vào Sheet, hoặc Từ chối.
- **Thùng rác:** Khôi phục thành viên/sự kiện lỡ xóa, hoặc xóa vĩnh viễn nếu chắc chắn.
- **Tài khoản:** Thêm/xóa tài khoản đăng nhập (VD: cấp riêng cho mỗi chi/nhánh trong họ).
- **Nhật ký thao tác:** Xem lại ai đã thêm/sửa/xóa gì và khi nào (200 hoạt động gần nhất; xem đầy đủ hơn thì mở thẳng Sheet `AuditLog`).
- **Đổi mật khẩu:** Đổi mật khẩu tài khoản đang đăng nhập.

## 💾 Sao lưu tự động

Vì toàn bộ dữ liệu chỉ nằm trong 1 Google Sheet, hãy bật sao lưu định kỳ để phòng rủi ro thao tác nhầm hoặc mất file gốc: trong Apps Script editor, chọn hàm `createWeeklyBackupTrigger` rồi bấm **Run** (chỉ 1 lần). Từ đó mỗi Thứ Hai lúc ~3h sáng, hệ thống tự tạo 1 bản sao Spreadsheet vào thư mục Drive `GiaPha_Backups` (tự động giữ lại 8 bản gần nhất, xóa bớt bản cũ).

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
