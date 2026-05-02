import OpenAI from "openai";
import nodemailer from "nodemailer";

// Bộ nhớ gom dữ liệu
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

    // 1. LƯU THÔNG TIN (KHÔNG GỬI MAIL NGAY)
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

    // 2. KHÓA GỬI MAIL: CHỈ GỬI 1 LẦN SAU 22H
    const currentHour = now.getHours();
    if (currentHour >= 22 && stats.lastEmailSentDay !== today && stats.recentQuestions.length > 0) {
      stats.lastEmailSentDay = today; 
      sendReportEmail(stats).catch(e => { console.log("Lỗi mail"); stats.lastEmailSentDay = null; });
    }

    // 3. LẤY SẢN PHẨM SAPO (ĐỂ TRẢ LỜI ĐÚNG CÂU HỎI)
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
    } catch (e) { console.log("Sapo error"); }

    if (message === "Duy_Check_68") {
      return res.status(200).json({ reply: `📊 **ADMIN RONA**: Hôm nay có ${stats.uniqueIPs.size} khách. Báo cáo sẽ gửi vào mail Duy sau 22h!` });
    }

    // 4. AI TƯ VẤN: ÉP RA LINK BẤM ĐƯỢC
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `Bạn là Le Dzuy - Sommelier tại RONA. 
          - Tư vấn am hiểu, đẳng cấp về pha lê Bohemia.
          - QUAN TRỌNG: Khi giới thiệu sản phẩm, PHẢI dùng thẻ <a> để khách BẤM ĐƯỢC.
          - CẤU TRÚC LINK: <a href="URL" style="color:#8b0000; font-weight:bold; text-decoration:underline;">Tên Sản Phẩm</a>.
          - Nếu khách cần mua ngay, đưa link Zalo: <a href="https://zalo.me/0963111234" style="color:#0068ff; font-weight:bold;">Chat Zalo với Duy</a>.
          - Tuyệt đối không dùng Markdown như [Tên](Link).
          DANH SÁCH SẢN PHẨM: ${JSON.stringify(products)}`
        },
        { role: "user", content: `Khách đang xem: ${context}. Câu hỏi: ${message}` }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    return res.status(200).json({ reply: "Duy bận tí, sếp nhắn Zalo giúp Duy nhé!" });
  }
}

async function sendReportEmail(data) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  let transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
  const listHtml = data.recentQuestions.map(i => `<li><b>[${i.time}]</b>: ${i.q}</li>`).join("");
  return transporter.sendMail({
    from: `"Trợ Lý RONA" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: `[TỔNG KẾT RONA] ${new Date().toLocaleDateString('vi-VN')}`,
    html: `<h3>Báo cáo tổng kết</h3><p>Khách: ${data.uniqueIPs.size}</p><ul>${listHtml}</ul>`
  });
}
