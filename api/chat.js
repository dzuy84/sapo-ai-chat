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

    // ================= OPENAI =================
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // ================= BODY FIX =================
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
            `- ${p.name} | ${p.price}đ | ${p.url}`
          ).join("\n")
        : "KHÔNG TÌM THẤY SẢN PHẨM PHÙ HỢP";

    // ================= OPENAI CHAT =================
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
Bạn là nhân viên bán hàng ly rượu vang RONA.

QUY TẮC BẮT BUỘC:
- CHỈ dùng sản phẩm trong danh sách
- KHÔNG tự bịa sản phẩm
- KHÔNG được thêm sản phẩm ngoài danh sách
- Nếu không có sản phẩm → nói "không tìm thấy sản phẩm phù hợp"
- Luôn tư vấn ngắn gọn, dễ hiểu, hướng tới chốt đơn

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
      products
    });

  } catch (err) {
    console.log("API ERROR:", err);

    return res.status(500).json({
      error: err.message
    });
  }
}
