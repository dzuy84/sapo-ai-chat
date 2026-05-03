import { OpenAI } from "openai";
import nodemailer from "nodemailer";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { message, history } = req.body;
  if (!message) return res.status(200).json({ reply: "Duy ơi, em nghe đây!" });

  try {
    const sapoAlias = process.env.SAPO_STORE_ALIAS; // ly-uong-ruou-vang
    const sapoApiKey = process.env.SAPO_API_KEY;
    const sapoApiSecret = process.env.SAPO_API_SECRET;
    
    let productContext = "";
    try {
      // Tìm kiếm sản phẩm rộng hơn
      const sapoRes = await fetch(`https://${sapoApiKey}:${sapoApiSecret}@${sapoAlias}.mysapo.net/admin/products.json?title=${encodeURIComponent(message)}&limit=3`);
      const sapoData = await sapoRes.json();
      
      if (sapoData.products?.length > 0) {
        productContext = "Dưới đây là các mẫu phù hợp:\n" + sapoData.products.map(p => {
          return `- ${p.title}: Giá ${p.variants[0].price}đ. Link: https://lyuongruouvang.com/products/${p.handle}`;
        }).join("\n");
      }
    } catch (e) { console.log("Lỗi Sapo"); }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `Bạn là Hương Lan, chuyên gia Sommelier của RONA. BẮT BUỘC: Khi có sản phẩm khách hỏi, bạn PHẢI gửi link và giá này cho khách: ${productContext}. Nếu không thấy sản phẩm cụ thể, hãy mời khách xem tại: https://lyuongruouvang.com/collections/all` },
        ...history,
        { role: "user", content: message },
      ],
    });

    res.status(200).json({ reply: response.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ reply: "Hương Lan đang kiểm tra lại kho, Duy chờ em tí nhé!" });
  }
}
