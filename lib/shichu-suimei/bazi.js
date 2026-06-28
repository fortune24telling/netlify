// bazi.js
// 四柱推命（命式）の算出ロジック。
// 年柱・月柱・日柱・時柱を、本格的な節気計算に基づいて求める。

const solar = require('./solar.js');

// ===== 十干・十二支 =====
const JIKKAN = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
const JUNISHI = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];

// 五行（十干に対応）
const GOGYO_BY_KAN = {
  "甲":"木","乙":"木","丙":"火","丁":"火","戊":"土","己":"土",
  "庚":"金","辛":"金","壬":"水","癸":"水"
};
// 五行（十二支に対応）
const GOGYO_BY_SHI = {
  "子":"水","丑":"土","寅":"木","卯":"木","辰":"土","巳":"火",
  "午":"火","未":"土","申":"金","酉":"金","戌":"土","亥":"水"
};

// ===== 二十四節気（黄経と「節」かどうか） =====
// 四柱推命で月の境界に使うのは「節」（立春・啓蟄・清明・立夏・芒種・小暑・
// 立秋・白露・寒露・立冬・大雪・小寒）の12個。中気（雨水・春分など）は使わない。
// 黄経315度=立春を起点に、各節は30度おきに12個ある。
const SETSU_LIST = [
  { name: "立春", deg: 315, approxMonth: 2,  monthIndex: 1 },  // 寅月の始まり
  { name: "啓蟄", deg: 345, approxMonth: 3,  monthIndex: 2 },  // 卯月
  { name: "清明", deg: 15,  approxMonth: 4,  monthIndex: 3 },  // 辰月
  { name: "立夏", deg: 45,  approxMonth: 5,  monthIndex: 4 },  // 巳月
  { name: "芒種", deg: 75,  approxMonth: 6,  monthIndex: 5 },  // 午月
  { name: "小暑", deg: 105, approxMonth: 7,  monthIndex: 6 },  // 未月
  { name: "立秋", deg: 135, approxMonth: 8,  monthIndex: 7 },  // 申月
  { name: "白露", deg: 165, approxMonth: 9,  monthIndex: 8 },  // 酉月
  { name: "寒露", deg: 195, approxMonth: 10, monthIndex: 9 },  // 戌月
  { name: "立冬", deg: 225, approxMonth: 11, monthIndex: 10 }, // 亥月
  { name: "大雪", deg: 255, approxMonth: 12, monthIndex: 11 }, // 子月
  { name: "小寒", deg: 285, approxMonth: 1,  monthIndex: 0 }   // 丑月
];
// monthIndex: 寅月=1, 卯月=2 ... 子月=11, 丑月=0 という対応（後述の月柱計算で使用）

// 指定範囲の年について、すべての節気の正確な日時（UTC）を計算してキャッシュする
const solarTermCache = {};

function getSolarTermsForYear(year) {
  if (solarTermCache[year]) return solarTermCache[year];
  const terms = SETSU_LIST.map(s => {
    // 小寒は前年12月ではなく当年1月なので、approxMonthそのままでOK
    const moment = solar.findSolarTermMoment(year, s.deg, s.approxMonth);
    return {
      name: s.name,
      monthIndex: s.monthIndex,
      jd: solar.toJulianDay(moment.year, moment.month, moment.day, moment.hourUTC + moment.minuteUTC / 60)
    };
  });
  solarTermCache[year] = terms;
  return terms;
}

// ===== 日付 → ユリウス日（UTC基準） =====
// 入力は日本時間（JST, UTC+9）の生年月日時として受け取り、UTCに変換する
function birthToJD(year, month, day, hourJST, minuteJST) {
  const totalHourJST = hourJST + minuteJST / 60;
  const hourUTC = totalHourJST - 9;
  return solar.toJulianDay(year, month, day, hourUTC);
}

// ===== 年柱の計算 =====
// 立春を年の境とする。立春より前の生まれは「前年」扱い。
// 基準：1984年が甲子年（十干十二支ともにインデックス0）
function getYearPillar(year, month, day, hourJST, minuteJST) {
  const jd = birthToJD(year, month, day, hourJST, minuteJST);

  // その年の立春の瞬間を求める
  const terms = getSolarTermsForYear(year);
  const risshun = terms.find(t => t.name === "立春");

  let ganshiYear = year;
  if (jd < risshun.jd) {
    ganshiYear = year - 1;
  }

  // 1984年=甲子（オフセット0）を基準に60干支を求める
  let offset = (ganshiYear - 1984) % 60;
  if (offset < 0) offset += 60;

  const kanIndex = offset % 10;
  const shiIndex = offset % 12;

  return {
    kan: JIKKAN[kanIndex],
    shi: JUNISHI[shiIndex],
    ganshiYear: ganshiYear
  };
}

// ===== 月柱の計算 =====
// 節気の「節」を境に月が変わる。寅月・卯月…という十二支の並びは固定。
// 月の十干は「年の十干」によって、その年の寅月（1月）の干が決まる
// （五虎遁の法則）。
const GOTORON = {
  // 年干 -> 寅月（1月）の干のインデックス
  "甲": 2, "己": 2,  // 丙
  "乙": 4, "庚": 4,  // 戊
  "丙": 6, "辛": 6,  // 庚
  "丁": 8, "壬": 8,  // 壬
  "戊": 0, "癸": 0   // 甲
};

