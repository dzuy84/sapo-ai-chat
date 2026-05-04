const { OpenAI } = require("openai");

// Vercel Pro: tăng timeout cho OpenAI call
module.exports.config = { maxDuration: 30 };

// ===== 1. OPENAI SINGLETON =====
let openai;
function getOpenAI() {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

// ===== 2. CACHE SẢN PHẨM (in-memory, reset khi cold start) =====
let cachedProducts = [];
let lastFetch = 0;

async function fetchProducts() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const auth = Buffer.from(
      `${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`
    ).toString("base64");

    const sapoRes = await fetch(
      `https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=250&fields=title,alias`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);
    if (!sapoRes.ok) throw new Error(`Sapo HTTP ${sapoRes.status}`);
    const data = await sapoRes.json();

    return (data.products || []).map((p) => ({
      name: p?.title || "",
      url: `https://lyuongruouvang.com/products/${p?.alias || ""}`,
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

// ===== 3. LỌC SẢN PHẨM =====
function findRelevantProducts(message, products) {
  if (!Array.isArray(products)) return [];

  const stopwords = new Set([
    "mua", "giá", "bao", "nhiêu", "cho", "xem", "cái", "này",
    "em", "anh", "chị", "ơi", "nhé",
  ]);

  const synonymMap = {
    whiskey: "whisky",
    bình: "bình",
    hoa: "hoa",
    đèn: "đèn",
  };

  const tokens = String(message || "")
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1 && !stopwords.has(t))
    .map((t) => synonymMap[t] || t);

  if (tokens.length === 0) return [];

  const scored = products.map((p) => {
    let score = 0;
    const name = String(p?.name || "").toLowerCase();
    tokens.forEach((t) => { if (name.includes(t)) score++; });
    return { ...p, score };
  });

  return scored
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

// ===== 4. RATE LIMIT (in-memory, best-effort trên serverless) =====
const ipHits = new Map();

function checkRateLimit(ip) {
  if (ipHits.size > 10000) ipHits.clear();

  const hits = (ipHits.get(ip) || 0) + 1;
  ipHits.set(ip, hits);
  setTimeout(() => ipHits.delete(ip), 60000);

  return hits > 15;
}

// ===== 5. XÂY DỰNG SYSTEM PROMPT =====
function buildSystemPrompt(context, relevantProducts) {
  return `
# VAI TRÒ
Bạn là chuyên gia tư vấn pha lê cao cấp của THIÊN ÂN, chuyên các dòng RONA và Bohemia. Phong cách chuyên nghiệp, tinh tế, tập trung chốt đơn hàng.

# BỐI CẢNH
Khách đang xem trang: "${typeof context === "string" ? context.slice(0, 100) : "Trang chủ"}".

# LOGIC XỬ LÝ
## 1. Khách hỏi SẢN PHẨM CỤ THỂ
- Cung cấp link sản phẩm trực tiếp từ DỮ LIỆU SẢN PHẨM. 
- Form link: <a href="URL" style="color:#8b0000;font-weight:bold;text-decoration:underline;">Tên sản phẩm</a>
- Nếu không có: Tạo link search: <a href="https://lyuongruouvang.com/search?query=KEYWORD" style="color:#8b0000;font-weight:bold;text-decoration:underline;">Xem kết quả cho "KEYWORD"</a>
- Thêm 1 link danh mục.

## 2. Hỏi CHUNG
- Trả lời tự nhiên, có cảm xúc. Thêm 1 link danh mục phù hợp.

# DANH MỤC (CHỈ CHỌN MỘT)
- Ly vang đỏ: <br>🍷 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-uong-vang-do" style="color:#8b0000;font-weight:bold;">Danh mục Ly Vang Đỏ</a>
- Ly vang trắng: <br>🍷 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-vang-trang" style="color:#8b0000;font-weight:bold;">Danh mục Ly Vang Trắng</a>
- Ly Champagne/Flute: <br>🥂 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-champagne-flute" style="color:#8b0000;font-weight:bold;">Ly Champagne Flute</a>
- Bình chiết/Decanter: <br>🏺 Khám phá thêm: <a href="https://lyuongruouvang.com/binh-chiet-ruou" style="color:#8b0000;font-weight:bold;">Bình Chiết Rượu Decanter</a>
- Ly Whiskey: <br>🥃 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-whiskey" style="color:#8b0000;font-weight:bold;">Danh mục Ly Whiskey</a>
- Bình hoa/Bình bông: <br>💐 Khám phá thêm: <a href="https://lyuongruouvang.com/binh-bong" style="color:#8b0000;font-weight:bold;">Bình Hoa Pha Lê</a>
- Bộ quà tặng: <br>🎁 Khám phá thêm: <a href="https://lyuongruouvang.com/bo-qua-tang" style="color:#8b0000;font-weight:bold;">Gợi ý Bộ Quà Tặng</a>
- Mặc định: <br>🍷 Khám phá thêm: <a href="https://lyuongruouvang.com/" style="color:#8b0000;font-weight:bold;">Sản Phẩm Pha Lê RONA & Bohemia</a>

# CÂU KẾT BẮT BUỘC
- Tiếng Việt: <br><a href="https://zalo.me/0963111234" style="color:#0068ff;font-weight:bold;">👉 Cần tư vấn kỹ hơn, anh/chị nhắn Zalo cho Em nhé!</a>
- Tiếng Anh: <br><a href="https://zalo.me/0963111234" style="color:#0068ff;font-weight:bold;">👉 Need more help? Chat with us on Zalo!</a>

# DỮ LIỆU SẢN PHẨM PHÙ HỢP
${JSON.stringify(relevantProducts)}`;
}

// ===== 6. VALIDATE & SANITIZE HISTORY =====
// Nhận history từ client, chỉ giữ các message hợp lệ, tối đa 10 lượt (20 messages)
function sanitizeHistory(rawHistory) {
  if (!Array.isArray(rawHistory)) return [];

  return rawHistory
    .filter(
      (msg) =>
        msg &&
        typeof msg === "object" &&
        (msg.role === "user" || msg.role === "assistant") &&
        typeof msg.content === "string" &&
        msg.content.trim().length > 0
    )
    .map((msg) => ({
      role: msg.role,
      content: String(msg.content).trim().slice(0, 1000), // giới hạn mỗi message
    }))
    .slice(-20); // chỉ giữ 10 lượt gần nhất (20 messages)
}

// ===== 7. GỌI OPENAI VỚI RETRY =====
async function callOpenAIWithRetry(aiClient, messages, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const completion = await aiClient.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.5,
        max_tokens: 600,
        messages,
      });

      const choice = completion.choices[0];

      // Nếu response không đầy đủ (finish_reason !== "stop"), retry
      if (choice.finish_reason !== "stop") {
        console.warn(`Attempt ${attempt}: finish_reason = ${choice.finish_reason}, retrying...`);
        lastError = new Error(`Incomplete response: ${choice.finish_reason}`);
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 300 * attempt)); // backoff
          continue;
        }
      }

      console.log("Token usage:", completion.usage);
      return choice.message.content;

    } catch (err) {
      lastError = err;
      console.error(`Attempt ${attempt} failed:`, err.message);

      // Không retry nếu lỗi client (4xx), chỉ retry lỗi server (5xx) hoặc timeout
      if (err.status && err.status >= 400 && err.status < 500) {
        throw err;
      }

      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }

  throw lastError;
}

