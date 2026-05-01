import OpenAI from "openai";

export default async function handler(req, res) {
  // ================= CORS =================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
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

    // ================= 1. SEARCH SAPO =================
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

    // ================= 2. KHÔNG CÓ SP =================
    const productText =
      products.length > 0
        ? JSON.stringify(products)
        : "KHÔNG_CÓ_SẢN_PHẨM";

    // ================= 3. AI CONTROL CHẶT =================
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `
Bạn là nhân viên bán hàng website ly rượu vang RONA.

QUY TẮC CỰC KỲ QUAN TRỌNG:
- CHỈ được dùng sản phẩm trong danh sách
- TUYỆT ĐỐI không tự bịa sản phẩm
- Nếu KHÔNG_CÓ_SẢN_PHẨM → nói:
  "Hiện tại chưa có sản phẩm phù hợp"

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

    return res.status(200).json({
      reply: completion.choices[0].message.content,
      products
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}
