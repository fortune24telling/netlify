// honmeisei.js
// 九星気学・本命星の算出ロジック。
//
// 算出式（複数の独立した解説サイトで一致している標準的な方式）：
//   1. 生まれた年（西暦）の４桁の数字をそれぞれ足し算する
//   2. 出た数字の十の位と一の位を足して一桁にする（必要なら繰り返す）
//   3. 11からその数字を引く（マイナスになった場合は絶対値を取る）
//   4. 出た数字（1〜9）が本命星に対応する
//
// 年の境は立春（四柱推命の年柱と同じ考え方）。1月1日〜立春前日に生まれた人は、
// 前年の生まれとして計算する（既存のsolar.jsの節気計算を再利用する）。

const solar = require('../shichu-suimei/solar.js');

const KYUSEI_NAMES = {
  1: "一白水星", 2: "二黒土星", 3: "三碧木星", 4: "四緑木星", 5: "五黄土星",
  6: "六白金星", 7: "七赤金星", 8: "八白土星", 9: "九紫火星"
};

const KYUSEI_GOGYO = {
  1: "水", 2: "土", 3: "木", 4: "木", 5: "土",
  6: "金", 7: "金", 8: "土", 9: "火"
};

// 西暦の各桁を足し合わせ、一桁になるまで繰り返す（数字根）
function digitalRoot(n) {
  let s = String(n);
  while (s.length > 1) {
    let sum = 0;
    for (const ch of s) sum += parseInt(ch, 10);
    s = String(sum);
  }
  return parseInt(s, 10);
}

// 本命星算出年（立春を境にした「気学上の年」）を求める
function getKyuseiYear(year, month, day) {
  // その年の立春の瞬間を求める（時刻は正午JST固定で日付のみ使う）
  const risshunMoment = solar.findSolarTermMoment(year, 315, 2); // 黄経315度=立春
  const jdBirth = solar.toJulianDay(year, month, day, 12 - 9); // 正午JST
  const jdRisshun = solar.toJulianDay(risshunMoment.year, risshunMoment.month, risshunMoment.day, risshunMoment.hourUTC + risshunMoment.minuteUTC / 60);

  if (jdBirth < jdRisshun) {
    return year - 1;
  }
  return year;
}

// 本命星の番号（1〜9）を算出する
function getHonmeiseiNumber(kyuseiYear) {
  const root = digitalRoot(kyuseiYear);
  let num = 11 - root;
  if (num <= 0) num += 9; // マイナス・ゼロになった場合は9を足して1〜9の範囲に戻す
  if (num > 9) num -= 9;
  return num;
}

function getHonmeisei(year, month, day) {
  const kyuseiYear = getKyuseiYear(year, month, day);
  const number = getHonmeiseiNumber(kyuseiYear);
  return {
    number: number,
    name: KYUSEI_NAMES[number],
    gogyo: KYUSEI_GOGYO[number],
    kyuseiYear: kyuseiYear
  };
}

module.exports = {
  getHonmeisei,
  getKyuseiYear,
  getHonmeiseiNumber,
  digitalRoot,
  KYUSEI_NAMES,
  KYUSEI_GOGYO
};
