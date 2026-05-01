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

    // Lấy dữ liệu sản phẩm kèm Type và Tags
    const sapoRes = await fetch(
      `https://${shop}.mysapo.net/admin/products.json?limit=250&fields=title,variants,alias,product_type,tags`,
      { headers: { Authorization: `Basic ${auth}` } }
    );

    const data = await sapoRes.json();
    const products = (data.products || []).map(p => ({
      name: p.title,
      type: p.product_type,
      tags: p.tags,
      price: p.variants?.[0]?.price ? Number(p.variants[0].price).toLocaleString("vi-VN") + "đ" : "Liên hệ",
      url: `https://lyuongruouvang.com/products/${p.alias}`
    }));

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o", 
      temperature: 0.6, 
      messages: [
        {
          role: "system",
          content: `
Bạn là Le Dzuy - Chuyên gia Sommelier tại Pha Lê RONA. 
Nhiệm vụ: Tư vấn đẳng cấp, nịnh khách có gu, chốt đơn tinh tế.

QUY TẮC PHẢN HỒI (QUAN TRỌNG):
1. KHÔNG DÙNG target="_blank": Link phải mở ngay tại tab hiện tại của khách.
2. ĐỊNH DẠNG LINK: Mọi tên sản phẩm phải lồng trong thẻ: 
   <a href="URL" style="color:#8b0000;font-weight:bold;text-decoration:underline;">Tên sản phẩm</a>
3. KIẾN THỨC: Tư vấn ly to (>450ml) cho vang đỏ, ly nhỏ cho vang trắng. Giải thích lý do (giúp rượu thở, giữ lạnh...).
4. KHÔNG BAO GIỜ NÓI "KHÔNG CÓ": Hãy gợi ý mẫu tương đương trong danh sách dựa trên dung tích hoặc loại sản phẩm.
5. SẠCH SẼ: Không in mã JSON, không dùng Markdown.

DANH SÁCH SẢN PHẨM RONA:
${JSON.stringify(products)}
`
        },
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
