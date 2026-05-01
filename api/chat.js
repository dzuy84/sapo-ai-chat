import OpenAI from "openai";

export default async function handler(req, res) {

  // ================= CORS =================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Chỉ POST" });

  try {

    const { message } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: "Thiếu message" });
    }

    // ================= SAPO AUTH =================
    const auth = Buffer.from(
      `${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`
    ).toString("base64");

    // ================= GET PRODUCTS =================
    const productRes = await fetch(
      "https://lyuongruouvang.com/admin/products.json",
      {
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    );

    const productData = await productRes.json();
    const products = productData.products || [];

    // ================= OPENAI =================
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
Bạn là nhân viên bán hàng ly rượu vang RONA.

QUY TẮC:
- CHỈ dùng sản phẩm trong danh sách
- KHÔNG bịa sản phẩm
- Nếu không có → nói không tìm thấy
- Tư vấn ngắn gọn, chốt đơn

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
    console.log("API ERROR:", err);

    return res.status(500).json({
      error: err.message
    });
  }
}
