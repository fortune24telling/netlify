// api/kyusei-kigaku/kyusei-free.js
// 九星気学・無料診断のエンドポイント。
// 入力：生年月日
// 出力：本命星1つ＋一言診断のみ
//
// このファイルはサーバー側でのみ実行され、ブラウザには送られない。

const { getHonmeisei } = require('./honmeisei.js');
const { getHonmeiseiBrief } = require('./honmeisei-brief.js');

module.exports = (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  const { year, month, day } = body || {};
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);

  if (!y || !m || !d || y < 1900 || y > 2035 || m < 1 || m > 12 || d < 1 || d > 31) {
    res.status(400).json({ error: "生年月日が正しくありません。" });
    return;
  }

  try {
    const honmeisei = getHonmeisei(y, m, d);
    const brief = getHonmeiseiBrief(honmeisei.number);

    res.status(200).json({
      honmeisei: {
        number: honmeisei.number,
        name: honmeisei.name,
        gogyo: honmeisei.gogyo
      },
      interpretation: {
        type: "brief",
        text: brief
      }
    });
  } catch (e) {
    res.status(500).json({ error: "計算中にエラーが発生しました。生年月日をご確認ください。" });
  }
};
