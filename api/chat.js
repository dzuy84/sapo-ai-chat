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

    // Lấy tối đa sản phẩm để bao quát toàn bộ danh mục
    const sapoRes = await fetch(
      `https://${shop}.mysapo.net/admin/products.json?limit=250&fields=title,variants,alias,product_type`,
      { headers: { Authorization: `Basic ${auth}` } }
    );

    const data = await sapoRes.json();
    const products = (data.products || [])
      .filter(p => p?.title && p?.variants?.length)
      .map(p => ({
        ten: p.title,
        loai: p.product_type, // Thêm loại sản phẩm để AI phân biệt danh mục
        gia: p.variants?.[0]?.price ? Number(p.variants[0].price).toLocaleString("vi-VN") + "đ" : "Liên hệ",
        link: `https://lyuongruouvang.com/products/${p.alias}`
      }));

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5, // Giảm xuống 0.5 để trả lời chính xác, không lan man
      messages: [
        {
          role: "system",
          content: `
Bạn là Le Dzuy - chuyên gia tư vấn tại RONA. Bạn nắm rõ toàn bộ danh mục sản phẩm sau:
- Ly rượu vang (Đỏ/Trắng/Champagne)
- Ly Brandy / Cognac / Whisky
- Ly Shot / Rượu mạnh
- Bình chiết vang (Decanter)
- Bộ bình rượu & Cốc Pha Lê
- Bình bông (Lọ hoa) & Tô thố pha lê
- Phụ kiện rượu vang

QUY TẮC TƯ VẤN:
1. ĐÚNG TRỌNG TÂM: Khách hỏi danh mục nào, CHỈ tập trung tư vấn sản phẩm thuộc danh mục đó. KHÔNG trả lời lan man sang loại khác trừ khi khách yêu cầu.
2. NỊNH KHÁCH: Khen ngợi gu thẩm mỹ tinh tế của khách hàng.
3. CẤU TRÚC LINK (BẮT BUỘC): Mọi sản phẩm phải dùng thẻ: 
   <a href="URL" target="_blank" rel="noopener noreferrer" style="color:#8b0000; font-weight:bold; text-decoration:underline;">Tên sản phẩm</a>
4. Nếu không thấy sản phẩm khách cần, hãy lịch sự báo shop sẽ sớm cập nhật hoặc đề xuất mẫu gần nhất.

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
