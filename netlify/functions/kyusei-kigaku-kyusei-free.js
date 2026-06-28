// netlify/functions/kyusei-kigaku-kyusei-free.js
// 九星気学・無料診断のエンドポイント。
// 入力：生年月日
// 出力：本命星1つ＋一言診断のみ
//
// このファイルはサーバー側でのみ実行され、ブラウザには送られない。

const { getHonmeisei } = require('../../lib/kyusei-kigaku/honmeisei.js');
const { getHonmeiseiBrief } = require('../../lib/kyusei-kigaku/honmeisei-brief.js');

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
    const honmeisei = getHonmeisei(y, m, d);
    const brief = getHonmeiseiBrief(honmeisei.number);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        honmeisei: {
          number: honmeisei.number,
          name: honmeisei.name,
          gogyo: honmeisei.gogyo
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
