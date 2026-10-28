# Heo Con Club: bộ asset game bài & game dân gian dễ thương 🐷🃏

Asset miễn phí, phong cách kẹo pastel, cho một cổng game kiểu "chặt heo" với **20 game**:
Tiến Lên, Phỏm, Mậu Binh, Xì Dách, Poker, Bài Cào, Sâm Lốc, Liêng, Bầu Cua, Xóc Đĩa, Tài Xỉu, Cờ Tướng, Cá Ngựa, Cờ Caro, Bài Màu, Lô Tô, Bắn Cá, **Máy Đẩy Xu**, **Gắp Thú** và **Máy Xúc Vé**.
Khoảng 13.700 file, 387 MB, trong đó có 88 model 3D thật chạy ngay trong trình duyệt.

**Chơi online:** https://dorisle-uxui.github.io/heo-con-club/ (GitHub Pages, lần đầu tải hơi lâu).

**Bắt đầu từ `index.html`** (mở bằng double-click): màn loading → đăng nhập / đăng ký → thị trấn 3D có đường phố, cây cối, xe chạy, người đi dạo. Mỗi game là một cửa tiệm trên phố.

## Mở xem nhanh

| File | Là gì |
|---|---|
| `index.html` | **Cửa vào chính.** Màn loading, đăng nhập và đăng ký, rồi thị trấn 3D tràn màn hình. Có HUD, bản đồ nhỏ, nhiệm vụ, quà ngày, cửa hàng, xếp hạng, hộp thư và màn hướng dẫn lần đầu. |
| `pusher.html` | **Máy Đẩy Xu 3D**: 3 máy, khay đẩy chạy thật, ngắm và thả xu, cuộn vé, thẻ bài, Heo Vàng jackpot, đổi vé lấy xu. |
| `tien-len.html` | **Tiến Lên Miền Nam chơi thật, đủ luật**, đấu với 3 máy. Có chọn bàn 4 mức cược, chia bài, đồng hồ lượt, chặt heo, bảng kết quả, tự chuyển ván. Có xu 3D bay, đồng hồ cát 3D và linh vật 3D. Xu dùng chung với sảnh. |
| `play3d.html?game=<key>` | **18 game 3D chơi thật**: Phỏm, Mậu Binh, Xì Dách, Poker, Bài Cào, Sâm Lốc, Liêng, Bầu Cua, Xóc Đĩa, Tài Xỉu, Cờ Tướng, Cá Ngựa, Cờ Caro, Bài Màu, Lô Tô, Bắn Cá, Gắp Thú, Máy Xúc Vé. Mỗi game có luật đầy đủ (nút **?**), game bài và cờ có bot. |
| `lobby.html` | **Bản đồ menu**: ảnh chụp thị trấn từ trên cao, mỗi cửa tiệm là một ghim. Lọc theo loại game, bấm ghim để xem thông tin rồi **CHƠI NGAY** hoặc **Tới tiệm**. |
| `lobby-classic.html` | Sảnh 2D cũ (linh vật 3D, quà ngày, lì xì, bản chơi thử ngắn), giữ lại để tham khảo. |
| `screenshots/` | 31 ảnh: thị trấn 3D, đăng nhập, loading, bản đồ menu, hộp thư, Máy Đẩy Xu, từng game, Tiến Lên. |
| `assets/manifest.json` | Chỉ mục đường dẫn mọi thứ, dùng để load trong code. |
| `CREDITS.md` | License từng bộ. **Đọc trước khi phát hành.** |
| `tools/` | Script Python đã dùng để vẽ UI, asset game, icon (cần Pillow + numpy). Sửa màu rồi chạy lại, ví dụ `python3 tools/gen_ui.py assets`. Có thêm `pack3d.js` và `render3d.html` cho model 3D. |

Mọi trang mở bằng double-click được. Riêng `lobby-classic.html` cần một web server tĩnh vì nó tải âm thanh và JSON:

```bash
python3 -m http.server 8765
```

## Thị trấn 3D (`index.html`)

