# Bật chơi online (đăng nhập Google)

Game dùng **Firebase** của Google (gói miễn phí Spark) để:
- đăng nhập bằng tài khoản Google,
- lưu xu, cấp, nhiệm vụ lên mây (đổi máy vẫn còn),
- bảng xếp hạng người chơi thật và danh sách ai đang online,
- phòng chơi chung bàn với bạn bè.

Khi chưa cấu hình, game vẫn chơi offline như cũ. Mở bằng file (double-click) cũng luôn là offline; chơi online cần bản web `https://dorisle-uxui.github.io/heo-con-club/`.

## Các bước (làm một lần)

1. Vào https://console.firebase.google.com, đăng nhập Google, bấm **Create a project** (Tạo dự án). Đặt tên `heo-con-club`. Tắt Google Analytics cho gọn rồi **Create project**.
2. **Bật đăng nhập Google:** menu trái **Build → Authentication → Get started → Sign-in method → Google → Enable**, chọn email hỗ trợ, **Save**.
3. **Cho phép trang web:** vẫn trong Authentication → tab **Settings → Authorized domains → Add domain**, nhập `dorisle-uxui.github.io`. (`localhost` có sẵn để thử trên máy.)
4. **Tạo cơ sở dữ liệu:** **Build → Firestore Database → Create database**, chọn vùng gần (vd. `asia-southeast1` Singapore), chọn **production mode**, **Create**.
5. **Dán luật bảo mật:** trong Firestore → tab **Rules**, xoá hết, dán toàn bộ nội dung file `firestore.rules` của game, bấm **Publish**.
6. **Lấy cấu hình web:** biểu tượng bánh răng **Project settings → General → Your apps →** nút **`</>`** (Web) → đặt tên app `heo-con-club` → **Register app**. Firebase hiện một đoạn `const firebaseConfig = { apiKey: ..., ... }`.
7. Gửi đoạn `firebaseConfig` đó cho Claude (hoặc tự dán vào `js/firebase-config.js` thay cho `window.HC_FIREBASE = null;`), rồi đẩy lên GitHub.

Đoạn cấu hình này không phải mật khẩu: nó chỉ cho biết dự án nào, ai được đọc/ghi gì là do luật ở bước 5 quyết định.

## Sau khi bật

- Màn đăng nhập có nút **Đăng nhập bằng Google**. Lần đầu, tiến trình đang chơi trên máy được đưa lên mây; các máy khác đăng nhập cùng tài khoản sẽ tải về.
- **Bảng xếp hạng** có các tab Giàu nhất, Cấp cao nhất, Thắng nhiều nhất, Đang online (người thật), tab Thị trấn là bảng cũ với bot.
- Cài đặt hiện tài khoản Google; **Đăng xuất** lưu lên mây trước khi thoát.
- **Tiến Lên → Chơi với bạn:** mở phòng (chọn chế độ, mức cược), gửi mã 6 số hoặc link mời cho bạn bè; ghế trống có máy chơi thay.

## Lưu ý

- Gói miễn phí đủ cho vài trăm người chơi mỗi ngày (50.000 lượt đọc, 20.000 lượt ghi mỗi ngày).
- Xu được tính trên máy người chơi rồi gửi lên, nên người rành kỹ thuật có thể sửa số xu của chính họ. Với game chơi vui giữa bạn bè thì ổn; muốn chống gian lận thật sự cần máy chủ tính điểm (Cloud Functions, cần gói trả phí Blaze).
- Xu trong game là xu ảo, không mua bằng tiền thật và không đổi ra tiền. Nếu sau này muốn bán xu thì cần tìm hiểu quy định pháp luật về trò chơi điện tử trước.
