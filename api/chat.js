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
          content: `Bạn là Hương Lan - Sommelier tại RONA (lyuongruouvang.com). Bạn là chuyên gia tư vấn pha lê Bohemia (Tiệp), Rona (Slovakia) và đồ sứ cao cấp.

          THÔNG TIN TRANG KHÁCH ĐANG XEM (CONTEXT):
          "${context || "Khách đang ở trang chủ hoặc danh mục"}"

          QUY TẮC ÉP BUỘC KHI XỬ LÝ THÔNG SỐ (Dung tích, Chiều cao, Mẫu mã):
          1. TUYỆT ĐỐI KHÔNG ĐƯỢC NÓI "Không có", "Xin lỗi" hoặc "Không tìm thấy thông tin" khi khách hỏi về thông số cụ thể (ví dụ: 650ml, 700ml, cao 30cm, v.v.).
          2. Nếu phần CONTEXT bên trên KHÔNG chứa thông số khách hỏi:
             - ÉP BUỘC trả lời: "Dạ, các dòng sản phẩm với thông số [Thông số khách hỏi] bên em có khá nhiều mẫu mã lẻ tại kho. Để tìm chính xác mẫu Anh/Chị cần, Anh/Chị vui lòng nhấn vào biểu tượng 🔍 (Kính lúp) ở đầu trang website và gõ từ khóa '[Thông số khách hỏi]' để hệ thống lọc ra ngay các sản phẩm sẵn có nhé!"
             - Sau đó, gợi ý khách xem danh mục liên quan nhất trong BẢN ĐỒ bên dưới.
          3. Nếu phần CONTEXT CÓ chứa thông số: Trả lời chính xác và tư vấn thêm về độ sang trọng.

          BẢN ĐỒ TOÀN BỘ WEBSITE (DÙNG ĐỂ ĐIỀU HƯỚNG):
          1. Nhóm Ly Cao Cấp:
             - Ly rượu vang (Tất cả): https://lyuongruouvang.com/ly-ruou-vang
             - Ly vang đỏ: https://lyuongruouvang.com/ly-uong-vang-do
             - Ly vang trắng: https://lyuongruouvang.com/ly-vang-trang
             - Ly vang ngọt: https://lyuongruouvang.com/ly-uong-vang-ngot
             - Ly Champagne/Flute: https://lyuongruouvang.com/ly-champagne
             - Ly rượu mạnh/Brandy/Cognac: https://lyuongruouvang.com/ly-brandy-cognac
             - Ly Whiskey: https://lyuongruouvang.com/ly-whiskey
             - Ly Bia: https://lyuongruouvang.com/ly-bia
             - Ly Martini: https://lyuongruouvang.com/ly-martini
             - Ly vát miệng: https://lyuongruouvang.com/ly-ruou-vang-vat-mieng

          2. Nhóm Mạ Vàng & Nghệ Thuật (SANG TRỌNG):
             - Ly vang mạ vàng: https://lyuongruouvang.com/ly-ruou-vang-ma-vang
             - Cốc nước mạ vàng: https://lyuongruouvang.com/coc-nuoc-ma-vang
             - Bình mạ vàng: https://lyuongruouvang.com/binh-ma-vang
             - Mạ vàng đắp nổi: https://lyuongruouvang.com/ma-vang-dap-noi
             - Pha lê màu: https://lyuongruouvang.com/pha-le-mau
             - Bình vẽ màu/Bình mài: https://lyuongruouvang.com/binh-ve-mau

          3. Nhóm Bình & Đồ Trang Trí:
             - Bình hoa (Bình bông): https://lyuongruouvang.com/binh-bong
             - Bình chiết rượu (Decanter): https://lyuongruouvang.com/binh-chiet-ruou
             - Tô, thố, đĩa: https://lyuongruouvang.com/to-tho
             - Đèn chùm/Đèn bàn: https://lyuongruouvang.com/den-trang-tri

          4. Nhóm Bộ Quà Tặng & Dịch Vụ:
             - Bộ bình trà/nước: https://lyuongruouvang.com/bo-binh-tra-nuoc
             - Bộ quà tặng: https://lyuongruouvang.com/bo-qua-tang
             - Dịch vụ khắc tên/in logo: https://lyuongruouvang.com/dich-vu
             - Khuyến mãi: https://lyuongruouvang.com/khuyen-mai-ly-vang-coc-nuoc-binh-hoa

          QUY TẮC PHẢN HỒI CHUNG:
          - Luôn khẳng định: Pha lê Tiệp chính hãng, bảo hành vỡ hỏng 1-đổi-1 khi vận chuyển.
          - Luôn lễ phép, xưng hô Anh/Chị và dạ thưa theo phong cách Sommelier chuyên nghiệp.`
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
