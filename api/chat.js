const { OpenAI } = require("openai");

let stats = { totalVisits: 0, uniqueIPs: new Set(), recentQuestions: [] };

// 🔥 Cache sản phẩm
let cachedProducts = [];
let lastFetch = 0;

async function getProducts() {
  // Cache 5 phút
  if (Date.now() - lastFetch < 5 * 60 * 1000 && cachedProducts.length > 0) {
    return cachedProducts;
  }

  try {
    const auth = Buffer.from(
      `${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`
    ).toString("base64");

    const res = await fetch(
      `https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=250&fields=title,alias,variants,body_html`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json"
        }
      }
    );

    const data = await res.json();

    // 🔥 LỌC DATA SẠCH (fix lỗi undefined)
    cachedProducts = (data.products || [])
      .filter(p => p && p.title && p.alias)
      .map(p => ({
        name: String(p.title),
        price: p.variants?.[0]?.price || "Liên hệ",
        description: (p.body_html || "").replace(/<[^>]+>/g, ""),
        url: `https://lyuongruouvang.com/products/${p.alias}`
      }));

    lastFetch = Date.now();
    return cachedProducts;

  } catch (e) {
    console.error("Sapo Error:", e);
    return cachedProducts;
  }
}

// 🔥 MATCH SẢN PHẨM (đã fix crash + thông minh hơn)
function findRelevantProducts(message, products) {
  if (!message || typeof message !== "string") return [];

  const msg = message.toLowerCase();

  return products
    .filter(p => {
      if (!p || !p.name) return false;

      const name = p.name.toLowerCase();

      return (
        msg.includes(name) ||
        name.includes(msg) ||
        msg.split(" ").some(word => name.includes(word))
      );
    })
    .sort((a, b) => b.name.length - a.name.length) // ưu tiên chính xác
    .slice(0, 3);
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "OPTIONS, POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { message, context } = req.body || {};

    // 🔥 CHẶN MESSAGE RỖNG
    if (!message || typeof message !== "string") {
      return res.status(200).json({
        reply: "Anh/chị nhập giúp em câu hỏi nhé 😊"
      });
    }

    const ip =
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      "Unknown";

    const now = new Date(
      new Date().toLocaleString("en-US", {
        timeZone: "Asia/Ho_Chi_Minh"
      })
    );

    // 📊 thống kê
    if (message !== "Duy_Check_68") {
      stats.totalVisits++;
      if (ip !== "Unknown") stats.uniqueIPs.add(ip);

      stats.recentQuestions.push({
        q: message,
        time: now.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit"
        })
      });

      if (stats.recentQuestions.length > 50) stats.recentQuestions.shift();
    }

    // 🔐 ADMIN CHECK
    if (message === "Duy_Check_68") {
      return res.status(200).json({
        reply: `📊 ADMIN:\nKhách: ${stats.uniqueIPs.size}\nTương tác: ${stats.totalVisits}`
      });
    }

    // 🔥 Lấy sản phẩm
    const products = await getProducts();

    // 🔥 Tìm sản phẩm liên quan
    const relevant = findRelevantProducts(message, products);

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content: `
Bạn là chuyên gia bán ly rượu vang RONA.

MỤC TIÊU:
- Trả lời như người thật
- Dẫn dắt khách mua hàng

PHONG CÁCH:
- Chat tự nhiên như Zalo
- Ngắn gọn, dễ hiểu
- Có cảm xúc nhẹ 🍷✨
- Không máy móc

CHIẾN LƯỢC BÁN:
- Hỏi giá → giải thích giá trị
- Phân vân → chọn 1 sản phẩm tốt nhất
- Không có → gợi ý gần nhất
- Chưa rõ → hỏi lại 1 câu

NGỮ CẢNH:
Khách đang ở: "${context || "Trang chủ"}"

SẢN PHẨM LIÊN QUAN:
${JSON.stringify(relevant)}

MỘT SỐ SẢN PHẨM:
${JSON.stringify(products.slice(0, 50))}

LUÔN KẾT THÚC:
👉 https://zalo.me/0963111234
`
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    return res.status(200).json({
      reply: completion.choices[0].message.content
    });

  } catch (err) {
    console.error("ERROR:", err);

    return res.status(200).json({
      reply:
        "Dạ em đang bận chút xíu 😥 Anh/chị nhắn Zalo giúp em nhé 👉 https://zalo.me/0963111234"
    });
  }
};
