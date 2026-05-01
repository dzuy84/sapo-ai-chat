import OpenAI from "openai";
import nodemailer from "nodemailer";

// Bộ nhớ tạm để lưu số liệu trong ngày
let stats = { totalVisits: 0, uniqueIPs: new Set(), recentQuestions: [], lastEmailSentDay: null };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { message, context, ip } = req.body || {};
    const today = new Date().toLocaleDateString('vi-VN');

    // 1. Ghi chép số liệu
    stats.totalVisits++;
    if (ip && ip !== "Ẩn") stats.uniqueIPs.add(ip);
    
    if (message && message !== "Duy_Check_68") {
      stats.recentQuestions.push({ 
        q: message, 
        time: new Date().toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}), 
        page: context || "Trang chủ" 
      });
      if (stats.recentQuestions.length > 30) stats.recentQuestions.shift();
    }

    // 2. Tự động gửi mail báo cáo (Chạy ngầm để không chậm chat)
    const currentHour = new Date().getHours();
    if (currentHour >= 22 && stats.lastEmailSentDay !== today && stats.recentQuestions.length > 0) {
      sendReportEmail().then(() => {
        stats.lastEmailSentDay = today;
      }).catch(e => console.error("Lỗi gửi mail:", e));
    }

    // 3. Mật mã Admin xem nhanh
    if (message === "Duy_Check_68") {
      return res.status(200).json({ 
        reply: `📊 **QUẢN TRỊ RONA**\n\n🔹 Chat hôm nay: ${stats.totalVisits}\n🔹 Số khách (IP): ${stats.uniqueIPs.size}\n📧 Báo cáo chi tiết đang được gửi về Gmail của sếp!` 
      });
    }

    // 4. Lấy danh sách sản phẩm từ Sapo
    const auth = Buffer.from(`${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`).toString("base64");
    const sapoRes = await fetch(`https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=250&fields=title,variants,alias`, { 
        headers: { Authorization: `Basic ${auth}` } 
    });
    const data = await sapoRes.json();
    const products = (data.products || []).map(p => ({ 
      name: p.title, 
      price: p.variants?.[0]?.price || "Liên hệ", 
      url: `https://lyuongruouvang.com/products/${p.alias}` 
    }));

    // 5. Gọi AI trả lời khách
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: `Bạn là Le Dzuy - Sommelier tại RONA. 
          - Tư vấn đẳng cấp, am hiểu về pha lê Bohemia và vang.
          - Nếu khách hỏi mua/giao, đưa link Zalo: <a href="https://zalo.me/0963111234" style="color:#0068ff;font-weight:bold;">Chat Zalo với Duy</a>.
          - Luôn dùng thẻ <a> cho link sản phẩm. Không dùng Markdown.
          SẢN PHẨM: ${JSON.stringify(products.slice(0, 50))}`
        },
        { role: "user", content: `(Đang xem: ${context}) - Khách hỏi: ${message}` }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    console.error(err);
    return res.status(200).json({ reply: "Duy bận chút, mình nhắn lại sau ít phút nhé!" });
  }
}

// Hàm gửi mail báo cáo
async function sendReportEmail() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  
  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });

  const listHtml = stats.recentQuestions.map(i => `
    <li style="margin-bottom:8px;">
      <b>[${i.time}]</b>: ${i.q} <br>
      <small style="color:#666;">Xem tại: ${i.page}</small>
    </li>`).join("");

  return transporter.sendMail({
    from: `"Trợ Lý RONA" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: `[RONA] Báo cáo ngày ${new Date().toLocaleDateString('vi-VN')}`,
    html: `<div style="font-family:sans-serif; padding:20px; border:1px solid #8b0000; border-radius:10px;">
             <h2 style="color:#8b0000;">Báo cáo hôm nay nè sếp Duy!</h2>
             <p>🔹 Tổng lượt chat: ${stats.totalVisits}</p>
             <p>🔹 Số khách (IP): ${stats.uniqueIPs.size}</p>
             <hr>
             <h4>Chi tiết câu hỏi:</h4>
             <ul>${listHtml || "Không có câu hỏi nào."}</ul>
           </div>`
  });
}
