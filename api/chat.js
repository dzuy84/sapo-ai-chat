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

    const auth = Buffer.from(
      `${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`
    ).toString("base64");

    const sapoUrl = `https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=100`;

    const productRes = await fetch(sapoUrl, {
      headers: { Authorization: `Basic ${auth}` }
    });

    const productData = await productRes.json();

    const products = (productData.products || []).map(p => ({
      id: p.id,
      ten: p.title,
      gia: p.variants?.[0]?.price
        ? Number(p.variants[0].price).toLocaleString("vi-VN") + "đ"
        : "Liên hệ",
      link: `https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/products/${p.alias}`
    }));

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
Bạn là "Le Dzuy" - chuyên gia tư vấn ly rượu vang cao cấp.

QUY TẮC:
- KHÔNG dùng HTML link
- KHÔNG mở tab mới
- Chỉ trả về tên sản phẩm + id
- Luôn tư vấn tự nhiên, nịnh khách nhẹ nhàng
- Giữ phong cách sang trọng

DANH SÁCH SẢN PHẨM:
${JSON.stringify(products)}
`
        },
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({
      reply: completion.choices[0].message.content,
      products
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
