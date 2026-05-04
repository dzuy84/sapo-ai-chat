const { OpenAI } = require("openai");

let stats = { totalVisits: 0, uniqueIPs: new Set(), recentQuestions: [] };

// 🔥 Cache sản phẩm
let cachedProducts = [];
let lastFetch = 0;

async function getProducts() {
  if (Date.now() - lastFetch < 5 * 60 * 1000 && cachedProducts.length > 0) {
    return cachedProducts;
  }

  try {
    const auth = Buffer.from(`${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`).toString("base64");

    const res = await fetch(
      `https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=250&fields=title,alias,variants,body_html`,
      {
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/json"
        }
      }
    );

    const data = await res.json();

    cachedProducts = (data.products || []).map(p => ({
      name: p.title,
      price: p.variants?.[0]?.price || "Liên hệ",
      description: (p.body_html || "").replace(/<[^>]+>/g, ""), // bỏ HTML
      url: `https://lyuongruouvang.com/products/${p.alias}`
    }));

    lastFetch = Date.now();
    return cachedProducts;

  } catch (e) {
    console.error("Sapo Error:", e);
    return cachedProducts;
  }
}

// 🔥 Tìm sản phẩm gần đúng
function findRelevantProducts(message, products) {
  const msg = message.toLowerCase();

  return products
    .filter(p => msg.includes(p.name.toLowerCase().split(" ")[0]))
    .slice(0, 3);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { message, context } = req.body || {};
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || "Unknown";

    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));

    // 📊 thống kê
    if (message && message !== "Duy_Check_68") {
      stats.totalVisits++;
      if (ip !== "Unknown") stats.uniqueIPs.add(ip);

      stats.recentQuestions.push({
        q: message,
        time: now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      });

      if (stats.recentQuestions.length > 50) stats.recentQuestions.shift();
    }

    if (message === "Duy_Check_68") {
      return res.status(200).json({
        reply: `📊 ADMIN:\nKhách: ${stats.uniqueIPs.size}\nTương tác: ${stats.totalVisits}`
      });
    }

    // 🔥 lấy sản phẩm
    const products = await getProducts();

    // 🔥 tìm sản phẩm liên quan
    const relevant = findRelevantProducts(message, products);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
- Tự nhiên như chat Zalo
- Ngắn gọn, dễ hiểu
- Có cảm xúc nhẹ (🍷✨)
- Không trả lời máy móc

CHIẾN LƯỢC:
- Nếu khách hỏi giá → giải thích giá trị
- Nếu phân vân → chọn 1 sản phẩm tốt nhất
- Nếu chưa rõ → hỏi lại 1 câu
- Nếu không có → gợi ý gần nhất

NGỮ CẢNH:
Khách đang ở: "${context || 'Trang chủ'}"

SẢN PHẨM GỢI Ý:
${JSON.stringify(relevant)}

TOÀN BỘ SẢN PHẨM:
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
    console.error(err);
    return res.status(200).json({
      reply: "Dạ em đang bận chút xíu 😥 Anh/chị nhắn Zalo giúp em nhé 👉 https://zalo.me/0963111234"
    });
  }
};