// ===== 8. MAIN HANDLER =====
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "OPTIONS, POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ reply: "Method not allowed" });

  // Kiểm tra ENV đủ trước khi chạy
  const requiredEnv = ["OPENAI_API_KEY", "SAPO_API_KEY", "SAPO_API_SECRET", "SAPO_STORE_ALIAS"];
  for (const key of requiredEnv) {
    if (!process.env[key]) {
      console.error(`Missing ENV: ${key}`);
      return res.status(500).json({ reply: "Hệ thống đang bảo trì." });
    }
  }

  try {
    let { message, context, history } = req.body || {};

    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({ reply: "Tin nhắn không hợp lệ." });
    }

    message = message.trim().slice(0, 500);

    // Rate limit
    const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "Unknown";
    if (checkRateLimit(ip)) {
      return res.status(429).json({ reply: "Bạn thao tác nhanh quá. Thử lại sau 1 phút nhé!" });
    }

    console.log(`[CHAT] IP: ${ip} | Trang: ${context || "Trang chủ"} | Hỏi: ${message.slice(0, 100)}`);

    // Lấy sản phẩm & lọc theo tin nhắn hiện tại
    const allProducts = await getProductsCached();
    const relevantProducts = findRelevantProducts(message, allProducts);
    const aiClient = getOpenAI();

    // Xây dựng conversation history hợp lệ từ client
    const cleanHistory = sanitizeHistory(history);

    // Xây dựng messages gửi lên OpenAI:
    // [system] + [history] + [user message hiện tại]
    const messages = [
      {
        role: "system",
        content: buildSystemPrompt(context, relevantProducts),
      },
      ...cleanHistory,
      {
        role: "user",
        content: `Yêu cầu của khách hàng: """${message}"""`,
      },
    ];

    // Gọi OpenAI với retry tự động
    const reply = await callOpenAIWithRetry(aiClient, messages);

    return res.status(200).json({ reply });

  } catch (err) {
    console.error("Handler error:", err);

    return res.status(200).json({
      reply: "Dạ em đang bận chút xíu, anh/chị nhắn Zalo Em tư vấn ngay nhé! <br><a href='https://zalo.me/0963111234' style='color:#0068ff;font-weight:bold;'>👉 Chat Zalo Em</a>",
    });
  }
};a
