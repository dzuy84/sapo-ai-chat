import { OpenAI } from "openai";
import nodemailer from "nodemailer";

// 1. Khởi tạo OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 2. Cấu hình gửi Mail (Lưu ý: EMAIL_USER và EMAIL_PASS phải đúng tên trên Vercel)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Biến lưu thống kê (Vercel sẽ giữ trong bộ nhớ ngắn hạn)
let dailyStats = {
  questions: [],
  visitorIPs: new Set(),
  lastSentDay: null
};

export default async function handler(req, res) {
  // Cấu hình CORS để chạy được trên mọi trang web
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { message, history, ip } = req.body;
  const today = new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

  try {
    // Lưu lịch sử chat để báo cáo
    if (message) {
      dailyStats.questions.push(message);
      if (ip) dailyStats.visitorIPs.add(ip);
    }

    // 3. Kết nối Sapo lấy sản phẩm (Sử dụng Admin API)
    const sapoAlias = process.env.SAPO_STORE_ALIAS;
    const sapoApiKey = process.env.SAPO_API_KEY;
    const sapoApiSecret = process.env.SAPO_API_SECRET;
    
    let productContext = "";
    try {
      // Tìm kiếm theo từ khóa khách hỏi (query)
      const sapoRes = await fetch(`https://${sapoApiKey}:${sapoApiSecret}@${sapoAlias}.mysapo.net/admin/products/search.json?query=${encodeURIComponent(message)}&limit=3`);
      const sapoData = await sapoRes.json();
      
      if (sapoData.products && sapoData.products.length > 0) {
        productContext = "Dưới đây là các sản phẩm thật trong kho, bạn PHẢI gửi link chi tiết này cho khách:\n" + 
          sapoData.products.map(p => {
            const price = p.variants[0]?.price ? `${p.variants[0].price}đ` : "Liên hệ";
            return `- ${p.title}: Giá ${price}. Link mua: https://lyuongruouvang.com/products/${p.handle}`;
          }).join("\n");
      } else {
        productContext = "Không thấy sản phẩm này trong kho. Hãy mời khách xem tất cả tại: https://lyuongruouvang.com/collections/all";
      }
    } catch (e) {
      console.error("Sapo Connection Error");
      productContext = "Tạm thời không truy cập được kho hàng Sapo.";
    }

    // 4. AI Hương Lan trả lời
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: `Bạn là Hương Lan, chuyên gia Sommelier của RONA (lyuongruouvang.com). 
          Nhiệm vụ của bạn là tư vấn đẳng cấp về pha lê Bohemia và Rona.
          QUY TẮC BẮT BUỘC: Khi khách hỏi về sản phẩm, bạn PHẢI liệt kê danh sách kèm LINK CHI TIẾT và GIÁ từ dữ liệu này: ${productContext}.
          Tuyệt đối không bảo khách tự đi tìm kiếm.` 
        },
        ...history,
        { role: "user", content: message },
      ],
    });

    const botReply = response.choices[0].message.content;

    // 5. Gửi báo cáo Email vào lúc 22h đêm (Giờ Việt Nam)
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    if (now.getHours() >= 22 && dailyStats.lastSentDay !== today && dailyStats.questions.length > 0) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: process.env.EMAIL_USER, // Gửi về chính mail của Duy
          subject: `[RONA] Báo cáo Chatbot ngày ${today}`,
          html: `
            <h3>Tổng kết ngày ${today}</h3>
            <p><b>Số khách truy cập:</b> ${dailyStats.visitorIPs.size}</p>
            <p><b>Các nội dung khách đã hỏi:</b></p>
            <ul>${dailyStats.questions.map(q => `<li>${q}</li>`).join("")}</ul>
            <p><i>Báo cáo tự động từ hệ thống RONA AI.</i></p>
          `
        });
        dailyStats.lastSentDay = today;
        dailyStats.questions = []; // Reset sau khi gửi
        dailyStats.visitorIPs.clear();
      } catch (mailError) {
        console.error("Gửi mail thất bại");
      }
    }

    res.status(200).json({ reply: botReply });

  } catch (error) {
    console.error("System Error:", error);
    res.status(500).json({ reply: "Hương Lan đang kiểm tra lại kho, Duy chờ em một chút nhé!" });
  }
}
