import OpenAI from "openai";
import nodemailer from "nodemailer";

// Bộ nhớ tạm để gom dữ liệu trong ngày
let stats = { totalVisits: 0, uniqueIPs: new Set(), recentQuestions: [], lastEmailSentDay: null };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { message, context, ip } = req.body || {};
    const now = new Date();
    const today = now.toLocaleDateString('vi-VN');

    // 1. GHI CHÉP DỮ LIỆU
    if (message && message !== "Duy_Check_68") {
      stats.totalVisits++;
      if (ip) stats.uniqueIPs.add(ip);
      stats.recentQuestions.push({ 
        q: message, 
        time: now.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}), 
        page: context || "Trang chủ" 
      });
      // Giữ tối đa 50 câu hỏi gần nhất để không nặng máy chủ
      if (stats.recentQuestions.length > 50) stats.recentQuestions.shift();
    }

    // 2. LOGIC GỬI MAIL TỔNG KẾT (CHỈ GỬI 1 LẦN DUY NHẤT SAU 22H)
    const currentHour = now.getHours();
    if (currentHour >= 22 && stats.lastEmailSentDay !== today && stats.recentQuestions.length > 0) {
      stats.lastEmailSentDay = today; // Đánh dấu đã gửi để các tin nhắn sau không gửi nữa
      sendReportEmail(stats).catch(e => {
        console.log("Lỗi mail:", e);
        stats.lastEmailSentDay = null; // Nếu lỗi thì cho phép gửi lại sau
      });
    }

    // 3. MẬT MÃ ADMIN XEM NHANH
    if (message === "Duy_Check_68") {
      return res.status(200).json({ 
        reply: `📊 **ADMIN RONA**\n\n🔹 Khách hôm nay: ${stats.uniqueIPs.size}\n🔹 Tổng câu hỏi: ${stats.recentQuestions.length}\n📧 Báo cáo tổng kết sẽ gửi vào Gmail sau 22h đêm!` 
      });
    }

    // 4. AI TRẢ LỜI KHÁCH (DÙNG KIẾN THỨC CHUẨN)
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content: `Bạn là Le Dzuy - Sommelier tại RONA. 
          - Tư vấn đẳng cấp về pha lê Bohemia Tiệp Khắc và vang cao cấp.
          - Luôn nịnh khách, trả lời lịch sự, chuyên nghiệp.
          - Nếu khách hỏi mua hoặc cần tư vấn kỹ hơn, đưa link Zalo: <a href="https://zalo.me/0963111234" style="color:#0068ff;font-weight:bold;">Chat Zalo với Duy</a>.`
        },
        { role: "user", content: `Khách hỏi: ${message}` }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    console.error("Lỗi:", err);
    return res.status(200).json({ reply: "Duy bận tí, mình nhắn lại giúp Duy nhé!" });
  }
}

async function sendReportEmail(data) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });

  const listHtml = data.recentQuestions.map(i => `<li style="margin-bottom:5px;"><b>[${i.time}]</b>: ${i.q}</li>`).join("");

  return transporter.sendMail({
    from: `"Trợ Lý RONA" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: `[TỔNG KẾT RONA] Ngày ${new Date().toLocaleDateString('vi-VN')}`,
    html: `<div style="font-family:sans-serif;border:1px solid #8b0000;padding:20px;border-radius:10px;">
             <h2 style="color:#8b0000;">Báo cáo tổng kết ngày</h2>
             <p>🔹 Số khách truy cập: <b>${data.uniqueIPs.size}</b></p>
             <p>🔹 Tổng số câu hỏi: <b>${data.recentQuestions.length}</b></p>
             <hr>
             <h4>Chi tiết các câu hỏi:</h4>
             <ul>${listHtml || "Không có dữ liệu"}</ul>
           </div>`
  });
}
