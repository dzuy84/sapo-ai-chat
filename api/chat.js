const { OpenAI } = require("openai");
const nodemailer = require("nodemailer");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

let dailyStats = { questions: [], visitorIPs: new Set(), lastSentDay: null };

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { message, history = [], ip } = req.body;
  const today = new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

  try {
    if (message) {
      dailyStats.questions.push(message);
      if (ip) dailyStats.visitorIPs.add(ip);
    }

    // LẤY DỮ LIỆU SAPO (Dùng Access Token cho an toàn)
    const sapoAlias = process.env.SAPO_STORE_ALIAS; // ly-uong-ruou-vang
    const sapoToken = process.env.SAPO_API_SECRET; // Mã shpat_... hoặc 07c03d...
    
    let productContext = "";
    try {
      const sapoRes = await fetch(`https://${sapoAlias}.mysapo.net/admin/products/search.json?query=${encodeURIComponent(message)}&limit=3`, {
        headers: {
          "X-Sapo-Access-Token": sapoToken,
          "Content-Type": "application/json"
        }
      });
      const sapoData = await sapoRes.json();
      
      if (sapoData.products && sapoData.products.length > 0) {
        productContext = "Sản phẩm thực tế trong kho RONA:\n" + sapoData.products.map(p => {
          const price = p.variants[0]?.price ? Number(p.variants[0].price).toLocaleString("vi-VN") + "đ" : "Liên hệ";
          return `- ${p.title}: Giá ${price}. Link: https://lyuongruouvang.com/products/${p.handle}`;
        }).join("\n");
      } else {
        productContext = "Không tìm thấy. Dẫn khách xem: https://lyuongruouvang.com/collections/all";
      }
    } catch (e) {
      productContext = "Lỗi kết nối Sapo.";
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: `Bạn là Hương Lan, chuyên gia RONA. BẮT BUỘC: Chỉ dùng link/giá từ kho: ${productContext}. Không tự chế link.` 
        },
        ...history,
        { role: "user", content: message },
      ],
    });

    const botReply = response.choices[0].message.content;

    // BÁO CÁO 22H
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    if (now.getHours() >= 22 && dailyStats.lastSentDay !== today && dailyStats.questions.length > 0) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: process.env.EMAIL_USER,
          subject: `[RONA] Báo cáo ngày ${today}`,
          html: `<h3>Tổng kết:</h3><p>Khách: ${dailyStats.visitorIPs.size}</p><ul>${dailyStats.questions.map(q => `<li>${q}</li>`).join("")}</ul>`
        });
        dailyStats.lastSentDay = today;
        dailyStats.questions = [];
      } catch (mE) {}
    }

    res.status(200).json({ reply: botReply });

  } catch (error) {
    res.status(500).json({ reply: "Duy ơi, hệ thống đang bảo trì tí nhé!" });
  }
};
