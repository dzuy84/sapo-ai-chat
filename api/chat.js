import OpenAI from "openai";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Chỉ POST" });

  try {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: "Thiếu tin nhắn" });

    const auth = Buffer.from(`${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`).toString("base64");
    const sapoUrl = `https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=250&fields=title,variants,alias,image`;
    
    const productRes = await fetch(sapoUrl, { headers: { Authorization: `Basic ${auth}` } });
    const productData = await productRes.json();
    
    const products = (productData.products || []).map(p => ({
      ten: p.title,
      gia: p.variants[0]?.price ? Number(p.variants[0].price).toLocaleString('vi-VN') + "đ" : "Liên hệ",
      link: `https://lyuongruouvang.com/products/${p.alias}`,
      hinh_anh: p.image?.src || ""
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

QUY TẮC HIỂN THỊ (BẮT BUỘC DÙNG HTML):
Khi giới thiệu sản phẩm, bạn phải trình bày ĐÚNG cấu trúc sau:
<div>
  <img src="LINK_ANH" style="width:100%; border-radius:8px; margin-top:10px;" />
  <br><b>TEN_SAN_PHAM</b>
  <br>💰 Giá: GIA_TIEN
  <br><a href="LINK_SP" target="_blank" style="color:#8b0000; font-weight:bold;">Xem chi tiết</a>
</div>
<hr>

LƯU Ý:
- Không dùng cú pháp Markdown [link](url).
- Nếu không có ảnh, bỏ qua thẻ <img>.
- Trả lời lịch sự, tư vấn đúng loại ly cho khách.

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
