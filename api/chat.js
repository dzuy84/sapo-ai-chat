import OpenAI from "openai";
import nodemailer from "nodemailer";

let stats = { totalVisits: 0, uniqueIPs: new Set(), recentQuestions: [], lastEmailSentDay: null };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { message, history, context, ip } = req.body || {}; 
    const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
    const today = now.toLocaleDateString('vi-VN');
    const currentHour = now.getHours();

    if (message && message !== "111234") {
      stats.totalVisits++;
      if (ip) stats.uniqueIPs.add(ip);
      stats.recentQuestions.push({ q: message, time: now.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) });
    }

    if (currentHour >= 22 && stats.lastEmailSentDay !== today && stats.recentQuestions.length > 0) {
      stats.lastEmailSentDay = today; 
      sendReportEmail(stats, today).catch(e => {});
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1, 
      messages: [
        {
          role: "system",
          content: `Bạn là Hương Lan - Sommelier tại RONA (lyuongruouvang.com). Bạn là chuyên gia tư vấn pha lê Bohemia (Tiệp), Rona (Slovakia) và đồ sứ cao cấp.

KIẾN THỨC MẶC ĐỊNH CỦA SHOP:
- Luôn có sẵn các dung tích: 350ml, 450ml, 550ml, 650ml, 750ml, 850ml

QUY TẮC QUAN TRỌNG (SEARCH):
- Nếu khách hỏi dung tích (ví dụ: 650ml, 750ml...) hoặc từ khóa sản phẩm
- LUÔN tạo link dạng:
👉 https://lyuongruouvang.com/search?query=tukhoa
- Trả về dạng:
[Xem sản phẩm phù hợp](https://lyuongruouvang.com/search?query=650)

- KHÔNG nói chung chung → phải đưa link để khách bấm

CONTEXT:
"${context || "Khách đang ở trang chủ"}"

PHẢN HỒI:
- Luôn tự nhiên, bán hàng tốt, dẫn link rõ ràng`
        },
        ...(history || []), 
        { role: "user", content: message }
      ]
    });

    let reply = completion.choices[0].message.content;

    // ====== 🔥 AUTO THÊM LINK SEARCH (QUAN TRỌNG) ======
    const match = message.match(/(\d{3,4})\s?ml|\b(\d{3,4})\b/);
    if (match) {
      const keyword = match[1] || match[2];
      reply += `\n👉 <a href="https://lyuongruouvang.com/search?query=${keyword}" target="_self">Xem tất cả mẫu ${keyword}ml tại đây</a>`;
    }
    // ==================================================

    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(200).json({ reply: "Hương Lan đang kiểm tra kho hàng, Duy nhắn Zalo để mình hỗ trợ ngay nhé!" });
  }
}

async function sendReportEmail(data, dateStr) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  let transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
  const listHtml = data.recentQuestions.map(i => `<li><b>[${i.time}]</b>: ${i.q}</li>`).join("");
  return transporter.sendMail({
    from: `"RONA AI Report" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: `[BÁO CÁO RONA] ${dateStr}`,
    html: `<div style="font-family:sans-serif; padding:20px; border:1px solid #8b0000; border-radius:10px;">
           <h2 style="color:#8b0000;">Tổng kết chat ngày ${dateStr}</h2>
           <p>Số khách IP khác nhau: <b>${data.uniqueIPs.size}</b></p>
           <hr><ul>${listHtml}</ul></div>`
  });
}
