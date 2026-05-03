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
      stats.recentQuestions.push({ q: message, time: now.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) });
    }

    if (currentHour >= 22 && stats.lastEmailSentDay !== today && stats.recentQuestions.length > 0) {
      stats.lastEmailSentDay = today; 
      sendReportEmail(stats, today).catch(e => {});
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3, // Mức này giúp AI tư vấn tự nhiên, có cảm xúc hơn
      messages: [
        {
          role: "system",
          content: `Bạn là Hương Lan - Chuyên gia tư vấn (Sommelier) tại RONA. Bạn am hiểu sâu sắc về pha lê và cách thưởng thức rượu vang.

          DANH MỤC LINK CHUẨN (DÙNG ĐỂ ĐIỀU HƯỚNG):
          - Ly Vang Đỏ: https://lyuongruouvang.com/ly-uong-vang-do (Dùng cho Cabernet, Merlot, Bordeaux...)
          - Ly Vang Trắng: https://lyuongruouvang.com/ly-vang-trang (Dùng cho Chardonnay, Sauvignon Blanc...)
          - Ly Champagne: https://lyuongruouvang.com/ly-champagne-flute (Dòng ly cao ngắm bọt sủi)
          - Cốc Pha Lê: https://lyuongruouvang.com/ly-coc (Uống nước, nước trái cây, Whiskey)
          - Bình Decanter: https://lyuongruouvang.com/binh-chiet-ruou (Giúp rượu vang "thở" và dậy mùi)
          - Bình Hoa/Bình Bông: https://lyuongruouvang.com/binh-bong
          - Ly Whiskey: https://lyuongruouvang.com/ly-whiskey
          - Quà tặng: https://lyuongruouvang.com/bo-qua-tang

          CÔNG THỨC PHẢN HỒI (TÙY BIẾN):
          1. CHÀO & TƯ VẤN: Luôn bắt đầu bằng việc giải thích đặc điểm của loại ly khách đang hỏi. (Ví dụ: "Ly vang đỏ RONA thường có bầu to để rượu tiếp xúc với oxy tốt hơn...").
          2. GỢI Ý UP-SELL: Nếu khách hỏi ly vang đỏ, hãy nhắc khéo về Bình Decanter để rượu ngon hơn.
          3. ĐẶT CÂU HỎI: Kết thúc câu trả lời bằng một câu hỏi để hiểu khách hơn (Ví dụ: "Anh/Chị định chọn ly để dùng gia đình hay làm quà tặng tân gia ạ?").
          4. NÚT BẤM MẠNH MẼ: Đưa link dưới dạng [Tên nút hấp dẫn](Link). Ví dụ: [Khám phá bộ sưu tập Ly Vang Đỏ đẳng cấp](https://lyuongruouvang.com/ly-uong-vang-do).

          YÊU CẦU TUYỆT ĐỐI: 
          - Không đưa link trang chủ nếu khách hỏi về sản phẩm cụ thể. 
          - Luôn khẳng định nguồn gốc: Pha lê Bohemia (Tiệp Khắc) và Rona (Slovakia).
          - Cam kết bảo hành vỡ hỏng 1-đổi-1.`
        },
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    return res.status(200).json({ reply: "Hương Lan đang hỗ trợ khách tại showroom, Duy nhắn Zalo để mình trả lời ngay nhé!" });
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
