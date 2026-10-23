# Prompt tạo ảnh cho Heo Con Club

Mỗi prompt tạo **một ảnh**. Ảnh bảng (16:9, nhiều món) được script tự cắt ra từng món; ảnh nền và ảnh bàn là ảnh nguyên tấm. Cách làm:

1. Copy nguyên khối prompt, dán vào công cụ tạo ảnh, tải ảnh về (PNG/JPG, cỡ lớn nhất).
2. Lưu đúng tên file ghi ở mục đó (ảnh bảng vào `custom/sheets/`, đuôi .png hay .jpg đều được).
3. Chạy lệnh dưới, rồi mở `custom/sheets/_kiem_tra/` xem từng món đã cắt đúng tên chưa:

```bash
python3 -E tools/apply_custom.py
```

Ảnh nào chưa làm thì game giữ ảnh cũ. File này do `tools/art_sheets.py` sinh ra.

## Giữ phong cách riêng

Giữ phong cách riêng của Heo Con Club: khi tạo mỗi ảnh, đính kèm 1–2 ảnh bạn đã làm ở đợt 1 (vd. `custom/sheets/ca_1.jpg` và `bai_nhanvat_1.jpg`) và thêm câu sau vào cuối prompt:

```text
Match the art style of the attached images exactly: the same glossy 3D clay-toy rendering, soft lighting, rounded proportions and pastel candy palette.
```

## Mẹo

- **Thứ tự quan trọng:** script đọc từng hàng từ trái sang phải, đúng thứ tự trong prompt. AI vẽ thiếu, thừa hoặc các món dính nhau thì script báo lỗi và bỏ qua bảng đó, bạn tạo lại.
- **Nền trắng trơn** để script xoá nền. Dấu ✦ ở góc ảnh của Gemini được tự xoá trên ảnh nền.
- **Một món bị lỗi:** tạo riêng món đó và lưu đè vào đúng đường dẫn trong bảng tên file. Script không ghi đè ảnh bạn tự thay.
- **Cá quay đầu sang trái**, game tự lật khi cá bơi sang phải.
- **Không để AI viết chữ:** số trên lá bài và phỉnh, chữ VIP, "Ngày 1", tên game đều do script vẽ.

# Đợt 2 · mới

## Ảnh 1 · Bắn Cá · vẽ lại 10 con có sẵn (bảng 1)

Lưu: `custom/sheets/ca_cu_1.png`

```text
A sprite sheet of exactly 10 separate cute sea creatures, arranged in a neat grid of 5 columns and 2 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a small chubby golden yellow fish with round fins; a small chubby pastel pink fish with big round eyes; a clownfish with orange and white stripes; a round sky blue fish with a yellow tail; a small orange-pink shrimp with long feelers. Row 2 from left to right: a round puffed-up blowfish with soft spikes, peach orange; a red crab with big claws raised, seen from the front; a translucent blue and purple jellyfish with wavy tentacles hanging down, seen from the front; an angelfish with tall fins and yellow and blue stripes; a pink squid with big eyes and tentacles hanging down, seen from the front. Every creature is seen from the side and faces left (head on the left), unless its description says otherwise. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Cá Vàng | `custom/ban-ca/thay/ca_vang.png` |
| 2 | Cá Hồng | `custom/ban-ca/thay/ca_hong.png` |
| 3 | Cá Hề | `custom/ban-ca/thay/ca_he.png` |
| 4 | Cá Xanh | `custom/ban-ca/thay/ca_xanh.png` |
| 5 | Tôm | `custom/ban-ca/thay/tom.png` |
| 6 | Cá Nóc | `custom/ban-ca/thay/ca_noc.png` |
| 7 | Cua | `custom/ban-ca/thay/cua.png` |
| 8 | Sứa | `custom/ban-ca/thay/sua.png` |
| 9 | Cá Thần Tiên | `custom/ban-ca/thay/ca_than_tien.png` |
| 10 | Mực | `custom/ban-ca/thay/muc.png` |

</details>

## Ảnh 2 · Bắn Cá · vẽ lại 8 con có sẵn (bảng 2, có 3 trùm)

Lưu: `custom/sheets/ca_cu_2.png`

```text
A sprite sheet of exactly 8 separate cute sea creatures, arranged in a neat grid of 4 columns and 2 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a green sea turtle with a patterned shell, swimming; a bright red lobster with big claws, seen from the front with its tail down; a gray seal with whiskers, swimming; a blue dolphin, smiling. Row 2 from left to right: a golden arowana dragon fish with large shiny scales and long barbels; a giant pink-purple octopus with curling tentacles, seen from the front; a great white shark with a friendly toothy grin; a huge blue whale with a pale belly and a small water spout. Every creature is seen from the side and faces left (head on the left), unless its description says otherwise. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Rùa Biển | `custom/ban-ca/thay/rua.png` |
| 2 | Tôm Hùm | `custom/ban-ca/thay/tom_hum.png` |
| 3 | Hải Cẩu | `custom/ban-ca/thay/hai_cau.png` |
| 4 | Cá Heo | `custom/ban-ca/thay/ca_heo.png` |
| 5 | Cá Rồng Vàng | `custom/ban-ca/thay/ca_rong.png` |
| 6 | Bạch Tuộc Khổng Lồ | `custom/ban-ca/thay/bach_tuoc.png` |
| 7 | Cá Mập Trắng | `custom/ban-ca/thay/ca_map.png` |
| 8 | Cá Voi Xanh | `custom/ban-ca/thay/ca_voi.png` |

</details>

## Ảnh 3 · Phỉnh cược (chip) · 8 mệnh giá, chữ số do script viết

Lưu: `custom/sheets/chip.png`

```text
A sprite sheet of exactly 8 separate cute casino chips, arranged in a neat grid of 4 columns and 2 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a round chip, white with pink edge stripes; a round chip, pink with white edge stripes; a round chip, sky blue with white edge stripes; a round chip, mint green with white edge stripes. Row 2 from left to right: a round chip, lemon yellow with white edge stripes; a round chip, lavender purple with white edge stripes; a round chip, shiny gold with white edge stripes; a round chip, dark navy with gold edge stripes. Every chip is seen from directly above and has an empty plain circle in the middle. The objects have no faces, no eyes and no mouths. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Chip 1K | `custom/chips/chip_1k.png` |
| 2 | Chip 5K | `custom/chips/chip_5k.png` |
| 3 | Chip 10K | `custom/chips/chip_10k.png` |
| 4 | Chip 50K | `custom/chips/chip_50k.png` |
| 5 | Chip 100K | `custom/chips/chip_100k.png` |
| 6 | Chip 500K | `custom/chips/chip_500k.png` |
| 7 | Chip 1M | `custom/chips/chip_1m.png` |
| 8 | Chip 10M | `custom/chips/chip_10m.png` |

</details>

## Ảnh 4 · Icon giao diện · bảng 1

Lưu: `custom/sheets/hud_1.png`

```text
A sprite sheet of exactly 10 separate cute game interface icons, arranged in a neat grid of 5 columns and 2 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a shiny gold coin with an embossed pig face; a sparkling blue diamond gem; a pink gift box with a golden ribbon bow; a rolled parchment scroll tied with a red ribbon; a golden trophy cup with two handles. Row 2 from left to right: two shopping bags, pink and mint; a retro arcade joystick with a red ball top on a purple base; a pink envelope sealed with a red heart; a plain white envelope with a light blue edge; a party popper cone bursting with confetti. Every icon is a slightly angled front view. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Xu | `custom/assets/emoji-fluent-3d/game/coin.png` |
| 2 | Kim cương | `custom/assets/emoji-fluent-3d/game/gem_stone.png` |
| 3 | Hộp quà | `custom/assets/emoji-fluent-3d/game/wrapped_gift.png` |
| 4 | Cuộn nhiệm vụ | `custom/assets/emoji-fluent-3d/game/scroll.png` |
| 5 | Cúp | `custom/assets/emoji-fluent-3d/game/trophy.png` |
| 6 | Túi mua sắm | `custom/assets/emoji-fluent-3d/game/shopping_bags.png` |
| 7 | Cần điều khiển | `custom/assets/emoji-fluent-3d/game/joystick.png` |
| 8 | Thư tình | `custom/assets/emoji-fluent-3d/game/love_letter.png` |
| 9 | Phong thư | `custom/assets/emoji-fluent-3d/game/envelope.png` |
| 10 | Pháo giấy | `custom/assets/emoji-fluent-3d/game/party_popper.png` |