- **Loading thật:** nền thế giới mây kẹo, logo Heo Con Club, thanh tiến độ chạy theo số model đã tải, có heo chạy trên thanh, mẹo chơi đổi liên tục.
- **Đăng nhập / đăng ký:** nền thị trấn vẽ tay, bố cục 2 cột (logo bên trái, khung đăng nhập bên phải). Có tên đăng nhập, tên trong game, mật khẩu có thanh độ mạnh, chọn linh vật 3D. Có nút chơi ngay bằng tài khoản khách.
  - Tài khoản thường chỉ lưu trong trình duyệt này. Mật khẩu được băm PBKDF2 có salt, không lưu dạng chữ.
  - Mỗi tài khoản có xu, vé, linh vật, nhiệm vụ riêng. Khách dùng dữ liệu cũ.
  - Nút **Đăng nhập bằng Google** (bản web, sau khi bật Firebase): lưu tiến trình lên mây, đổi máy vẫn còn. Xem mục *Chơi online* bên dưới.
- **Nhiệm vụ & cấp độ** (`js/hc-progress.js`, dùng chung cho mọi game):
  - Mỗi ván, mỗi lượt cược, mỗi con cá bắn được đều cộng kinh nghiệm. Lên cấp có quà, có danh hiệu, cứ 2 cấp mở thêm avatar. Cấp VIP tính theo tổng xu đã cược.
  - 3 nhiệm vụ ngày (dễ / vừa / khó, được đổi 1 lần), 4 nhiệm vụ tuần, rương thưởng khi xong hết, thành tựu 4 bậc, album cá Bắn Cá.
  - **Lễ hội Heo Con:** mùa 14 ngày, 30 mốc quà, điểm lấy từ nhiệm vụ.
  - **Vòng quay** (1 lượt free mỗi ngày), **Heo đất** (2% tiền cược nuôi heo, đập khi đủ 50K từ cấp 3), **Cứu trợ** 200K khi còn dưới 20K xu (3 lần/ngày).
  - Bàn cao cấp mở theo cấp: Cao Thủ cấp 5, Đại Gia cấp 10, Hoàng Gia cấp 15.
  - `node tests/progress.test.js` kiểm tra nhiệm vụ, cấp, thành tựu, lễ hội, vòng quay, heo đất.
- **Thị trấn:** quảng trường đài phun nước, vòng xuyến, 4 dãy phố, 25 cửa tiệm có biển hiệu, mái hiên sọc và đồ trang trí 3D xoay trên mái.
  - Hàng trăm cây (có cây hoa anh đào, tím, vàng), đèn đường, ghế đá, hàng rào, nhà dân, sân chơi, cổng chào "HEO CON CLUB".
  - Xe hơi chạy vòng xuyến, người đi dạo có tên và biết nói, chim bồ câu bay khi bạn lại gần, mây trôi đổ bóng.
- **Điều khiển:** chạm đất để đi, chạm cửa tiệm để tự đi tới cửa rồi vào game, W A S D để chạy, kéo để xoay, cuộn hoặc chụm 2 ngón để phóng to, bấm bản đồ nhỏ để đi tới chỗ đó.
- **Giao diện:** cảnh 3D tràn kín cửa sổ ở mọi tỉ lệ. HUD nhỏ gọn bám theo các cạnh để chừa chỗ cho game. Popup to hơn HUD một chút cho dễ đọc và tự thu nhỏ khi cửa sổ hẹp.
  - **Cài đặt → Cỡ giao diện:** Nhỏ / Vừa / Lớn, áp dụng cho thị trấn, bản đồ, máy đẩy xu và 18 game 3D.
- **Tiếng Anh:** Cài đặt → 🌐 Ngôn ngữ (Tiếng Việt / English), hoặc thêm `?lang=en` vào link. `js/hc-i18n.js` dịch chữ trên trang, chữ vẽ trên canvas và biển hiệu 3D theo từ điển `js/i18n-en.js`; icon game có bản chữ tiếng Anh trong `games/lobby-icons-en/` (`HC_ICON_LANG=en python3 -E tools/gen_icons.py assets`, rồi `python3 tools/pack_tex.py assets town-en`). Mở trang với `&i18nlog=1` rồi đọc `window.__i18nMiss` để xem câu nào chưa có bản dịch.
- **Sảnh 2D và Tiến Lên** có nút về thị trấn. Vào game từ thị trấn thì nút quay lại sẽ đưa bạn về thị trấn.

## Máy Đẩy Xu (`pusher.html`)

