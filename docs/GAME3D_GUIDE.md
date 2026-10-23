# Làm một game 3D cho Heo Con Club (khung `js/table3d.js`)

Mỗi game 3D chạy trong `play3d.html?game=<key>`. Trang này lo phần chung: thanh trên (nút quay lại, tên game, xu, luật chơi, âm thanh), màn loading, co giãn theo cửa sổ, popup, thông báo, hiệu ứng xu bay. Game chỉ cần một file module.

Ví dụ hoàn chỉnh để đọc trước: `js/games3d/bau-cua.js` (cược + xúc xắc) và `js/games3d/xi-dach.js` + `js/games3d/rules/xi-dach.js` + `tests/xi-dach.test.js` (đánh bài với nhà cái).

## File của một game

| File | Nội dung |
|---|---|
| `js/games3d/<key>.js` | Module 3D: `T3.register('<key>', {...})`. |
| `js/games3d/rules/<key>.js` | Luật thuần (không DOM, không three.js), dạng UMD như file xi-dach. Gắn vào `window.Rules['<key>']`, và `module.exports` cho Node. |
| `tests/<key>.test.js` | Test luật bằng Node: `node tests/<key>.test.js`, in ra `N passed, 0 failed`. |

Không sửa các file dùng chung: `js/table3d.js`, `play3d.html`, `js/hc3d.js`, `js/hc-core.js`, `index.html`, `lobby.html`, `js/town3d.js`. Cần thêm tiện ích thì viết ngay trong module của mình.

## Đăng ký module

```js
T3.register('tai-xiu', {
  title: 'Tài Xỉu', sub: 'một dòng mô tả ngắn',
  table: 'round' | 'rect' | 'board' | 'none',      // bàn tròn đánh bài, bàn chữ nhật cược, bàn cờ, hoặc tự dựng cảnh
  theme: 'pink' | 'mint' | 'sky' | 'lemon' | 'lavender' | 'peach' | 'red',
  tex: ['cards', 'chips'],                            // gói ảnh assets/3d/js/tex_<tên>.js (xem bảng dưới)
  scripts: ['js/games3d/rules/tai-xiu.js'],           // file luật
  models: ['bgb_d6_red'],                             // model 3D trong assets/3d/index.json (tuỳ chọn)
  cam: { pos: [0, 11, 16], look: [0, 0, -.5] },       // tuỳ chọn, mặc định theo kiểu bàn
  rules: '<p>Luật chơi bằng HTML, tiếng Việt</p>',
  async start(ctx) { /* vòng lặp game, chạy mãi */ },
  async selftest(ctx) { /* chơi tự động 1 ván, trả về { pass: 1, fail: 0, ... } */ },
});
```

## Toạ độ

Mặt bàn là `y = 0`. Trục `x` sang phải, `z` hướng về phía người chơi (camera ở `z` dương). Bàn tròn bán kính 7. Bàn chữ nhật 18 × 11. Bàn cờ 15 × 13 (mặt bàn cờ cao `y = 0`).

## `ctx` có gì

**Cảnh:** `ctx.THREE`, `ctx.scene`, `ctx.camera`, `ctx.add(obj)`, `ctx.remove(obj)`, `ctx.mat(hex, {roughness, emissiveHex…})` (màu sRGB chuẩn), `ctx.H.roundedBox(w,h,d,r,seg)` (khối bo góc, dán ảnh đúng từng mặt), `ctx.tex(key)` (texture từ gói ảnh), `T3.canvasTex(w, h, (ctx2d, w, h) => {...})` (vẽ texture bằng canvas, chữ dùng font đã nạp).

**Chuyển động:** `await ctx.tween(obj, {x,y,z, rx,ry,rz, s, arc}, ms, 'out'|'io'|'back'|'bounce'|'lin')`. `await ctx.wait(ms)`. `ctx.onFrame((dt, t) => …)` (trả `false` để gỡ). `await ctx.camTo({pos, look}, ms)`.

**Bài tây 52 lá** (gói `cards`): `ctx.deck()` → `[{s:'hearts', r:'A', key:'hearts_A'}, …]` đã xáo. `ctx.card(key)` → lá bài nằm ngửa trên bàn. Úp bài: `card.rotation.z = Math.PI`. `await ctx.deal(card, {x, z, ry}, ms, faceUp)`. `await ctx.flip(card, true)`. `await ctx.layoutHand(cards, {z, y, tilt, spread})` (bài trên tay bạn dựng đứng trước camera, `card.userData.selected = true` để nhô lên). Lá dùng ảnh khác (Bài Màu): `ctx.card(null, { tex: 'bm_red_5', back: 'bm_back' })`, `card.setFace('bm_blue_7')`.

