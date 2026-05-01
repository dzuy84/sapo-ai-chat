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

    const auth = Buffer.from(`${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`).toString("base64");
    const shop = process.env.SAPO_STORE_ALIAS;

    // Tăng limit lên 250 để lấy đủ hàng
    const sapoRes = await fetch(
      `https://${shop}.mysapo.net/admin/products.json?limit=250`,
      { headers: { Authorization: `Basic ${auth}` } }
    );

    const data = await sapoRes.json();

    const products = (data.products || [])
      .filter(p => p?.title && p?.variants?.length)
      .map(p => ({
        ten: p.title,
        gia: p.variants?.[0]?.price
          ? Number(p.variants[0].price).toLocaleString("vi-VN") + "đ"
          : "Liên hệ",
        // Sửa link về domain chính của shop
        link: `https://lyuongruouvang.com/products/${p.alias}`
      }));

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7, // Tăng lên 0.7 để AI nói chuyện "nịnh" và mượt hơn
      messages: [
        {
          role: "system",
          content: `
Bạn là Le Dzuy - chuyên gia tư vấn ly rượu vang RONA.
Phong cách: Sang trọng, nịnh khách, am hiểu nghệ thuật thưởng thức.

QUY TẮC PHẢN HỒI (BẮT BUỘC):
1. Dùng thẻ <a> để khách bấm vào tên sản phẩm. BẮT BUỘC có target="_blank".
   Cú pháp: <a href="LINK" target="_blank" style="color:#8b0000;font-weight:bold;">Tên sản phẩm</a>
2. Khen khéo gu thẩm mỹ của khách.
3. Tư vấn ngắn gọn: Ly lớn cho vang đỏ, ly nhỏ cho vang trắng.
4. KHÔNG dùng markdown [text](url).

DANH SÁCH SẢN PHẨM:
${JSON.stringify(products)}
`
        },
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({
      reply: completion.choices[0].message.content
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
