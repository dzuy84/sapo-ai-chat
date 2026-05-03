const { OpenAI } = require("openai");
const nodemailer = require("nodemailer");

// ===== 1. OpenAI =====
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ===== 2. Mail =====
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

let dailyStats = { questions: [], visitorIPs: new Set(), lastSentDay: null };

module.exports = async (req, res) => {
  // ===== CORS =====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { message, history = [], ip } = req.body;
  const today = new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

  try {
    if (message) {
      dailyStats.questions.push(message);
      if (ip) dailyStats.visitorIPs.add(ip);
    }

    // ===== 4. LẤY SẢN PHẨM SAPO =====
    const sapoAlias = process.env.SAPO_STORE_ALIAS;
    const sapoToken = process.env.SAPO_API_SECRET;

    let productContext = "";
    try {
      let sapoRes = await fetch(
        `https://${sapoAlias}.mysapo.net/admin/products.json?limit=3&title=${encodeURIComponent(message)}`,
        { headers: { "X-Sapo-Access-Token": sapoToken, "Content-Type": "application/json" } }
      );
      let sapoData = await sapoRes.json();

      if (!sapoData.products || sapoData.products.length === 0) {
        const fb = await fetch(`https://${sapoAlias}.mysapo.net/admin/products.json?limit=3`, {
          headers: { "X-Sapo-Access-Token": sapoToken, "Content-Type": "application/json" }
        });
        sapoData = await fb.json();
      }

      if (sapoData.products && sapoData.products.length > 0) {
        productContext = "DANH SÁCH SẢN PHẨM THỰC TẾ:\\n" + sapoData.products.map(p => {
          const price = p.variants?.[0]?.price ? Number(p.variants[0].price).toLocaleString("vi-VN") + "đ" : "Liên hệ";
          return `- ${p.title}\\n  Giá: ${price}\\n  Link: https://lyuongruouvang.com/products/${p.handle}`;
        }).join("\\n\\n");
      }
    } catch (err) { productContext = "Lỗi kết nối kho."; }

    // ===== 5. AI TRẢ LỜI =====
    const aiRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `Bạn là Hương Lan - chuyên gia tư vấn RONA. Dữ liệu: ${productContext}. BẮT BUỘC: Có link và giá thật.` },
        ...history,
        { role: "user", content: message },
      ],
    });

    const reply = aiRes.choices[0].message.content;

    // ===== 6. GỬI MAIL 22H =====
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    if (now.getHours() >= 22 && dailyStats.lastSentDay !== today && dailyStats.questions.length > 0) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: process.env.EMAIL_USER,
          subject: `[RONA] Báo cáo ngày ${today}`,
          html: `<h3>Báo cáo:</h3><p>Khách: ${dailyStats.visitorIPs.size}</p><ul>${dailyStats.questions.map(q => `<li>${q}</li>`).join("")}</ul>`
        });
        dailyStats.lastSentDay = today;
      } catch (e) {}
    }

    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ reply: "Duy ơi, kiểm tra lại API Key nhé!" });
  }
};