- 3 máy: **Máy Hồng** (1.000 xu/lượt, máy mới), **Máy Vàng** (5.000, có người vừa chơi, vé sát mép), **Máy Kim Cương** (20.000, có Heo Vàng).
- Khay đẩy chạy tới lui. Xu thả lúc khay lùi hết cỡ rơi ngay trước khay nên cú đẩy sau mạnh nhất. Rê chuột hoặc kéo để ngắm, chạm hoặc Space để thả, có chế độ tự thả.
- **Ô may mắn + vòng quay 3 ô:** cái cốc hồng chạy trên nóc khay; thả xu lọt vào là được 1 lượt quay (giữ tối đa 10). Ba hình giống nhau: Mưa xu, Thêm vé, Thẻ bài, **Tường chắn** 20 giây (che hai góc, không mất xu), **Đẩy mạnh** 20 giây, hoặc **Jackpot**. Hai ô đầu giống nhau thì ô cuối quay chậm kèm chữ REACH!
- **Hũ Heo Vàng:** hũ jackpot riêng từng máy, lớn dần theo mỗi xu thả. Ba hình heo trên vòng quay ăn cả hũ.
- **Bộ thẻ:** thẻ bài rơi ra là lá cụ thể. Gom đủ **Tứ Quý Át** (thưởng 25 lần cược) hoặc **Sảnh Cơ** 10-J-Q-K-A (35 lần). Thẻ trùng đổi thành vé.
- **Fever:** mỗi lần trúng thắp 1 trong 6 đèn; đủ 6 đèn thì 10 giây xu vàng, mỗi xu rơi ra được nhân đôi.
- Xu rớt mép trước là thắng, rớt vào khe hai góc là mất. Máy nhớ trạng thái khi bạn rời đi.
- Vật lý và toàn bộ luật nằm trong `js/pusher-sim.js` (`PusherSim.Game`, có seed). `node tests/pusher.test.js` (55 phép kiểm) đo tỉ lệ trả thưởng khoảng 92–96% tuỳ cách chơi.

## 18 game 3D (`play3d.html`)

- Mở từ cửa tiệm trong thị trấn, từ bản đồ, hoặc thẳng bằng link `play3d.html?game=bau-cua`.
  - Key: phom, mau-binh, xi-dach, poker, bai-cao, sam-loc, lieng, bau-cua, xoc-dia, tai-xiu, co-tuong, co-ca-ngua, co-caro, bai-mau, lo-to, ban-ca, gap-thu, xuc-ve.
- Bàn, bài, chip, xúc xắc, bát đĩa đều là 3D. Mỗi game có nút **?** xem luật, bot đánh cùng, xu dùng chung với thị trấn.
- **Chọn bàn** (`js/t3-lobby.js`): mỗi game mở ra màn 5 hạng bàn Tập Sự, Bình Dân, Cao Thủ, Đại Gia, Hoàng Gia. Bàn quyết định mức cược và độ khó của bot; bàn cao cần đủ xu và đủ cấp.
- **Chế độ chơi** (luật thật, có test): Phỏm có / không gửi bài, Sâm Lốc 4 người / Solo, Mậu Binh thường / có thưởng chi, Poker không giới hạn / giới hạn hũ, Liêng tố tự do / tối đa bằng hũ, Xì Dách nhà con / làm cái, Bài Cào nhà cái bot / xoay cái, Bầu Cua · Xóc Đĩa · Tài Xỉu thường 30 giây / nhanh 12 giây.
- Link thẳng vào một bàn: `play3d.html?game=poker&room=binh-dan&mode=pl`.
- **Bắn Cá:**
  - Nhấn hoặc giữ vào con cá để **khoá mục tiêu**; đạn tự đuổi theo nên bắn là trúng.
  - Mỗi con cá có thanh máu, cá to nhiều máu hơn nhưng thưởng lớn hơn.
  - Nút **TỰ BẮN** tự chọn con đáng bắn. Tính dài hạn trả lại khoảng 92–95% số xu bắn ra.
