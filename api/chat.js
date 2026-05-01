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

    // ================= SAPO SEARCH (QUAN TRỌNG NHẤT) =================
    const searchUrl =
      `https://ly-uong-ruou-vang.mysapo.net/search/suggest.json?q=${encodeURIComponent(message)}`;

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

    // ================= FORMAT PRODUCTS =================
    const productText =
      products.length > 0
        ? products.map(p =>
            `Tên: ${p.name} | Giá: ${p.price}đ | Link: ${p.url}`
          ).join("\n")
        : "KHÔNG CÓ SẢN PHẨM PHÙ HỢP";

    // ================= OPENAI =================
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `
Bạn là nhân viên bán hàng của website ly rượu vang RONA.

QUAN TRỌNG:
- CHỈ dùng sản phẩm trong danh sách
- KHÔNG được tự bịa sản phẩm
- Nếu không có → nói không tìm thấy

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
    console.log("API ERROR:", err);

    return res.status(500).json({
      error: err.message
    });
  }
}
