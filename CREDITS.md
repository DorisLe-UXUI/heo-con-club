# Credits & License

Mọi asset trong `assets/` đều dùng được cho game thương mại.
Phần lớn là CC0 (không cần ghi tên). Chỉ những mục trong phần **"Bắt buộc"** mới phải ghi credit hoặc kèm file license.

Tải về và tạo ngày 2026-10-14.

## Bắt buộc ghi credit / kèm license

| Thư mục | Tác giả | License | Phải làm gì |
|---|---|---|---|
| `emoji-noto-animated/` | **Google**, Noto Animated Emoji | CC BY 4.0 | Ghi "Noto Animated Emoji by Google, CC BY 4.0". Ghi chú đã chỉnh sửa vì `sheet_96.png` và `still_128.png` là bản thu nhỏ. |
| `avatars-dicebear/fun-emoji/` | Davis Uche, qua DiceBear | CC BY 4.0 | Ghi tên tác giả + link license. |
| `avatars-dicebear/big-smile/` | Ashley Seo | CC BY 4.0 | Như trên. |
| `avatars-dicebear/adventurer/` | Lisa Wischofsky | CC BY 4.0 | Như trên. |
| `avatars-dicebear/toon-head/` | Johan Melin | CC BY 4.0 | Như trên. |
| `avatars-dicebear/croodles/` | vijay verma | CC BY 4.0 | Như trên. |
| `avatars-dicebear/personas/` | Draftbit | CC BY 4.0 | Như trên. |
| `avatars-dicebear/micah/` | Micah Lanier | CC BY 4.0 | Như trên. |
| `avatars-dicebear/miniavs/` | Webpixels | CC BY 4.0 | Như trên. |
| `avatars-dicebear/dylan/` | Natalia Spivak | CC BY 4.0 | Như trên. |
| `avatars-dicebear/avataaars/`, `avatars-dicebear/bottts/` | Pablo Stanley | "Free for personal and commercial use" | Ghi tên Pablo Stanley để an toàn. Xem avataaars.com và bottts.com. |
| `emoji-fluent-3d/` (gồm `characters/`, `game-items/`, `sea/`) | Microsoft, Fluent Emoji | MIT | Kèm nguyên văn `emoji-fluent-3d/LICENSE.txt` trong phần licenses của game. |
| Các asset tự vẽ có trang trí bằng emoji Fluent | khung avatar, thẻ quà ngày, thanh tiền, icon sảnh, linh vật Bầu Cua, quân Cá Ngựa | MIT (phần emoji) | Chỉ cần kèm file MIT ở trên. |
| `../js/vendor/` (three.js r147, GLTFLoader, SkeletonUtils) | three.js authors | MIT | Đây là code, không phải asset. Giữ file `js/vendor/LICENSE-three.txt` khi phát hành. |
| `fonts/*.ttf` | Google Fonts, nhiều tác giả | SIL OFL 1.1 | Được nhúng vào game. Giữ các file `OFL*.txt` khi phân phối. Không bán riêng font. |

Dòng credit gợi ý để dán vào game:

```
Animated emoji: Noto Animated Emoji by Google — CC BY 4.0 (resized)
3D emoji & characters: Microsoft Fluent Emoji — MIT
3D models: KayKit by Kay Lousberg (kaylousberg.com), Tiny Treats by Isa Lousberg (isalousberg.com) — CC0
3D engine: three.js — MIT
Avatars: DiceBear — "Fun Emoji Set" by Davis Uche, "Custom Avatar" by Ashley Seo, "Adventurer" by Lisa Wischofsky,
"ToonHead" by Johan Melin, "Croodles" by vijay verma, "Personas" by Draftbit, "Avatar Illustration System" by Micah Lanier,
"Miniavs" by Webpixels, "Dylan" by Natalia Spivak — CC BY 4.0; "Avataaars" & "Bottts" by Pablo Stanley
Fonts: SIL Open Font License (Google Fonts)
Other art, music & sounds: Kenney, Pixel-boy & AAA, pzUH, OpenGameArt contributors (CC0)
```

Muốn né hết chuyện credit thì dùng thay thế sau:
- Bộ bài: game đã dùng bộ `cards-heocon` (CC0). Có thể đổi sang `cards-pixel-kerenel`, `cards-sylly-vector` hoặc bộ Kenney.
- Avatar: `lorelei`, `notionists`, `thumbs`, `open-peeps`, `pixel-art`, hoặc avatar Kenney / Ninja.
- Emoji động: dùng emoji Fluent tĩnh và tự làm hiệu ứng nảy bằng code.

## Tự vẽ cho dự án này: CC0

Vẽ bằng code (Pillow), không dùng art của bên thứ ba, trừ các emoji Fluent dùng làm trang trí như ghi ở trên.