</details>

## Ảnh 5 · Icon giao diện · bảng 2

Lưu: `custom/sheets/hud_2.png`

```text
A sprite sheet of exactly 10 separate cute game interface icons, arranged in a neat grid of 5 columns and 2 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a pink megaphone; a burlap money bag tied at the top, full of gold coins; a golden crown with pink and blue jewels; a golden key with a heart-shaped head; a closed golden padlock. Row 2 from left to right: a white die with pink dots, tilted; a small pastel house with a pink roof; a playing card showing a cute jester face; a magic wand with a star tip and sparkles; a glowing yellow light bulb. Every icon is a slightly angled front view. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Loa | `custom/assets/emoji-fluent-3d/game/loudspeaker.png` |
| 2 | Túi tiền | `custom/assets/emoji-fluent-3d/game/money_bag.png` |
| 3 | Vương miện | `custom/assets/emoji-fluent-3d/game/crown.png` |
| 4 | Chìa khoá | `custom/assets/emoji-fluent-3d/game/key.png` |
| 5 | Ổ khoá | `custom/assets/emoji-fluent-3d/game/locked.png` |
| 6 | Xúc xắc | `custom/assets/emoji-fluent-3d/game/game_die.png` |
| 7 | Ngôi nhà | `custom/assets/emoji-fluent-3d/game/house.png` |
| 8 | Lá Joker | `custom/assets/emoji-fluent-3d/game/joker.png` |
| 9 | Đũa phép | `custom/assets/emoji-fluent-3d/game/magic_wand.png` |
| 10 | Bóng đèn | `custom/assets/emoji-fluent-3d/game/light_bulb.png` |

</details>

## Ảnh 6 · Icon giao diện · bảng 3

Lưu: `custom/sheets/hud_3.png`

```text
A sprite sheet of exactly 10 separate cute game interface icons, arranged in a neat grid of 5 columns and 2 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a gold medal on a red ribbon with a star in the middle; a silver medal on a blue ribbon with a star in the middle; a bronze medal on a green ribbon with a star in the middle; two pink admission tickets; one golden ticket with a star. Row 2 from left to right: a pink twin-bell alarm clock; a silver stopwatch; a red and white target with a dart in the center; a red round map pin; a glossy dark navy spade symbol. Every icon is a slightly angled front view. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Huy chương vàng | `custom/assets/emoji-fluent-3d/game/1st_place_medal.png` |
| 2 | Huy chương bạc | `custom/assets/emoji-fluent-3d/game/2nd_place_medal.png` |
| 3 | Huy chương đồng | `custom/assets/emoji-fluent-3d/game/3rd_place_medal.png` |
| 4 | Vé vào cửa | `custom/assets/emoji-fluent-3d/game/admission_tickets.png` |
| 5 | Vé vàng | `custom/assets/emoji-fluent-3d/game/ticket.png` |
| 6 | Đồng hồ báo thức | `custom/assets/emoji-fluent-3d/game/alarm_clock.png` |
| 7 | Đồng hồ bấm giờ | `custom/assets/emoji-fluent-3d/game/stopwatch.png` |
| 8 | Bia bắn | `custom/assets/emoji-fluent-3d/game/bullseye.png` |
| 9 | Ghim | `custom/assets/emoji-fluent-3d/game/round_pushpin.png` |
| 10 | Chất bích | `custom/assets/emoji-fluent-3d/game/spade_suit.png` |

</details>

## Ảnh 7 · Nút bấm giao diện · 13 nút

Lưu: `custom/sheets/nut.png`

```text
A sprite sheet of exactly 13 separate cute glossy game buttons, arranged in a neat grid of 5 columns and 3 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a rounded-square glossy jelly game button in mint green with a chunky white house symbol; a rounded-square glossy jelly game button in mint green with a chunky white plus symbol; a rounded-square glossy jelly game button in mint green with a chunky white speaker symbol; a rounded-square glossy jelly game button in pink with a chunky white triangle pointing left; a rounded-square glossy jelly game button in pink with a chunky white house symbol. Row 2 from left to right: a rounded-square glossy jelly game button in pink with a chunky white gear symbol; a rounded-square glossy jelly game button in pink with a chunky white speaker symbol; a rounded-square glossy jelly game button in lavender purple with a chunky white envelope symbol; a rounded-square glossy jelly game button in lemon yellow with a chunky white symbol of four small squares; a rounded-square glossy jelly game button in lemon yellow with a chunky white thumbs-up symbol. Row 3 from left to right: a rounded-square glossy jelly game button in lemon yellow with a chunky white question mark; a rounded-square glossy jelly game button in red with a chunky white X made of two rounded bars; a rounded-square glossy jelly game button in light gray with a chunky white padlock symbol. Every button is a flat front view, all the same size. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Nút nhà (xanh) | `custom/assets/ui-jelly-pzuh/buttons-pastel/mint/icon_home_mint.png` |
| 2 | Nút cộng (xanh) | `custom/assets/ui-jelly-pzuh/buttons-pastel/mint/icon_plus_mint.png` |
| 3 | Nút loa (xanh) | `custom/assets/ui-jelly-pzuh/buttons-pastel/mint/icon_sound_mint.png` |
| 4 | Nút quay lại | `custom/assets/ui-jelly-pzuh/buttons-pastel/pink/icon_back_pink.png` |
| 5 | Nút nhà (hồng) | `custom/assets/ui-jelly-pzuh/buttons-pastel/pink/icon_home_pink.png` |
| 6 | Nút cài đặt | `custom/assets/ui-jelly-pzuh/buttons-pastel/pink/icon_settings_pink.png` |
| 7 | Nút loa (hồng) | `custom/assets/ui-jelly-pzuh/buttons-pastel/pink/icon_sound_pink.png` |
| 8 | Nút thư | `custom/assets/ui-jelly-pzuh/buttons-pastel/purple/icon_mail_purple.png` |
| 9 | Nút danh sách | `custom/assets/ui-jelly-pzuh/buttons-pastel/yellow/icon_grid_yellow.png` |
| 10 | Nút thích | `custom/assets/ui-jelly-pzuh/buttons-pastel/yellow/icon_like_yellow.png` |
| 11 | Nút trợ giúp | `custom/assets/ui-jelly-pzuh/buttons-pastel/yellow/icon_question_yellow.png` |
| 12 | Nút đóng | `custom/assets/ui-jelly-pzuh/buttons/icon_close_red.png` |
| 13 | Ô bị khoá | `custom/assets/ui-jelly-pzuh/buttons/square_locked.png` |

</details>

## Ảnh 8 · Huy hiệu VIP 1–8 · chữ VIP và số do script viết

Lưu: `custom/sheets/vip.png`

```text
A sprite sheet of exactly 8 separate cute shield-shaped VIP badges, getting fancier from first to last, arranged in a neat grid of 4 columns and 2 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a shield badge, silver blue, simple; a shield badge, mint green with a small star; a shield badge, sky blue with two small stars; a shield badge, lavender purple with small wings. Row 2 from left to right: a shield badge, pink with small wings and a heart gem; a shield badge, gold with wings and a ruby; a shield badge, coral red and gold with big wings and gems; a shield badge, dark navy and gold, the most luxurious, with big golden wings, a crown and diamonds. Every badge is a flat front view with an empty smooth area in the middle for a label. The objects have no faces, no eyes and no mouths. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | VIP 1 | `custom/vip/vip_1.png` |
| 2 | VIP 2 | `custom/vip/vip_2.png` |
| 3 | VIP 3 | `custom/vip/vip_3.png` |
| 4 | VIP 4 | `custom/vip/vip_4.png` |
| 5 | VIP 5 | `custom/vip/vip_5.png` |
| 6 | VIP 6 | `custom/vip/vip_6.png` |
| 7 | VIP 7 | `custom/vip/vip_7.png` |
| 8 | VIP 8 | `custom/vip/vip_8.png` |

