import { OpenAI } from "openai";
import nodemailer from "nodemailer";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

let dailyStats = { questions: [], visitorIPs: new Set(), lastSentDay: null };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const { message, history, ip } = req.body;
  const today = new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

  try {
    dailyStats.questions.push(message);
    if (ip) dailyStats.visitorIPs.add(ip);

    const sapoAlias = process.env.SAPO_STORE_ALIAS;
    const sapoApiKey = process.env.SAPO_API_KEY;
    const sapoApiSecret = process.env.SAPO_API_SECRET;
    
    let productContext = "Hiện không có thông tin sản phẩm.";
    try {
      const sapoRes = await fetch(`https://${sapoApiKey}:${sapoApiSecret}@${sapoAlias}.mysapo.net/admin/products/search.json?query=${encodeURIComponent(message)}&limit=3`);
      const sapoData = await sapoRes.json();
      if (sapoData.products?.length > 0) {
        productContext = sapoData.products.map(p => 
          `Tên: ${p.title}, Giá: ${p.variants[0].price}đ, Link: https://${sapoAlias}.com/products/${p.handle}`
        ).join("\n");
      }
    } catch (e) { console.error("Sapo Error:", e); }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `Bạn là Hương Lan, chuyên gia Sommelier của RONA. Tư vấn đẳng cấp về pha lê Bohemia và Rona. Sản phẩm: ${productContext}` },
        ...history,
        { role: "user", content: message },
      ],
    });

    const botReply = response.choices[0].message.content;
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    
    if (now.getHours() >= 22 && dailyStats.lastSentDay !== today) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: `[RONA] Báo cáo ${today}`,
        html: `<p>Khách: ${dailyStats.visitorIPs.size}</p><ul>${dailyStats.questions.map(q => `<li>${q}</li>`).join("")}</ul>`
      });
      dailyStats.lastSentDay = today;
    }

    res.status(200).json({ reply: botReply });
  } catch (error) {
    res.status(500).json({ reply: "Hương Lan đang bận, sếp Duy kiểm tra lại nhé!" });
  }
}