function getMonthPillar(year, month, day, hourJST, minuteJST, yearPillar) {
  const jd = birthToJD(year, month, day, hourJST, minuteJST);

  // 当年と前年・翌年の節気をまとめて、jd以前で最も近い節気を探す
  const allTerms = [
    ...getSolarTermsForYear(year - 1),
    ...getSolarTermsForYear(year),
    ...getSolarTermsForYear(year + 1)
  ].sort((a, b) => a.jd - b.jd);

  let currentTerm = null;
  for (const t of allTerms) {
    if (t.jd <= jd) currentTerm = t;
    else break;
  }
  if (!currentTerm) currentTerm = allTerms[0];

  const monthIndex = currentTerm.monthIndex; // 寅月=1 ... 子月=11, 丑月=0

  // 寅月の干のインデックスを年干から求め、そこから monthIndex 分進める
  // （寅月=1なので、寅月自体は+0、卯月=2は+1 ...という対応にする）
  const yinMonthKanIndex = GOTORON[yearPillar.kan];
  // monthIndexは 寅=1,卯=2,...,丑=0 なので、寅を基準(0)とした相対位置に変換
  let relativeFromYin = monthIndex - 1;
  if (relativeFromYin < 0) relativeFromYin += 12; // 丑月(0)の場合 -1 -> 11

  const kanIndex = (yinMonthKanIndex + relativeFromYin) % 10;
  const shiIndex = monthIndex; // 十二支のインデックスは monthIndex と一致（寅=2なのでズレに注意）

  // 十二支のインデックス対応: 子=0,丑=1,寅=2,卯=3...亥=11
  // monthIndexは寅=1,卯=2...丑=0という定義なので、実際の十二支インデックスに変換する
  const shiIndexActual = (monthIndex + 1) % 12; // 寅(monthIndex=1) -> shi index 2(寅) ... 丑(monthIndex=0) -> 1(丑)

  return {
    kan: JIKKAN[kanIndex],
    shi: JUNISHI[shiIndexActual],
    termName: currentTerm.name
  };
}

// ===== 日柱の計算 =====
// 60干支は連続した日数の通日サイクル。基準日を1つ定めて、そこからの日数で求める。
// 基準：1900年1月31日 = 甲辰日（よく使われる基準日）
function getDayPillar(year, month, day, hourJST, minuteJST) {
  // 日柱の判定は「日付」基準（何時に日が変わるかは諸説あるが、ここでは正子=0時を採用）
  const jdNoon = solar.toJulianDay(year, month, day, 12 - 9); // その日の正午JST=03:00UTCのJDを使い、日付のズレを防ぐ

  // 基準日のユリウス日: 1900年1月31日(グレゴリオ) 正午JST = 甲辰日（60干支オフセット40）
  const baseJD = solar.toJulianDay(1900, 1, 31, 12 - 9);
  const baseOffset = 40; // 甲辰 = 干index0, 支index4 -> 60干支オフセット40

  let diff = Math.round(jdNoon - baseJD);
  let offset = (diff + baseOffset) % 60;
  if (offset < 0) offset += 60;

  const kanIndex = offset % 10;
  const shiIndex = offset % 12;

  return {
    kan: JIKKAN[kanIndex],
    shi: JUNISHI[shiIndex]
  };
}

// ===== 時柱の計算 =====
// 二時間ごとに十二支が割り当てられる（23:00〜00:59=子、01:00〜02:59=丑 ...）
// 時の干は「日干」によって、その日の子時（0時台）の干が決まる（五鼠遁の法則）
const GOSOTON = {
  "甲": 0, "己": 0,  // 甲
  "乙": 2, "庚": 2,  // 丙
  "丙": 4, "辛": 4,  // 戊
  "丁": 6, "壬": 6,  // 庚
  "戊": 8, "癸": 8   // 壬
};

function getHourPillar(hourJST, minuteJST, dayPillar) {
  const totalMinutes = hourJST * 60 + minuteJST;

  // 23:00〜0:59 = 子, 1:00〜2:59 = 丑, ... という2時間区切り
  // 23:00以降は次の日の子時として扱う（日柱はそのままだが、時柱は繰り上がる点に注意。
  // ここでは簡略化のため、入力された日付の時柱のみを返す）
  let shiIndex;
  if (totalMinutes >= 23 * 60 || totalMinutes < 1 * 60) {
    shiIndex = 0; // 子
  } else {
    shiIndex = Math.floor((totalMinutes - 1 * 60) / 120) + 1;
  }

  const ziKanIndex = GOSOTON[dayPillar.kan];
  const kanIndex = (ziKanIndex + shiIndex) % 10;

  return {
    kan: JIKKAN[kanIndex],
    shi: JUNISHI[shiIndex]
  };
}

// ===== メイン関数：命式を算出 =====
function calculateMeishiki(year, month, day, hourJST, minuteJST, hourUnknown) {
  const yearPillar = getYearPillar(year, month, day, hourJST || 12, minuteJST || 0);
  const monthPillar = getMonthPillar(year, month, day, hourJST || 12, minuteJST || 0, yearPillar);
  const dayPillar = getDayPillar(year, month, day, hourJST || 12, minuteJST || 0);
  const hourPillar = hourUnknown ? null : getHourPillar(hourJST, minuteJST, dayPillar);

  function withGogyo(pillar) {
    if (!pillar) return null;
    return {
      kan: pillar.kan,
      shi: pillar.shi,
      kanGogyo: GOGYO_BY_KAN[pillar.kan],
      shiGogyo: GOGYO_BY_SHI[pillar.shi]
    };
  }

  return {
    year: withGogyo(yearPillar),
    month: withGogyo(monthPillar),
    day: withGogyo(dayPillar),
    hour: withGogyo(hourPillar)
  };
}

module.exports = {
  calculateMeishiki,
  getYearPillar,
  getMonthPillar,
  getDayPillar,
  getHourPillar,
  JIKKAN,
  JUNISHI,
  GOGYO_BY_KAN,
  GOGYO_BY_SHI
};