</details>

## Ảnh 9 · Quà đăng nhập 7 ngày · khung và chữ do script vẽ

Lưu: `custom/sheets/qua_ngay.png`

```text
A sprite sheet of exactly 7 separate cute reward items, arranged in a neat grid of 4 columns and 2 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a small stack of three gold coins; a bigger pile of gold coins; a burlap money bag with a gold coin; a big sparkling blue diamond. Row 2 from left to right: a pink gift box with a golden bow; a big money bag overflowing with gold coins; a golden crown with jewels. Every item is a slightly angled front view. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Ngày 1 | `custom/daily/day_1.png` |
| 2 | Ngày 2 | `custom/daily/day_2.png` |
| 3 | Ngày 3 | `custom/daily/day_3.png` |
| 4 | Ngày 4 | `custom/daily/day_4.png` |
| 5 | Ngày 5 | `custom/daily/day_5.png` |
| 6 | Ngày 6 | `custom/daily/day_6.png` |
| 7 | Ngày 7 | `custom/daily/day_7.png` |

</details>

## Ảnh 10 · Khung avatar · 8 khung tròn

Lưu: `custom/sheets/khung.png`

```text
A sprite sheet of exactly 8 separate cute round avatar frames, each a thin decorated ring, arranged in a neat grid of 4 columns and 2 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a ring frame, gold with a tiny crown on top and a blue gem at the bottom; a ring frame, lavender purple with a tiny crown on top; a ring frame, mint green with a four-leaf clover and a tiny star; a ring frame, pink with two little hearts. Row 2 from left to right: a ring frame, rainbow gradient with a tiny crown and two little hearts; a ring frame, silver with a tiny gold star at the bottom; a ring frame, sky blue with a tiny gold star at the top right; a ring frame, red and gold with apricot blossoms and a tiny red lantern for Lunar New Year. Every frame is a flat front view; the inside of each ring is completely empty (plain white). Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Khung gold | `custom/assets/ui-premium-generated/avatar-frames/frame_gold.png` |
| 2 | Khung lavender | `custom/assets/ui-premium-generated/avatar-frames/frame_lavender.png` |
| 3 | Khung mint | `custom/assets/ui-premium-generated/avatar-frames/frame_mint.png` |
| 4 | Khung pink | `custom/assets/ui-premium-generated/avatar-frames/frame_pink.png` |
| 5 | Khung rainbow | `custom/assets/ui-premium-generated/avatar-frames/frame_rainbow.png` |
| 6 | Khung silver | `custom/assets/ui-premium-generated/avatar-frames/frame_silver.png` |
| 7 | Khung sky | `custom/assets/ui-premium-generated/avatar-frames/frame_sky.png` |
| 8 | Khung tet | `custom/assets/ui-premium-generated/avatar-frames/frame_tet.png` |

</details>

## Ảnh 11 · Ruy băng tiêu đề, nút dài, công tắc

Lưu: `custom/sheets/ui_phu.png`

```text
A sprite sheet of exactly 12 separate cute blank game interface pieces, arranged in a neat grid of 4 columns and 3 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a very wide and short ribbon banner with folded tails at both ends, about five times wider than tall, pink; a very wide and short ribbon banner with folded tails at both ends, about five times wider than tall, mint green; a very wide and short ribbon banner with folded tails at both ends, about five times wider than tall, sky blue; a very wide and short ribbon banner with folded tails at both ends, about five times wider than tall, lemon yellow. Row 2 from left to right: a very wide and short ribbon banner with folded tails at both ends, about five times wider than tall, lavender purple; a glossy capsule button three times wider than tall, pink; a glossy capsule button three times wider than tall, mint green; a glossy capsule button three times wider than tall, sky blue. Row 3 from left to right: a glossy capsule button three times wider than tall, lemon yellow; a glossy capsule button three times wider than tall, light gray; a pink toggle switch turned on, the round knob on the right; a light gray toggle switch turned off, the round knob on the left. All are flat front views and completely blank, with no symbols on them. The objects have no faces, no eyes and no mouths. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Ruy băng pink | `custom/assets/ui-premium-generated/ribbons/ribbon_pink.png` |
| 2 | Ruy băng mint | `custom/assets/ui-premium-generated/ribbons/ribbon_mint.png` |
| 3 | Ruy băng sky | `custom/assets/ui-premium-generated/ribbons/ribbon_sky.png` |
| 4 | Ruy băng lemon | `custom/assets/ui-premium-generated/ribbons/ribbon_lemon.png` |
| 5 | Ruy băng lavender | `custom/assets/ui-premium-generated/ribbons/ribbon_lavender.png` |
| 6 | Nút dài pink | `custom/assets/ui-premium-generated/buttons/pill_pink.png` |
| 7 | Nút dài mint | `custom/assets/ui-premium-generated/buttons/pill_mint.png` |
| 8 | Nút dài sky | `custom/assets/ui-premium-generated/buttons/pill_sky.png` |
| 9 | Nút dài lemon | `custom/assets/ui-premium-generated/buttons/pill_lemon.png` |
| 10 | Nút dài grey | `custom/assets/ui-premium-generated/buttons/pill_grey.png` |
| 11 | Công tắc bật | `custom/assets/ui-premium-generated/controls/toggle_on_pink.png` |
| 12 | Công tắc tắt | `custom/assets/ui-premium-generated/controls/toggle_off.png` |

</details>

## Ảnh 12 · Biểu cảm · bảng 1

Lưu: `custom/sheets/cam_xuc_1.png`

```text
A sprite sheet of exactly 10 separate cute 3D emoji stickers, arranged in a neat grid of 5 columns and 2 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a round glossy yellow 3D emoji face laughing with squinting eyes and a wide open smile; a round glossy yellow 3D emoji face laughing with tears of joy; a round glossy yellow 3D emoji face smiling with heart-shaped eyes; a round glossy yellow 3D emoji face smiling with cool black sunglasses; a round glossy yellow 3D emoji face wearing a party hat and blowing a party horn. Row 2 from left to right: a round glossy yellow 3D emoji face thinking with a hand on its chin; a round glossy yellow 3D emoji face sad with a single tear; a round glossy yellow 3D emoji face crying loudly with streams of tears; a round glossy yellow 3D emoji face screaming in fear with hands on its cheeks; a round glossy yellow 3D emoji face holding back tears with big trembling eyes. All are front views. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Cười híp mắt | `custom/assets/emoji-fluent-3d/reactions/grinning_squinting_face.png` |
| 2 | Cười ra nước mắt | `custom/assets/emoji-fluent-3d/reactions/face_with_tears_of_joy.png` |
| 3 | Mắt tim | `custom/assets/emoji-fluent-3d/reactions/smiling_face_with_heart_eyes.png` |
| 4 | Kính râm | `custom/assets/emoji-fluent-3d/reactions/smiling_face_with_sunglasses.png` |
| 5 | Tiệc tùng | `custom/assets/emoji-fluent-3d/reactions/partying_face.png` |
| 6 | Suy nghĩ | `custom/assets/emoji-fluent-3d/reactions/thinking_face.png` |
| 7 | Rơi lệ | `custom/assets/emoji-fluent-3d/reactions/crying_face.png` |
| 8 | Khóc to | `custom/assets/emoji-fluent-3d/reactions/loudly_crying_face.png` |
| 9 | Hoảng hốt | `custom/assets/emoji-fluent-3d/reactions/face_screaming_in_fear.png` |
| 10 | Rưng rưng | `custom/assets/emoji-fluent-3d/reactions/face_holding_back_tears.png` |

</details>

