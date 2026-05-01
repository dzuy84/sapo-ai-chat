import OpenAI from "openai";

export default async function handler(req, res) {

  // ================= CORS =================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Chỉ POST" });

  try {

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body || {};

    const message = body.message || "";

    // ================= 1. SEARCH SAPO =================
    const url = `https://ly-uong-ruou-vang.mysapo.net/search/suggest.json?q=${encodeURIComponent(message)}`;

    let products = [];

    try {
      const r = await fetch(url);
      const data = await r.json();

      products = (data.products || []).map(p => ({
        name: p.name,
        price: p.price,
        url: `https://ly-uong-ruou-vang.mysapo.net/products/${p.alias}`
      }));

    } catch (err) {
      console.log("Sapo error:", err);
      products = [];
    }

    // ================= 2. SMART RULE =================
    const productText = products.length
      ? JSON.stringify(products)
      : "[]";

    // ================= 3. OPENAI =================
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
Bạn là nhân viên bán hàng ly rượu vang RONA.

QUY TẮC:
- KHÔNG được tự tạo sản phẩm
- KHÔNG được nói "không có sản phẩm"
- CHỈ dùng danh sách JSON
- Nếu danh sách rỗng → nói "Đang cập nhật sản phẩm phù hợp"
- Luôn tư vấn bán hàng tự nhiên
- Luôn hướng tới chốt đơn

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
    console.log(err);
    return res.status(500).json({ error: err.message });
  }
}
