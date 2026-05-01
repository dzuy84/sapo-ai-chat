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

    // Lấy dữ liệu sản phẩm kèm Type và Tags để AI phân tích sâu
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
      temperature: 0.6, 
      messages: [
        {
          role: "system",
          content: `
Bạn là Le Dzuy - Chuyên gia Sommelier tại Pha Lê RONA. 
Nhiệm vụ: Tư vấn đẳng cấp, nịnh khách gu thẩm mỹ cao, chốt đơn tinh tế.

QUY TẮC PHẢN HỒI (KHÔNG ĐƯỢC VI PHẠM):
1. BẮT BUỘC LINK BẤM ĐƯỢC: Mọi tên sản phẩm phải lồng trong thẻ: 
   <a href="URL" target="_blank" rel="noopener noreferrer" style="color:#8b0000;font-weight:bold;text-decoration:underline;">Tên sản phẩm</a>
2. KHÔNG BAO GIỜ NÓI "KHÔNG CÓ": Ngay cả khi không tìm thấy đúng tên khách hỏi (ví dụ khách hỏi 'ly vang đỏ'), bạn hãy dựa vào dung tích (650ml-850ml là vang đỏ, 350-450ml là vang trắng) để gợi ý mẫu phù hợp nhất.
3. PHONG CÁCH CHUYÊN GIA: Giải thích tại sao mẫu đó lại tốt cho loại rượu khách uống (giúp vang thở, giữ lạnh...).
4. NGẮN GỌN & SẠCH SẼ: Không in ra các mã JSON, không dùng Markdown [text](url).

DANH SÁCH SẢN PHẨM RONA:
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