| Thư mục | Nội dung |
|---|---|
| `cards-heocon/` | Bộ bài Heo Con 52 lá + 2 mặt sau, vẽ bằng `tools/gen_cards.py`. Chất và J/Q/K là emoji Fluent (MIT), chữ số dùng font Grandstander (OFL). Game dùng bộ này. |
| `games/` | Asset riêng 10 game, 18 icon sảnh, chip, bát, đĩa, thẻ |
| `ui-premium-generated/` | UI kẹo pastel, 40 câu hô, khung avatar, VIP, nền sảnh |
| `bg-tables-generated/` | 7 bàn chơi |
| `ui-jelly-pzuh/buttons-pastel/` | Đổi màu từ bộ nút pzUH (CC0) |

Cờ Tướng dùng font LXGW WenKai TC và ZCOOL KuaiLe (OFL) để vẽ chữ. Ảnh xuất ra vẫn là CC0. Bài Màu là thiết kế riêng, không liên quan thương hiệu nào.

## CC0 1.0 (public domain, không cần credit)

### Model 3D (`3d/`)

Lấy từ các file zip có sẵn trong máy, ở thư mục dự án farm-city-3d. Mỗi bộ có file license gốc chép kèm trong `3d/LICENSE-*.txt`.

| Model | Bộ gốc | Tác giả |
|---|---|---|
| `adv_*`, `anim_general`, `anim_move` | KayKit Adventurers 2.0 FREE | Kay Lousberg, www.kaylousberg.com |
| `mini_*` | KayKit Mini-Game Variety Pack 1.2 | Kay Lousberg |
| `bgb_*` | KayKit Board Game Bits 1.0 FREE | Kay Lousberg |
| `tt_*` | Tiny Treats Fun Playground 1.0 FREE | Isa Lousberg, www.isalousberg.com |
| `pp_*` | Tiny Treats Pretty Park 1.0 FREE | Isa Lousberg |
| `hh_*` | Tiny Treats Homely House 1.0 FREE | Isa Lousberg |
| `hp_*` | Tiny Treats House Plants 1.0 FREE | Isa Lousberg |
| `kf_*` | KayKit Forest Nature Pack 1.0 FREE | Kay Lousberg |

Ảnh trong `3d/renders/` là ảnh chụp từ các model trên, cũng CC0.
`3d/js/tex_town.js` và `3d/js/tex_cards.js` nhúng sẵn icon game, emoji Fluent (MIT) và lá bài Heo Con (CC0, tự vẽ) để vẽ biển hiệu, lá bài trên mái nhà và bộ bài 3D.
Đường, vỉa hè, nhà cửa hàng, xe hơi, mây, bóng bay và máy đẩy xu được dựng bằng code, không dùng asset ngoài.
Hai tác giả không bắt buộc ghi tên nhưng có ghi trong license là rất mong được ghi.

### Bài, UI, icon, nền

| Thư mục | Tác giả | Nguồn |
|---|---|---|
| `boardgame-kenney/` | Kenney | https://kenney.nl/assets/boardgame-pack |
| `cards-kenney-pixel/` | Kenney | https://kenney.nl/assets/playing-cards-pack |
| `cards-sylly-vector/` | Sylly (Andrew Tidey) | https://opengameart.org/content/cards-set |
| `cards-chips-mehrasaur/` | mehrasaur | https://opengameart.org/content/playing-card-assets-52-cards-deck-chips |
| `cards-pixel-kerenel/` | KereneL | https://kerenel.itch.io/pixelart-cards |
| `cards-stylized-mreliptik/` | Victor Meunier (MrEliptik) | https://mreliptik.itch.io/playing-cards-packs-52-cards |
| `ui-jelly-pzuh/` | pzUH | https://opengameart.org/content/free-game-gui |
| `ui-kenney/` | Kenney | https://kenney.nl/assets/ui-pack |
| `ui-puzzle-kenney/` | Kenney | https://kenney.nl/assets/puzzle-pack-2 |
| `icons-game-kenney/` | Kenney | https://kenney.nl/assets/game-icons |
| `icons-boardgame-kenney/` | Kenney | https://kenney.nl/assets/board-game-icons |
| `cursors-kenney/` | Kenney | https://kenney.nl/assets/cursor-pack |
| `bg-clouds-kenney/` | Kenney | https://kenney.nl/assets/background-elements |
| `bg-patterns-kenney/` | Kenney | https://kenney.nl/assets/pattern-pack |

### Nhân vật, avatar, emote, hiệu ứng, vật phẩm

