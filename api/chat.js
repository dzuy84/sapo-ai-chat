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
      if (stats.recentQuestions.length > 50) stats.recentQuestions.shift();
    }

    if (currentHour >= 22 && stats.lastEmailSentDay !== today && stats.recentQuestions.length > 0) {
      stats.lastEmailSentDay = today; 
      sendReportEmail(stats, today).catch(e => { stats.lastEmailSentDay = null; });
    }

    let products = [];
    try {
      const auth = Buffer.from(`${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`).toString("base64");
      const sapoRes = await fetch(`https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=100&fields=title,alias,product_type`, { headers: { Authorization: `Basic ${auth}` } });
      const data = await sapoRes.json();
      products = (data.products || []).map(p => ({ 
        name: p.title, 
        type: p.product_type,
        url: `https://lyuongruouvang.com/products/${p.alias}` 
      }));
    } catch (e) {}

    if (message === "111234") {
      return res.status(200).json({ reply: `📊 **ADMIN RONA**: Có ${stats.uniqueIPs.size} khách hôm nay. Báo cáo gửi sau 22h.` });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: `Bạn là Hương Lan - Sommelier tại RONA (lyuongruouvang.com).
          
          BẢN ĐỒ DANH MỤC (PHẢI DÙNG KHI KHÁCH HỎI CHUNG):
          - Ly vang đỏ: https://lyuongruouvang.com/ly-uong-ruou-vang-do
          - Ly vang trắng: https://lyuongruouvang.com/ly-uong-ruou-vang-trang
          - Ly Champagne/Vang nổ: https://lyuongruouvang.com/ly-uong-ruou-vang-no-champagne
          - Cốc nước/Ly nước pha lê: https://lyuongruouvang.com/coc-pha-le
          - Bình Decanter: https://lyuongruouvang.com/binh-tho-ruou-vang-decanter
          - Bộ bình rượu (Wine Set): https://lyuongruouvang.com/bo-binh-ruou
          - Quà tặng doanh nghiệp: https://lyuongruouvang.com/qua-tang-pha-le-cao-cap

          LUẬT ĐIỀU HƯỚNG:
          1. Nếu khách hỏi về loại ly (ví dụ: "ly vang đỏ", "ly uống nước", "ly champagne"), bạn PHẢI đưa link DANH MỤC tương ứng ở trên để khách xem tất cả mẫu.
          2. Nếu khách hỏi dùng ly vang uống nước: Tư vấn là được nhưng nên dùng Cốc chuyên dụng. Gửi link [Danh mục Cốc nước pha lê](https://lyuongruouvang.com/coc-pha-le).
          3. Nếu khách hỏi sản phẩm cụ thể, tra cứu trong danh sách: ${JSON.stringify(products.slice(0, 40))}
          4. Luôn sử dụng định dạng [Tên mục hoặc Sản phẩm](Link) để hiện nút bấm.
          5. Nhấn mạnh: Pha lê Tiệp Khắc, Slovakia, bảo hành 1-đổi-1 nếu vỡ khi vận chuyển.`
        },
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    return res.status(200).json({ reply: "Hương Lan đang chuẩn bị rượu cho tiệc, Duy nhắn Zalo để mình tư vấn ngay nhé!" });
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
           <h2 style="color:#8b0000;">Tổng kết hoạt động ${dateStr}</h2>
           <p>🔹 Số khách chat: <b>${data.uniqueIPs.size}</b></p>
           <hr>
           <ul>${listHtml}</ul>
           </div>`
  });
}
