# Ảnh tự tạo

Thả ảnh bạn tạo (bằng ChatGPT, Gemini, Midjourney…) vào đây rồi chạy:

```bash
python3 -E tools/apply_custom.py
```

Cách nhanh nhất: tạo **ảnh bảng 16:9** (nhiều món trong 1 ảnh) và lưu vào `custom/sheets/`, script tự cắt ra từng món. Prompt và tên file nằm trong [`docs/PROMPTS.md`](../docs/PROMPTS.md).

| Thư mục | Thay cho | Tên file |
|---|---|---|
| `sheets/` | Ảnh bảng 16:9, tự cắt ra các thư mục bên dưới | `ca_1.png`, `bai_chat.png`, `icon_1.png`… (xem `docs/PROMPTS.md`). Kết quả cắt xem trong `sheets/_kiem_tra/`. |
| `ban-ca/` | Cá mới trong Bắn Cá | đúng tên trong `ban-ca/ca.json` (vd. `kraken.png`). Sửa `ca.json` để đổi tên hiển thị, hệ số, loại cá (`small`, `medium`, `big`, `boss`), độ to (`size` 0.5–2), hướng ảnh (`faces`: `left`/`right`). |
| `cards/` | Bộ bài | `suit_hearts.png`, `suit_diamonds.png`, `suit_clubs.png`, `suit_spades.png`, `face_J.png` / `face_J_hearts.png` (tương tự Q, K), `ace_hearts.png`…, `back.png`, `back_dark.png` |
| `icons/` | Hình minh hoạ icon game | `tien-len.png`, `bau-cua.png`, `ban-ca.png`… (tên game như trong `play3d.html?game=`) |
| `chips/`, `vip/`, `daily/` | Phỉnh cược, huy hiệu VIP, quà 7 ngày | `chip_1k.png`…`chip_10m.png`, `vip_1.png`…`vip_8.png`, `day_1.png`…`day_7.png` (chỉ hình, số và chữ do script viết) |
| `ban-ca/thay/` | Vẽ lại 18 loài cá có sẵn trong Bắn Cá | `ca_vang.png`, `cua.png`, `ca_map.png`… (tên loài) |
| `bau-cua/` | Linh vật Bầu Cua | `bau.png`, `cua.png`, `tom.png`, `ca.png`, `ga.png`, `nai.png` |
| `assets/` | Một file bất kỳ trong `assets/` | cùng đường dẫn, vd. `assets/games/xoc-dia/coin_red.png` thay `assets/games/xoc-dia/coin_red.png` |

- Nền trắng hoặc nền trơn một màu được tự xoá. Ảnh đã trong suốt thì giữ nguyên.
- Ảnh được tự cắt viền và thu về đúng cỡ, nên cỡ gốc bao nhiêu cũng được (nên từ 1024px).
- Muốn quay về ảnh mặc định: xoá ảnh trong thư mục này rồi chạy lại lệnh trên.