- **Gắp Thú** (`gap-thu`): máy gắp thú bông 3D, 3 máy 1K / 5K / 20K một lượt.
  - Đưa càng bằng nút mũi tên, phím mũi tên / WASD hoặc kéo trên màn hình, **GẮP!** (Space) để thả. Nút **Nhìn ngang** đổi góc để canh chiều sâu. Mỗi lượt 20 giây.
  - Lực kẹp mỗi lượt ngẫu nhiên, thú hiếm nặng hơn: kẹp yếu thì tuột ngay, vừa vừa thì rơi giữa đường (nằm gần lỗ hơn), rơi trúng miệng lỗ vẫn được quà. Trượt 10 lần tặng 1 lượt miễn phí.
  - 9 thú bông (vịt, cún, gấu của bộ KayKit và gà, heo, thỏ, mèo, gấu trúc, Heo Vàng dựng bằng khối), 4 độ hiếm trả xu, vé và 💎. Bảng "Đã gắp được" lưu bộ sưu tập.
  - Luật thuần trong `js/games3d/rules/gap-thu.js`; `node tests/gap-thu.test.js` chơi hàng trăm nghìn lượt: dài hạn trả lại 85–95% (xu + vé × 500).
- **Máy Xúc Vé** (`xuc-ve`): cánh tay đung đưa trên thùng cuộn vé, bấm **XÚC!** đúng lúc muỗng ở trên đống cao nhất.
  - Muỗng đổ vé lên kệ đẩy (vật lý giống Máy Đẩy Xu). Cuộn rơi mép trước trả đúng giá in trên cuộn: 10K, 20K, 50K, 100K, 200K và Cuộn Vàng 500K. Rơi hai góc thì về thùng.
  - 3 cỡ muỗng 30K / 60K / 120K (tối đa 2 / 4 / 8 cuộn). Vé còn trên kệ được giữ lại cho lần sau, máy nhớ trạng thái.
  - Luật + vật lý trong `js/games3d/rules/xuc-ve.js`; `node tests/xuc-ve.test.js` mô phỏng hàng nghìn lượt xúc: canh giờ tốt trả lại 92–94%, người chơi thường 86–88%, bấm bừa khoảng 50%.
- Link test: `&demo=1` cho máy tự chơi, `&selftest=1` ghi kết quả vào `body[data-selftest]`, `&shot=1` để chụp ảnh.
- Muốn thêm game mới: xem `docs/GAME3D_GUIDE.md`.

## Bản đồ menu (`lobby.html`)

- Ảnh thị trấn chụp từ trên cao, ghim tròn trên từng cửa tiệm, kéo để xem, cuộn hoặc chụm để phóng to.
- Cột trái lọc theo loại game (bài, xúc xắc, cờ, vui khác, tiện ích), cột phải là danh sách tất cả game.
- `lobby.html?sel=xoc-dia` mở sẵn thẻ thông tin của một game.

## Tiến Lên (`tien-len.html`)

`tien-len.html` mở trực tiếp bằng double-click được, không cần server.

**Luật đã làm:**
- Thứ tự 3 → 2, chất ♠ < ♣ < ♦ < ♥. Bộ hợp lệ: rác, đôi, sám cô, tứ quý, sảnh (không có heo), đôi thông.
- Chặn phải cùng loại, cùng số lá, lá lớn nhất lớn hơn. Đã bỏ lượt thì mất quyền tới hết vòng.
- Chặt: 3 đôi thông chặt 1 heo. Tứ quý chặt heo, đôi heo, 3 đôi thông. 4 đôi thông chặt cả tứ quý. Hàng lớn chặt hàng nhỏ.
- Chặt chồng: người bị chặt sau cùng trả hết. Tiền chặt trả khi hết vòng.
- Ván đầu ai có 3♠ đi trước và phải đánh kèm 3♠. Ván sau người về nhất đi trước. Có hưởng sái.
- Tới trắng: tứ quý heo, sảnh rồng, 5 đôi thông, 6 đôi, đồng màu, tứ quý 3 ở ván đầu.
- Cóng, thối heo, thối hàng.
- Tính xu theo mức cược: nhất +3, nhì +1, ba −1, bét −3. Heo đen 1, heo đỏ 2, 3 đôi thông 3, tứ quý 4, 4 đôi thông 5. Cóng phạt thêm 2, tới trắng mỗi người trả 4.

**Chế độ:** Xếp hạng (luật trên), **Đếm lá** (có người hết bài là xong, trả 1 cược mỗi lá còn lại, cóng 26), **Nhất ăn tất** (người nhất ăn mỗi nhà 3 cược), **Miền Bắc** (chặn đồng chất, đôi cùng màu, sảnh đồng chất, không đôi thông, không tới trắng), **Solo 2 người**.

