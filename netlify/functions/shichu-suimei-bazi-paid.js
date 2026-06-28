// api/shichu-suimei/bazi-paid.js
// 四柱推命・¥500鑑定のエンドポイント。
// 入力：生年月日（＋出生時刻、不明の場合は時柱を省略）
// 出力：年柱・月柱・日柱・時柱のすべて＋性格・才能・適職（日干ベース）＋
//       今年の運気（歳運：日干と今年の干の五行関係）
//
// このファイルはサーバー側でのみ実行され、ブラウザには送られない。

const { calculateMeishiki, getYearPillar, GOGYO_BY_KAN, GOGYO_BY_SHI } = require('./bazi.js');
const { KAN_PERSONALITY } = require('./kan-personality.js');
const { getYearFortune } = require('./gogyo-relation.js');

function withGogyoLabel(pillar) {
  if (!pillar) return null;
  return {
    kan: pillar.kan,
    shi: pillar.shi,
    kanGogyo: pillar.kanGogyo,
    shiGogyo: pillar.shiGogyo
  };
}

module.exports = (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  const { year, month, day, hour, minute, hourUnknown } = body || {};

  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  const isHourUnknown = !!hourUnknown;
  const h = isHourUnknown ? 12 : parseInt(hour, 10);
  const min = isHourUnknown ? 0 : (parseInt(minute, 10) || 0);

  if (!y || !m || !d || y < 1900 || y > 2035 || m < 1 || m > 12 || d < 1 || d > 31) {
    res.status(400).json({ error: "生年月日が正しくありません。" });
    return;
  }
  if (!isHourUnknown && (isNaN(h) || h < 0 || h > 23)) {
    res.status(400).json({ error: "出生時刻が正しくありません。" });
    return;
  }

  try {
    const meishiki = calculateMeishiki(y, m, d, h, min, isHourUnknown);

    // 性格・才能・適職（日干ベース）
    const dayKan = meishiki.day.kan;
    const personality = KAN_PERSONALITY[dayKan];

    // 今年の運気（歳運）：今年の年柱を求め、日干との五行関係を見る
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisYearPillar = getYearPillar(thisYear, now.getMonth() + 1, now.getDate(), 12, 0);
    const thisYearGogyo = GOGYO_BY_KAN[thisYearPillar.kan];
    const selfGogyo = GOGYO_BY_KAN[dayKan];
    const yearFortune = getYearFortune(selfGogyo, thisYearGogyo);

    res.status(200).json({
      pillars: {
        year: withGogyoLabel(meishiki.year),
        month: withGogyoLabel(meishiki.month),
        day: withGogyoLabel(meishiki.day),
        hour: meishiki.hour ? withGogyoLabel(meishiki.hour) : null
      },
      hourUnknown: isHourUnknown,
      personality: {
        trait: personality.trait,
        talent: personality.talent,
        job: personality.job
      },
      yearFortune: {
        year: thisYear,
        yearKanshi: thisYearPillar.kan + thisYearPillar.shi,
        relation: yearFortune.relation,
        label: yearFortune.label,
        text: yearFortune.text
      }
    });
  } catch (e) {
    res.status(500).json({ error: "計算中にエラーが発生しました。生年月日・時刻をご確認ください。" });
  }
};
