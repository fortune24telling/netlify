// netlify/functions/shichu-suimei-bazi-free.js
// 四柱推命・無料診断のエンドポイント。
// 入力：生年月日（時刻は不要）
// 出力：日柱の干支1つ＋一言診断のみ（年柱・月柱・時柱は計算するが返さない）
//
// このファイルはサーバー側でのみ実行され、ブラウザには送られない。
// ページのソースを見ても、命式の算出ロジックや診断テキストの中身は見えない。

const { getDayPillar, GOGYO_BY_KAN, GOGYO_BY_SHI } = require('../../lib/shichu-suimei/bazi.js');
const { getKanshiBrief } = require('../../lib/shichu-suimei/kanshi-brief.js');

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { body = {}; }

  const { year, month, day } = body || {};

  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);

  if (!y || !m || !d || y < 1900 || y > 2035 || m < 1 || m > 12 || d < 1 || d > 31) {
    return { statusCode: 400, body: JSON.stringify({ error: "生年月日が正しくありません。" }) };
  }

  try {
    // 日柱は出生時刻に依存しないため、正午固定で計算する
    const dayPillar = getDayPillar(y, m, d, 12, 0);
    const brief = getKanshiBrief(dayPillar.kan, dayPillar.shi);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayPillar: {
          kan: dayPillar.kan,
          shi: dayPillar.shi,
          kanGogyo: GOGYO_BY_KAN[dayPillar.kan],
          shiGogyo: GOGYO_BY_SHI[dayPillar.shi]
        },
        interpretation: {
          type: "brief",
          text: brief
        }
      })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "計算中にエラーが発生しました。生年月日をご確認ください。" }) };
  }
};
