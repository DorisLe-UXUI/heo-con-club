// Pack .gltf (+ external .bin / textures) or .glb files into self-contained GLBs, and into
// assets/3d/js/<key>.js files that register base64 data (so three.js can load them from file://).
// Usage: node tools/pack3d.js <srcRoot> <assetsDir> [keyRegex]
'use strict';
const fs = require('fs');
const path = require('path');
const [, , SRC, ASSETS] = process.argv;

const LIST = {
  // KayKit Adventurers 2.0 (CC0, Kay Lousberg)
  adv_knight: 'adv/KayKit_Adventurers_2.0_FREE/Characters/gltf/Knight.glb',
  adv_barbarian: 'adv/KayKit_Adventurers_2.0_FREE/Characters/gltf/Barbarian.glb',
  adv_mage: 'adv/KayKit_Adventurers_2.0_FREE/Characters/gltf/Mage.glb',
  adv_ranger: 'adv/KayKit_Adventurers_2.0_FREE/Characters/gltf/Ranger.glb',
  adv_rogue: 'adv/KayKit_Adventurers_2.0_FREE/Characters/gltf/Rogue.glb',
  adv_rogue_hooded: 'adv/KayKit_Adventurers_2.0_FREE/Characters/gltf/Rogue_Hooded.glb',
  anim_general: 'adv/KayKit_Adventurers_2.0_FREE/Animations/gltf/Rig_Medium/Rig_Medium_General.glb',
  anim_move: 'adv/KayKit_Adventurers_2.0_FREE/Animations/gltf/Rig_Medium/Rig_Medium_MovementBasic.glb',
  // KayKit Mini-Game Variety Pack (CC0, Kay Lousberg)
  mini_bear: 'mini/Models/Characters/Bear/gltf/character_bear.gltf',
  mini_dog: 'mini/Models/Characters/Dog/gltf/character_dog.gltf',
  mini_duck: 'mini/Models/Characters/Duck/gltf/character_duck.gltf',
  mini_star: 'mini/Models/gltf/star.gltf.glb',
  mini_heart_red: 'mini/Models/gltf/heart_teamRed.gltf.glb',
  mini_heart_blue: 'mini/Models/gltf/heart_teamBlue.gltf.glb',
  mini_heart_yellow: 'mini/Models/gltf/heart_teamYellow.gltf.glb',
  mini_diamond_red: 'mini/Models/gltf/diamond_teamRed.gltf.glb',
  mini_diamond_blue: 'mini/Models/gltf/diamond_teamBlue.gltf.glb',
  mini_diamond_yellow: 'mini/Models/gltf/diamond_teamYellow.gltf.glb',
  mini_lightning: 'mini/Models/gltf/lightning.gltf.glb',
  mini_powerup: 'mini/Models/gltf/powerupBlock_teamYellow.gltf.glb',
  mini_ball_red: 'mini/Models/gltf/ball_teamRed.gltf.glb',
  mini_ring_blue: 'mini/Models/gltf/ring_teamBlue.gltf.glb',
  mini_flag_red: 'mini/Models/gltf/flag_teamRed.gltf.glb',
  mini_tile_blue: 'mini/Models/gltf/tileLarge_teamBlue.gltf.glb',
  // KayKit Board Game Bits (CC0, Kay Lousberg)
  bgb_coin_gold: 'bgb/coin_gold.gltf',
  bgb_coin_silver: 'bgb/coin_silver.gltf',
  bgb_coin_copper: 'bgb/coin_copper.gltf',
  bgb_coin_10_gold: 'bgb/coin_10_gold.gltf',
  bgb_d6_red: 'bgb/D6_A_red.gltf',
  bgb_d6_blue: 'bgb/D6_A_blue.gltf',
  bgb_d6_green: 'bgb/D6_A_green.gltf',
  bgb_d6_yellow: 'bgb/D6_A_yellow.gltf',
  bgb_d20_blue: 'bgb/D20_blue.gltf',
  bgb_d8_red: 'bgb/D8_red.gltf',
  bgb_hourglass: 'bgb/hourglass.gltf',
  bgb_cube_gold: 'bgb/cube_gold.gltf',
  bgb_pawn_red: 'bgb/pawn_A_red.gltf',
  // Tiny Treats Fun Playground (CC0, Isa Lousberg)
  tt_merry_go_round: 'tiny/Tiny_Treats_Fun_Playground_1.0_FREE/Assets/gltf/merry_go_round.gltf',
  tt_spring_horse: 'tiny/Tiny_Treats_Fun_Playground_1.0_FREE/Assets/gltf/spring_horse_A.gltf',
  tt_slide: 'tiny/Tiny_Treats_Fun_Playground_1.0_FREE/Assets/gltf/slide_A.gltf',
  tt_tire_pink: 'tiny/Tiny_Treats_Fun_Playground_1.0_FREE/Assets/gltf/tire_pink.gltf',
  tt_sandcastle: 'tiny/Tiny_Treats_Fun_Playground_1.0_FREE/Assets/gltf/sandcastle_A.gltf',
  tt_tree: 'tiny/Tiny_Treats_Fun_Playground_1.0_FREE/Assets/gltf/tree_small.gltf',
  tt_stumps: 'tiny/Tiny_Treats_Fun_Playground_1.0_FREE/Assets/gltf/stepping_stumps_A_pink.gltf',
  // Tiny Treats Pretty Park (CC0, Isa Lousberg)
  pp_bench: 'park/Tiny_Treats_Pretty_Park_1.0_FREE/Assets/gltf/bench.gltf',
  pp_bird: 'park/Tiny_Treats_Pretty_Park_1.0_FREE/Assets/gltf/bird.gltf',
  pp_bush: 'park/Tiny_Treats_Pretty_Park_1.0_FREE/Assets/gltf/bush.gltf',
  pp_bush_large: 'park/Tiny_Treats_Pretty_Park_1.0_FREE/Assets/gltf/bush_large.gltf',
  pp_cobble: 'park/Tiny_Treats_Pretty_Park_1.0_FREE/Assets/gltf/cobble_stones.gltf',
  pp_cobble_large: 'park/Tiny_Treats_Pretty_Park_1.0_FREE/Assets/gltf/cobble_stones_large.gltf',
  pp_flower_a: 'park/Tiny_Treats_Pretty_Park_1.0_FREE/Assets/gltf/flower_A.gltf',
  pp_flower_b: 'park/Tiny_Treats_Pretty_Park_1.0_FREE/Assets/gltf/flower_B.gltf',
  pp_fountain: 'park/Tiny_Treats_Pretty_Park_1.0_FREE/Assets/gltf/fountain.gltf',
  pp_grass_a: 'park/Tiny_Treats_Pretty_Park_1.0_FREE/Assets/gltf/grass_A.gltf',
  pp_grass_b: 'park/Tiny_Treats_Pretty_Park_1.0_FREE/Assets/gltf/grass_B.gltf',
  pp_hedge_corner: 'park/Tiny_Treats_Pretty_Park_1.0_FREE/Assets/gltf/hedge_corner.gltf',
  pp_hedge: 'park/Tiny_Treats_Pretty_Park_1.0_FREE/Assets/gltf/hedge_straight.gltf',
  pp_hedge_long: 'park/Tiny_Treats_Pretty_Park_1.0_FREE/Assets/gltf/hedge_straight_long.gltf',
  pp_lantern: 'park/Tiny_Treats_Pretty_Park_1.0_FREE/Assets/gltf/street_lantern.gltf',
  pp_trashcan: 'park/Tiny_Treats_Pretty_Park_1.0_FREE/Assets/gltf/trashcan.gltf',
  pp_tree: 'park/Tiny_Treats_Pretty_Park_1.0_FREE/Assets/gltf/tree.gltf',
  pp_tree_large: 'park/Tiny_Treats_Pretty_Park_1.0_FREE/Assets/gltf/tree_large.gltf',
  // Tiny Treats Homely House (CC0, Isa Lousberg)
  hh_house: 'house/Tiny_Treats_Homely_House_1.0_FREE/Assets/gltf/house.gltf',
  hh_mailbox: 'house/Tiny_Treats_Homely_House_1.0_FREE/Assets/gltf/mailbox.gltf',
  hh_foliage_a: 'house/Tiny_Treats_Homely_House_1.0_FREE/Assets/gltf/foliage_A.gltf',
  hh_foliage_b: 'house/Tiny_Treats_Homely_House_1.0_FREE/Assets/gltf/foliage_B.gltf',
  hh_fence_long: 'house/Tiny_Treats_Homely_House_1.0_FREE/Assets/gltf/fence_straight_long.gltf',
  hh_fence_corner: 'house/Tiny_Treats_Homely_House_1.0_FREE/Assets/gltf/fence_corner.gltf',
  hh_gate: 'house/Tiny_Treats_Homely_House_1.0_FREE/Assets/gltf/gate_single.gltf',
  hh_bench_a: 'house/Tiny_Treats_Homely_House_1.0_FREE/Assets/gltf/bench_A.gltf',
  hh_bench_b: 'house/Tiny_Treats_Homely_House_1.0_FREE/Assets/gltf/bench_B.gltf',
  hh_tree: 'house/Tiny_Treats_Homely_House_1.0_FREE/Assets/gltf/tree.gltf',
  hh_tree_large: 'house/Tiny_Treats_Homely_House_1.0_FREE/Assets/gltf/tree_large.gltf',
  hh_package: 'house/Tiny_Treats_Homely_House_1.0_FREE/Assets/gltf/package.gltf',
  // Tiny Treats House Plants (CC0, Isa Lousberg)
  hp_monstera: 'plants/Tiny_Treats_House_Plants_1.0_FREE/Assets/gltf/monstera_plant_large_potted.gltf',
  hp_yucca: 'plants/Tiny_Treats_House_Plants_1.0_FREE/Assets/gltf/yucca_plant_large_potted.gltf',
  hp_cacti: 'plants/Tiny_Treats_House_Plants_1.0_FREE/Assets/gltf/cacti_plant_pot_large.gltf',
  hp_succulent: 'plants/Tiny_Treats_House_Plants_1.0_FREE/Assets/gltf/succulent_plant_pot_large.gltf',
  hp_pothos: 'plants/Tiny_Treats_House_Plants_1.0_FREE/Assets/gltf/pothos_plant_large_potted.gltf',
  // KayKit Forest Nature Pack (CC0, Kay Lousberg)
  kf_tree_1a: 'forest/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/Tree_1_A_Color1.gltf',
  kf_tree_2a: 'forest/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/Tree_2_A_Color1.gltf',
  kf_tree_3a: 'forest/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/Tree_3_A_Color1.gltf',
  kf_tree_4a: 'forest/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/Tree_4_A_Color1.gltf',
  kf_bush_1a: 'forest/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/Bush_1_A_Color1.gltf',
  kf_bush_2a: 'forest/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/Bush_2_A_Color1.gltf',
  kf_bush_3a: 'forest/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/Bush_3_A_Color1.gltf',
  kf_bush_4a: 'forest/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/Bush_4_A_Color1.gltf',
  kf_rock_1a: 'forest/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/Rock_1_A_Color1.gltf',
};

