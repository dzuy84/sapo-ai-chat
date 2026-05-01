import OpenAI from "openai";

export default async function handler(req, res) {
  // ================= 1. CẤU HÌNH CORS =================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Chỉ POST" });

  try {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: "Thiếu message" });

    // ================= 2. KẾT NỐI SAPO =================
    const auth = Buffer.from(
      `${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`
    ).toString("base64");

    // Lấy 250 sản phẩm mới nhất, chỉ lấy các trường cần thiết để tiết kiệm dung lượng
    const sapoUrl = `https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=250&fields=title,variants,alias`;
    
    const productRes = await fetch(sapoUrl, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json"
      }
    });

    if (!productRes.ok) throw new Error("Không thể kết nối API Sapo");

    const productData = await productRes.json();
    const rawProducts = productData.products || [];

    // Tối ưu hóa danh sách sản phẩm để AI dễ đọc
    const productsForAI = rawProducts.map(p => ({
      ten: p.title,
      gia: p.variants[0]?.price.toLocaleString('vi-VN') + " VNĐ",
      link: `https://lyuongruouvang.com/products/${p.alias}`,
      // Gợi ý cho AI: Ly dung tích lớn thường là vang đỏ, nhỏ là vang trắng/champagne
      ghi_chu: p.title.toLowerCase()
    }));

    // ================= 3. CẤU HÌNH AI (GPT-4O-MINI) =================
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `
Bạn là chuyên gia tư vấn tại shop "Ly Rượu Vang RONA".
Nhiệm vụ: Tư vấn sản phẩm phù hợp nhất cho khách hàng.

HƯỚNG DẪN TƯ VẤN THÔNG MINH:
1. Nếu khách hỏi "Ly vang đỏ": Hãy gợi ý các mẫu ly có dung tích lớn hoặc tên có chữ "Red Wine", "650ml", "450ml".
2. Nếu khách hỏi "Ly vang trắng": Hãy gợi ý các mẫu ly có dung tích nhỏ hơn hoặc tên có chữ "White Wine", "350ml", "150ml".
3. Nếu khách hỏi "Ly Champagne/Sủi tăm": Gợi ý các mẫu ly dáng cao, thon (Flute).
4. Quy tắc phản hồi:
   - Luôn kèm theo GIÁ và LINK sản phẩm dưới dạng Markdown: [Tên sản phẩm](Link).
   - Nếu không có đúng tên mặt chữ, hãy dùng kiến thức về rượu vang để đề xuất sản phẩm tương tự.
   - Tránh trả lời "không có" nếu trong danh sách có sản phẩm có thể thay thế.
   - Giọng văn lịch sự, chuyên nghiệp.

DANH SÁCH SẢN PHẨM:
${JSON.stringify(productsForAI)}
`
        },
        { role: "user", content: message }
      ]
    });

    // ================= 4. TRẢ KẾT QUẢ =================
    return res.status(200).json({
      reply: completion.choices[0].message.content,
      success: true,
      count: productsForAI.length
    });

  } catch (err) {
    console.error("LỖI:", err.message);
    return res.status(500).json({ error: "Lỗi hệ thống", detail: err.message });
  }
}
