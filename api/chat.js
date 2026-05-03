import OpenAI from "openai";
import nodemailer from "nodemailer";

// ===== 1. Khởi tạo OpenAI =====
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ===== 2. Cấu hình gửi Mail báo cáo =====
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Sử dụng App Password (16 ký tự)
  },
});

// ===== 3. Biến lưu thống kê (Vercel giữ trong bộ nhớ tạm) =====
let dailyStats = {
  questions: [],
  visitorIPs: new Set(),
  lastSentDay: null,
};

export default async function handler(req, res) {
  // ===== Cấu hình CORS để chat chạy được trên website =====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { message, history = [], ip } = req.body;
  const today = new Date().toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
  });

  try {
    // ===== Lưu thống kê câu hỏi =====
    if (message) {
      dailyStats.questions.push(message);
      if (ip) dailyStats.visitorIPs.add(ip);
    }

    // ===== 4. KẾT NỐI KHO HÀNG SAPO =====
    const sapoAlias = process.env.SAPO_STORE_ALIAS; // Chỉ điền: ly-uong-ruou-vang
    const sapoToken = process.env.SAPO_API_SECRET; // Mã Admin API Access Token

    let productContext = "";

    try {
      // Tìm sản phẩm theo từ khóa khách hỏi
      let sapoRes = await fetch(
        `https://${sapoAlias}.mysapo.net/admin/products.json?limit=3&title=${encodeURIComponent(message)}`,
        {
          headers: {
            "X-Sapo-Access-Token": sapoToken,
            "Content-Type": "application/json",
          },
        }
      );

      let sapoData = await sapoRes.json();

      // Nếu không tìm thấy sản phẩm cụ thể -> Lấy đại 3 sản phẩm mới nhất làm gợi ý
      if (!sapoData.products || sapoData.products.length === 0) {
        const fallbackRes = await fetch(
          `https://${sapoAlias}.mysapo.net/admin/products.json?limit=3`,
          {
            headers: {
              "X-Sapo-Access-Token": sapoToken,
              "Content-Type": "application/json",
            },
          }
        );
        sapoData = await fallbackRes.json();
      }

      // Format dữ liệu sản phẩm để AI đọc
      if (sapoData.products && sapoData.products.length > 0) {
        productContext = "DANH SÁCH SẢN PHẨM THỰC TẾ TỪ KHO (PHẢI DÙNG LINK NÀY):\n" +
          sapoData.products.map((p) => {
            const price = p.variants?.[0]?.price
              ? Number(p.variants[0].price).toLocaleString("vi-VN") + "đ"
              : "Liên hệ";
            return `- ${p.title}\n  Giá: ${price}\n  Link: https://lyuongruouvang.com/products/${p.handle}`;
          }).join("\n\n");
      } else {
        productContext = "Không tìm thấy sản phẩm. Gợi ý khách xem tại: https://lyuongruouvang.com/collections/all";
      }
    } catch (err) {
      console.error("Lỗi Sapo:", err);
      productContext = "Hiện tại không kết nối được kho hàng, mời khách xem tại: https://lyuongruouvang.com";
    }

    // ===== 5. AI HƯƠNG LAN TRẢ LỜI =====
    const aiRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Bạn là Hương Lan - chuyên gia tư vấn của RONA (lyuongruouvang.com).
NHIỆM VỤ: Tư vấn đẳng cấp, am hiểu về pha lê Bohemia (Tiệp Khắc) và Rona (Slovakia).
QUY TẮC: 
- Bạn PHẢI liệt kê sản phẩm, giá và link từ dữ liệu này: ${productContext}.
- TUYỆT ĐỐI không tự bịa link hoặc giá.
- Luôn mời khách mua hàng và để lại thông tin nếu cần tư vấn thêm.`,
        },
        ...history,
        { role: "user", content: message },
      ],
    });

    const reply = aiRes.choices[0].message.content;

    // ===== 6. GỬI BÁO CÁO QUA EMAIL LÚC 22H =====
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    if (now.getHours() >= 22 && dailyStats.lastSentDay !== today && dailyStats.questions.length > 0) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: process.env.EMAIL_USER,
          subject: `[RONA] Báo cáo tình hình Chatbot ngày ${today}`,
          html: `<h3>Báo cáo hoạt động</h3>
                 <p><b>Số khách:</b> ${dailyStats.visitorIPs.size}</p>
                 <p><b>Câu hỏi trong ngày:</b></p>
                 <ul>${dailyStats.questions.map(q => `<li>${q}</li>`).join("")}</ul>`,
        });
        dailyStats.lastSentDay = today;
        dailyStats.questions = [];
        dailyStats.visitorIPs.clear();
      } catch (e) {
        console.error("Lỗi gửi mail:", e);
      }
    }

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Lỗi hệ thống:", err);
    return res.status(500).json({ reply: "Hương Lan đang kiểm tra lại kho, Duy đợi em tí nhé!" });
