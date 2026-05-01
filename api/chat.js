import OpenAI from "openai";
import nodemailer from "nodemailer";

// Bộ nhớ tạm để gom dữ liệu
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

    // 1. GHI CHÉP DỮ LIỆU (Chỉ ghi vào bộ nhớ, chưa gửi mail)
    if (message && message !== "Duy_Check_68") {
      stats.totalVisits++;
      if (ip) stats.uniqueIPs.add(ip);
      stats.recentQuestions.push({ 
        q: message, 
        time: now.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}), 
        page: context || "Trang chủ" 
      });
      if (stats.recentQuestions.length > 50) stats.recentQuestions.shift();
    }

    // 2. LOGIC GỬI MAIL TỔNG KẾT (CHỈ GỬI 1 LẦN SAU 22H)
    const currentHour = now.getHours();
    if (currentHour >= 22 && stats.lastEmailSentDay !== today && stats.recentQuestions.length > 0) {
      // Đánh dấu đã gửi ngay lập tức để các tin nhắn sau không gửi trùng
      stats.lastEmailSentDay = today; 
      
      // Gửi mail chạy ngầm
      sendReportEmail(stats).catch(e => {
          console.error("Lỗi gửi mail:", e);
          stats.lastEmailSentDay = null; // Nếu lỗi thì cho phép gửi lại sau
      });
    }

    // 3. MẬT MÃ ADMIN XEM NHANH
    if (message === "Duy_Check_68") {
      return res.status(200).json({ 
        reply: `📊 **QUẢN TRỊ RONA**\n\n🔹 Hôm nay có ${stats.uniqueIPs.size} khách.\n🔹 Tổng ${stats.recentQuestions.length} câu hỏi.\n📧 Báo cáo tổng kết sẽ gửi vào Gmail sau 22h đêm!` 
      });
    }

    // 4. LẤY DỮ LIỆU SAPO VÀ TRẢ LỜI KHÁCH (Như cũ)
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
          content: `Bạn là Le Dzuy - Sommelier tại RONA. Tư vấn đẳng cấp pha lê Bohemia. 
          Link Zalo: <a href="https://zalo.me/0963111234" style="color:#0068ff;font-weight:bold;">Chat Zalo với Duy</a>.
          DANH SÁCH: ${JSON.stringify(products.slice(0, 60))}`
        },
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    return res.status(200).json({ reply: "Duy bận tí, nhắn lại giúp Duy nhé!" });
  }
}

async function sendReportEmail(data) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });

  const listHtml = data.recentQuestions.map(i => `<li><b>[${i.time}]</b>: ${i.q}</li>`).join("");

  return transporter.sendMail({
    from: `"Trợ Lý RONA" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: `[TỔNG KẾT RONA] Ngày ${new Date().toLocaleDateString('vi-VN')}`,
    html: `<h2>Báo cáo tổng kết ngày hôm nay</h2>
           <p>🔹 Số khách truy cập: ${data.uniqueIPs.size}</p>
           <p>🔹 Tổng số câu hỏi: ${data.recentQuestions.length}</p>
           <hr>
           <ul>${listHtml}</ul>`
  });
}
