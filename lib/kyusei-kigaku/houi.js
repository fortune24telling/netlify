// houi.js
// 九星気学・方位盤（後天定位盤・年盤・月盤・日盤の方位配置）の算出ロジック。
//
// 【後天定位盤（九星の定位置）】
//   一白水星：北　　　二黒土星：西南　　三碧木星：東
//   四緑木星：東南　　五黄土星：中央(中宮)　六白金星：西北
//   七赤金星：西　　　八白土星：東北　　九紫火星：南
//
// 【方位盤の配置（飛泊）の規則】
//   年盤・月盤は、中宮に入った星から「陰遁」の順（9→8→7→…→1→9…、
//   すなわち数字が減る方向）で、後天定位盤と同じ「回座の順序」に従って
//   8方位に配置される。
//   （日盤・時盤は陽遁/陰遁の両方があるが、今回の方位殺の判定では
//     年盤・月盤のみを使用するため、年盤・月盤の陰遁配置のみを実装する）

// 後天定位盤：方位ごとの定位置の星（基準パターン）
// 配置の順序（後天定位盤を基準に、数字が減る方向＝陰遁で巡る順序）
//   中宮(5) → 西北(6) → 西(7) → 東北(8) → 南(9) → 北(1) → 西南(2) → 東(3) → 東南(4)
// ※これは方位盤が「五黄が中宮にある状態」を基準として、数字の大きい方から
//   小さい方へ巡る順序（飛泊の順）を表す。
const HOUTEN_TEII = {
  1: "北", 2: "西南", 3: "東", 4: "東南", 5: "中央",
  6: "西北", 7: "西", 8: "東北", 9: "南"
};

// 後天定位盤を基準に、九星が年ごとに巡る方位の順序（実例データから検証済み）：
//   中央 → 西北 → 東北 → 西 → 南 → 北 → 西南 → 東 → 東南 → (中央に戻る)
// 各方位の星は、前の盤において「1つ前の方位」にあった星が移動してくる。
const ORDER_HOUI = ["中央", "西北", "東北", "西", "南", "北", "西南", "東", "東南"];

// ORDER_HOUIの巡回順に対応する、後天定位盤（5中宮）での星の並び
// （中央=5, 西北=6, 東北=7, 西=8, 南=9, 北=1, 西南=2, 東=3, 東南=4）
const ITTEN_ORDER = [5, 6, 7, 8, 9, 1, 2, 3, 4];

const ALL_DIRECTIONS = ["北", "東北", "東", "東南", "南", "西南", "西", "西北"];

// 中宮に入る星(centerNumber)が分かれば、年盤・月盤（陰遁）における
// 全方位の星の配置を求める。
function getBanHaichi(centerNumber) {
  const centerIndexInOrder = ITTEN_ORDER.indexOf(centerNumber);
  const rotated = ITTEN_ORDER.slice(centerIndexInOrder).concat(ITTEN_ORDER.slice(0, centerIndexInOrder));

  const haichi = {};
  rotated.forEach((starNumber, i) => {
    haichi[ORDER_HOUI[i]] = starNumber;
  });

  return haichi;
}

// 指定した中宮の星における「五黄殺」の方位を求める
function getGoOusatsuHoui(banHaichi) {
  for (const houi in banHaichi) {
    if (banHaichi[houi] === 5) return houi;
  }
  return null; // 中宮自体が五黄の場合は方位としては存在しない
}

// 指定した方位の「反対側」の方位を求める
const OPPOSITE_HOUI = {
  "北": "南", "南": "北",
  "東": "西", "西": "東",
  "東南": "西北", "西北": "東南",
  "東北": "西南", "西南": "東北",
  "中央": null
};

// 暗剣殺：五黄殺の反対側の方位
function getAnkensatsuHoui(banHaichi) {
  const goouHoui = getGoOusatsuHoui(banHaichi);
  if (!goouHoui) return null;
  return OPPOSITE_HOUI[goouHoui];
}

// 本命殺：その盤（年盤など）における、自分の本命星がある方位
// （中宮にある場合はnullを返す＝方位としては存在しない）
function getHonmeisatsuHoui(banHaichi, honmeiseiNumber) {
  for (const houi in banHaichi) {
    if (banHaichi[houi] === honmeiseiNumber) {
      return houi === "中央" ? null : houi;
    }
  }
  return null;
}

// 本命的殺：本命殺の反対側の方位
function getHonmeitekisatsuHoui(banHaichi, honmeiseiNumber) {
  const honmeisatsuHoui = getHonmeisatsuHoui(banHaichi, honmeiseiNumber);
  if (!honmeisatsuHoui) return null;
  return OPPOSITE_HOUI[honmeisatsuHoui];
}

// 十二支に対応する方位（年盤・月盤の「破」を求めるために使用）
// 子=北、丑寅=東北、卯=東、辰巳=東南、午=南、未申=西南、酉=西、戌亥=西北
const JUNISHI_HOUI = {
  "子": "北", "丑": "東北", "寅": "東北", "卯": "東",
  "辰": "東南", "巳": "東南", "午": "南", "未": "西南",
  "申": "西南", "酉": "西", "戌": "西北", "亥": "西北"
};

// 歳破・月破：その年・月の十二支の方位の、反対側の方位
function getHaHoui(junishi) {
  const junishiHoui = JUNISHI_HOUI[junishi];
  if (!junishiHoui) return null;
  return OPPOSITE_HOUI[junishiHoui];
}

module.exports = {
  HOUTEN_TEII,
  ALL_DIRECTIONS,
  getBanHaichi,
  getGoOusatsuHoui,
  getAnkensatsuHoui,
  getHonmeisatsuHoui,
  getHonmeitekisatsuHoui,
  getHaHoui,
  OPPOSITE_HOUI,
  JUNISHI_HOUI
};
