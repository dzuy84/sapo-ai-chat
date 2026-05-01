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

    // ================= 1. TRÍCH KEYWORD (QUAN TRỌNG) =================
    const keywordRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Bạn là hệ thống trích xuất keyword sản phẩm.

QUY TẮC:
- Chỉ trả về keyword sản phẩm
- Không giải thích
- 2-5 từ là tối đa

Ví dụ:
"có ly vang đỏ không" → ly vang đỏ
"tôi muốn ly 600ml" → ly 600ml
"ly quà tặng cao cấp" → ly quà tặng
`
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    const keyword = keywordRes.choices[0].message.content.trim();

    // ================= 2. SAPO SEARCH =================
    const searchUrl =
      `https://ly-uong-ruou-vang.mysapo.net/search/suggest.json?q=${encodeURIComponent(keyword)}`;

    let products = [];

    try {
      const sapoRes = await fetch(searchUrl);
      const sapoData = await sapoRes.json();

      products = (sapoData.products || [])
        .slice(0, 5)
        .map(p => ({
          name: p.name,
          price: p.price,
          url: `https://ly-uong-ruou-vang.mysapo.net/products/${p.alias}`
        }));

    } catch (err) {
      console.log("SAPO ERROR:", err);
      products = [];
    }

    // ================= 3. FORMAT PRODUCTS =================
    const productText =
      products.length > 0
        ? products.map(p =>
            `- ${p.name} | ${p.price}đ | ${p.url}`
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
- KHÔNG tự thêm sản phẩm
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
