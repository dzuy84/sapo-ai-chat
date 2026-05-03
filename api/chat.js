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
      const sapoRes = await fetch(`https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=150&fields=title,variants,alias,product_type`, { headers: { Authorization: `Basic ${auth}` } });
      const data = await sapoRes.json();
      products = (data.products || []).map(p => ({ 
        name: p.title, 
        type: p.product_type,
        url: `https://lyuongruouvang.com/products/${p.alias}` 
      }));
    } catch (e) {}

    if (message === "111234") {
      return res.status(200).json({ reply: `📊 **ADMIN RONA**: Có ${stats.uniqueIPs.size} khách. Mail sẽ gửi sau 22h!` });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    let userContent = message;
    if (context) {
      userContent = `Tôi đang quan tâm đến sản phẩm: ${context}. Nếu tôi yêu cầu tóm tắt, hãy dựa vào danh sách sản phẩm bạn có để trả lời chuyên nghiệp nhất. Câu hỏi của tôi là: ${message}`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: `Bạn là Hương Lan - Sommelier cao cấp tại RONA.
          
          NHIỆM VỤ CHUYÊN MÔN:
          - Khi khách nhấp vào hoặc hỏi về sản phẩm, hãy tra cứu trong DANH SÁCH SẢN PHẨM bên dưới.
          - Tóm tắt: Tên, loại (ly vang/cốc nước), xuất xứ (Pha lê Tiệp Khắc/Slovakia), bảo hành 1-đổi-1.
          
          CHIẾN LƯỢC GỢI Ý (UP-SELL):
          - Nếu khách hỏi về việc dùng ly vang để uống nước lọc/nước trái cây: Hãy trả lời là "Có thể dùng được để tạo phong cách sang trọng", NHƯNG sau đó PHẢI khéo léo gợi ý khách tham khảo thêm các bộ "Cốc nước pha lê" (product_type thường là 'Cốc nước' hoặc 'Ly nước') để sử dụng thuận tiện và bền bỉ hơn hàng ngày.
          - Luôn đưa ra link sản phẩm cụ thể từ danh sách nếu tìm thấy mẫu phù hợp.

          DANH SÁCH SẢN PHẨM: ${JSON.stringify(products)}

          ĐỊNH DẠNG TRẢ LỜI:
          - Sử dụng markdown [Tên sản phẩm](đường link) để hiển thị sản phẩm.
          - Phong cách: Sang trọng, tinh tế, am hiểu chuyên sâu về pha lê.`
        },
        { role: "user", content: userContent }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    return res.status(200).json({ reply: "Glas đang bận phục vụ rượu cho khách, anh/chị nhắn Zalo Glas tư vấn ngay nhé!" });
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
