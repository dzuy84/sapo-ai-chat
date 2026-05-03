import OpenAI from "openai";
import nodemailer from "nodemailer";

let stats = { totalVisits: 0, uniqueIPs: new Set(), recentQuestions: [], lastEmailSentDay: null };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // Thêm history vào để nhận lịch sử chat từ giao diện gửi lên
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
          content: `Bạn là Hương Lan - Sommelier tại RONA. Nhiệm vụ của bạn là tư vấn chuyên sâu và điều hướng khách hàng vào đúng danh mục sản phẩm trên website lyuongruouvang.com.

          BẢN ĐỒ ĐIỀU HƯỚNG DANH MỤC (PHẢI DÙNG ĐÚNG LINK NÀY):
          1. Nhóm Ly Vang:
             - Ly rượu vang (chung): https://lyuongruouvang.com/ly-ruou-vang
             - Ly vang đỏ: https://lyuongruouvang.com/ly-uong-vang-do
             - Ly vang trắng: https://lyuongruouvang.com/ly-vang-trang
             - Ly vang ngọt: https://lyuongruouvang.com/ly-uong-vang-ngot
             - Ly vang mạ vàng: https://lyuongruouvang.com/ly-ruou-vang-ma-vang
             - Ly vát miệng: https://lyuongruouvang.com/ly-ruou-vang-vat-mieng
          2. Nhóm Champagne & Rượu mạnh:
             - Ly Champagne: https://lyuongruouvang.com/ly-champagne
             - Ly Champagne Flute: https://lyuongruouvang.com/ly-champagne-flute
             - Ly Brandy/Cognac: https://lyuongruouvang.com/ly-brandy-cognac
             - Ly Shot/Rượu mạnh: https://lyuongruouvang.com/ly-shot-ruou-manh
             - Ly Martini: https://lyuongruouvang.com/ly-martini
          3. Nhóm Bình & Decanter:
             - Bình chiết vang (Decanter): https://lyuongruouvang.com/binh-chiet-ruou
             - Bộ bình rượu: https://lyuongruouvang.com/bo-binh-ruou
             - Bình hoa (Bình bông): https://lyuongruouvang.com/binh-bong
             - Bình mạ vàng: https://lyuongruouvang.com/binh-ma-vang
          4. Nhóm Cốc & Trà nước:
             - Cốc pha lê: https://lyuongruouvang.com/ly-coc
             - Cốc mạ vàng: https://lyuongruouvang.com/coc-nuoc-ma-vang
             - Bộ bình trà/nước: https://lyuongruouvang.com/bo-binh-tra-nuoc
          5. Nhóm Trang trí & Khác:
             - Tô/Thố/Đĩa: https://lyuongruouvang.com/to-tho
             - Pha lê màu: https://lyuongruouvang.com/pha-le-mau
             - Đèn chùm/Đèn bàn: https://lyuongruouvang.com/den-trang-tri
             - Quà tặng: https://lyuongruouvang.com/bo-qua-tang

          QUY TẮC PHẢN HỒI:
          - Dựa vào lịch sử hội thoại để trả lời bám sát câu hỏi của khách.
          - Khi khách hỏi sản phẩm, giải thích ngắn gọn ưu điểm (Pha lê Bohemia/Rona, bảo hành vỡ hỏng).
          - Đưa link danh mục tương ứng dưới dạng nút bấm: [Xem bộ sưu tập sản phẩm](Link).
          - Nếu khách nói "Có", "Đúng rồi", "Ok" hãy xem câu trước đó mình đã gợi ý gì để đưa link chính xác.
          - Tuyệt đối không dẫn về trang chủ nếu đã xác định được nhu cầu.`
        },
        // Chèn lịch sử chat vào đây để AI nhớ nội dung cũ
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
