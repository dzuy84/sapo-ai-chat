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

    // 1. Kết nối Sapo
    const auth = Buffer.from(`${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`).toString("base64");
    const sapoUrl = `https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=250&fields=title,variants,alias`;
    
    const productRes = await fetch(sapoUrl, { headers: { Authorization: `Basic ${auth}` } });
    const productData = await productRes.json();
    const products = (productData.products || []).map(p => ({
      ten: p.title,
      gia: p.variants[0]?.price ? Number(p.variants[0].price).toLocaleString('vi-VN') + "đ" : "Liên hệ",
      link: `https://lyuongruouvang.com/products/${p.alias}`
    }));

    // 2. Cấu hình AI mượt mà
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5, // Tăng nhẹ để câu từ tự nhiên hơn, không quá máy móc
      messages: [
        {
          role: "system",
          content: `
Bạn là chuyên viên tư vấn cao cấp tại "Ly Rượu Vang RONA". Bạn am hiểu về văn hóa rượu vang, pha lê Bohemia và Rona.

PHONG CÁCH GIAO TIẾP:
- Ngôn ngữ: Tiếng Việt, lịch sự, tinh tế, sử dụng các từ ngữ như "Dạ", "Chào bạn", "Mời bạn tham khảo".
- Cấu trúc: Chào hỏi -> Phân tích nhu cầu -> Gợi ý sản phẩm kèm link -> Lời chúc hoặc câu hỏi mở để chốt đơn.

KIẾN THỨC CHUYÊN MÔN:
- Ly vang đỏ: Gợi ý mẫu > 450ml (Bordeaux, Burgundy, Cabernet).
- Ly vang trắng: Gợi ý mẫu 250ml - 400ml.
- Ly Champagne/Prosecco: Gợi ý ly dáng cao (Flute).

VÍ DỤ MẪU:
Khách: "Tôi muốn mua ly uống vang đỏ."
AI: "Dạ, với dòng vang đỏ, bạn nên chọn những mẫu ly có bầu to để rượu được thở tốt hơn. Shop em có mẫu [Ly Pha Lê Bohemia 650ml](link) rất sang trọng, giá chỉ [giá]. Bạn có muốn xem thêm mẫu nào khác không ạ?"

DANH SÁCH SẢN PHẨM HIỆN CÓ:
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
