import OpenAI from "openai";

export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Chỉ POST" });

  try {

    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: "Thiếu nội dung" });

    // ================= SAPO AUTH =================
    const auth = Buffer.from(
      `${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`
    ).toString("base64");

    const shop = process.env.SAPO_STORE_ALIAS;

    const sapoRes = await fetch(
      `https://${shop}.mysapo.net/admin/products.json?limit=100`,
      {
        headers: { Authorization: `Basic ${auth}` }
      }
    );

    const data = await sapoRes.json();

    // ================= FIX DATA =================
    const products = (data.products || [])
      .filter(p => p?.title && p?.variants?.length)
      .map(p => ({
        ten: p.title,
        gia: p.variants?.[0]?.price
          ? Number(p.variants[0].price).toLocaleString("vi-VN") + "đ"
          : "Liên hệ",

        link: `https://${shop}.mysapo.net/products/${p.alias}`
      }));

    // ================= OPENAI =================
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,

      messages: [
        {
          role: "system",
          content: `
Bạn là Le Dzuy - chuyên gia tư vấn ly rượu vang RONA.

QUY TẮC BẮT BUỘC:
- KHÔNG dùng HTML
- KHÔNG dùng <a>
- KHÔNG markdown link
- CHỈ dùng dữ liệu sản phẩm trong danh sách
- Trả lời ngắn gọn, tư vấn sang trọng, chốt đơn nhẹ nhàng

HƯỚNG DẪN:
- Ly vang đỏ: ly lớn
- Ly vang trắng: ly nhỏ
- Luôn gợi ý 1-3 sản phẩm phù hợp

DANH SÁCH SẢN PHẨM:
${JSON.stringify(products)}
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
