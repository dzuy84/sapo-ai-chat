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

    // ================= INIT OPENAI =================
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // ================= FIX BODY =================
    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body || {};

    const message = body.message;

    if (!message) {
      return res.status(400).json({ error: "Thiếu message" });
    }

    // ================= 1. GET SAPO PRODUCTS =================
    let products = [];

    try {
      const url = `https://ly-uong-ruou-vang.mysapo.net/search/suggest.json?q=${encodeURIComponent(message)}`;

      const sapoRes = await fetch(url);
      const data = await sapoRes.json();

      products = (data.products || []).map(p => ({
        name: p.name,
        price: p.price,
        url: `https://ly-uong-ruou-vang.mysapo.net/products/${p.alias}`
      }));

    } catch (err) {
      console.log("Sapo error:", err);
      products = [];
    }

    // ================= 2. IF NO PRODUCTS =================
    const productText =
      products.length > 0
        ? JSON.stringify(products)
        : "KHÔNG CÓ SẢN PHẨM PHÙ HỢP";

    // ================= 3. OPENAI CHAT =================
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2, // 🔥 giảm bịa
      messages: [
        {
          role: "system",
          content: `
Bạn là nhân viên bán hàng cho website ly rượu vang RONA.

QUAN TRỌNG:
- CHỈ được dùng sản phẩm trong danh sách
- KHÔNG được tự tạo sản phẩm mới
- KHÔNG được bịa tên sản phẩm
- Nếu không có sản phẩm → nói "không tìm thấy sản phẩm phù hợp"

DANH SÁCH SẢN PHẨM:
${productText}

Cách trả lời:
- Ngắn gọn
- Có tư vấn bán hàng
- Có thể gợi ý 1–3 sản phẩm trong danh sách
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
      products
    });

  } catch (err) {
    console.log("API ERROR:", err);

    return res.status(500).json({
      error: err.message
    });
  }
}
