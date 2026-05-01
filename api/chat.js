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

    // ================= SAFE BODY =================
    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body || {};

    const message = body.message;

    if (!message) {
      return res.status(400).json({ error: "Thiếu message" });
    }

    // ================= SEARCH SAPO (SMART) =================
    let products = [];

    try {

      const keywordMain = message;
      const keywordShort = message.split(" ").slice(0, 2).join(" ");

      const url1 = `https://ly-uong-ruou-vang.mysapo.net/search/suggest.json?q=${encodeURIComponent(keywordMain)}`;
      const url2 = `https://ly-uong-ruou-vang.mysapo.net/search/suggest.json?q=${encodeURIComponent(keywordShort)}`;

      const [r1, r2] = await Promise.all([
        fetch(url1),
        fetch(url2)
      ]);

      const d1 = await r1.json();
      const d2 = await r2.json();

      const list = [
        ...(d1.products || []),
        ...(d2.products || [])
      ];

      // remove duplicate
      const map = new Map();
      list.forEach(p => {
        if (p && p.id) map.set(p.id, p);
      });

      products = [...map.values()].map(p => ({
        name: p.name,
        price: p.price,
        url: `https://ly-uong-ruou-vang.mysapo.net/products/${p.alias}`
      }));

    } catch (err) {
      console.log("Sapo error:", err);
      products = [];
    }

    // ================= FALLBACK SMART =================
    if (products.length === 0) {
      if (
        message.toLowerCase().includes("vang") ||
        message.toLowerCase().includes("ly")
      ) {
        products = [
          {
            name: "Ly vang đỏ Bohemia 590ml",
            price: 456000,
            url: "https://ly-uong-ruou-vang.mysapo.net"
          }
        ];
      }
    }

    // ================= PRODUCT TEXT =================
    const productText =
      products.length > 0
        ? JSON.stringify(products)
        : "KHÔNG CÓ SẢN PHẨM PHÙ HỢP";

    // ================= AI CHAT =================
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
Bạn là nhân viên bán hàng website ly rượu vang RONA.

QUY TẮC BẮT BUỘC:
- CHỈ dùng sản phẩm trong danh sách
- KHÔNG được tự tạo sản phẩm
- KHÔNG bịa tên sản phẩm
- Nếu không có sản phẩm → nói không tìm thấy + gợi ý danh mục

DANH SÁCH SẢN PHẨM:
${productText}

TRẢ LỜI:
- Ngắn gọn
- Tư vấn bán hàng
- Ưu tiên chốt đơn
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
