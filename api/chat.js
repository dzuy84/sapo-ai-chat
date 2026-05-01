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

    // ================= ENV =================
    const SAPO_KEY = process.env.SAPO_API_KEY;
    const SAPO_SECRET = process.env.SAPO_API_SECRET;

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

    // ================= BASIC AUTH SAPO =================
    const auth = Buffer
      .from(`${SAPO_KEY}:${SAPO_SECRET}`)
      .toString("base64");

    // ================= SAPO PRODUCTS (ADMIN API) =================
    let products = [];

    try {

      const sapoRes = await fetch(
        "https://ly-uong-ruou-vang.mysapo.net/admin/products.json?limit=5",
        {
          method: "GET",
          headers: {
            "Authorization": `Basic ${auth}`,
            "Content-Type": "application/json"
          }
        }
      );

      const data = await sapoRes.json();

      products = (data.products || []).map(p => ({
        name: p.name,
        price: p.variants?.[0]?.price || "Liên hệ",
        url: `https://ly-uong-ruou-vang.mysapo.net/products/${p.handle || p.alias}`
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
        : "KHÔNG CÓ SẢN PHẨM TRONG SHOP";

    // ================= OPENAI =================
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
Bạn là nhân viên bán hàng ly rượu vang cao cấp RONA.

QUY TẮC:
- CHỈ dùng sản phẩm trong danh sách
- KHÔNG tự bịa sản phẩm
- Nếu không có → nói không tìm thấy
- Ưu tiên bán hàng, chốt đơn

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