**Phỉnh** (gói `chips`): `ctx.chip('10k')`, `ctx.stack(amount, x, z)`, `await ctx.moveStack(group, x, z, ms, vanish)`, `ctx.chipKey(10000) → '10k'`.

**Xúc xắc:** `ctx.die({ size })` (chấm tròn) hoặc `ctx.die({ faces: [6 texture key] })`. `die.setFace(i)` (mặt `i` ngửa lên, 0..5). `await die.roll(i, x, z, ms)` (lăn tới (x,z) và dừng ở mặt `i`). Với xúc xắc chấm, mặt `i` có `i+1` chấm.

**Đồ khác:** `ctx.bowl(color, r)`, `ctx.plate(color, r)`, `ctx.coin2(texA, texB, r)` (đồng xu 2 mặt).

**Người chơi:** `const seats = await ctx.seats(n, { angles: [90, 180, 270, 0] })`. Ghế 0 là bạn (góc 90 = phía camera, không có hình 3D). Các ghế khác là bot có nhân vật 3D và nhãn tên. Mỗi ghế có `name, avatar, coins, me, angle, say(text), anim('cheer'|'sad'|'think'|'wave'), setCoins(v), turn(on), spot(along, inward) → Vector3 trên bàn trước mặt ghế, facing` (góc xoay để lá bài quay về phía ghế).

**Chạm vào vật 3D:** `ctx.pickable(obj, onClick(point), onHover(on))` trả hàm gỡ. `ctx.ray(pointerEvent, plane)` → điểm trên mặt phẳng. Có thể gán `ctx.onPointerDown/Move/Up = e => …`.

**Nhãn bám theo vật 3D:** `ctx.label(obj3D | () => Vector3, html, cls)` → `{ el, remove() }`. Lớp có sẵn: `tag3` (thêm `mint|sky|lemon|grey`), `seatlbl`, `bub3`.

**Giao diện** (`ctx.ui`, đơn vị như màn 1080p):
- `ctx.ui.actions([{ id, label, cls: 'pink'|'mint'|'sky'|'lemon'|'lavender'|'grey', icon, onClick }])` → thanh nút dưới. Trả `{ btn(id), set(id, { disabled, label, hidden }) }`. `ctx.ui.clearActions()`.
- `ctx.ui.chipPicker([1000, 5000, …], onChange, startIndex)` → `{ value }`.
- `ctx.ui.status(html)` (dòng trạng thái góc trái dưới), `ctx.ui.toast(msg, icon)`, `ctx.ui.callout('THẮNG!')`, `ctx.ui.confetti()`, `ctx.ui.float(text, vector3)`.
- `await ctx.ui.modal({ title, html | body, buttons: [{ label, cls, onClick }], width, icon })`, `ctx.ui.results(title, rows, { again })` với `rows: [{ name, avatar, detail, amount, me, tag }]`.
- `ctx.ui.h(tag, attrs, parent)` và `ctx.ui.root` để tự dựng HUD riêng. Đường dẫn ảnh DOM dùng `HC.A('emoji-fluent-3d/game/coin.png')`.

**Xu (ví chung với cả thị trấn):** `ctx.coins`, `ctx.spend(n)` (trả `false` và báo nếu thiếu), `ctx.win(n, vector3)` (cộng xu + hiệu ứng xu bay).

**Âm thanh:** `ctx.sfx('card'|'card2'|'slide'|'shuffle'|'fan'|'chip'|'chips'|'dice'|'diceThrow'|'coin'|'gold'|'win'|'lose'|'click'|'tick'|'pop'|'turn'|'error'|'power'|'laser'|'boom'|'jingle')`, `ctx.music('cards'|'dice'|'board'|'sea'|'loto')`.

**Tiện ích:** `ctx.shuffle(arr)`, `ctx.pick(arr)`, `ctx.rand()`, `ctx.SHOT` (đang chụp ảnh), `ctx.TEST` (đang tự kiểm), `ctx.Q` (tham số URL). Khi `ctx.TEST` hoặc `ctx.SHOT`, `ctx.wait` và `tween` chạy nhanh hơn.

## Sảnh chọn bàn, mức cược và chế độ chơi

Trước khi vào bàn, `play3d.html` hiện **sảnh "Chọn bàn"** (`js/t3-lobby.js`): 4–5 bàn **Tập Sự, Bình Dân, Cao Thủ, Đại Gia, Hoàng Gia**, mỗi bàn có mức cược, số xu tối thiểu, cấp cần có (`HC.prog.level()`), sức bot và ảnh bàn (`assets/bg-tables-generated/with-table/table_scene_<scene>.png`). Mặc định theo loại game (`T3.ROOM_KIND`: `bet`, `unit`, `blind`, `board`, `ticket`, `fish`); module có thể thay trong `T3.register`:

```js
stakeName: 'Mù nhỏ',                       // chữ trước mức cược trên thẻ bàn ('Cược' nếu bỏ trống)
rooms: [{ id: 'tap-su', stakes: [1000, 5000], min: 20000, lv: 1, ai: 0, bank: [80000, 600000], scene: 'mint' }, …],   // ghi đè từng bàn
modes: [{ id: 'thuong', name: 'Thường', desc: 'một dòng dưới tab', rules: 'đoạn luật thêm vào nút ?', minMul: 1 }, …], // ≥ 2 chế độ thì sảnh có tab
botLabel: false,                            // ẩn "Bot Khó" (game may rủi)
```

Bàn và chế độ đã chọn nằm ở `ctx.room` / `ctx.mode` khi `start(ctx)` chạy (`ctx.room = null` với `?selftest`, `?shot`, `?demo`: giữ mức cược cũ). Khung tự lo phần chung:

- `ctx.ui.chipPicker(values, …)` chỉ hiện các mức `ctx.room.stakes`.
- Bot trong `ctx.seats()` có vốn theo bàn. `ctx.botBank()`, `ctx.botStake(fallback)` (bot đặt cược theo bàn), `ctx.maxStake(fallback)`, `ctx.topUp(seat, legacyMin, legacyAdd, mult)` (nạp xu cho bot sắp hết), `ctx.aiLevel(fallback)` (0 Dễ … 3 Siêu khó).
- `ctx.ui.countdown(giây, onEnd, nhãn)`: đồng hồ đặt cược (Bầu Cua, Xóc Đĩa, Tài Xỉu dùng cho chế độ Thường / Nhanh).
- Nút quay lại ở bàn thành **Đổi bàn** (về sảnh); ở sảnh thì về thị trấn / bản đồ như cũ.

URL: `?game=<key>&room=<id>&mode=<id>` vào thẳng bàn (không đủ xu / cấp thì quay về sảnh), `&lobby=1` ép hiện sảnh (kể cả khi chụp ảnh `&shot=1`). Tự kiểm một chế độ: `?game=xi-dach&selftest=1&mode=lam-cai`.

## Gói ảnh có sẵn (`tex`)

| Gói | Key |
|---|---|
| `cards` | `c_<suit>_<rank>` (suit: spades, clubs, diamonds, hearts; rank: A 2…10 J Q K), `c_back`, `c_back_black` |
| `chips` | `chip_1k` `chip_5k` `chip_10k` `chip_50k` `chip_100k` `chip_500k` `chip_1m` `chip_10m`, `marker_d` `marker_sb` `marker_bb` |
| `bau-cua` | `bc_face_<con>`, `bc_tile_<con>` (nai bau ga ca cua tom) |
| `xoc-dia` | `xd_red`, `xd_white` |
| `co-tuong` | `ct_<red|black>_<general|advisor|elephant|horse|chariot|cannon|soldier>`, `ct_board` |
| `co-ca-ngua` | `cn_board`, `cn_red` `cn_blue` `cn_green` `cn_yellow` |
| `co-caro` | `cc_x`, `cc_o` |
| `bai-mau` | `bm_back`, `bm_wild`, `bm_wild_draw4`, `bm_<red|green|blue|yellow>_<0-9|skip|reverse|draw2>` |
| `ban-ca` | `sea_<tropical_fish|fish|blowfish|octopus|shark|whale|turtle|jellyfish|crab|dolphin|squid|lobster|shrimp|seal|spiral_shell>`, `bc_cannon_1..5`, `bc_net`, `bc_bullet` |
| `lo-to` | `lt_heart` |

Ảnh DOM (HUD) dùng thẳng file trong `assets/` qua `HC.A(...)`. Ảnh dán lên vật 3D phải lấy từ gói ảnh hoặc vẽ bằng canvas, vì mở bằng `file://` thì WebGL không nhận ảnh PNG thường.

## Kiểm tra

```bash
node tests/<key>.test.js
```

Tự kiểm trong trình duyệt (Chrome chạy ngầm), đọc kết quả ở `body[data-selftest]`:

```bash
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CH" --headless=new --mute-audio --allow-file-access-from-files --enable-unsafe-swiftshader --use-angle=swiftshader --user-data-dir=/tmp/hc-<key> --window-size=1280,800 --virtual-time-budget=90000 --dump-dom "file://<đường dẫn tuyệt đối, đã mã hoá %20>/play3d.html?game=<key>&selftest=1" | grep -o 'data-selftest="[^"]*"'
```

Chụp ảnh: thay `--dump-dom` bằng `--screenshot=<file>.png --window-size=1920,1080` và dùng `?game=<key>&shot=1` (thêm `&demo=1` nếu module hỗ trợ tự vào ván). Mỗi lần chạy dùng một `--user-data-dir` riêng rồi xoá đi.
