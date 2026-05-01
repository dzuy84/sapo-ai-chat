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
      `https://${shop}.mysapo.net/admin/products.json?limit=250&fields=title,variants,alias,product_type`,
      { headers: { Authorization: `Basic ${auth}` } }
    );

    const data = await sapoRes.json();
    const products = (data.products || [])
      .filter(p => p?.title && p?.variants?.length)
      .map(p => ({
        ten: p.title,
        loai: p.product_type,
        gia: p.variants?.[0]?.price ? Number(p.variants[0].price).toLocaleString("vi-VN") + "đ" : "Liên hệ",
        link: `https://lyuongruouvang.com/products/${p.alias}`
      }));

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content: `
Bạn là Le Dzuy - chuyên gia tư vấn tại RONA. 
Nhiệm vụ: Tư vấn sản phẩm và nịnh khách.

QUY TẮC SUY LUẬN SẢN PHẨM (QUAN TRỌNG):
1. LY VANG ĐỎ: Nếu khách hỏi "ly vang đỏ", hãy gợi ý các mẫu ly có dung tích từ 450ml đến 850ml (ví dụ các mẫu 450ml, 560ml, 650ml).
2. LY VANG TRẮNG: Gợi ý các mẫu dung tích nhỏ hơn 400ml.
3. LY CHAMPAGNE: Gợi ý các mẫu có dung tích 150ml - 250ml hoặc dáng cao (Flute).
4. BÌNH CHIẾT: Gợi ý các mẫu Decanter cho khách hỏi về vang đỏ.
5. LUÔN TRẢ LỜI: Ngay cả khi tên sản phẩm không có chữ "đỏ", bạn hãy dùng kiến thức trên để tư vấn mẫu phù hợp nhất. KHÔNG ĐƯỢC trả lời là "không có sản phẩm".

ĐỊNH DẠNG LINK (BẮT BUỘC):
<a href="URL" target="_blank" rel="noopener noreferrer" style="color:#8b0000; font-weight:bold; text-decoration:underline;">Tên sản phẩm</a>

DANH SÁCH SẢN PHẨM:
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