## Ảnh 13 · Biểu cảm · bảng 2

Lưu: `custom/sheets/cam_xuc_2.png`

```text
A sprite sheet of exactly 10 separate cute 3D emoji stickers, arranged in a neat grid of 5 columns and 2 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a round glossy yellow 3D emoji face grinning nervously with a drop of sweat; a round glossy yellow 3D emoji face licking its lips; a round glossy yellow 3D emoji face curious with a monocle; a round glossy yellow 3D emoji face smiling innocently with a golden halo; a cute round gray robot face with a small antenna. Row 2 from left to right: a yellow cartoon hand giving a thumbs up; two yellow cartoon hands clapping; a yellow cartoon hand waving; two yellow cartoon hands raised in celebration; two yellow cartoon hands shaking. All are front views. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Cười toát mồ hôi | `custom/assets/emoji-fluent-3d/reactions/grinning_face_with_sweat.png` |
| 2 | Thèm | `custom/assets/emoji-fluent-3d/reactions/face_savoring_food.png` |
| 3 | Kính lúp | `custom/assets/emoji-fluent-3d/reactions/face_with_monocle.png` |
| 4 | Thiên thần | `custom/assets/emoji-fluent-3d/reactions/smiling_face_with_halo.png` |
| 5 | Rô-bốt | `custom/assets/emoji-fluent-3d/reactions/robot.png` |
| 6 | Like | `custom/assets/emoji-fluent-3d/hands/thumbs_up.png` |
| 7 | Vỗ tay | `custom/assets/emoji-fluent-3d/hands/clapping_hands.png` |
| 8 | Vẫy tay | `custom/assets/emoji-fluent-3d/hands/waving_hand.png` |
| 9 | Giơ tay | `custom/assets/emoji-fluent-3d/hands/raising_hands.png` |
| 10 | Bắt tay | `custom/assets/emoji-fluent-3d/hands/handshake.png` |

</details>

## Ảnh 14 · Biểu cảm · bảng 3

Lưu: `custom/sheets/cam_xuc_3.png`

```text
A sprite sheet of exactly 10 separate cute 3D emoji stickers, arranged in a neat grid of 5 columns and 2 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a yellow cartoon hand pointing up; a yellow cartoon hand pointing left; a cute flame; a glowing golden star with sparkles; a red cross mark made of two rounded bars. Row 2 from left to right: a white speech bubble; a pink pig face; a pink pig standing, side view; a brown horse head; a black chess pawn. All are front views. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Chỉ lên | `custom/assets/emoji-fluent-3d/hands/index_pointing_up.png` |
| 2 | Chỉ trái | `custom/assets/emoji-fluent-3d/hands/backhand_index_pointing_left.png` |
| 3 | Lửa | `custom/assets/emoji-fluent-3d/symbols/fire.png` |
| 4 | Ngôi sao | `custom/assets/emoji-fluent-3d/symbols/glowing_star.png` |
| 5 | Dấu X | `custom/assets/emoji-fluent-3d/symbols/cross_mark.png` |
| 6 | Bong bóng chat | `custom/assets/emoji-fluent-3d/symbols/speech_balloon.png` |
| 7 | Mặt heo | `custom/assets/emoji-fluent-3d/animals/pig_face.png` |
| 8 | Chú heo | `custom/assets/emoji-fluent-3d/animals/pig.png` |
| 9 | Đầu ngựa | `custom/assets/emoji-fluent-3d/game-items/horse_face.png` |
| 10 | Quân tốt | `custom/assets/emoji-fluent-3d/game-items/chess_pawn.png` |

</details>

## Ảnh 15 · Avatar người chơi · 15 avatar còn lại

Lưu: `custom/sheets/avatar_2.png`

```text
A sprite sheet of exactly 15 separate cute round avatar badges, each a head-and-shoulders character inside a circle with a soft pastel background color, arranged in a neat grid of 5 columns and 3 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a steamed bun (bánh bao) with rosy cheeks on a cream circle; a baby penguin on a sky blue circle; a little green frog on a mint circle; a cheerful avocado half on a lemon yellow circle; a corgi puppy on a peach circle. Row 2 from left to right: a rice ball (onigiri) with a strip of seaweed on a mint circle; a shiba inu puppy on a lavender circle; a strawberry on a pink circle; a smiling green jackfruit on a lemon yellow circle; a gray kitten on a pink circle. Row 3 from left to right: a green sugar-apple fruit on a peach circle; a cream puff pastry on a lavender circle; a milk carton on a sky blue circle; a little monkey on a cream circle; a yellow baby chick on a mint circle. All are front views. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Bánh | `custom/assets/avatars-dicebear/fun-emoji/png/banh.png` |
| 2 | Bi | `custom/assets/avatars-dicebear/fun-emoji/png/bi.png` |
| 3 | Bin | `custom/assets/avatars-dicebear/fun-emoji/png/bin.png` |
| 4 | Bơ | `custom/assets/avatars-dicebear/fun-emoji/png/bo.png` |
| 5 | Bon | `custom/assets/avatars-dicebear/fun-emoji/png/bon.png` |
| 6 | Cốm | `custom/assets/avatars-dicebear/fun-emoji/png/com.png` |
| 7 | Cún | `custom/assets/avatars-dicebear/fun-emoji/png/cun.png` |
| 8 | Dâu | `custom/assets/avatars-dicebear/fun-emoji/png/dau.png` |
| 9 | Mít | `custom/assets/avatars-dicebear/fun-emoji/png/mit.png` |
| 10 | Miu | `custom/assets/avatars-dicebear/fun-emoji/png/miu.png` |
| 11 | Na | `custom/assets/avatars-dicebear/fun-emoji/png/na.png` |
| 12 | Su | `custom/assets/avatars-dicebear/fun-emoji/png/su.png` |
| 13 | Sữa | `custom/assets/avatars-dicebear/fun-emoji/png/sua.png` |
| 14 | Tèo | `custom/assets/avatars-dicebear/fun-emoji/png/teo.png` |
| 15 | Tí | `custom/assets/avatars-dicebear/fun-emoji/png/ti.png` |

</details>

## Ảnh 16 · Avatar thú (bot Tiến Lên) · 13 con

Lưu: `custom/sheets/avatar_thu.png`

```text
A sprite sheet of exactly 13 separate cute round animal head avatars, arranged in a neat grid of 5 columns and 3 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a bear head; a chick head; a duck head; a elephant head; a frog head. Row 2 from left to right: a horse head; a monkey head; a owl head; a panda head; a penguin head. Row 3 from left to right: a pig head; a rabbit head; a zebra head. All are front views of the head only. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Gấu | `custom/assets/avatars-animals-remastered-kenney/PNG/Round/bear.png` |
| 2 | Gà con | `custom/assets/avatars-animals-remastered-kenney/PNG/Round/chick.png` |
| 3 | Vịt | `custom/assets/avatars-animals-remastered-kenney/PNG/Round/duck.png` |
| 4 | Voi | `custom/assets/avatars-animals-remastered-kenney/PNG/Round/elephant.png` |
| 5 | Ếch | `custom/assets/avatars-animals-remastered-kenney/PNG/Round/frog.png` |
| 6 | Ngựa | `custom/assets/avatars-animals-remastered-kenney/PNG/Round/horse.png` |
| 7 | Khỉ | `custom/assets/avatars-animals-remastered-kenney/PNG/Round/monkey.png` |
| 8 | Cú | `custom/assets/avatars-animals-remastered-kenney/PNG/Round/owl.png` |
| 9 | Gấu trúc | `custom/assets/avatars-animals-remastered-kenney/PNG/Round/panda.png` |
| 10 | Chim cánh cụt | `custom/assets/avatars-animals-remastered-kenney/PNG/Round/penguin.png` |
| 11 | Heo | `custom/assets/avatars-animals-remastered-kenney/PNG/Round/pig.png` |
| 12 | Thỏ | `custom/assets/avatars-animals-remastered-kenney/PNG/Round/rabbit.png` |
| 13 | Ngựa vằn | `custom/assets/avatars-animals-remastered-kenney/PNG/Round/zebra.png` |