**Chơi với bạn:** nút **Chơi với bạn** ở màn chọn bàn (cần đăng nhập Google trên bản web).
- Mở phòng chọn chế độ và mức cược, được mã 6 số. Bạn bè nhập mã hoặc bấm link mời (`tien-len.html?join=123456`). Ghế trống có máy chơi thay.
- Mọi người chạy cùng một ván: chủ phòng chia bài và xếp thứ tự nước đi, mỗi máy tự vẽ lại từ góc nhìn của mình (`js/tl-online.js`). Ai không đánh trong 28 giây thì chủ phòng đánh thay; chủ phòng thoát thì người khác tự lên làm chủ.
- Thử trên máy không cần Firebase: mở 2 tab `tien-len.html?mockfb=1&mockuser=An` và `…&mockuser=Binh`, đăng nhập Google ở mỗi tab (bản giả lập).

**Điều khiển:**
- Bấm vào lá để chọn, hoặc kéo ngang qua nhiều lá. Nút Đánh sáng lên và ghi tên bộ khi bộ đang chọn đánh được.
- Phím tắt: Space hoặc Enter để đánh, P bỏ lượt, H gợi ý (bấm nhiều lần để đổi gợi ý), S xếp bài theo số hoặc theo bộ, Esc bỏ chọn.
- Mỗi lượt có 20 giây. Hết giờ máy tự bỏ lượt, hoặc tự đánh lá nhỏ nhất nếu bạn đang cầm cái.

**Code và test:**
- `js/tienlen-engine.js`: toàn bộ luật, cách tính tiền và AI, không phụ thuộc giao diện. Dùng lại được cho Node, React, Cocos hay Phaser.
- `node tests/tienlen.test.js`: 9.133 phép kiểm, gồm hàng nghìn ván máy tự đánh ở mọi chế độ. Hiện tất cả đều qua.
- `node tests/tl-online.test.js`: chơi chung bàn: mọi góc nhìn ra cùng kết quả, chủ phòng đánh thay người vắng, đổi chủ phòng giữa ván.
- `node tests/auth.test.js` (tài khoản) và `node tests/pusher.test.js` (máy đẩy xu) cũng đều qua.
- Tự kiểm giao diện: `index.html?selftest=1&screen=town&as=guest` và `pusher.html?machine=1&selftest=1` ghi kết quả vào `body[data-selftest]`.
- `tien-len.html?room=1&uitest=6&speed=turbo`: script đóng vai người chơi, tự bấm qua 6 ván rồi ghi kết quả vào trang.
- Link nhanh: `?room=0..4` vào thẳng một bàn, `?mode=dem-la|nhat-an-tat|mien-bac|solo`, `?seed=N` chia bài cố định, `?auto=1` cho máy đánh thay bạn.

## Giao diện 3D

Lần này giao diện dùng model 3D thật lấy từ các bộ KayKit và Tiny Treats có sẵn trong máy. Tất cả là CC0.

**Trong sảnh (`lobby.html`):**
- Bên trái là linh vật 3D đứng trên bục hồng, có xương và hoạt ảnh. Có 9 linh vật, đổi bằng hai mũi tên: Pháp Sư Tím, Hiệp Sĩ Bạc, Ninja Lá, Cung Thủ, Chiến Binh Gấu, Tiểu Thư Rừng, Gấu Nâu, Cún Vàng, Vịt Bông.
- Bấm vào linh vật thì nó nhảy và nói một câu. Cứ vài giây nó lại tự làm một động tác.
- Xu, sao, tim, kim cương và xúc xắc 3D bay vòng quanh linh vật. Phía sau có vật phẩm 3D trôi nhẹ và nền cầu vồng đổi màu chậm.
- Nút lớn **CHƠI TIẾN LÊN** màu cầu vồng và 4 nút tròn: Quà ngày, Lì xì, Xếp hạng, Cửa hàng.
- Avatar có thêm 9 chân dung 3D. Đổi linh vật trong popup hồ sơ, phần "Linh vật 3D".

