const { OpenAI } = require("openai");
const nodemailer = require("nodemailer");

// 1. Cấu hình OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 2. Cấu hình Email (Sử dụng biến Duy vừa cài trên Vercel)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Biến tạm để lưu thống kê trong ngày (Vercel Serverless sẽ reset khi idle, 
// nhưng vẫn đủ để gom dữ liệu trong các phiên chat gần nhau)
let dailyStats = {
  questions: [],
  visitorIPs: new Set(),
  lastSentDay: null
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { message, history, ip } = req.body;
  const today = new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

  try {
    // Lưu thống kê
    dailyStats.questions.push(message);
    if (ip) dailyStats.visitorIPs.add(ip);

    // 3. Truy vấn Sapo (Admin API) để tìm sản phẩm
    const sapoAlias = process.env.SAPO_STORE_ALIAS;
    const sapoApiKey = process.env.SAPO_API_KEY;
    const sapoApiSecret = process.env.SAPO_API_SECRET;
    
    let productContext = "Hiện tại không có thông tin sản phẩm cụ thể.";
    try {
      const sapoRes = await fetch(`https://${sapoApiKey}:${sapoApiSecret}@${sapoAlias}.mysapo.net/admin/products/search.json?query=${encodeURIComponent(message)}&limit=3`);
      const sapoData = await sapoRes.json();
      if (sapoData.products && sapoData.products.length > 0) {
        productContext = sapoData.products.map(p => 
          `Tên: ${p.title}, Giá: ${p.variants[0].price}đ, Link: https://${sapoAlias}.com/products/${p.handle}`
        ).join("\n");
      }
    } catch (e) {
      console.error("Lỗi Sapo:", e);
    }

    // 4. Gửi yêu cầu cho AI (Vai Hương Lan - Sommelier)
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `Bạn là Hương Lan, chuyên gia Sommelier của RONA (lyuongruouvang.com). 
        Bạn am hiểu sâu sắc về pha lê Bohemia (Tiệp Khắc) và Rona (Slovakia).
        Hãy tư vấn đẳng cấp, nhẹ nhàng. Nếu có sản phẩm sau đây, hãy khéo léo giới thiệu: ${productContext}` },
        ...history,
        { role: "user", content: message },
      ],
    });

    const botReply = response.choices[0].message.content;

    // 5. Logic gửi Email báo cáo vào lúc 22h đêm
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    const currentHour = now.getHours();

    if (currentHour >= 22 && dailyStats.lastSentDay !== today && dailyStats.questions.length > 0) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: `[RONA] Báo cáo tình hình Chatbot ngày ${today}`,
        html: `
          <h3>Tổng kết ngày ${today}</h3>
          <p><b>Số khách truy cập:</b> ${dailyStats.visitorIPs.size}</p>
          <p><b>Các câu hỏi trong ngày:</b></p>
          <ul>${dailyStats.questions.map(q => `<li>${q}</li>`).join("")}</ul>
        `,
      };

      await transporter.sendMail(mailOptions);
      dailyStats.lastSentDay = today;
      dailyStats.questions = []; // Reset sau khi gửi
      dailyStats.visitorIPs.clear();
    }

    // Trả kết quả về cho giao diện (Frontend)
    res.status(200).json({ reply: botReply });

  } catch (error) {
    console.error("Lỗi hệ thống:", error);
    res.status(500).json({ reply: "Hương Lan đang bận một chút, Duy kiểm tra lại giúp em nhé!" });
  }
}