</details>

## Ảnh 17 · Nhân vật bot trong bàn 3D · 15 nhân vật

Lưu: `custom/sheets/nhan_vat.png`

```text
A sprite sheet of exactly 15 separate cute chibi characters, head and shoulders, arranged in a neat grid of 5 columns and 3 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a toddler with a pink bow; a baby green dragon; a royal guard with a tall bearskin hat; a playful monkey; a ninja in a navy mask. Row 2 from left to right: a panda; a wizard with a starry purple hat; a prince with a small golden crown; a princess with a tiara; a friendly robot. Row 3 from left to right: Santa Claus; a teddy bear; a unicorn with a rainbow mane; a girl astronaut in a white helmet; a fairy girl with tiny wings. All are front views. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Em bé | `custom/assets/emoji-fluent-3d/characters/child.png` |
| 2 | Rồng | `custom/assets/emoji-fluent-3d/characters/dragon.png` |
| 3 | Lính gác | `custom/assets/emoji-fluent-3d/characters/guard.png` |
| 4 | Khỉ | `custom/assets/emoji-fluent-3d/characters/monkey.png` |
| 5 | Ninja | `custom/assets/emoji-fluent-3d/characters/ninja.png` |
| 6 | Gấu trúc | `custom/assets/emoji-fluent-3d/characters/panda.png` |
| 7 | Pháp sư | `custom/assets/emoji-fluent-3d/characters/person_mage.png` |
| 8 | Hoàng tử | `custom/assets/emoji-fluent-3d/characters/prince.png` |
| 9 | Công chúa | `custom/assets/emoji-fluent-3d/characters/princess.png` |
| 10 | Rô-bốt | `custom/assets/emoji-fluent-3d/characters/robot.png` |
| 11 | Ông già Noel | `custom/assets/emoji-fluent-3d/characters/santa_claus.png` |
| 12 | Gấu bông | `custom/assets/emoji-fluent-3d/characters/teddy_bear.png` |
| 13 | Kỳ lân | `custom/assets/emoji-fluent-3d/characters/unicorn.png` |
| 14 | Phi hành gia | `custom/assets/emoji-fluent-3d/characters/woman_astronaut.png` |
| 15 | Tiên nữ | `custom/assets/emoji-fluent-3d/characters/woman_fairy.png` |

</details>

## Ảnh 18 · Quân cờ Cá Ngựa, Caro và mặt sau Bài Màu

Lưu: `custom/sheets/co.png`

```text
A sprite sheet of exactly 7 separate cute board game pieces, arranged in a neat grid of 4 columns and 2 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a round red board game token with a white horse head emblem; a round blue board game token with a white horse head emblem; a round green board game token with a white horse head emblem; a round yellow board game token with a white horse head emblem. Row 2 from left to right: a chunky glossy pink X piece made of two rounded bars; a chunky glossy sky blue ring piece; a tall card with rounded corners and a colorful rainbow swirl pattern around a round emblem split into four colored quarters. The horse tokens and the X and O pieces are seen from directly above; the card is a flat front view. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Quân ngựa đỏ | `custom/assets/games/co-ca-ngua/token_red.png` |
| 2 | Quân ngựa xanh dương | `custom/assets/games/co-ca-ngua/token_blue.png` |
| 3 | Quân ngựa xanh lá | `custom/assets/games/co-ca-ngua/token_green.png` |
| 4 | Quân ngựa vàng | `custom/assets/games/co-ca-ngua/token_yellow.png` |
| 5 | Quân X | `custom/assets/games/co-caro/piece_x.png` |
| 6 | Quân O | `custom/assets/games/co-caro/piece_o.png` |
| 7 | Mặt sau Bài Màu | `custom/assets/games/bai-mau/cards/back.png` |

</details>

## Ảnh 19 · Bàn Tiến Lên · Bàn cổ điển

Lưu: `custom/assets/bg-tables-generated/with-table/table_scene_classic.png` (ảnh nguyên tấm, không cắt)

```text
A flat straight-on top-down view of an empty card game room for a cute mobile game. In the center, a large stadium-shaped (pill-shaped) card table that spans about 82% of the image width and 72% of its height, slightly below the middle; a thick soft padded rim and a emerald green felt surface with a thin dashed stitch line just inside the rim. The table is empty: no cards, no chips, no people. Around the table, a soft warm cream wall with a faint repeating pattern of tiny card suit symbols. cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors. Even soft lighting. No text, no letters, no watermark. Wide 16:9 image, 1920x1080.
```

## Ảnh 20 · Bàn Tiến Lên · Bàn tím

Lưu: `custom/assets/bg-tables-generated/with-table/table_scene_lavender.png` (ảnh nguyên tấm, không cắt)

```text
A flat straight-on top-down view of an empty card game room for a cute mobile game. In the center, a large stadium-shaped (pill-shaped) card table that spans about 82% of the image width and 72% of its height, slightly below the middle; a thick soft padded rim and a lavender purple felt surface with a thin dashed stitch line just inside the rim. The table is empty: no cards, no chips, no people. Around the table, a soft pale lilac wall with a faint repeating pattern of tiny card suit symbols. cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors. Even soft lighting. No text, no letters, no watermark. Wide 16:9 image, 1920x1080.
```

## Ảnh 21 · Bàn Tiến Lên · Bàn bạc hà

Lưu: `custom/assets/bg-tables-generated/with-table/table_scene_mint.png` (ảnh nguyên tấm, không cắt)

```text
A flat straight-on top-down view of an empty card game room for a cute mobile game. In the center, a large stadium-shaped (pill-shaped) card table that spans about 82% of the image width and 72% of its height, slightly below the middle; a thick soft padded rim and a mint green felt surface with a thin dashed stitch line just inside the rim. The table is empty: no cards, no chips, no people. Around the table, a soft pale mint wall with a faint repeating pattern of tiny card suit symbols. cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors. Even soft lighting. No text, no letters, no watermark. Wide 16:9 image, 1920x1080.
```

## Ảnh 22 · Bàn Tiến Lên · Bàn đào

Lưu: `custom/assets/bg-tables-generated/with-table/table_scene_peach.png` (ảnh nguyên tấm, không cắt)

```text
A flat straight-on top-down view of an empty card game room for a cute mobile game. In the center, a large stadium-shaped (pill-shaped) card table that spans about 82% of the image width and 72% of its height, slightly below the middle; a thick soft padded rim and a peach orange felt surface with a thin dashed stitch line just inside the rim. The table is empty: no cards, no chips, no people. Around the table, a soft pale peach wall with a faint repeating pattern of tiny card suit symbols. cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors. Even soft lighting. No text, no letters, no watermark. Wide 16:9 image, 1920x1080.
```

## Ảnh 23 · Bàn Tiến Lên · Bàn hoa anh đào

Lưu: `custom/assets/bg-tables-generated/with-table/table_scene_sakura.png` (ảnh nguyên tấm, không cắt)

```text
A flat straight-on top-down view of an empty card game room for a cute mobile game. In the center, a large stadium-shaped (pill-shaped) card table that spans about 82% of the image width and 72% of its height, slightly below the middle; a thick soft padded rim and a pink felt surface with a thin dashed stitch line just inside the rim. The table is empty: no cards, no chips, no people. Around the table, a soft pale pink with a few cherry blossom petals wall with a faint repeating pattern of tiny card suit symbols. cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors. Even soft lighting. No text, no letters, no watermark. Wide 16:9 image, 1920x1080.
```

## Ảnh 24 · Bàn Tiến Lên · Bàn xanh trời

Lưu: `custom/assets/bg-tables-generated/with-table/table_scene_sky.png` (ảnh nguyên tấm, không cắt)

