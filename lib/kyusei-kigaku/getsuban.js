// getsuban.js
// 九星気学・月盤（月の中心星）の算出ロジック。
//
// 【月のインデックス(m)の定義】
// 気学上の年は立春から始まり、各月の境界は二十四節気の「節」（節入り）。
// m=1(寅月・立春)〜m=12(丑月・小寒)として、1〜12のインデックスを振る。
//
// 【月盤中宮の算出式】
// その年の年星（年盤の中宮星）が属するグループによって、計算式が変わる。
//   グループA「一白・四緑・七赤」の年: C = (9 - m) mod 9
//   グループB「二黒・五黄・八白」の年: C = (12 - m) mod 9
//   グループC「三碧・六白・九紫」の年: C = (15 - m) mod 9
// 計算結果が0になった場合は9（九紫火星）とする。

const solar = require('../shichu-suimei/solar.js');
const { getHonmeiseiNumber, KYUSEI_NAMES, KYUSEI_GOGYO } = require('./honmeisei.js');

// 24節気のうち「節」のみ（四柱推命のbazi.jsと同じ定義）。
// monthIndex: 寅月=1, 卯月=2, ... 子月=11, 丑月=12 として、月盤の m に対応させる。
const SETSU_LIST = [
  { name: "立春", deg: 315, approxMonth: 2,  m: 1  },
  { name: "啓蟄", deg: 345, approxMonth: 3,  m: 2  },
  { name: "清明", deg: 15,  approxMonth: 4,  m: 3  },
  { name: "立夏", deg: 45,  approxMonth: 5,  m: 4  },
  { name: "芒種", deg: 75,  approxMonth: 6,  m: 5  },
  { name: "小暑", deg: 105, approxMonth: 7,  m: 6  },
  { name: "立秋", deg: 135, approxMonth: 8,  m: 7  },
  { name: "白露", deg: 165, approxMonth: 9,  m: 8  },
  { name: "寒露", deg: 195, approxMonth: 10, m: 9  },
  { name: "立冬", deg: 225, approxMonth: 11, m: 10 },
  { name: "大雪", deg: 255, approxMonth: 12, m: 11 },
  { name: "小寒", deg: 285, approxMonth: 1,  m: 12 }
];

const solarTermCache = {};
function getSolarTermsForYear(year) {
  if (solarTermCache[year]) return solarTermCache[year];
  const terms = SETSU_LIST.map(s => {
    const moment = solar.findSolarTermMoment(year, s.deg, s.approxMonth);
    return {
      name: s.name,
      m: s.m,
      jd: solar.toJulianDay(moment.year, moment.month, moment.day, moment.hourUTC + moment.minuteUTC / 60)
    };
  });
  solarTermCache[year] = terms;
  return terms;
}

// 年星の3グループ分類
const GROUP_A = [1, 4, 7]; // 一白・四緑・七赤
const GROUP_B = [2, 5, 8]; // 二黒・五黄・八白
const GROUP_C = [3, 6, 9]; // 三碧・六白・九紫

function getGroupFormula(yearStarNumber) {
  if (GROUP_A.includes(yearStarNumber)) return (m) => 9 - m;
  if (GROUP_B.includes(yearStarNumber)) return (m) => 12 - m;
  if (GROUP_C.includes(yearStarNumber)) return (m) => 15 - m;
  return null;
}

function normalizeToNine(n) {
  let r = ((n % 9) + 9) % 9;
  if (r === 0) r = 9;
  return r;
}

