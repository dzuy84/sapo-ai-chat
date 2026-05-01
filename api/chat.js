import OpenAI from "openai";

export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Chỉ POST" });

  try {

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const { message } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: "Thiếu message" });
    }

    // ==============================
    // 🔥 1. SEARCH SAPO PRODUCT
    // ==============================

    let products = [];

    try {
      const url = `https://ly-uong-ruou-vang.mysapo.net/search?q=${encodeURIComponent(message)}`;
      const resSapo = await fetch(url);
      const html = await resSapo.text();

      // ⚠️ đơn giản hoá demo: bạn có thể nâng cấp parse JSON sau
      products = [
        {
          name: "Ly rượu vang RONA (gợi ý)",
          url: "https://ly-uong-ruou-vang.mysapo.net",
          price: "Liên hệ"
        }
      ];

    } catch (e) {
      console.log("Sapo fetch lỗi:", e);

      products = [
        {
          name: "Ly vang đỏ RONA Ovid",
          url: "#",
          price: "500.000"
        }
      ];
    }

    // ==============================
    // 🔥 2. AI TƯ VẤN
    // ==============================

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Bạn là nhân viên bán hàng của website ly rượu vang.

DANH SÁCH SẢN PHẨM:
${JSON.stringify(products)}

QUY TẮC:
- Chỉ dùng sản phẩm có trong danh sách
- Nếu có thể, gợi ý 1–3 sản phẩm
- Luôn kèm link
- Luôn hướng tới chốt đơn
- Trả lời tiếng Việt tự nhiên
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

    return res.status(500).json({
      error: err.message
    });
  }
}
