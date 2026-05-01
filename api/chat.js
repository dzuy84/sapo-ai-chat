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

    // Gửi mail báo cáo (Chạy ngầm hoàn toàn)
    const currentHour = new Date().getHours();
    if (currentHour >= 22 && stats.lastEmailSentDay !== today && stats.recentQuestions.length > 0) {
      stats.lastEmailSentDay = today;
      sendReportEmail().catch(e => console.error("Mail Error:", e));
    }

    if (message === "Duy_Check_68") {
      return res.status(200).json({ reply: `📊 Admin RONA: Hôm nay có ${stats.uniqueIPs.size} khách chat sếp nhé!` });
    }

    // AI Tư vấn
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Bạn là Sommelier Duy tại RONA. Tư vấn đẳng cấp pha lê Tiệp. Dùng thẻ <a> cho link." },
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    return res.status(200).json({ reply: "Duy đang bận tí, mình nhắn lại nhé!" });
  }
}

async function sendReportEmail() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
  const html = stats.recentQuestions.map(i => `<li>${i.q}</li>`).join("");
  return transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    subject: `Báo cáo RONA ${new Date().toLocaleDateString('vi-VN')}`,
    html: `<h3>Khách hỏi hôm nay:</h3><ul>${html}</ul>`
  });
}