const pad4 = b => (b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4), 0)]) : b);
const mime = f => (/\.jpe?g$/i.test(f) ? 'image/jpeg' : 'image/png');

function readUri(dir, uri) {
  if (uri.startsWith('data:')) return Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64');
  return fs.readFileSync(path.join(dir, decodeURIComponent(uri)));
}

function gltfToGlb(file) {
  const dir = path.dirname(file);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const parts = []; let off = 0;
  const bufOff = [];
  (json.buffers || []).forEach((b, i) => { const d = pad4(readUri(dir, b.uri)); bufOff[i] = off; parts.push(d); off += d.length; });
  (json.bufferViews || []).forEach(bv => { bv.byteOffset = (bv.byteOffset || 0) + bufOff[bv.buffer]; bv.buffer = 0; });
  (json.images || []).forEach(img => {
    if (!img.uri) return;
    const d = readUri(dir, img.uri);
    json.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: d.length });
    img.bufferView = json.bufferViews.length - 1; img.mimeType = img.uri.startsWith('data:') ? img.uri.slice(5, img.uri.indexOf(';')) : mime(img.uri); delete img.uri;
    const p = pad4(d); parts.push(p); off += p.length;
  });
  json.buffers = [{ byteLength: off }];
  const bin = Buffer.concat(parts);
  let js = Buffer.from(JSON.stringify(json), 'utf8');
  js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const total = 12 + 8 + js.length + 8 + bin.length;
  const h = Buffer.alloc(12); h.writeUInt32LE(0x46546C67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(total, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4E4F534A, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004E4942, 4);
  return Buffer.concat([h, jh, js, bh, bin]);
}

