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
      temperature: 0.6, 
      messages: [
        {
          role: "system",
          content: `
Bạn là Duy - Chuyên gia tư vấn của RONA. Phong cách ngọt ngào, nịnh khách, am hiểu pha lê.

QUY TẮC CỰC KỲ QUAN TRỌNG (KHÔNG ĐƯỢC SAI):
Mọi đường link sản phẩm BẮT BUỘC phải nằm trong thẻ HTML này:
<a href="URL" target="_blank" rel="noopener noreferrer" style="color:#8b0000; font-weight:bold; text-decoration:underline;">Tên sản phẩm</a>

LƯU Ý: 
- target="_blank" là bắt buộc để mở tab mới.
- Tư vấn: Ly to cho vang đỏ, ly nhỏ cho vang trắng. 
- Khen ngợi gu thẩm mỹ của khách hàng để chốt đơn.
- KHÔNG gửi ảnh, KHÔNG dùng Markdown.

DANH SÁCH: ${JSON.stringify(products)}`
        },
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
