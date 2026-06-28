// nichiban.js
// 九星気学・日盤（日の中心星）の算出ロジック。
//
// 【陽遁・陰遁の規則】
//   陽遁：冬至の直近の甲子日を「一白水星」として開始し、以後
//         一白→二黒→三碧→…→九紫と数字が増える方向（順行）で1日1つ進む。
//   陰遁：夏至の直近の甲子日を「九紫火星」として開始し、以後
//         九紫→八白→七赤→…→一白と数字が減る方向（逆行）で1日1つ進む。
//
// 【切り替え日の決定方式：前遠後近法】
//   冬至（または夏至）の前後にある2つの甲子日のうち、冬至・夏至までの
//   日数が短い方（＝近い方）を切り替え日として採用する。
//   同じ近さ（冬至・夏至当日の干支が「癸巳」で、前後の甲子日が
//   ちょうど等距離になるケース）の場合のみ、後（直後）の甲子日を採用する。
//   ※この規則は「高島易断」系の市販暦・万年暦で広く使われる前遠後近法に基づく。
//     他の流派（前後法・三元法など）とは結果が異なる場合がある。
//
// 【九星の閏（うるう）】
//   陽遁・陰遁は合わせて360日だが、実際の1年は約365.2422日のため、
//   11〜12年に一度、60日のズレが蓄積する。これを解消するため、
//   該当する陽遁または陰遁の期間を30日延長する「閏」を挿入する。
//   閏の挿入は次の手順で判定・補正する：
//     1. 通常の前遠後近法で切替日（甲子日）を求める
//     2. 連続する切替日同士の間隔が180日からズレている場合、
//        ズレが生じている側の切替日を30日分前にずらして補正する
//        （この補正後の日の干支は必ず「甲午」になる）
//     3. 甲午で補正された切替日からは、通常の甲子始まり（一白or九紫）
//        ではなく、甲午からの特殊な進行（陰遁→陽遁の場合は七赤から、
//        陽遁→陰遁の場合は三碧から）で60日間（甲午〜次の甲子前日）を
//        進め、その後ようやく通常の甲子日・一白(または九紫)に合流する

const solar = require('../shichu-suimei/solar.js');

const JIKKAN = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
const JUNISHI = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];

function jdOf(year, month, day) {
  return solar.toJulianDay(year, month, day, 12 - 9); // 正午JST = 03:00 UTC
}

function kanshiOffsetOf(jd) {
  const baseJD = jdOf(1900, 1, 31);
  const baseOffset = 40;
  let diff = Math.round(jd - baseJD);
  let offset = (diff + baseOffset) % 60;
  if (offset < 0) offset += 60;
  return offset;
}

function kanshiNameOf(jd) {
  const offset = kanshiOffsetOf(jd);
  return JIKKAN[offset % 10] + JUNISHI[offset % 12];
}

function findNearbyKoshiDays(jdCenter) {
  const offset = kanshiOffsetOf(jdCenter);
  const daysToPrevKoshi = offset;
  const daysToNextKoshi = (60 - offset) % 60;

  const prevKoshiJD = jdCenter - daysToPrevKoshi;
  const nextKoshiJD = (daysToNextKoshi === 0) ? prevKoshiJD : jdCenter + daysToNextKoshi;

  return {
    prevJD: prevKoshiJD,
    nextJD: nextKoshiJD,
    daysToPrev: daysToPrevKoshi,
    daysToNext: daysToNextKoshi
  };
}

function toNoonJSTJD(jdAnyTime) {
  const d = solar.julianDayToDate(jdAnyTime + 9 / 24);
  return jdOf(d.year, d.month, d.day);
}

function selectNearestKoshiDay(jdSolarTermAnyTime) {
  const jdCenter = toNoonJSTJD(jdSolarTermAnyTime);
  const { prevJD, nextJD, daysToPrev, daysToNext } = findNearbyKoshiDays(jdCenter);

  if (daysToPrev === 0) return prevJD;
  if (daysToPrev < daysToNext) return prevJD;
  if (daysToNext < daysToPrev) return nextJD;
  return nextJD; // 同距離（癸巳のケース）→ 後（直後）を採用
}

function getToujiJD(year) {
  const m = solar.findSolarTermMoment(year, 270, 12);
  return solar.toJulianDay(m.year, m.month, m.day, m.hourUTC + m.minuteUTC / 60);
}
function getGeshiJD(year) {
  const m = solar.findSolarTermMoment(year, 90, 6);
  return solar.toJulianDay(m.year, m.month, m.day, m.hourUTC + m.minuteUTC / 60);
}

// 冬至・夏至（前後合わせて十分な年数）について、前遠後近法による
// 「補正前」の切替日一覧を、時系列順に作る
function buildRawSwitchPoints(centerYear) {
  const years = [];
  for (let y = centerYear - 3; y <= centerYear + 3; y++) years.push(y);

  const points = [];
  years.forEach(y => {
    points.push({ type: "touji", sourceYear: y, koshiJD: selectNearestKoshiDay(getToujiJD(y)) });
    points.push({ type: "geshi", sourceYear: y, koshiJD: selectNearestKoshiDay(getGeshiJD(y)) });
  });
  points.sort((a, b) => a.koshiJD - b.koshiJD);
  return points;
}

