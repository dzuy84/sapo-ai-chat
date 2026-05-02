import OpenAI from "openai";
import nodemailer from "nodemailer";

// Lưu ý: stats sẽ bị reset nếu Vercel ngủ đông (đặc tính của serverless)
let stats = { totalVisits: 0, uniqueIPs: new Set(), recentQuestions: [], lastEmailSentDay: null };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { message, context, ip } = req.body || {};
    
    // ÉP GIỜ VIỆT NAM
    const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
    const today = now.toLocaleDateString('vi-VN');
    const currentHour = now.getHours();

    // 1. LƯU THÔNG TIN
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

    // 2. GỬI MAIL: Đã chỉnh đúng 22h đêm giờ Việt Nam
    if (currentHour >= 22 && stats.lastEmailSentDay !== today && stats.recentQuestions.length > 0) {
      stats.lastEmailSentDay = today; 
      // Gửi ngầm không đợi để tránh timeout cho khách
      sendReportEmail(stats, today).catch(e => { console.log("Lỗi mail:", e); stats.lastEmailSentDay = null; });
    }

    // 3. LẤY SẢN PHẨM SAPO
    let products = [];
    try {
        const auth = Buffer.from(`${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`).toString("base64");
        const sapoRes = await fetch(`https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=150&fields=title,variants,alias`, { 
            headers: { Authorization: `Basic ${auth}` } 
        });
        const data = await sapoRes.json();
        products = (data.products || []).map(p => ({ 
          name: p.title, 
          price: p.variants?.[0]?.price || "Liên hệ", 
          url: `https://lyuongruouvang.com/products/${p.alias}` 
        }));
    } catch (e) { console.log("Sapo error:", e); }

    if (message === "Duy_Check_68") {
      return res.status(200).json({ reply: `📊 **ADMIN RONA**: Hôm nay có ${stats.uniqueIPs.size} khách. Báo cáo sẽ gửi vào mail Duy sau 22h!` });
    }

    // 4. AI TRẢ LỜI
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `Bạn là Le Dzuy - Sommelier tại RONA. Tư vấn đẳng cấp pha lê Bohemia. 
          PHẢI dùng thẻ <a>: <a href="URL" style="color:#8b0000; font-weight:bold; text-decoration:underline;">Tên Sản Phẩm</a>.
          Link Zalo: <a href="https://zalo.me/0963111234" style="color:#0068ff; font-weight:bold;">Chat Zalo với Duy</a>.
          DANH SÁCH SP: ${JSON.stringify(products.slice(0, 100))}`
        },
        { role: "user", content: `Khách xem: ${context}. Câu hỏi: ${message}` }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    console.error("Main Error:", err);
    return res.status(200).json({ reply: "Duy bận tí, sếp nhắn Zalo giúp Duy nhé!" });
  }
}

async function sendReportEmail(data, dateStr) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  let transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
  
  // Lấy bản sao list câu hỏi rồi clear để tránh trùng lặp nếu server không ngủ đông
  const questions = [...data.recentQuestions];
  const listHtml = questions.map(i => `<li><b>[${i.time}]</b>: ${i.q}</li>`).join("");

  return transporter.sendMail({
    from: `"Trợ Lý RONA" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: `[TỔNG KẾT RONA] ${dateStr}`,
    html: `<h3>Báo cáo tổng kết ngày ${dateStr}</h3>
           <p>🔹 Khách: <b>${data.uniqueIPs.size}</b></p>
           <hr>
           <ul>${listHtml}</ul>`
  });
}