```text
A flat straight-on top-down view of an empty card game room for a cute mobile game. In the center, a large stadium-shaped (pill-shaped) card table that spans about 82% of the image width and 72% of its height, slightly below the middle; a thick soft padded rim and a sky blue felt surface with a thin dashed stitch line just inside the rim. The table is empty: no cards, no chips, no people. Around the table, a soft pale sky blue wall with a faint repeating pattern of tiny card suit symbols. cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors. Even soft lighting. No text, no letters, no watermark. Wide 16:9 image, 1920x1080.
```

## Ảnh 25 · Bàn Tiến Lên · Bàn Tết

Lưu: `custom/assets/bg-tables-generated/with-table/table_scene_tet.png` (ảnh nguyên tấm, không cắt)

```text
A flat straight-on top-down view of an empty card game room for a cute mobile game. In the center, a large stadium-shaped (pill-shaped) card table that spans about 82% of the image width and 72% of its height, slightly below the middle; a thick soft padded rim and a red felt surface with a thin dashed stitch line just inside the rim. The table is empty: no cards, no chips, no people. Around the table, a soft warm red and gold with apricot blossoms and small red lanterns wall with a faint repeating pattern of tiny card suit symbols. cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors. Even soft lighting. No text, no letters, no watermark. Wide 16:9 image, 1920x1080.
```

# Đợt 1 · đã làm

## Ảnh 26 · Bắn Cá · bảng 1: 6 cá nhỏ + 4 cá vừa

Lưu: `custom/sheets/ca_1.png`

```text
A sprite sheet of exactly 10 separate cute sea creatures, arranged in a neat grid of 5 columns and 2 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a tiny guppy with a huge flowing rainbow fan tail in pink, orange and turquoise; a small slender neon tetra with a glowing electric blue stripe and a bright red lower half; a coral pink seahorse with a curled tail, upright, seen from the side facing left; a peach orange five-armed starfish with tiny white dots and a happy face, seen from the front; a parrotfish with a little beak, mint green and turquoise scales and pink fins. Row 2 from left to right: a chubby lionhead goldfish with a bumpy red cap, bright orange body and a double flowing tail; a round flat butterflyfish with yellow and white vertical stripes and a black eye stripe; a nautilus with a cream and caramel striped spiral shell and short soft tentacles; a manta ray at a three-quarter angle from above, navy blue back with pastel cyan spots; a chubby deep purple anglerfish with a glowing golden lantern above its head and small friendly teeth. Every fish is seen from the side and faces left (head on the left), unless its description says otherwise. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Cá Bảy Màu · Cá nhỏ ×2 | `custom/ban-ca/ca_bay_mau.png` |
| 2 | Cá Neon · Cá nhỏ ×3 | `custom/ban-ca/ca_neon.png` |
| 3 | Cá Ngựa · Cá nhỏ ×4 | `custom/ban-ca/ca_ngua.png` |
| 4 | Sao Biển · Cá nhỏ ×3 | `custom/ban-ca/sao_bien.png` |
| 5 | Cá Mỏ Vẹt · Cá nhỏ ×5 | `custom/ban-ca/ca_mo_vet.png` |
| 6 | Cá Vàng Đầu Lân · Cá nhỏ ×5 | `custom/ban-ca/ca_vang_dau_lan.png` |
| 7 | Cá Bướm · Cá vừa ×8 | `custom/ban-ca/ca_buom.png` |
| 8 | Ốc Anh Vũ · Cá vừa ×10 | `custom/ban-ca/oc_anh_vu.png` |
| 9 | Cá Đuối Ó · Cá vừa ×12 | `custom/ban-ca/ca_duoi.png` |
| 10 | Cá Lồng Đèn · Cá vừa ×16 | `custom/ban-ca/ca_long_den.png` |

</details>

## Ảnh 27 · Bắn Cá · bảng 2: cá vừa và cá lớn

Lưu: `custom/sheets/ca_2.png`

```text
A sprite sheet of exactly 8 separate cute sea creatures, arranged in a neat grid of 4 columns and 2 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: an ocean sunfish (mola mola) with a round flat lavender-gray body, tall top and bottom fins and rosy cheeks; a ruby red spiky king crab wearing a tiny golden crown, claws raised, seen from the front; a golden koi carp with gold and red scales, long whiskers and flowing ribbon fins; a swordfish with a long pointed bill, cobalt blue back, pale blue belly and a tall sail fin. Row 2 from left to right: a pastel blue narwhal with white speckles and a long spiral golden horn; a gray-blue hammerhead shark with a wide hammer-shaped head and a friendly smile; a chibi mermaid girl with long wavy pink hair, a turquoise fish tail and a pearl tiara, swimming; a sea turtle with a golden shell studded with jewels and coins and mint green flippers. Every creature is seen from the side and faces left (head on the left), unless its description says otherwise. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Cá Mặt Trăng · Cá vừa ×18 | `custom/ban-ca/ca_mat_trang.png` |
| 2 | Cua Hoàng Đế · Cá vừa ×20 | `custom/ban-ca/cua_hoang_de.png` |
| 3 | Cá Chép Vàng · Cá lớn ×30 | `custom/ban-ca/ca_chep_vang.png` |
| 4 | Cá Kiếm · Cá lớn ×40 | `custom/ban-ca/ca_kiem.png` |
| 5 | Kỳ Lân Biển · Cá lớn ×45 | `custom/ban-ca/ky_lan_bien.png` |
| 6 | Cá Mập Búa · Cá lớn ×50 | `custom/ban-ca/ca_map_bua.png` |
| 7 | Nàng Tiên Cá · Cá lớn ×60 | `custom/ban-ca/nang_tien_ca.png` |
| 8 | Rùa Vàng Kho Báu · Cá lớn ×70 | `custom/ban-ca/rua_vang.png` |

</details>

## Ảnh 28 · Bắn Cá · bảng 3: 6 trùm

Lưu: `custom/sheets/ca_3.png`

```text
A sprite sheet of exactly 6 separate cute but majestic boss sea creatures, rich in detail, arranged in a neat grid of 3 columns and 2 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a chubby golden piggy wearing a diving mask and snorkel, with little fins, swimming; a round pastel yellow and pink toy submarine with portholes and a periscope, overflowing with gold coins; a giant golden sacred turtle from Vietnamese legend with an ornate jade green and gold shell, a glowing jade sword on its back. Row 2 from left to right: a purple and magenta kraken with many curling tentacles, big glossy eyes and a tiny pirate hat, seen from the front; an Asian sea dragon king with a long jade green and gold serpentine body in an S-curve, flowing whiskers and a small golden crown; a huge golden whale with a glittering body and a fountain of gold coins spouting above its head. Every creature is seen from the side and faces left (head on the left), unless its description says otherwise. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Heo Vàng Đại Dương · Trùm ×120 | `custom/ban-ca/heo_vang_dai_duong.png` |
| 2 | Tàu Ngầm Kho Báu · Trùm ×150 | `custom/ban-ca/tau_ngam_kho_bau.png` |
| 3 | Rùa Thần Kim Quy · Trùm ×180 | `custom/ban-ca/rua_than_kim_quy.png` |
| 4 | Thủy Quái Kraken · Trùm ×200 | `custom/ban-ca/kraken.png` |
| 5 | Long Vương Biển · Trùm ×250 | `custom/ban-ca/long_vuong.png` |
| 6 | Cá Voi Hoàng Kim · Trùm ×300 | `custom/ban-ca/ca_voi_hoang_kim.png` |

</details>

## Ảnh 29 · Bộ bài · chất bài và hình lá Át

Lưu: `custom/sheets/bai_chat.png`

```text
A sprite sheet of exactly 8 separate cute playing card emblems, arranged in a neat grid of 4 columns and 2 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a chunky rounded a heart symbol like a soft jelly candy, glossy hot pink and red; a chunky rounded a diamond (rhombus) symbol like a soft jelly candy, glossy coral red and orange; a chunky rounded a club (three round leaves and a short stem) symbol like a soft jelly candy, glossy dark charcoal with a hint of deep green; a chunky rounded a spade (upside-down heart with a short stem) symbol like a soft jelly candy, glossy dark navy and deep purple. Row 2 from left to right: an ornate a heart emblem in hot pink and red with small golden wings, a tiny crown and sparkles; an ornate a diamond (rhombus) emblem in coral red and orange with small golden wings, a tiny crown and sparkles; an ornate a club (three round leaves and a short stem) emblem in dark charcoal with a hint of deep green with small golden wings, a tiny crown and sparkles; an ornate a spade (upside-down heart with a short stem) emblem in dark navy and deep purple with small golden wings, a tiny crown and sparkles. All are flat front views, perfectly symmetrical. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Chất Cơ | `custom/cards/suit_hearts.png` |
| 2 | Chất Rô | `custom/cards/suit_diamonds.png` |
| 3 | Chất Chuồn | `custom/cards/suit_clubs.png` |
| 4 | Chất Bích | `custom/cards/suit_spades.png` |
| 5 | Át Cơ | `custom/cards/ace_hearts.png` |
| 6 | Át Rô | `custom/cards/ace_diamonds.png` |
| 7 | Át Chuồn | `custom/cards/ace_clubs.png` |
| 8 | Át Bích | `custom/cards/ace_spades.png` |

