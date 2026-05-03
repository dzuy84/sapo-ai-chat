import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { message, history } = req.body;
  if (!message) return res.status(200).json({ reply: "Duy ơi, em nghe đây!" });

  try {
    const sapoAlias = process.env.SAPO_STORE_ALIAS; 
    const sapoToken = process.env.SAPO_API_SECRET; // Chính là cái Token Admin Duy vừa dán

    let productContext = "";
    try {
      // Dùng header X-Sapo-Access-Token để lấy hàng thật
      const sapoRes = await fetch(`https://${sapoAlias}.mysapo.net/admin/products.json?title=${encodeURIComponent(message)}&limit=3`, {
        headers: { 
          "X-Sapo-Access-Token": sapoToken,
          "Content-Type": "application/json"
        }
      });
      const sapoData = await sapoRes.json();
      
      if (sapoData.products?.length > 0) {
        productContext = "HÀNG TRONG KHO RONA:\n" + sapoData.products.map(p => {
          return `- ${p.title}: Giá ${p.variants[0].price}đ. Link: https://${sapoAlias}.com/products/${p.handle}`;
        }).join("\n");
      }
    } catch (e) { console.log("Lỗi kết nối Sapo"); }

    const aiRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: `Bạn là Hương Lan, chuyên gia của RONA. BẮT BUỘC: Nếu có dữ liệu này, bạn PHẢI gửi link và giá thật: ${productContext}. Tuyệt đối không tự chế link. Nếu không thấy, mời khách xem tại: https://lyuongruouvang.com/collections/all` 
        },
        ...history,
        { role: "user", content: message },
      ],
    });

    res.status(200).json({ reply: aiRes.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ reply: "Hương Lan đang kiểm tra kho, sếp Duy chờ em tí nhé!" });
  }
}
