import OpenAI from "openai";
import nodemailer from "nodemailer";

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

// ===== 3. Stats =====
let dailyStats = {
  questions: [],
  visitorIPs: new Set(),
  lastSentDay: null,
};

export default async function handler(req, res) {
  // ===== CORS =====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { message, history = [], ip } = req.body;

  const today = new Date().toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
  });

  try {
    // ===== Lưu thống kê =====
    if (message) {
      dailyStats.questions.push(message);
      if (ip) dailyStats.visitorIPs.add(ip);
    }

    // ===== 4. LẤY SẢN PHẨM SAPO =====
    const sapoAlias = process.env.SAPO_STORE_ALIAS;
    const sapoToken = process.env.SAPO_API_SECRET;

    let productContext = "";

    try {
      // 👉 Lấy theo từ khóa
      let sapoRes = await fetch(
        `https://${sapoAlias}.mysapo.net/admin/products.json?limit=3&title=${encodeURIComponent(
          message
        )}`,
        {
          headers: {
            "X-Sapo-Access-Token": sapoToken,
            "Content-Type": "application/json",
          },
        }
      );

      let sapoData = await sapoRes.json();

      console.log("SAPO SEARCH:", sapoData);

      // 👉 Nếu không có → fallback lấy đại 3 sản phẩm
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
        console.log("SAPO FALLBACK:", sapoData);
      }

      // 👉 Format dữ liệu cho AI
      if (sapoData.products && sapoData.products.length > 0) {
        productContext =
          "DANH SÁCH SẢN PHẨM THỰC TẾ (PHẢI DÙNG):\n" +
          sapoData.products
            .map((p) => {
              const price = p.variants?.[0]?.price
                ? Number(p.variants[0].price).toLocaleString("vi-VN") + "đ"
                : "Liên hệ";

              return `- ${p.title}
Giá: ${price}
Link: https://lyuongruouvang.com/products/${p.handle}`;
            })
            .join("\n\n");
      } else {
        productContext =
          "Không có sản phẩm phù hợp. Gợi ý khách xem: https://lyuongruouvang.com/collections/all";
      }
    } catch (err) {
      console.error("SAPO ERROR:", err);
      productContext = "Lỗi kết nối kho Sapo.";
    }

    // ===== 5. AI TRẢ LỜI =====
    const aiRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Bạn là Hương Lan - chuyên gia rượu vang & ly pha lê RONA.

NHIỆM VỤ:
- Tư vấn chuyên sâu, nói chuyện tự nhiên như người bán hàng thật
- Ưu tiên chốt đơn

DỮ LIỆU SẢN PHẨM:
${productContext}

QUY TẮC BẮT BUỘC:
- PHẢI liệt kê sản phẩm từ dữ liệu trên
- PHẢI có giá
- PHẢI có link
- KHÔNG được bịa sản phẩm
- Không được nói "tôi không biết"
- Luôn gợi ý mua hàng
`,
        },
        ...history,
        { role: "user", content: message },
      ],
    });

    const reply = aiRes.choices[0].message.content;

    // ===== 6. GỬI MAIL 22H =====
    const now = new Date(
      new Date().toLocaleString("en-US", {
        timeZone: "Asia/Ho_Chi_Minh",
      })
    );

    if (
      now.getHours() >= 22 &&
      dailyStats.lastSentDay !== today &&
      dailyStats.questions.length > 0
    ) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: process.env.EMAIL_USER,
          subject: `[RONA] Báo cáo ngày ${today}`,
          html: `
<h3>Báo cáo chatbot</h3>
<p>👤 Khách: ${dailyStats.visitorIPs.size}</p>
<p>💬 Câu hỏi:</p>
<ul>${dailyStats.questions
              .map((q) => `<li>${q}</li>`)
              .join("")}</ul>
`,
        });

        dailyStats.lastSentDay = today;
        dailyStats.questions = [];
        dailyStats.visitorIPs.clear();
      } catch (e) {
        console.error("MAIL ERROR:", e);
      }
    }

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("SYSTEM ERROR:", err);
    return res.status(500).json({
      reply: "Hệ thống đang bận, thử lại giúp mình nhé!",
    });
  }
}