</details>

## Ảnh 30 · Bộ bài · nhân vật J Q K chất Cơ và Rô

Lưu: `custom/sheets/bai_nhanvat_1.png`

```text
A sprite sheet of exactly 6 separate cute chibi half-body character portraits for playing cards, arranged in a neat grid of 3 columns and 2 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a boy page knight in pink and white holding a heart-shaped shield; a princess in a pink ball gown holding a red rose, with a small heart tiara; a king with a fluffy red cape, a golden crown with a heart jewel and a heart-topped scepter. Row 2 from left to right: a merchant boy in orange and gold carrying a bag of gold coins; a queen in a golden gown with a jeweled tiara and a golden folding fan; a rich king in coral red and gold robes holding a big shining diamond. Every character is a half-body portrait, front view, looking at the viewer. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Bồi Cơ | `custom/cards/face_J_hearts.png` |
| 2 | Đầm Cơ | `custom/cards/face_Q_hearts.png` |
| 3 | Già Cơ | `custom/cards/face_K_hearts.png` |
| 4 | Bồi Rô | `custom/cards/face_J_diamonds.png` |
| 5 | Đầm Rô | `custom/cards/face_Q_diamonds.png` |
| 6 | Già Rô | `custom/cards/face_K_diamonds.png` |

</details>

## Ảnh 31 · Bộ bài · nhân vật J Q K chất Chuồn và Bích

Lưu: `custom/sheets/bai_nhanvat_2.png`

```text
A sprite sheet of exactly 6 separate cute chibi half-body character portraits for playing cards, arranged in a neat grid of 3 columns and 2 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a forest archer boy in green with a four-leaf-clover cap and a small bow; a flower fairy queen in green and white with a four-leaf-clover wand and tiny wings; a wise old king with a white beard, a crown made of leaves and a wooden staff. Row 2 from left to right: a ninja boy in navy blue with a mask and a tiny throwing star; a moon witch queen in deep purple with a starry hat and a crescent moon staff; a knight king in navy armor with a dark purple cape and a crown with a spade-shaped jewel. Every character is a half-body portrait, front view, looking at the viewer. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Bồi Chuồn | `custom/cards/face_J_clubs.png` |
| 2 | Đầm Chuồn | `custom/cards/face_Q_clubs.png` |
| 3 | Già Chuồn | `custom/cards/face_K_clubs.png` |
| 4 | Bồi Bích | `custom/cards/face_J_spades.png` |
| 5 | Đầm Bích | `custom/cards/face_Q_spades.png` |
| 6 | Già Bích | `custom/cards/face_K_spades.png` |

</details>

## Ảnh 32 · Bộ bài · 2 mặt sau

Lưu: `custom/sheets/bai_matsau.png`

```text
A sprite sheet of exactly 2 separate tall playing card back designs, each a vertical card with 2:3 proportions and rounded corners, arranged in a neat grid of 2 columns and 1 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: pastel pink with a symmetrical pattern of tiny white hearts and stars and a round golden medallion with a pink pig face in the center; deep navy and purple with a symmetrical pattern of tiny golden stars and moons and a round golden medallion with a pink pig face in the center. Both cards stand upright side by side, seen flat from the front. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Mặt sau hồng | `custom/cards/back.png` |
| 2 | Mặt sau tối | `custom/cards/back_dark.png` |

</details>

## Ảnh 33 · Icon game · bảng 1 (10 game)

Lưu: `custom/sheets/icon_1.png`

```text
A sprite sheet of exactly 10 separate cute game icon illustrations, each a compact tight group of objects, arranged in a neat grid of 5 columns and 2 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: three fanned playing cards showing only simple suit symbols, no letters or numbers on them with a happy pink piglet peeking from behind; four fanned playing cards showing only simple suit symbols, no letters or numbers on them with a golden sparkle burst behind; five playing cards showing only simple suit symbols, no letters or numbers on them fanned in an arc with a small golden crown on top; two playing cards showing only simple suit symbols, no letters or numbers on them standing next to a short stack of pastel casino chips; two playing cards showing only simple suit symbols, no letters or numbers on them next to tall stacks of pastel casino chips. Row 2 from left to right: three fanned playing cards showing only simple suit symbols, no letters or numbers on them next to a money bag full of gold coins; five fanned playing cards showing only simple suit symbols, no letters or numbers on them with a cute little flame beside them; three fanned playing cards showing only simple suit symbols, no letters or numbers on them next to a stack of lavender casino chips; a green gourd, a red crab and one white die with tiny animal pictures, grouped together; a round red ceramic bowl lifted slightly above a golden plate holding four coins, two red and two white. Each group is drawn from a slightly angled front view. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Tiến Lên | `custom/icons/tien-len.png` |
| 2 | Phỏm | `custom/icons/phom.png` |
| 3 | Mậu Binh | `custom/icons/mau-binh.png` |
| 4 | Xì Dách | `custom/icons/xi-dach.png` |
| 5 | Poker | `custom/icons/poker.png` |
| 6 | Bài Cào | `custom/icons/bai-cao.png` |
| 7 | Sâm Lốc | `custom/icons/sam-loc.png` |
| 8 | Liêng | `custom/icons/lieng.png` |
| 9 | Bầu Cua | `custom/icons/bau-cua.png` |
| 10 | Xóc Đĩa | `custom/icons/xoc-dia.png` |

</details>

## Ảnh 34 · Icon game · bảng 2 (8 game)

Lưu: `custom/sheets/icon_2.png`

```text
A sprite sheet of exactly 8 separate cute game icon illustrations, each a compact tight group of objects, arranged in a neat grid of 4 columns and 2 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: three rounded dice tumbling in the air, white and pastel pink with round dots; two round wooden Chinese chess pieces, one with a red rim and one with a black rim, engraved patterns instead of characters; four horse-head board game tokens in red, blue, green and yellow next to one white die; a small pastel tic-tac-toe board with chunky pink X pieces and sky blue O pieces. Row 2 from left to right: four colorful pastel game cards in red, yellow, green and blue with swirl patterns, no numbers; a pink bingo card with a grid of empty squares and three colorful lottery balls with stars; a tropical fish and a small pastel pink toy cannon with bubbles around them; a pastel coin pusher arcade machine with a pile of gold coins and a pink ticket coming out. Each group is drawn from a slightly angled front view. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Tài Xỉu | `custom/icons/tai-xiu.png` |
| 2 | Cờ Tướng | `custom/icons/co-tuong.png` |
| 3 | Cá Ngựa | `custom/icons/co-ca-ngua.png` |
| 4 | Cờ Caro | `custom/icons/co-caro.png` |
| 5 | Bài Màu | `custom/icons/bai-mau.png` |
| 6 | Lô Tô | `custom/icons/lo-to.png` |
| 7 | Bắn Cá | `custom/icons/ban-ca.png` |
| 8 | Đẩy Xu | `custom/icons/day-xu.png` |

</details>

## Ảnh 35 · Bầu Cua · 6 linh vật

Lưu: `custom/sheets/bau_cua.png`

```text
A sprite sheet of exactly 6 separate cute mascots for the Vietnamese dice game Bầu Cua, arranged in a neat grid of 3 columns and 2 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a round green bottle gourd with a little red ribbon at its neck, a small leaf on top and a happy face; a red crab with big round claws raised happily; an orange-red shrimp with long feelers and a curled tail. Row 2 from left to right: a blue and yellow fish with round fins, facing left; a proud rooster with a red comb and colorful tail feathers, standing; a baby deer with small antlers, light brown with white spots, standing. All mascots are seen from the front unless their description says otherwise. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Bầu | `custom/bau-cua/bau.png` |
| 2 | Cua | `custom/bau-cua/cua.png` |
| 3 | Tôm | `custom/bau-cua/tom.png` |
| 4 | Cá | `custom/bau-cua/ca.png` |
| 5 | Gà | `custom/bau-cua/ga.png` |
| 6 | Nai | `custom/bau-cua/nai.png` |