// 連続する切替日の間隔をチェックし、180日からズレている箇所に
// 「閏」を補正で挿入する。
// 補正方式：間隔が180日より長い場合（240日など）、本来は「後側の切替日が
// 30日早まって甲午になる」と解釈する。つまり、無補正の前遠後近法で求めた
// 「後側の切替日（本来の冬至/夏至の切替日）」をそのまま使うのが正しく、
// その「30日前」が閏の開始点（甲午）になる。
// 重要：このとき、間隔が180日に短縮された側の「前の切替点」は、実際には
// 存在しない（閏期間に置き換えられる）ため、結果から除外する必要がある。
function buildCorrectedSwitchPoints(centerYear) {
  const raw = buildRawSwitchPoints(centerYear);
  const corrected = [];
  let skipNext = false;

  for (let i = 0; i < raw.length; i++) {
    if (skipNext) { skipNext = false; continue; }

    const point = Object.assign({}, raw[i], { isJunStart: false });

    if (i > 0 && corrected.length > 0) {
      const prevPoint = corrected[corrected.length - 1];
      const interval = Math.round(raw[i].koshiJD - prevPoint.koshiJD);

      if (interval === 240) {
        // 240日 = 通常180日 + 閏60日。
        // raw[i]（本来の冬至/夏至の切替日）の30日前（甲午）が閏の開始点となる。
        // 閏点のtype（陽遁/陰遁の方向）は、合流先であるraw[i]のtypeと同じにする
        // （閏明けにそのままraw[i]のモードへ連続的につながるため）。
        const junPoint = {
          type: raw[i].type,
          sourceYear: raw[i].sourceYear,
          koshiJD: raw[i].koshiJD - 30,
          isJunStart: true
        };
        corrected.push(junPoint);
      } else if (interval === 120) {
        // 120日 = 通常180日 - 60日。今回の前遠後近法の枠組みでは240日側で
        // 対応済みのため、ここでは通常の点としてそのまま採用する（重複挿入を避ける）。
      }
    }

    corrected.push(point);
  }
  return corrected;
}

function normalizeToNine(n) {
  let r = ((n % 9) + 9) % 9;
  if (r === 0) r = 9;
  return r;
}

// 指定したユリウス日(jd)が、陽遁・陰遁のどちらの期間に属するかを判定し、
// その期間の開始日からの経過日数を求める（閏補正を含む）
function getDayBanContext(jd) {
  const year = solar.julianDayToDate(jd).year;
  const switchPoints = buildCorrectedSwitchPoints(year);

  let current = null;
  for (let i = 0; i < switchPoints.length; i++) {
    if (switchPoints[i].koshiJD <= jd) current = switchPoints[i];
    else break;
  }
  if (!current) current = switchPoints[0];

  const mode = current.type === "touji" ? "youton" : "inton";
  const daysSinceStart = Math.round(jd - current.koshiJD) + 1; // 開始日自体を1日目とする

  return {
    mode,
    startJD: current.koshiJD,
    daysSinceStart,
    switchType: current.type,
    isJunStart: current.isJunStart
  };
}

// 日盤中宮の番号を求める（閏区間にも対応）
function getNichibanNumber(jd) {
  const { mode, daysSinceStart, isJunStart } = getDayBanContext(jd);
  // mode は「閏明けに合流する先」のモード（陽遁=冬至側 or 陰遁=夏至側）

  if (isJunStart) {
    if (daysSinceStart <= 30) {
      // 甲午からの30日間（特殊進行）。
      // 合流先が陽遁（冬至側）の閏は「七赤」から開始し、数字が減る方向に進む。
      // 合流先が陰遁（夏至側）の閏は「三碧」から開始し、数字が増える方向に進む。
      if (mode === "youton") {
        return normalizeToNine(7 - (daysSinceStart - 1));
      } else {
        return normalizeToNine(3 + (daysSinceStart - 1));
      }
    } else {
      // 31日目以降：甲子日に到達し、通常の進行（modeの方向）に合流
      const daysAfterKoshi = daysSinceStart - 30;
      if (mode === "youton") {
        return normalizeToNine(daysAfterKoshi);
      } else {
        return normalizeToNine(10 - daysAfterKoshi);
      }
    }
  }

  // 通常区間
  if (mode === "youton") {
    return normalizeToNine(daysSinceStart);
  } else {
    return normalizeToNine(10 - daysSinceStart);
  }
}

const { KYUSEI_NAMES, KYUSEI_GOGYO } = require('./honmeisei.js');

// メイン関数：指定した年月日（JST）の日盤中宮を求める
function getNichiban(year, month, day) {
  const jd = jdOf(year, month, day);
  const ctx = getDayBanContext(jd);
  const number = getNichibanNumber(jd);
  return {
    number: number,
    name: KYUSEI_NAMES[number],
    gogyo: KYUSEI_GOGYO[number],
    mode: ctx.mode === "youton" ? "陽遁" : "陰遁",
    kanshi: kanshiNameOf(jd),
    isJunPeriod: ctx.isJunStart && ctx.daysSinceStart <= 30
  };
}

function getCurrentNichiban() {
  const now = new Date();
  return getNichiban(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

module.exports = {
  getNichiban,
  getCurrentNichiban,
  getDayBanContext,
  getNichibanNumber,
  selectNearestKoshiDay,
  findNearbyKoshiDays,
  buildCorrectedSwitchPoints,
  kanshiNameOf,
  kanshiOffsetOf,
  getToujiJD,
  getGeshiJD
};