| Thư mục | Tác giả | Nguồn |
|---|---|---|
| `avatars-animals-kenney/` | Kenney | https://kenney.nl/assets/animal-pack |
| `avatars-animals-remastered-kenney/` | Kenney | https://kenney.nl/assets/animal-pack-remastered |
| `characters-toon-kenney/` | Kenney | https://kenney.nl/assets/toon-characters |
| `characters-platformer-kenney/` | Kenney | https://kenney.nl/assets/platformer-characters |
| `characters-shapes-kenney/` | Kenney | https://kenney.nl/assets/shape-characters |
| `characters-jumper-kenney/` | Kenney | https://kenney.nl/assets/jumper-pack |
| `characters-physics-kenney/` | Kenney | https://kenney.nl/assets/physics-assets |
| `avatars-dicebear/lorelei/`, `notionists/`, `thumbs/`, `open-peeps/`, `pixel-art/` | Lisa Wischofsky, Zoish, DiceBear, Pablo Stanley | https://www.dicebear.com/licenses/ |
| `avatars-ninja-facesets/`, `emotes-ninja/`, `fx-ninja/`, `items-ninja/` | Pixel-boy & AAA | https://pixel-boy.itch.io/ninja-adventure-asset-pack |
| `emotes-kenney/` | Kenney | https://kenney.nl/assets/emotes-pack |
| `fx-particles-kenney/` | Kenney | https://kenney.nl/assets/particle-pack |
| `fx-smoke-kenney/` | Kenney | https://kenney.nl/assets/smoke-particles |

### Nhạc nền

| File trong `music-bgm/` | Tác giả | Nguồn |
|---|---|---|
| `opengameart/happy-clappy-loop__OwlishMedia.wav` | OwlishMedia | https://opengameart.org/content/happy-clappy-loop |
| `opengameart/menu-loop-tiggo__qubodup.ogg`, `level-loop-tigrun__qubodup.ogg` | qubodup | https://opengameart.org/node/174263 |
| `opengameart/happy-adventure__TinyWorlds.mp3` | TinyWorlds | https://opengameart.org/content/happy-adventure-loop |
| `opengameart/happy-vibes__Ruskerdax.mp3` | Ruskerdax | https://opengameart.org/node/160228 |
| `opengameart/good-morning__Cakeflaps.ogg` | Cakeflaps (You're Perfect Studio), dùng theo lựa chọn CC0 trên trang gốc | https://opengameart.org/node/86566 |
| `opengameart/menu-chill__etrock.wav` | etrock | https://opengameart.org/content/menu-chill-music |
| `opengameart/lofi-loop__omfgdude.ogg` | omfgdude | https://opengameart.org/node/94031 |
| `ninja-adventure/*.ogg` (19 bài) | Pixel-boy & AAA | https://pixel-boy.itch.io/ninja-adventure-asset-pack |

### Âm thanh

| Thư mục | Tác giả | Nguồn |
|---|---|---|
| `audio-casino-kenney/` | Kenney | https://kenney.nl/assets/casino-audio |
| `audio-interface-kenney/` | Kenney | https://kenney.nl/assets/interface-sounds |
| `audio-ui-kenney/` | Kenney | https://kenney.nl/assets/ui-audio |
| `audio-jingles-kenney/` | Kenney | https://kenney.nl/assets/music-jingles |
| `audio-digital-kenney/` | Kenney | https://kenney.nl/assets/digital-audio |
| `audio-impact-kenney/` | Kenney | https://kenney.nl/assets/impact-sounds |
| `audio-sfx-ninja/` | Pixel-boy & AAA | https://pixel-boy.itch.io/ninja-adventure-asset-pack |

Kenney, Pixel-boy và qubodup đều nói credit là tự nguyện nhưng rất vui nếu được ghi tên.

## Font (SIL Open Font License 1.1)

Có tiếng Việt: Baloo 2, Nunito, Coiny, Grandstander, Itim, Mali, Pangolin, Playpen Sans, Quicksand, Lemonada, Gluten, Paytone One, Patrick Hand, LXGW WenKai TC. Cherry Bomb One có bảng chữ tiếng Việt nhưng vẽ sai Đ và ừ ứ ử ữ ự; Coiny vẽ chữ V giống hệt U. Hai font này chỉ hợp với số hoặc chữ không dấu. `GrandstanderBlack-Regular.ttf` là bản tĩnh (wght 900) tạo từ `Grandstander[wght].ttf` bằng fontTools, cùng giấy phép OFL (`OFL-grandstander.txt`).
Chỉ chữ Hán giản thể: ZCOOL KuaiLe.
File license nằm cạnh font: `fonts/OFL-<tên>.txt`, `fonts/Baloo2-OFL.txt`, `fonts/Nunito-OFL.txt`.

## Không có trong repo công khai

Bộ **Cute Cards** của Dani Maccari (dani-maccari.itch.io/cute-cards-deck) cho dùng trong game nhưng **không cho phân phối lại asset**, nên repo GitHub không chứa thư mục `assets/cards-cute-danimaccari/`, trang `preview.html` và các ảnh demo ghép từ bộ bài đó. Muốn dùng lại bộ này thì tải miễn phí từ trang itch.io trên và đặt vào `assets/cards-cute-danimaccari/`. Game không cần bộ này.