function toGlb(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) === 0x46546C67) {
    // GLB: make sure no external image uris remain
    const len = b.readUInt32LE(12); const json = JSON.parse(b.slice(20, 20 + len).toString());
    if ((json.images || []).some(i => i.uri && !i.uri.startsWith('data:'))) throw new Error('external image in glb ' + file);
    return b;
  }
  return gltfToGlb(file);
}

const outGlb = path.join(ASSETS, '3d', 'glb');
const outJs = path.join(ASSETS, '3d', 'js');
fs.mkdirSync(outGlb, { recursive: true }); fs.mkdirSync(outJs, { recursive: true });
let total = 0;
const index = {};
const ONLY = process.argv[4] ? new RegExp(process.argv[4]) : null;
for (const [key, rel] of Object.entries(LIST)) {
  if (ONLY && !ONLY.test(key)) continue;
  const glb = toGlb(path.join(SRC, rel));
  fs.writeFileSync(path.join(outGlb, key + '.glb'), glb);
  fs.writeFileSync(path.join(outJs, key + '.js'), `(window.HC_MODELS=window.HC_MODELS||{})[${JSON.stringify(key)}]=${JSON.stringify(glb.toString('base64'))};\n`);
  index[key] = glb.length; total += glb.length;
}
const idxFile = path.join(ASSETS, '3d', 'index.json');
const old = fs.existsSync(idxFile) ? JSON.parse(fs.readFileSync(idxFile, 'utf8')) : {};
fs.writeFileSync(idxFile, JSON.stringify(Object.assign(old, index), null, 1));
console.log(Object.keys(LIST).length, 'models,', (total / 1048576).toFixed(2), 'MB of GLB');
