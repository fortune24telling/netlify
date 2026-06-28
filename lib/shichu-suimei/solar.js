// solar.js
// 太陽の黄経（視黄経）を計算するモジュール。
// 二十四節気（立春・啓蟄など）の正確な日時を求めるために使用する。
//
// 計算方式：低〜中精度の太陽位置近似式（Jean Meeus "Astronomical Algorithms" の
// 簡略式に基づく）。誤差は数分〜十数分程度で、四柱推命の節気判定には十分な精度。

function toJulianDay(year, month, day, hourUTC) {
  // hourUTC: UTCでの時刻（0〜24の小数）
  let y = year, m = month;
  if (m <= 2) { y -= 1; m += 12; }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  const jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + hourUTC / 24 + b - 1524.5;
  return jd;
}

function normalizeDeg(deg) {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

// 太陽の視黄経（度）を、ユリウス日（JD, TT近似でJDTとして扱う）から計算する
function solarLongitude(jd) {
  const T = (jd - 2451545.0) / 36525.0; // ユリウス世紀数（J2000.0基準）

  // 太陽の平均黄経
  const L0 = normalizeDeg(280.46646 + 36000.76983 * T + 0.0003032 * T * T);

  // 太陽の平均近点角
  const M = normalizeDeg(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const Mrad = M * Math.PI / 180;

  // 中心差（equation of center）
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad)
          + (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad)
          + 0.000289 * Math.sin(3 * Mrad);

  // 太陽の真黄経
  const trueLong = L0 + C;

  // 章動・光行差による補正（簡易）
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * Math.PI / 180);

  return normalizeDeg(lambda);
}

// 指定した年の、太陽黄経が targetDeg（度）に達する瞬間（UTC）を求める
// 二分探索により、分単位の精度まで収束させる
function findSolarTermMoment(year, targetDeg, approxMonth) {
  // 探索範囲：approxMonthの15日を中心に、前後20日
  const approxDay = 15;
  let startJD = toJulianDay(year, approxMonth, approxDay, 0) - 20;
  let endJD = startJD + 40;

  function angleDiff(jd) {
    const lon = solarLongitude(jd);
    let diff = lon - targetDeg;
    // -180〜180に正規化（360度境界をまたぐケースに対応）
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return diff;
  }

  let lo = startJD, hi = endJD;
  let loVal = angleDiff(lo), hiVal = angleDiff(hi);

  // 符号が変わる区間を探す（粗いステップでスキャン）
  const steps = 80;
  let foundLo = null, foundHi = null;
  let prevJD = lo, prevVal = loVal;
  for (let i = 1; i <= steps; i++) {
    const jd = lo + (hi - lo) * i / steps;
    const val = angleDiff(jd);
    if (prevVal <= 0 && val > 0) { foundLo = prevJD; foundHi = jd; break; }
    if (prevVal >= 0 && val < 0 && Math.abs(prevVal) < 180 && Math.abs(val) < 180) {
      // 通常はこちらには来ないが保険
    }
    prevJD = jd; prevVal = val;
  }

  if (foundLo === null) {
    // フォールバック：全区間で二分探索
    foundLo = lo; foundHi = hi;
  }

  // 二分探索で収束
  let a = foundLo, b = foundHi;
  for (let i = 0; i < 40; i++) {
    const mid = (a + b) / 2;
    const val = angleDiff(mid);
    if (val === 0) { a = b = mid; break; }
    if ((angleDiff(a) < 0 && val < 0) || (angleDiff(a) > 0 && val > 0)) {
      a = mid;
    } else {
      b = mid;
    }
  }

  const resultJD = (a + b) / 2;
  return julianDayToDate(resultJD);
}

function julianDayToDate(jd) {
  const jd2 = jd + 0.5;
  const Z = Math.floor(jd2);
  const F = jd2 - Z;
  let A = Z;
  if (Z >= 2299161) {
    const alpha = Math.floor((Z - 1867216.25) / 36524.25);
    A = Z + 1 + alpha - Math.floor(alpha / 4);
  }
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);

  const day = B - D - Math.floor(30.6001 * E) + F;
  const month = (E < 14) ? E - 1 : E - 13;
  const year = (month > 2) ? C - 4716 : C - 4715;

  const dayInt = Math.floor(day);
  const hourFloat = (day - dayInt) * 24;
  const hour = Math.floor(hourFloat);
  const minuteFloat = (hourFloat - hour) * 60;
  const minute = Math.round(minuteFloat);

  return { year, month, day: dayInt, hourUTC: hour, minuteUTC: minute };
}

module.exports = {
  toJulianDay,
  solarLongitude,
  findSolarTermMoment,
  julianDayToDate
};
