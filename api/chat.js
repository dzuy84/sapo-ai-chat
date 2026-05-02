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
    const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
    const today = now.toLocaleDateString('vi-VN');
    const currentHour = now.getHours();

    if (message && message !== "Duy_Check_68") {
      stats.totalVisits++;
      if (ip) stats.uniqueIPs.add(ip);
      stats.recentQuestions.push({ 
        q: message, 
        time: now.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) 
      });
      if (stats.recentQuestions.length > 50) stats.recentQuestions.shift();
    }

    if (currentHour >= 22 && stats.lastEmailSentDay !== today && stats.recentQuestions.length > 0) {
      stats.lastEmailSentDay = today; 
      sendReportEmail(stats, today).catch(e => { stats.lastEmailSentDay = null; });
    }

    let products = [];
    try {
      const auth = Buffer.from(`${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`).toString("base64");
      const sapoRes = await fetch(`https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=150&fields=title,variants,alias`, { headers: { Authorization: `Basic ${auth}` } });
      const data = await sapoRes.json();
      products = (data.products || []).map(p => ({ 
        name: p.title, 
        url: `https://lyuongruouvang.com/products/${p.alias}` 
      }));
    } catch (e) {}

    if (message === "Duy_Check_68") {
      return res.status(200).json({ reply: `📊 **ADMIN RONA**: Có ${stats.uniqueIPs.size} khách. Mail sẽ gửi sau 22h!` });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.4, // Giữ độ sáng tạo vừa phải để tư vấn lôi cuốn
      messages: [
        {
          role: "system",
          content: `Bạn là Le Dzuy - Sommelier cao cấp tại RONA. 
          
          PHONG CÁCH TƯ VẤN:
          1. Ngôn ngữ sang trọng, lịch sự nhưng gần gũi (Dùng "Duy", "anh/chị").
          2. Kiến thức: Phải am hiểu về pha lê Bohemia (Tiệp Khắc) - nhắc đến độ trong suốt, tiếng vang và sự tinh xảo.
          3. Kịch bản bán hàng: 
             - Nếu khách hỏi về ly vang: Phân biệt ly Bordeaux (vang đậm) và Burgundy (vang thanh).
             - Nếu khách lo vỡ: Cam kết bảo hành 1 đổi 1 khi vận chuyển.
             - Nếu khách hỏi xuất xứ: Khẳng định 100% nhập khẩu từ Tiệp Khắc/Slovakia (CO/CQ đầy đủ).
          4. ĐỊNH DẠNG:
             - PHẢI dùng thẻ <a> cho sản phẩm: <a href="URL" style="color:#8b0000; font-weight:bold; text-decoration:underline;">Tên Sản Phẩm</a>.
             - Luôn điều hướng về Zalo Duy: <a href="https://zalo.me/0963111234" style="color:#0068ff; font-weight:bold;">Chat Zalo với Duy</a>.
          
          DANH SÁCH SẢN PHẨM: ${JSON.stringify(products)}`
        },
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    return res.status(200).json({ reply: "Duy đang bận phục vụ rượu cho khách, anh/chị nhắn Zalo Duy tư vấn ngay nhé!" });
  }
}

async function sendReportEmail(data, dateStr) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  let transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
  const listHtml = data.recentQuestions.map(i => `<li><b>[${i.time}]</b>: ${i.q}</li>`).join("");
  return transporter.sendMail({
    from: `"Trợ Lý RONA" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: `[BÁO CÁO RONA] ${dateStr}`,
    html: `<div style="font-family:sans-serif; padding:20px; border:1px solid #8b0000;">
           <h2 style="color:#8b0000;">Tổng kết ngày ${dateStr}</h2>
           <p>🔹 Số khách chat: <b>${data.uniqueIPs.size}</b></p>
           <hr>
           <p><b>Chi tiết các câu hỏi:</b></p>
           <ul>${listHtml}</ul>
           </div>`
  });
}
