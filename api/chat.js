const { OpenAI } = require("openai");

// ===== 1. OPENAI SINGLETON & CACHE =====
let openai;
function getOpenAI() {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

let cachedProducts = [];
let lastFetch = 0;

async function fetchProducts() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const auth = Buffer.from(`${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`).toString("base64");

    const sapoRes = await fetch(
      `https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=250&fields=title,alias`,
      {
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);
    if (!sapoRes.ok) throw new Error(`Sapo HTTP ${sapoRes.status}`);
    const data = await sapoRes.json();

    return (data.products || []).map((p) => ({
      name: p.title,
      url: `https://lyuongruouvang.com/products/${p.alias}`,
    }));
  } catch (e) {
    console.error("Sapo fetch error:", e.message);
    return [];
  }
}

async function getProductsCached() {
  if (Date.now() - lastFetch < 5 * 60 * 1000 && cachedProducts.length > 0) {
    return cachedProducts;
  }
  cachedProducts = await fetchProducts();
  lastFetch = Date.now();
  return cachedProducts;
}

// ===== 2. LỌC SẢN PHẨM TRÁNH TỐN TOKEN =====
function findRelevantProducts(message, products) {
  const stopwords = new Set(["mua", "giá", "bao", "nhiêu", "cho", "xem", "cái", "này"]);
  const tokens = message.toLowerCase().split(/\s+/).filter(t => t.length > 1 && !stopwords.has(t));
  
  if (tokens.length === 0) return [];

  const scored = products.map((p) => {
    let score = 0;
    const name = p.name.toLowerCase();
    tokens.forEach((t) => { if (name.includes(t)) score++; });
    return { ...p, score };
  });

  return scored.filter(p => p.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
}

// ===== 3. MAIN HANDLER =====
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "OPTIONS, POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ reply: "Method not allowed" });

  try {
    const { message, context } = req.body || {};
    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({ reply: "Tin nhắn không hợp lệ." });
    }

    const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "Unknown";
    console.log(`[CHAT] IP: ${ip} | Trang: ${context || "Trang chủ"} | Hỏi: ${message.slice(0, 100)}`);

    // Lấy data đã cache và lọc sản phẩm
    const allProducts = await getProductsCached();
    const relevantProducts = findRelevantProducts(message, allProducts);
    const aiClient = getOpenAI();

    const completion = await aiClient.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content: `
# VAI TRÒ
Bạn là chuyên gia tư vấn pha lê cao cấp của THIÊN ÂN, chuyên các dòng RONA và Bohemia. Phong cách chuyên nghiệp, tinh tế, chốt đơn.

# NGÔN NGỮ
- Tự nhận diện và trả lời bằng ngôn ngữ khách dùng.
- Tiếng Việt: xưng "Em", gọi "anh/chị". Tiếng Anh: xưng "I", gọi "you".

# BỐI CẢNH
Khách đang xem trang: "${context || "Trang chủ"}". Dùng thông tin này nếu khách hỏi "cái này", "ly này".

# LOGIC XỬ LÝ
## 1. Hỏi SẢN PHẨM CỤ THỂ
- Cung cấp link sản phẩm trực tiếp (ưu tiên từ DỮ LIỆU SẢN PHẨM). 
- Form link: <a href="URL" style="color:#8b0000;font-weight:bold;text-decoration:underline;">Tên sản phẩm</a>
- Nếu không có: Tạo link search: <a href="https://lyuongruouvang.com/search?query=KEYWORD" style="color:#8b0000;font-weight:bold;text-decoration:underline;">Xem kết quả cho "KEYWORD" tại đây</a>
- Kèm thêm 1 link danh mục bên dưới.

## 2. Hỏi CHUNG
- Trả lời tự nhiên, thêm 1 link danh mục phù hợp nhất.

# DANH MỤC (CHỈ CHỌN MỘT)
- Ly vang đỏ: <br>🍷 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-uong-vang-do" style="color:#8b0000;font-weight:bold;">Danh mục Ly Vang Đỏ</a>
- Bộ quà tặng: <br>🎁 Khám phá thêm: <a href="https://lyuongruouvang.com/bo-qua-tang" style="color:#8b0000;font-weight:bold;">Gợi ý Bộ Quà Tặng</a>
- Bình hoa: <br>💐 Khám phá thêm: <a href="https://lyuongruouvang.com/binh-bong" style="color:#8b0000;font-weight:bold;">Bình Hoa Pha Lê</a>
- Decanter: <br>🏺 Khám phá thêm: <a href="https://lyuongruouvang.com/binh-chiet-ruou" style="color:#8b0000;font-weight:bold;">Bình Chiết Rượu Decanter</a>
- Mặc định: <br>🍷 Khám phá thêm: <a href="https://lyuongruouvang.com/" style="color:#8b0000;font-weight:bold;">Sản Phẩm Pha Lê Cao Cấp</a>

# CÂU KẾT BẮT BUỘC
- Tiếng Việt: <br><a href="https://zalo.me/0963111234" style="color:#0068ff;font-weight:bold;">👉 Cần tư vấn kỹ hơn, anh/chị nhắn Zalo cho Em nhé!</a>
- Tiếng Anh: <br><a href="https://zalo.me/0963111234" style="color:#0068ff;font-weight:bold;">👉 Need more help? Chat with us on Zalo!</a>

# DỮ LIỆU SẢN PHẨM PHÙ HỢP
${JSON.stringify(relevantProducts)}`,
        },
        { role: "user", content: message.trim() },
      ],
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error("Handler error:", err.message);
    return res.status(200).json({
      reply: "Dạ em đang bận chút xíu, anh/chị nhắn Zalo Em tư vấn ngay nhé! <br><a href='https://zalo.me/0963111234' style='color:#0068ff;font-weight:bold;'>👉 Chat Zalo Em</a>",
    });
  }
};