// 指定した生年月日（JST）が、気学上のどの「m」（月インデックス）・どの「気学年」に
// 属するかを求める（節気で月が切り替わる、年は立春で切り替わる）
function getKyuseiMonthIndex(year, month, day, hourJST, minuteJST) {
  const h = (hourJST === undefined || hourJST === null) ? 12 : hourJST;
  const min = (minuteJST === undefined || minuteJST === null) ? 0 : minuteJST;
  const jd = solar.toJulianDay(year, month, day, h + min / 60 - 9);

  // 当年・前年・翌年の節気をまとめて、jd以前で最も近い節気を探す
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

  // 気学年（年星を求めるための年）は、m=1(寅月,立春)〜m=12(丑月,小寒)の
  // どの月かによって決まる。m=12(丑月)は、グレゴリオ暦的には翌年1月だが、
  // 気学年としては「立春前の年」、つまりgetHonmeiseiNumberが扱う「年」と
  // 同じ年を使う必要がある。
  // 具体的には、立春(m=1)〜小寒(m=12)は同一の「気学年」に属する。
  // 立春の年を求めるため、その節気が何年の立春サイクルに属するかを特定する。
  const risshunTermsNearby = [
    ...getSolarTermsForYear(year - 1),
    ...getSolarTermsForYear(year),
    ...getSolarTermsForYear(year + 1)
  ].filter(t => t.m === 1).sort((a, b) => a.jd - b.jd);

  let kyuseiYear = null;
  for (let i = 0; i < risshunTermsNearby.length; i++) {
    const thisRisshun = risshunTermsNearby[i];
    const nextRisshun = risshunTermsNearby[i + 1];
    if (jd >= thisRisshun.jd && (!nextRisshun || jd < nextRisshun.jd)) {
      // この立春が属する「気学年」を特定する必要がある。
      // 立春のjdから年を逆算する（toJulianDayの逆変換は使わず、年のヒントから判定）
      kyuseiYear = thisRisshun._year;
      break;
    }
  }

  return { monthIndex: currentTerm.m, termName: currentTerm.name, jd: jd };
}

// 気学年を特定するため、節気データに年情報を付与する（内部用）
function getSolarTermsForYearWithYear(year) {
  const terms = getSolarTermsForYear(year);
  return terms.map(t => Object.assign({}, t, { _year: year }));
}

function getKyuseiYearAndMonthIndex(year, month, day, hourJST, minuteJST) {
  const h = (hourJST === undefined || hourJST === null) ? 12 : hourJST;
  const min = (minuteJST === undefined || minuteJST === null) ? 0 : minuteJST;
  const jd = solar.toJulianDay(year, month, day, h + min / 60 - 9);

  const allTerms = [
    ...getSolarTermsForYearWithYear(year - 1),
    ...getSolarTermsForYearWithYear(year),
    ...getSolarTermsForYearWithYear(year + 1)
  ].sort((a, b) => a.jd - b.jd);

  let currentTerm = null;
  for (const t of allTerms) {
    if (t.jd <= jd) currentTerm = t;
    else break;
  }
  if (!currentTerm) currentTerm = allTerms[0];

  // 気学年 = この節気を含む立春サイクルの「立春が属する年」
  // 立春(m=1)のterm._yearが、そのまま気学年の年星を求める年になる
  const risshunTerms = allTerms.filter(t => t.m === 1);
  let kyuseiYear = null;
  for (let i = risshunTerms.length - 1; i >= 0; i--) {
    if (risshunTerms[i].jd <= jd) { kyuseiYear = risshunTerms[i]._year; break; }
  }
  if (kyuseiYear === null) kyuseiYear = risshunTerms[0]._year;

  return { monthIndex: currentTerm.m, termName: currentTerm.name, kyuseiYear: kyuseiYear, jd: jd };
}

// 指定した年月の「気学年(kyuseiYear)」と「月インデックス(m)」から、月盤中宮を求める
function getGetsubanNumber(kyuseiYear, monthIndex) {
  const yearStarNumber = getHonmeiseiNumber(kyuseiYear);
  const formula = getGroupFormula(yearStarNumber);
  const raw = formula(monthIndex);
  return normalizeToNine(raw);
}

// メイン関数：生年月日（JST）から、その人が生まれた月の月盤中宮（=月命星）を求める
function getGetsumeisei(year, month, day, hourJST, minuteJST) {
  const { monthIndex, kyuseiYear, termName } = getKyuseiYearAndMonthIndex(year, month, day, hourJST, minuteJST);
  const number = getGetsubanNumber(kyuseiYear, monthIndex);
  return {
    number: number,
    name: KYUSEI_NAMES[number],
    gogyo: KYUSEI_GOGYO[number],
    monthIndex: monthIndex,
    kyuseiYear: kyuseiYear,
    termName: termName
  };
}

// 「今月」の月盤中宮を求める（今日の日付を使う）
function getCurrentGetsuban() {
  const now = new Date();
  return getGetsumeisei(now.getFullYear(), now.getMonth() + 1, now.getDate(), 12, 0);
}

module.exports = {
  getGetsumeisei,
  getCurrentGetsuban,
  getKyuseiYearAndMonthIndex,
  getGetsubanNumber,
  getGroupFormula,
  normalizeToNine,
  GROUP_A, GROUP_B, GROUP_C
};
