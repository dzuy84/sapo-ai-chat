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

    // 1. Kết nối Sapo - Lấy thêm trường 'image' để có hình ảnh
    const auth = Buffer.from(`${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`).toString("base64");
    const sapoUrl = `https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=250&fields=title,variants,alias,image`;
    
    const productRes = await fetch(sapoUrl, { headers: { Authorization: `Basic ${auth}` } });
    const productData = await productRes.json();
    
    const products = (productData.products || []).map(p => ({
      ten: p.title,
      gia: p.variants[0]?.price ? Number(p.variants[0].price).toLocaleString('vi-VN') + "đ" : "Liên hệ",
      link: `https://lyuongruouvang.com/products/${p.alias}`,
      hinh_anh: p.image?.src || "" // Lấy link ảnh đại diện
    }));

    // 2. Cấu hình AI hiển thị hình ảnh
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: `
Bạn là chuyên viên tư vấn cao cấp tại "Ly Rượu Vang RONA". 

QUY TẮC HIỂN THỊ HÌNH ẢNH:
- Khi giới thiệu sản phẩm, bạn PHẢI hiển thị hình ảnh theo cú pháp Markdown: [![thumbnail](Link ảnh)](Link sản phẩm)
- Ngay bên dưới hình ảnh là Tên sản phẩm (in đậm) và Giá tiền.
- Ví dụ: 
[![Sản phẩm](https://img.mysapo.net/abc.jpg)](https://lyuongruouvang.com/products/abc)
**Ly Pha Lê Bohemia 650ml** - Giá: 810.000đ

PHONG CÁCH:
- Dạ, thưa gửi lịch sự.
- Tư vấn dựa trên dung tích: Ly to (>450ml) cho vang đỏ, ly nhỏ (250-400ml) cho vang trắng.
- Nếu không có ảnh (link ảnh rỗng), chỉ dùng link text như bình thường.

DANH SÁCH SẢN PHẨM:
${JSON.stringify(products)}
`
        },
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({
      reply: completion.choices[0].message.content,
      success: true
    });

  } catch (err) {
    return res.status(500).json({ error: "Lỗi hệ thống", detail: err.message });
  }
}
