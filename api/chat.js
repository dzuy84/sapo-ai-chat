import OpenAI from "openai";

export default async function handler(req, res) {

  // ================= CORS =================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Chỉ POST" });

  try {

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body || {};

    const message = body.message || "";

    // ================= 1. SEARCH SAPO =================
    const searchUrl = `https://ly-uong-ruou-vang.mysapo.net/search/suggest.json?q=${encodeURIComponent(message)}`;

    let products = [];

    try {
      const r = await fetch(searchUrl);
      const data = await r.json();

      products = (data.products || []).map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        url: `https://ly-uong-ruou-vang.mysapo.net/products/${p.alias}`
      }));

    } catch (e) {
      console.log("Sapo error:", e);
      products = [];
    }

    // ================= 2. FILTER QUAN TRỌNG =================
    const keyword = message.toLowerCase();

    const filtered = products.filter(p =>
      p.name.toLowerCase().includes(keyword)
    );

    const finalProducts = filtered.length ? filtered : products.slice(0, 3);

    // ================= 3. AI =================
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
Bạn là nhân viên bán hàng website ly rượu vang RONA.

QUY TẮC:
- CHỈ dùng sản phẩm trong danh sách JSON
- KHÔNG tự tạo sản phẩm
- Nếu không có phù hợp → nói "không tìm thấy sản phẩm phù hợp"
- Luôn gợi ý tối đa 3 sản phẩm
- Luôn có giọng bán hàng tự nhiên

DANH SÁCH SẢN PHẨM:
${JSON.stringify(finalProducts)}
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
      products: finalProducts
    });

  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: err.message });
  }
}
