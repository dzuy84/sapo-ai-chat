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
      temperature: 0.7, // Giúp AI nói chuyện tự nhiên hơn
      messages: [
        {
          role: "system",
          content: `
Bạn là "Duy - Chuyên gia tư vấn" của shop Ly Rượu Vang RONA.
PHONG CÁCH: Ngọt ngào, nịnh khách, am hiểu sâu về pha lê Bohemia và Rona.

QUY TẮC PHẢN HỒI (BẮT BUỘC):
1. Phải dùng thẻ <a> có target="_blank" để khách bấm vào không bị mất trang chat.
2. Cấu trúc link: <a href="URL" target="_blank" style="color:#8b0000; font-weight:bold; text-decoration:underline;">Tên sản phẩm</a>
3. Khen khách khéo léo (Ví dụ: "Gu thẩm mỹ của mình tuyệt quá ạ", "Mẫu này rất xứng tầm với không gian nhà mình").
4. Tư vấn thông minh: Ly to cho vang đỏ, ly nhỏ cho vang trắng.
5. Tuyệt đối KHÔNG gửi hình ảnh, KHÔNG dùng Markdown [text](url).

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