**Trong Tiến Lên (`tien-len.html`):**
- Màn chọn bàn có xu 3D xoay trên mỗi bàn, xúc xắc và tim trang trí, linh vật của bạn đứng cạnh nút "Chơi ngay".
- Trong bàn, đồng hồ cát 3D xoay ở ghế đang tới lượt. Mỗi ghế một màu: hồng, xanh bạc hà, xanh trời, vàng chanh.
- Khi chặt heo và cuối ván, xu 3D bay theo đường cong sang người thắng. Bạn về nhất thì mưa xu.
- Bảng kết quả có linh vật của bạn trên bục vàng. Thắng thì nhảy mừng, bét hay cóng thì ngã.

**Cách chạy:**
- Vẫn mở bằng double-click được. Model được nhúng sẵn trong file `.js` nên trình duyệt không chặn.
- Máy không có WebGL thì tự dùng ảnh render sẵn trong `assets/3d/renders/`.
- Trên Mac M1 sảnh chạy khoảng 120 khung hình mỗi giây.

**Code 3D:**
- `js/hc3d.js`: thư viện nhỏ trên three.js. Có sân khấu 3D, tải model, nhân vật có hoạt ảnh, vật phẩm xoay, xu bay, mưa xu và bục đứng.
- `assets/3d/glb/`: 44 file `.glb` gốc, dùng thẳng cho Unity, Godot, Cocos hay Blender.
- `tools/pack3d.js`: đóng gói lại model từ zip KayKit thành `.glb` và `.js`. Chạy bằng `node tools/pack3d.js <thư mục giải nén> assets`.
- `tools/render3d.html`: chụp model ra PNG nền trong suốt, ví dụ `render3d.html?model=adv_mage&mode=portrait&anim=Idle_A`.

```js
const st = new HC3D.Stage(canvas, { width: 560, height: 560, fov: 30, shadows: true });
HC3D.podium(st, 0xff86b8, 0xe0457f);
const mage = await HC3D.character(st, 'adv_mage', { anim: 'Idle_A', scale: 1.3 });
mage.play('Jump_Full_Short', { once: true, then: 'Idle_A' });
st.start();
```

Hoạt ảnh có sẵn cho nhân vật `adv_*`: Idle_A, Idle_B, Interact, Use_Item, PickUp, Throw, Spawn_Ground, Hit_A, Hit_B, Death_A, Death_B, Jump_Full_Short, Running_A và vài kiểu đi.

## Có gì mới ở lần cập nhật trước

- **Asset riêng cho từng game** trong `games/`, tự vẽ, CC0:
  - Bầu Cua: 6 linh vật, ô cược, xúc xắc 3D, bàn cược.
  - Xóc Đĩa: đồng xu đỏ/trắng, bàn Chẵn/Lẻ.
  - Tài Xỉu: xúc xắc 2D 5 màu, xúc xắc 3D, bàn TÀI/XỈU.
  - Cờ Tướng: 2 kiểu quân và bàn, gỗ cổ điển hoặc pastel cute.
  - Các game khác: Cá Ngựa, Caro, Bài Màu 54 lá, Lô Tô 90 bóng + tờ dò, Bắn Cá với pháo 5 cấp, chip mệnh giá 1K–10M, bát và đĩa.
- **17 icon game** 512×512 cho sảnh trong `games/lobby-icons/`.
- **UI cao cấp kiểu kẹo pastel** trong `ui-premium-generated/`:
  - Nút 7 màu, popup, ruy băng, 8 khung avatar VIP, huy hiệu VIP 1–8, thanh tiền, công tắc, tab, thanh tiến trình, 7 thẻ quà ngày, 12 nền sảnh.
  - **40 câu hô** như "CHẶT HEO!", "THỐI 2!", "Ù!", "XÌ BÀNG!", "MẬU BINH!", "TÀI!", "XỈU!", "KINH!", "NỔ HŨ!".
- **Nhân vật xịn hơn:**
  - 106 nhân vật 3D Fluent: ninja, công chúa, tiên, pháp sư, siêu anh hùng, đầu bếp, thú…
  - Kenney Toon: 6 nhân vật × 45 tư thế.
  - Kenney Platformer: 5 nhân vật × 24 tư thế.
  - 30 thú avatar bản mới × 8 kiểu.
  - 8 kiểu avatar DiceBear mới, tổng 16 kiểu × 24.
