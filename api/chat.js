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

    // ================= SAPO API =================
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

    const products = (data.products || [])
      .filter(p => p?.title)
      .map(p => ({
        name: p.title,
        price: p.variants?.[0]?.price || 0,
        url: `https://${shop}.mysapo.net/products/${p.alias}`
      }));

    // ================= OPENAI (MẠNH HƠN) =================
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",   // 🔥 NÂNG CẤP TỪ MINI -> 4o
      temperature: 0.4,

      messages: [
        {
          role: "system",
          content: `
Bạn là "Le Dzuy - AI bán hàng cao cấp RONA (Shopee AI style)".

QUY TẮC TUYỆT ĐỐI:
- KHÔNG dùng HTML <a>
- KHÔNG markdown link
- KHÔNG JSON lỗi
- CHỈ trả text + danh sách sản phẩm

NHIỆM VỤ:
1. Hiểu nhu cầu khách
2. Chọn 1–5 sản phẩm phù hợp nhất
3. Trả về theo format:

REPLY:
...

PRODUCTS:
- name:
- price:
- url:

PHONG CÁCH:
- lịch sự
- tư vấn như chuyên gia pha lê
- gợi ý upsell nhẹ nhàng

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

    const text = completion.choices[0].message.content;

    // ================= PARSE PRODUCTS =================
    const result = {
      reply: text,
      products: products.slice(0, 5)
    };

    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}
