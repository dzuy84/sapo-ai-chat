import OpenAI from "openai";

export default async function handler(req, res) {

  // ================= CORS =================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Chỉ hỗ trợ POST" });
  }

  try {

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body || {};

    const message = body.message;

    if (!message) {
      return res.status(400).json({ error: "Thiếu message" });
    }

    // ================= 1. TRÍCH KEYWORD =================
    const keywordRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Trích keyword sản phẩm từ câu người dùng.

QUY TẮC:
- chỉ 2–5 từ
- không giải thích

Ví dụ:
"có ly vang đỏ không" → ly vang đỏ
"ly 600ml" → ly 600ml
"ly quà tặng" → ly quà tặng
`
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    const keyword = keywordRes.choices[0].message.content.trim();

    // ================= 2. SAPO SEARCH (DOMAIN CHÍNH) =================
    const searchUrl =
      `https://lyuongruouvang.com/search?q=${encodeURIComponent(keyword)}`;

    let products = [];

    try {
      const html = await (await fetch(searchUrl)).text();

      // ================= PARSE PRODUCT =================
      const regex = /href="(\/products\/.*?)".*?title="(.*?)"/g;

      const matches = [...html.matchAll(regex)];

      products = matches.slice(0, 5).map(m => ({
        name: m[2],
        url: `https://lyuongruouvang.com${m[1]}`,
        price: "xem trên web"
      }));

    } catch (err) {
      console.log("SEARCH ERROR:", err);
      products = [];
    }

    // ================= 3. FORMAT PRODUCT =================
    const productText =
      products.length > 0
        ? products.map(p =>
            `- ${p.name} | ${p.price} | ${p.url}`
          ).join("\n")
        : "KHÔNG TÌM THẤY SẢN PHẨM PHÙ HỢP";

    // ================= 4. OPENAI CHAT =================
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
Bạn là nhân viên bán hàng ly rượu vang RONA.

QUY TẮC:
- CHỈ dùng sản phẩm trong danh sách
- KHÔNG bịa sản phẩm
- KHÔNG tự tạo sản phẩm
- Nếu không có → nói không tìm thấy
- Trả lời ngắn gọn, tư vấn bán hàng

DANH SÁCH SẢN PHẨM:
${productText}
`
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    // ================= RESPONSE =================
    return res.status(200).json({
      reply: completion.choices[0].message.content,
      keyword,
      products
    });

  } catch (err) {
    console.log("API ERROR:", err);

    return res.status(500).json({
      error: err.message
    });
  }
}
