import OpenAI from "openai";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Chỉ POST" });

  try {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: "Thiếu message" });

    const auth = Buffer.from(`${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`).toString("base64");
    const sapoUrl = `https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=250&fields=title,variants,alias`;
    
    const productRes = await fetch(sapoUrl, { headers: { Authorization: `Basic ${auth}` } });
    const productData = await productRes.json();
    
    const products = (productData.products || []).map(p => ({
      ten: p.title,
      gia: p.variants[0]?.price ? Number(p.variants[0].price).toLocaleString('vi-VN') + "đ" : "Liên hệ",
      link: `https://lyuongruouvang.com/products/${p.alias}`
    }));

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `
Bạn là chuyên viên tư vấn tại "Ly Rượu Vang RONA".
Nhiệm vụ: Tư vấn sản phẩm và đưa ra link để khách bấm vào.

QUY TẮC PHẢN HỒI (BẮT BUỘC):
1. Khi nhắc đến sản phẩm, hãy để tên sản phẩm trong thẻ link HTML như sau: 
   <a href="LINK_SP" target="_blank" style="color:#007bff; font-weight:bold; text-decoration:underline;">TÊN_SAN_PHAM</a> - Giá: GIA_TIEN
2. Tuyệt đối KHÔNG dùng ký hiệu Markdown [text](url).
3. Tuyệt đối KHÔNG gửi hình ảnh.
4. Mỗi sản phẩm cách nhau bằng một lần xuống dòng.

DANH SÁCH: ${JSON.stringify(products)}`
        },
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
