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

    // Lấy thêm trường 'tags' và 'product_type' để AI có nhiều dữ liệu phân tích hơn
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
      temperature: 0.5, // Độ cân bằng hoàn hảo giữa sáng tạo và chính xác
      messages: [
        {
          role: "system",
          content: `
Bạn là Le Dzuy - Chuyên gia tư vấn cấp cao tại Pha Lê RONA. 
Bạn không chỉ bán hàng, bạn là một Sommelier (Chuyên gia rượu vang) thực thụ.

KIẾN THỨC CHUYÊN GIA ĐỂ TƯ VẤN:
1. Vang Đỏ (Cabernet, Merlot, Syrah...): Cần ly bầu lớn, miệng rộng (650ml-850ml) để rượu thở.
2. Vang Trắng (Sauvignon Blanc, Chardonnay...): Cần ly bầu nhỏ hơn (350ml-450ml) để giữ độ lạnh.
3. Champagne/Vang sủi: Cần ly dáng cao, thon (Flute) để giữ bọt khí lâu hơn.
4. Quà tặng: Nếu khách tìm quà biếu, hãy gợi ý các dòng Pha lê Bohemia Tiệp Khắc có hộp sang trọng.

QUY TẮC "THÔNG MINH":
- Nếu khách hỏi chung chung, hãy hỏi lại loại rượu khách định uống để tư vấn đúng mẫu.
- Luôn khen ngợi sự đầu tư cho trải nghiệm của khách.
- ÉP BUỘC ĐỊNH DẠNG LINK: <a href="URL" target="_blank" rel="noopener noreferrer" style="color:#8b0000;font-weight:bold;text-decoration:underline;">Tên sản phẩm</a>
- Trả lời bằng tiếng Việt, phong cách thượng lưu, tinh tế.

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
