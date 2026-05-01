import OpenAI from "openai";
import nodemailer from "nodemailer";

let stats = { totalVisits: 0, uniqueIPs: new Set(), recentQuestions: [], lastEmailSentDay: null };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { message, context, ip } = req.body || {};
    const today = new Date().toLocaleDateString('vi-VN');

    stats.totalVisits++;
    if (ip) stats.uniqueIPs.add(ip);
    
    if (message && message !== "Duy_Check_68") {
      stats.recentQuestions.push({ q: message, time: new Date().toLocaleTimeString('vi-VN'), page: context || "RONA" });
      if (stats.recentQuestions.length > 20) stats.recentQuestions.shift();
    }

    // Gửi mail ngầm
    const currentHour = new Date().getHours();
    if (currentHour >= 22 && stats.lastEmailSentDay !== today && stats.recentQuestions.length > 0) {
      sendReportEmail().then(() => { stats.lastEmailSentDay = today; }).catch(e => console.log("Mail Error"));
    }

    if (message === "Duy_Check_68") {
      return res.status(200).json({ reply: `📊 Admin RONA: Hôm nay có ${stats.uniqueIPs.size} khách. Báo cáo đang gửi về mail sếp!` });
    }

    // --- LẤY DỮ LIỆU SAPO ĐỂ TRẢ LỜI NHƯ CŨ ---
    const auth = Buffer.from(`${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`).toString("base64");
    const sapoRes = await fetch(`https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=250&fields=title,variants,alias`, { headers: { Authorization: `Basic ${auth}` } });
    const data = await sapoRes.json();
    const products = (data.products || []).map(p => ({ 
      name: p.title, 
      price: p.variants?.[0]?.price || "Liên hệ", 
      url: `https://lyuongruouvang.com/products/${p.alias}` 
    }));

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: `Bạn là Le Dzuy - Sommelier tại RONA. 
          1. Tư vấn am hiểu, đẳng cấp về pha lê Bohemia và vang. 
          2. Nếu khách hỏi mua, đưa link Zalo: <a href="https://zalo.me/0963111234" style="color:#0068ff;font-weight:bold;">Chat Zalo với Duy</a>.
          3. Luôn dùng thẻ <a> cho link sản phẩm. Ví dụ: <a href="URL" style="color:#8b0000;font-weight:bold;">Tên sản phẩm</a>.
          DANH SÁCH SẢN PHẨM: ${JSON.stringify(products.slice(0, 60))}`
        },
        { role: "user", content: `Khách đang xem: ${context}. Câu hỏi: ${message}` }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    return res.status(200).json({ reply: "Duy bận tí, nhắn lại giúp Duy nhé!" });
  }
}

async function sendReportEmail() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
  const html = stats.recentQuestions.map(i => `<li>${i.q}</li>`).join("");
  return transporter.sendMail({
    from: `"Trợ Lý RONA" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: `Báo cáo RONA ${new Date().toLocaleDateString('vi-VN')}`,
    html: `<h3>Khách hỏi hôm nay:</h3><ul>${html}</ul>`
  });
}