</details>

## Ảnh 36 · Súng, đạn, lưới, xu, dấu Lô Tô

Lưu: `custom/sheets/do_choi.png`

```text
A sprite sheet of exactly 10 separate cute game items, arranged in a neat grid of 5 columns and 2 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a toy cannon turret with a round base and a short thick barrel, pastel pink with one star badge; a toy cannon turret with a thicker barrel, mint green with two star badges; a toy cannon turret with a long barrel, sky blue with three star badges; a toy cannon turret with a double barrel, lavender purple and gold with four star badges; a deluxe toy cannon turret with a big triple barrel, shiny gold with ruby gems and five star badges. Row 2 from left to right: a single glowing round magic pearl with a soft cyan and pink glow; a round fishing net like a spider web made of pale aqua blue rope with small knots; a round coin with a glossy red lacquer face, a thin gold rim and an embossed flower; a round coin with a glossy ivory cream face, a thick gold rim and an embossed flower; a round glossy pink bingo marker chip with a red heart in the middle. The five cannons are seen from directly above with the barrel pointing up; the other items are seen from directly above. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Súng cấp 1 | `custom/assets/games/ban-ca/cannon_lv1_pink.png` |
| 2 | Súng cấp 2 | `custom/assets/games/ban-ca/cannon_lv2_mint.png` |
| 3 | Súng cấp 3 | `custom/assets/games/ban-ca/cannon_lv3_sky.png` |
| 4 | Súng cấp 4 | `custom/assets/games/ban-ca/cannon_lv4_lavender.png` |
| 5 | Súng cấp 5 | `custom/assets/games/ban-ca/cannon_lv5_gold.png` |
| 6 | Viên đạn | `custom/assets/games/ban-ca/bullet.png` |
| 7 | Lưới | `custom/assets/games/ban-ca/net.png` |
| 8 | Xu đỏ (Xóc Đĩa) | `custom/assets/games/xoc-dia/coin_red.png` |
| 9 | Xu trắng (Xóc Đĩa) | `custom/assets/games/xoc-dia/coin_white.png` |
| 10 | Dấu Lô Tô | `custom/assets/games/lo-to/marker_heart.png` |

</details>

## Ảnh 37 · Avatar người chơi

Lưu: `custom/sheets/avatar.png`

```text
A sprite sheet of exactly 8 separate cute round avatar badges, each a head-and-shoulders character inside a circle with a soft pastel background color, arranged in a neat grid of 4 columns and 2 rows with wide empty space between them. Nothing touches or overlaps, every item is complete and fully visible, all items about the same size, no extra items. Row 1 from left to right: a fluffy white cotton-ball puppy on a peach circle; a happy pink piglet on a pink circle; a playful orange kitten on a lemon yellow circle; a smiling strawberry ice cream cone on a mint circle. Row 2 from left to right: a squishy round white mochi with rosy cheeks on a lavender circle; a cheerful ripe mango on a sky blue circle; a cuddly brown teddy bear on a cream circle; a white bunny with long pink ears on a pink circle. All are front views with big shiny friendly eyes. Style for all: cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors, big shiny friendly eyes on living creatures. Plain solid pure white background (#FFFFFF) everywhere, no ground shadows, no text, no labels, no letters, no numbers, no watermark, no borders, no frames, no grid lines. Wide 16:9 image, 1920x1080.
```

<details><summary>Thứ tự và tên file sau khi cắt</summary>

| # | Món | File |
|---|---|---|
| 1 | Bông | `custom/assets/avatars-dicebear/fun-emoji/png/bong.png` |
| 2 | Heo | `custom/assets/avatars-dicebear/fun-emoji/png/heo.png` |
| 3 | Mèo | `custom/assets/avatars-dicebear/fun-emoji/png/meo.png` |
| 4 | Kem | `custom/assets/avatars-dicebear/fun-emoji/png/kem.png` |
| 5 | Mochi | `custom/assets/avatars-dicebear/fun-emoji/png/mochi.png` |
| 6 | Xoài | `custom/assets/avatars-dicebear/fun-emoji/png/xoai.png` |
| 7 | Gấu | `custom/assets/avatars-dicebear/fun-emoji/png/gau.png` |
| 8 | Thỏ | `custom/assets/avatars-dicebear/fun-emoji/png/tho.png` |

</details>

## Ảnh 38 · Nền màn loading

Lưu: `custom/assets/ui-premium-generated/lobby-backgrounds/bg_loading.jpg` (ảnh nguyên tấm, không cắt)

```text
A dreamy pastel fantasy sky world for a cute casino game loading screen: soft pink and lavender clouds, a sunburst in the center, a floating pink castle on a cloud island on the right, a winding candy road, a cute flying pink piglet on the left and a teddy bear on the right, gold coins, dice, hearts and gems floating around. cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors. Keep the top center and the bottom center calm and simple for a logo and a loading bar. No text, no letters, no watermark. Wide 16:9 image, 1920x1080.
```

## Ảnh 39 · Nền màn đăng nhập

Lưu: `custom/assets/ui-premium-generated/lobby-backgrounds/bg_login.jpg` (ảnh nguyên tấm, không cắt)

```text
A cute pastel miniature town seen from above at an angle for a casino game login screen: a fountain plaza in the middle, colorful little shops, cherry blossom trees, a river and the sea on the right, hot air balloons and a pig-shaped airship in the sky, a giant cute pink piglet floating on the left. cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors. Leave the right third of the image calm (sky and soft buildings) for a login panel. Shop signs are blank, no text, no letters, no watermark. Wide 16:9 image, 1920x1080.
```

## Ảnh 40 · Nền sảnh Tiến Lên

Lưu: `custom/assets/ui-premium-generated/lobby-backgrounds/lobby_dream_1920x1080.png` (ảnh nguyên tấm, không cắt)

```text
A soft dreamy pastel background for a cute card game lobby: pink and lavender gradient sky, fluffy clouds along the bottom, faint floating hearts, stars and playing card suit symbols, gentle bokeh. cute chibi style, glossy 3D cartoon render like a premium mobile casino game asset, soft rounded shapes, smooth clay-like materials with a subtle glow, soft studio lighting with a gentle rim light, vibrant candy pastel colors. Calm and low contrast so cards and buttons stay readable. No characters, no text, no letters, no watermark. Wide 16:9 image, 1920x1080.
```

## Ghi chú

- Bắn Cá: 24 loài mới nằm trong `custom/ban-ca/ca.json` (sửa được hệ số, loại, độ to). Ảnh trong `custom/ban-ca/thay/` vẽ lại 18 loài có sẵn. Xem riêng một loài: `play3d.html?game=ban-ca&fish=cus_kraken` hoặc `&fish=ca_map`.
- Muốn quay về ảnh mặc định: xoá ảnh trong `custom/` rồi chạy lại `python3 -E tools/apply_custom.py`.

Tổng cộng 40 prompt.