- **127 emoji động** Noto của Google, có WebP động, Lottie, sprite sheet và ảnh tĩnh.
- Thêm 20 sinh vật biển 3D, 92 vật phẩm game 3D, 2 font chữ Hán cho Cờ Tướng.

## Gợi ý dùng cho đẹp nhất

| Phần | Dùng gì |
|---|---|
| Bộ bài | `cards-heocon/cards/` (CC0, vẽ bằng `tools/gen_cards.py`) |
| Bàn chơi | `bg-tables-generated/with-table/table_scene_sakura.png` hoặc các bản `tet`, `mint`, `sky`… |
| Nền sảnh | `ui-premium-generated/lobby-backgrounds/lobby_dream_1920x1080.png`, có bản dọc 1080×1920 |
| Nút | `ui-premium-generated/buttons/pill_*.png`, kéo giãn được kiểu 9-slice |
| Icon nút tròn | `ui-jelly-pzuh/buttons-pastel/pink/icon_*.png` |
| Avatar + khung | `avatars-dicebear/fun-emoji/png/` + `ui-premium-generated/avatar-frames/frame_gold.png` |
| Nhân vật 3D có hoạt ảnh | `3d/glb/adv_*.glb` + `3d/glb/anim_general.glb`, hoặc ảnh `3d/renders/` |
| Nhân vật 3D ảnh tĩnh | `emoji-fluent-3d/characters/` |
| Thả cảm xúc | `emoji-noto-animated/<tên>/512.webp`, hoặc Lottie / sprite sheet cho engine |
| Câu hô | `ui-premium-generated/callouts/*.png` |
| Font | Grandstander Black (`fonts/GrandstanderBlack-Regular.ttf`, bản tĩnh độ đậm 900 tách từ Grandstander) cho tiêu đề và số, Baloo 2 / Nunito cho chữ thường. Không dùng Cherry Bomb One (vẽ sai Đ và ừ ứ ử ữ ự) và Coiny (chữ V giống hệt U) cho chữ tiếng Việt. |

Âm thanh gợi ý theo sự kiện nằm trong `manifest.recommended.sfx`.

## Chơi online (Google)

- Dùng Firebase gói miễn phí: đăng nhập Google, lưu xu / cấp / nhiệm vụ lên mây, bảng xếp hạng người thật (Giàu nhất, Cấp cao nhất, Thắng nhiều nhất, Đang online) và phòng Tiến Lên chơi với bạn.
- Bật một lần theo `docs/ONLINE_SETUP.md` (tạo dự án Firebase, bật Google, tạo Firestore, dán `firestore.rules`, dán cấu hình vào `js/firebase-config.js`). Chưa bật thì game vẫn chơi offline như cũ; mở bằng file cũng luôn là offline.
- Code: `js/hc-online.js` (đăng nhập, lưu mây, xếp hạng, phòng), `js/firebase-mock.js` (bản giả lập để thử: thêm `?mockfb=1&mockuser=Tên`).
- Xu được tính trên máy người chơi, hợp chơi vui giữa bạn bè. Xu là xu ảo, không mua bán bằng tiền thật.

## Tự tạo ảnh bằng AI

- Prompt sẵn sàng copy: `docs/PROMPTS.md` (hoặc trang có nút sao chép `docs/prompts.html`). 40 prompt phủ toàn bộ hình ảnh game: 30 ảnh bảng 16:9 chứa nhiều món (cá, bộ bài, phỉnh, icon, nút, khung, VIP, biểu cảm, avatar, quân cờ…) + 10 ảnh nguyên tấm (3 nền, 7 bàn Tiến Lên).
- Lưu ảnh bảng vào `custom/sheets/` đúng tên, rồi chạy `python3 -E tools/apply_custom.py`. Script tự xoá nền trắng, cắt ra từng món theo thứ tự hàng từ trái sang phải, ghép lá bài, icon, phỉnh, VIP, quà ngày (chữ số và chữ do script vẽ), xoá dấu ✦ của Gemini trên ảnh nền, đóng gói texture 3D và vẽ lại bản đồ. Kết quả cắt xem trong `custom/sheets/_kiem_tra/`.
- Bắn Cá có sẵn 24 loài mới (6 trùm) trong `custom/ban-ca/ca.json`, chỉ chờ ảnh. Máu cá tính theo hệ số nên tỉ lệ trả thưởng 95% giữ nguyên. Xem riêng một loài: `play3d.html?game=ban-ca&fish=cus_kraken`.
- Xoá ảnh trong `custom/` rồi chạy lại lệnh là game quay về ảnh mặc định. Chi tiết: `custom/README.md`.

