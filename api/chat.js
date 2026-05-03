import OpenAI from "openai";
import nodemailer from "nodemailer";

let stats = { totalVisits: 0, uniqueIPs: new Set(), recentQuestions: [], lastEmailSentDay: null };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // Nhận message, history và context (tên sản phẩm khách đang xem)
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
          content: `Bạn là Hương Lan - Sommelier tại RONA (lyuongruouvang.com). Bạn là chuyên gia tư vấn pha lê Bohemia (Tiệp Khắc) và Rona (Slovakia).

          NGỮ CẢNH TRANG HIỆN TẠI: Khách hàng đang xem sản phẩm: "${context || "Trang chủ website"}".

          QUY TẮC PHẢN HỒI:
          1. Nếu khách hỏi "Tôi đang xem gì?", "Sản phẩm này có gì hay?", "Tóm tắt giúp mình" hoặc các câu liên quan đến trang hiện tại:
             - Bạn PHẢI dựa vào tên sản phẩm: "${context}" để tư vấn.
             - Tóm tắt ngắn gọn: Thương hiệu, chất liệu cao cấp (mạ vàng 24k, pha lê thủ công...), và ứng dụng sang trọng của nó.
          
          2. BẢN ĐỒ ĐIỀU HƯỚNG DANH MỤC (Dùng đúng link này):
             - Ly vang đỏ: https://lyuongruouvang.com/ly-uong-vang-do
             - Ly vang trắng: https://lyuongruouvang.com/ly-vang-trang
             - Ly Champagne Flute: https://lyuongruouvang.com/ly-champagne-flute
             - Bộ bình trà & nước: https://lyuongruouvang.com/bo-binh-tra-nuoc
             - Cốc pha lê (Whiskey/Nước): https://lyuongruouvang.com/ly-coc
             - Decanter/Bình chiết: https://lyuongruouvang.com/binh-chiet-ruou
             - Bình hoa: https://lyuongruouvang.com/binh-bong
             - Tô thố đĩa: https://lyuongruouvang.com/to-tho

          3. XỬ LÝ SẢN PHẨM KHÔNG CÓ LINK (VÍ DỤ: LY BIA, LY CAFE...):
             - Tuyệt đối không nói "Không có".
             - Hướng dẫn dùng 🔍 (Kính lúp): "Dạ, mẫu này bên em hiện có rất nhiều mẫu lẻ tuyệt đẹp. Anh/Chị vui lòng nhấn vào biểu tượng 🔍 (Kính lúp) ở đầu trang website và gõ từ khóa '[Tên sản phẩm]' để hệ thống lọc ra ngay nhé!"

          4. QUY TẮC CHUNG:
             - Dựa vào lịch sử chat (history) để trả lời bám sát.
             - Đưa link danh mục dưới dạng nút bấm: [Xem bộ sưu tập sản phẩm](Link).
             - Khẳng định: Bảo hành vỡ hỏng 1-đổi-1 khi vận chuyển.`
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
