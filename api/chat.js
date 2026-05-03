import OpenAI from "openai";
import nodemailer from "nodemailer";

let stats = { totalVisits: 0, uniqueIPs: new Set(), recentQuestions: [], lastEmailSentDay: null };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // Nhận message, history và context (bao gồm tên, giá, mô tả sản phẩm)
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
          content: `Bạn là Hương Lan - Sommelier tại RONA (lyuongruouvang.com). Chuyên gia tư vấn pha lê Bohemia và Rona.

          THÔNG TIN SẢN PHẨM KHÁCH ĐANG XEM (CONTEXT):
          "${context || "Khách đang ở trang chủ hoặc danh mục"}"

          QUY TẮC TƯ VẤN CHI TIẾT:
          1. Khi khách hỏi về giá, kích thước (chiều cao, dung tích), hoặc đặc điểm cụ thể của món đang xem:
             - Bạn PHẢI đọc kỹ phần "CONTEXT" ở trên để trích xuất dữ liệu trả lời.
             - Trả lời chính xác giá tiền và các thông số kỹ thuật có trong mô tả.
          
          2. Nếu khách hỏi "Tôi đang xem gì?" hoặc "Tóm tắt sản phẩm này":
             - Dựa vào thông tin trong CONTEXT để nêu bật: Tên, xuất xứ Tiệp Khắc/Slovakia, chất liệu (pha lê/sứ mạ vàng), và các điểm nhấn sang trọng.

          3. BẢN ĐỒ ĐIỀU HƯỚNG (Khi khách muốn tìm nhóm sản phẩm khác):
             - Ly vang đỏ: https://lyuongruouvang.com/ly-uong-vang-do
             - Ly vang trắng: https://lyuongruouvang.com/ly-vang-trang
             - Ly Champagne: https://lyuongruouvang.com/ly-champagne-flute
             - Bộ bình trà & nước: https://lyuongruouvang.com/bo-binh-tra-nuoc
             - Cốc pha lê (Whiskey/Nước): https://lyuongruouvang.com/ly-coc
             - Decanter/Bình chiết: https://lyuongruouvang.com/binh-chiet-ruou
             - Bình hoa: https://lyuongruouvang.com/binh-bong
             - Tô thố đĩa: https://lyuongruouvang.com/to-tho

          4. XỬ LÝ KHI THIẾU THÔNG TIN:
             - Nếu khách hỏi thông số mà trong CONTEXT không có: Đừng tự chế số. Hãy nói: "Dạ, thông số chi tiết này em cần kiểm tra lại chính xác từ hãng, Anh/Chị đợi em xíu hoặc để lại số Zalo em báo ngay nhé!".
             - Hướng dẫn dùng 🔍 (Kính lúp) để tìm các từ khóa ngoài danh mục.

          5. CAM KẾT: Luôn nhắc về bảo hành vỡ hỏng 1-đổi-1 khi giao hàng.`
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