## Đăng lên web

- GitHub: https://github.com/DorisLe-UXUI/heo-con-club, GitHub Pages phát thẳng nhánh `main` (file `.nojekyll` tắt Jekyll). Mỗi lần `git push` là trang tự cập nhật sau vài phút.
- Bản Artifact (riêng tư): https://claude.ai/artifact/FAodJHnT2r5wuiSpanFxSd.
- `bash tools/deploy/build.sh dist` dựng thư mục `dist/` gọn để đăng: chỉ chứa các file game thật sự dùng (~418 file, 84 MB thay vì cả bộ 387 MB), gom ~200 ảnh nhỏ vào `assets/pack.js`, đổi tên file có dấu cách hoặc ngoặc. Trang mở đầu `launch.html` chuyển vào `home.html` (bản sao của `index.html`).
- Có thể đưa nguyên `dist/` lên bất kỳ host tĩnh nào (Netlify, itch.io dạng HTML5).
- Công cụ kiểm tra: `bash tools/selftest.sh bai-cao poker …` (selftest game 3D), `bash tools/shot.sh <trang> <tham số> <ảnh.png>` (chụp nhanh), `node tools/cdp_shot.mjs "tien-len.html?room=1&pose=turn" ảnh.png 1920,1080 --title=POSED` (chụp thời gian thật).

## Cấu trúc `assets/` (rút gọn)

```
3d/                           44 model 3D: glb/ bản gốc, js/ bản nhúng, renders/ ảnh chụp sẵn
cards-*                       7 bộ bài, 17 biến thể
games/<game>/                 asset riêng 10 game + shared/ (bát, đĩa) + card-shared/ (chip, viền chọn, thẻ)
games/lobby-icons/            17 icon game
ui-premium-generated/         UI kẹo pastel, câu hô, khung avatar, VIP, nền sảnh
ui-jelly-pzuh/                nút jelly 9 màu, 63 khung bảng
ui-kenney/, ui-puzzle-kenney/ UI Kenney, coin, bóng, hạt sáng
bg-tables-generated/          7 bàn chơi 1920×1080
emoji-fluent-3d/              569 emoji & nhân vật 3D: reactions, hands, symbols, game, game-items, tet, animals, characters, sea
emoji-noto-animated/          127 emoji động
avatars-*                     DiceBear 16 kiểu, Kenney thú 2 bộ, Ninja pixel 91
characters-*-kenney/          toon, platformer, shape, jumper (thỏ), physics (alien)
emotes-*, fx-*, items-ninja/, icons-*, cursors-kenney/, bg-clouds-kenney/, bg-patterns-kenney/
music-bgm/                    27 bài nhạc nền
audio-*                       khoảng 600 âm thanh
fonts/                        16 font
manifest.json
```

```js
const m = await fetch('assets/manifest.json').then(r => r.json());
const icon = 'assets/' + m.games['bau-cua'].lobby_icon;
const crab = 'assets/' + m.games['bau-cua'].assets['symbols'][1];
const callouts = m.ui.premium.callouts;          // 40 câu hô
const laugh = 'assets/' + m.emoji.noto_animated.items['joy_1f602'].webp;
```

## Còn thiếu

- Chưa có bài Tứ Sắc / Tổ Tôm.
- Câu hô, khung và nút là ảnh tĩnh. Hiệu ứng nảy, bay xu, confetti trong `lobby.html` làm bằng code, có thể chép sang game.
- Mới có 6 nhân vật 3D người có xương. Gấu, cún, vịt của bộ Mini-Game không có xương nên chỉ nhún nhảy bằng code.
- Tiến Lên vẫn là bàn 2D (có xu và linh vật 3D); 19 game còn lại đã là 3D.
- Chơi chung bàn với người thật mới có ở Tiến Lên; các game khác vẫn chơi với bot.
- Chơi online cần chủ game bật Firebase (`docs/ONLINE_SETUP.md`); khi chưa bật, bảng xếp hạng tab Thị trấn và bạn bè là dữ liệu mẫu.
