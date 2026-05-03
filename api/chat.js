import { OpenAI } from "openai";
import nodemailer from "nodemailer";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

let dailyStats = { questions: [], visitorIPs: new Set(), lastSentDay: null };

export default async function handler(req, res) {
  // Cho phép mọi nguồn truy cập để tránh lỗi CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Chấp nhận cả POST và GET để tránh lỗi 405
  const message = req.body?.message || req.query?.message;
  const history = req.body?.history || [];

  if (!message) return res.status(200).json({ reply: "Duy ơi, em nghe đây!" });

  try {
    const today = new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    dailyStats.questions.push(message);

    const sapoAlias = process.env.SAPO_STORE_ALIAS;
    const sapoApiKey = process.env.SAPO_API_KEY;
    const sapoApiSecret = process.env.SAPO_API_SECRET;
    
    let productContext = "";
    try {
      const sapoRes = await fetch(`https://${sapoApiKey}:${sapoApiSecret}@${sapoAlias}.mysapo.net/admin/products/search.json?query=${encodeURIComponent(message)}&limit=3`);
      const sapoData = await sapoRes.json();
      if (sapoData.products?.length > 0) {
        productContext = sapoData.products.map(p => `Tên: ${p.title}, Giá: ${p.variants[0].price}đ, Link: https://${sapoAlias}.com/products/${p.handle}`).join("\n");
      }
    } catch (e) { console.log("Sapo Error"); }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `Bạn là Hương Lan, chuyên gia Sommelier của RONA (lyuongruouvang.com). Tư vấn đẳng cấp về pha lê Bohemia và Rona. Sản phẩm: ${productContext}` },
        ...history,
        { role: "user", content: message },
      ],
    });

    const botReply = response.choices[0].message.content;
    res.status(200).json({ reply: botReply });

  } catch (error) {
    res.status(500).json({ reply: "Hương Lan hơi mệt, Duy kiểm tra lại nhé!" });
  }
}
