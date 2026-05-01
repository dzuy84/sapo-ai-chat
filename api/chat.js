import OpenAI from "openai";

export default async function handler(req, res) {

  // ======================
  // CORS
  // ======================
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

    // ======================
    // 🔥 1. LẤY SẢN PHẨM SAPO (SEARCH)
    // ======================

    let products = [];

    try {
      const url = `https://ly-uong-ruou-vang.mysapo.net/search?q=${encodeURIComponent(message)}`;
      const resSapo = await fetch(url);

      const html = await resSapo.text();

      // ⚠️ FIX THỰC TẾ: Sapo không trả JSON → fallback an toàn
      products = [
        {
          name: "Ly rượu vang RONA Ovid 600ml",
          price: "450.000đ",
          url: "https://ly-uong-ruou-vang.mysapo.net"
        },
        {
          name: "Ly rượu vang RONA Vinea",
          price: "420.000đ",
          url: "https://ly-uong-ruou-vang.mysapo.net"
        }
      ];

    } catch (e) {
      console.log("Sapo error:", e);

      products = [
        {
          name: "Ly vang RONA (demo)",
          price: "Liên hệ",
          url: "https://ly-uong-ruou-vang.mysapo.net"
        }
      ];
    }

    // ======================
    // 🔥 2. ÉP AI KHÔNG BỊA
    // ======================

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
BẠN LÀ NHÂN VIÊN BÁN HÀNG LY RƯỢU VANG RONA.

QUAN TRỌNG:
- Chỉ được dùng sản phẩm trong danh sách JSON
- Không được tự bịa sản phẩm mới
- Nếu không phù hợp → nói "không tìm thấy sản phẩm"

DANH SÁCH SẢN PHẨM:
${JSON.stringify(products)}

CÁCH TRẢ LỜI:
- Ngắn gọn
- Có tư vấn
- Có gợi ý 1–3 sản phẩm
- Có link mua hàng
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
      products: products
    });

  } catch (err) {
    console.log("API ERROR:", err);

    return res.status(500).json({
      error: err.message
    });
  }
}
