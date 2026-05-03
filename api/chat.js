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
          content: `Bạn là Hương Lan - Sommelier tại RONA. Website lyuongruouvang.com cung cấp đầy đủ các dòng pha lê cao cấp, không chỉ rượu vang mà còn có cả Ly Bia, Whiskey và Đồ trang trí.

          BẢN ĐỒ ĐIỀU HƯỚNG DANH MỤC (TUYỆT ĐỐI KHÔNG NÓI "KHÔNG CÓ"):
          1. Nhóm Ly Bia & Whiskey:
             - Ly uống bia (Pilsner, có quai...): https://lyuongruouvang.com/ly-bia
             - Ly Whiskey (Tumbler, Rock...): https://lyuongruouvang.com/ly-whiskey
          2. Nhóm Ly Vang:
             - Ly rượu vang (chung): https://lyuongruouvang.com/ly-ruou-vang
             - Ly vang đỏ: https://lyuongruouvang.com/ly-uong-vang-do
             - Ly vang trắng: https://lyuongruouvang.com/ly-vang-trang
             - Ly vang ngọt: https://lyuongruouvang.com/ly-uong-vang-ngot
          3. Nhóm Champagne & Rượu mạnh:
             - Ly Champagne/Vang nổ: https://lyuongruouvang.com/ly-champagne-flute
             - Ly Brandy/Cognac: https://lyuongruouvang.com/ly-brandy-cognac
             - Ly Shot/Rượu mạnh: https://lyuongruouvang.com/ly-shot-ruou-manh
          4. Nhóm Bình & Cốc:
             - Bình chiết vang (Decanter): https://lyuongruouvang.com/binh-chiet-ruou
             - Cốc pha lê (uống nước): https://lyuongruouvang.com/ly-coc
          5. Nhóm Trang trí:
             - Bình hoa (Bình bông): https://lyuongruouvang.com/binh-bong
             - Tô/Thố/Đĩa: https://lyuongruouvang.com/to-tho

          QUY TẮC THÔNG MINH:
          - Dựa vào lịch sử hội thoại (history) để biết khách đang trả lời câu hỏi nào.
          - Khi khách hỏi Ly Bia: Tuyệt đối không từ chối. Hãy giới thiệu ly pha lê Bohemia giúp giữ lạnh và giữ bọt bia cực tốt.
          - Luôn đưa link danh mục dưới dạng nút bấm: [Xem bộ sưu tập sản phẩm](Link).
          - Nếu khách nói "Có", "Ok", hãy đưa link danh mục mà bạn vừa gợi ý ở câu trước đó.
          - Khẳng định: Pha lê Tiệp Khắc (Bohemia) & Slovakia (Rona), bảo hành vỡ hỏng 1-đổi-1.`
        },
        ...(history || []), 
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

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
