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

    if (message && message !== "111234") {
      stats.totalVisits++;
      if (ip) stats.uniqueIPs.add(ip);
      stats.recentQuestions.push({ 
        q: message, 
        time: now.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) 
      });
    }

    if (currentHour >= 22 && stats.lastEmailSentDay !== today && stats.recentQuestions.length > 0) {
      stats.lastEmailSentDay = today; 
      sendReportEmail(stats, today).catch(e => {});
    }

    // Lấy dữ liệu sản phẩm từ Sapo
    let products = [];
    try {
      const auth = Buffer.from(`${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`).toString("base64");
      const sapoRes = await fetch(`https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=50&fields=title,alias`, { headers: { Authorization: `Basic ${auth}` } });
      const data = await sapoRes.json();
      products = (data.products || []).map(p => ({ 
        name: p.title, 
        url: `https://lyuongruouvang.com/products/${p.alias}` 
      }));
    } catch (e) {}

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1, // Ép AI trả lời chính xác, không sáng tạo link
      messages: [
        {
          role: "system",
          content: `Bạn là Hương Lan - Chuyên gia Sommelier tại RONA. 

          DANH MỤC BẮT BUỘC (SỬ DỤNG CHÍNH XÁC LINK NÀY KHI KHÁCH HỎI CHUNG):
          1. Ly vang đỏ: https://lyuongruouvang.com/ly-uong-ruou-vang-do
          2. Ly vang trắng: https://lyuongruouvang.com/ly-uong-ruou-vang-trang
          3. Ly Champagne/Vang nổ: https://lyuongruouvang.com/ly-uong-ruou-vang-no-champagne
          4. Cốc nước/Ly nước pha lê: https://lyuongruouvang.com/coc-pha-le
          5. Bình Decanter: https://lyuongruouvang.com/binh-tho-ruou-vang-decanter
          6. Bộ bình rượu: https://lyuongruouvang.com/bo-binh-ruou
          7. Quà tặng doanh nghiệp: https://lyuongruouvang.com/qua-tang-pha-le-cao-cap

          LUẬT TRẢ LỜI NGHIÊM NGẶT:
          - KHÔNG ĐƯỢC tự ý tạo link trang chủ https://lyuongruouvang.com/ khi khách hỏi về loại ly cụ thể.
          - Nếu khách hỏi "Ly vang đỏ" hoặc tương tự -> PHẢI dùng link số 1.
          - Nếu khách hỏi về "Cốc nước", "Ly nước", hoặc "Uống nước" -> PHẢI dùng link số 4.
          - Định dạng link luôn là: [Tên mục](Link) để hệ thống hiện NÚT BẤM.
          - Ví dụ: [Bấm xem bộ sưu tập Ly Vang Đỏ](https://lyuongruouvang.com/ly-uong-ruou-vang-do).

          SẢN PHẨM GỢI Ý THÊM: ${JSON.stringify(products)}`
        },
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    return res.status(200).json({ reply: "Hương Lan đang bận tiệc, bạn nhắn Zalo giúp nhé!" });
  }
}

async function sendReportEmail(data, dateStr) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  let transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
  const listHtml = data.recentQuestions.map(i => `<li><b>[${i.time}]</b>: ${i.q}</li>`).join("");
  return transporter.sendMail({
    from: `"RONA Report" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: `[RONA CHAT] ${dateStr}`,
    html: `<div style="font-family:sans-serif; padding:20px; border:1px solid #8b0000; border-radius:10px;">
           <h2 style="color:#8b0000;">Báo cáo chat ngày ${dateStr}</h2>
           <p>Số khách IP khác nhau: <b>${data.uniqueIPs.size}</b></p>
           <hr>
           <ul>${listHtml}</ul>
           </div>`
  });
}
