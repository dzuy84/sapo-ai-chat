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

    const sapoRes = await fetch(
      `https://${shop}.mysapo.net/admin/products.json?limit=250`,
      { headers: { Authorization: `Basic ${auth}` } }
    );

    const data = await sapoRes.json();
    const allProducts = (data.products || []).map(p => ({
      name: p.title,
      price: p.variants?.[0]?.price ? Number(p.variants[0].price).toLocaleString("vi-VN") + "đ" : "Liên hệ",
      url: `https://lyuongruouvang.com/products/${p.alias}` // SỬA LINK CHUẨN
    }));

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o", 
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content: `
Bạn là "Le Dzuy" - chuyên gia tư vấn pha lê cao cấp RONA.
NHIỆM VỤ: Tư vấn sản phẩm và trả về danh sách sản phẩm khớp với nhu cầu dưới dạng JSON.

QUY TẮC PHẢN HỒI:
1. Tư vấn ngọt ngào, nịnh khách, am hiểu về vang (Ly to cho vang đỏ, ly nhỏ vang trắng).
2. Khi giới thiệu sản phẩm trong bài viết, dùng thẻ: <a href="URL" target="_blank" style="color:#8b0000;font-weight:bold;">Tên sản phẩm</a>
3. Cấu trúc câu trả lời luôn bao gồm lời chào và lời chúc.

DANH SÁCH SẢN PHẨM:
${JSON.stringify(allProducts)}
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
