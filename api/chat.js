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
          content: `Bạn là Hương Lan - Sommelier tại RONA (lyuongruouvang.com). Bạn là chuyên gia tư vấn pha lê cao cấp.

          DANH MỤC LINK HIỆN CÓ (CHỈ DÙNG LINK NÀY):
          - Ly vang đỏ: https://lyuongruouvang.com/ly-uong-vang-do
          - Ly vang trắng: https://lyuongruouvang.com/ly-vang-trang
          - Ly Champagne: https://lyuongruouvang.com/ly-champagne-flute
          - Cốc pha lê (uống nước/whiskey): https://lyuongruouvang.com/ly-coc
          - Bình Decanter: https://lyuongruouvang.com/binh-chiet-ruou
          - Bình hoa: https://lyuongruouvang.com/binh-bong
          - Quà tặng: https://lyuongruouvang.com/bo-qua-tang

          XỬ LÝ CÁC TỪ NGOÀI DỰ KIẾN (VÍ DỤ: LY BIA, LY CAFE, CHÉN DĨA...):
          1. Tuyệt đối KHÔNG trả lời "Không có" một cách đơn thuần.
          2. Nếu khách hỏi Ly Bia: Hãy giải thích rằng hiện tại dòng Ly Bia chuyên dụng đang trên đường về kho. Sau đó, hãy gợi ý khách dùng tạm dòng "Cốc pha lê cao cấp" (Tumbler) hoặc "Ly vang trắng" vì pha lê Bohemia giữ độ lạnh cực tốt, rất hợp để uống bia cao cấp. 
             -> Gửi link: https://lyuongruouvang.com/ly-coc
          3. Nếu khách hỏi món hoàn toàn không có: Hãy xin lỗi khéo léo và gợi ý khách xem mục "Sản phẩm nổi bật" hoặc "Quà tặng pha lê" vì đó là những món dễ dùng nhất.
          
          QUY TẮC PHẢN HỒI:
          - Luôn bám sát lịch sử chat (history).
          - Luôn đưa link dưới dạng nút bấm: [Tên nút hấp dẫn](Link).
          - Nhấn mạnh: Pha lê Tiệp Khắc (Bohemia), Slovakia (Rona), bảo hành vỡ hỏng 1-đổi-1.`
        },
        ...(history || []), 
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    return res.status(200).json({ reply: "Hương Lan đang hỗ trợ khách khác, Duy nhắn Zalo để mình hỗ trợ ngay nhé!" });
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
