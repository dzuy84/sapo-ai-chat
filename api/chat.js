const { OpenAI } = require("openai");

module.exports.config = { maxDuration: 30 };

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

// Bo dau tieng Viet de so sanh khong phan biet dau
function removeVietnameseTones(str) {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d").replace(/\u0110/g, "D")
    .toLowerCase();
}

function findRelevantProducts(message, products) {
  if (!Array.isArray(products)) return [];
  const stopwords = new Set([
    "mua","gia","bao","nhieu","cho","xem","cai","nay",
    "em","anh","chi","oi","nhe","co","khong","ban","toi",
  ]);
  const synonymMap = { "whiskey": "whisky", "wine": "vang" };

  const msgNorm = removeVietnameseTones(message);
  const tokens = msgNorm
    .split(/\s+/)
    .filter((t) => t.length > 1 && !stopwords.has(t))
    .map((t) => synonymMap[t] || t);

  if (tokens.length === 0) return [];

  const scored = products.map((p) => {
    let score = 0;
    const nameNorm = removeVietnameseTones(p?.name || "");
    tokens.forEach((t) => {
      if (nameNorm.includes(t)) score += 2;
    });
    return { ...p, score };
  });

  return scored
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

const ipHits = new Map();
function checkRateLimit(ip) {
  if (ipHits.size > 10000) ipHits.clear();
  const hits = (ipHits.get(ip) || 0) + 1;
  ipHits.set(ip, hits);
  setTimeout(() => ipHits.delete(ip), 60000);
  return hits > 30;
}

function buildSystemPrompt(context, relevantProducts) {
  return `
# VAI TRÒ
Bạn là chuyên gia tư vấn pha lê cao cấp của THIÊN AN, chuyên các dòng RONA và Bohemia. Phong cách chuyên nghiệp, tinh tế, tập trung chốt đơn hàng. Luôn trả lời bằng tiếng Việt có dấu đầy đủ, tự nhiên như người thật.

# BỐI CẢNH
Khách đang xem trang: "${typeof context === "string" ? context.slice(0, 100) : "Trang chủ"}".

# QUY TẮC QUAN TRỌNG
- LUÔN viết tiếng Việt có dấu đầy đủ trong toàn bộ câu trả lời.
- Các đoạn text hiển thị trong link (anchor text) cũng phải có dấu đầy đủ.
- Chỉ copy NGUYÊN XI phần HTML link từ danh sách bên dưới, KHÔNG tự ý thay đổi text bên trong thẻ <a>.
- Trả lời ngắn gọn, thân thiện, không dài dòng.

# LOGIC XỬ LÝ
## 1. Khách hỏi SẢN PHẨM CỤ THỂ
- Cung cấp link sản phẩm trực tiếp từ DỮ LIỆU SẢN PHẨM.
- Form link: <a href="URL" style="color:#8b0000;font-weight:bold;text-decoration:underline;">Tên sản phẩm</a>
- Nếu không có: Tạo link search: <a href="https://lyuongruouvang.com/search?query=KEYWORD" style="color:#8b0000;font-weight:bold;text-decoration:underline;">Xem kết quả cho "KEYWORD"</a>
- Thêm 1 link danh mục phù hợp.

## 2. Hỏi CHUNG
- Trả lời tự nhiên, có cảm xúc. Thêm 1 link danh mục phù hợp.

# DANH MỤC — COPY NGUYÊN XI TỪNG DÒNG HTML NÀY (chỉ chọn một):
- Ly vang đỏ: <br>🍷 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-uong-vang-do" style="color:#8b0000;font-weight:bold;">Danh mục Ly Vang Đỏ</a>
- Ly vang trắng: <br>🍷 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-vang-trang" style="color:#8b0000;font-weight:bold;">Danh mục Ly Vang Trắng</a>
- Ly Champagne/Flute: <br>🥂 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-champagne-flute" style="color:#8b0000;font-weight:bold;">Ly Champagne Flute</a>
- Bình chiết/Decanter: <br>🏺 Khám phá thêm: <a href="https://lyuongruouvang.com/binh-chiet-ruou" style="color:#8b0000;font-weight:bold;">Bình Chiết Rượu Decanter</a>
- Ly Whiskey: <br>🥃 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-whiskey" style="color:#8b0000;font-weight:bold;">Danh mục Ly Whiskey</a>
- Bình hoa/Bình bông: <br>💐 Khám phá thêm: <a href="https://lyuongruouvang.com/binh-bong" style="color:#8b0000;font-weight:bold;">Bình Hoa Pha Lê</a>
- Bộ quà tặng: <br>🎁 Khám phá thêm: <a href="https://lyuongruouvang.com/bo-qua-tang" style="color:#8b0000;font-weight:bold;">Gợi ý Bộ Quà Tặng</a>
- Mặc định: <br>🍷 Khám phá thêm: <a href="https://lyuongruouvang.com/" style="color:#8b0000;font-weight:bold;">Sản Phẩm Pha Lê RONA & Bohemia</a>

# CÂU KẾT BẮT BUỘC — COPY NGUYÊN XI:
- Tiếng Việt: <br><a href="https://zalo.me/0963111234" style="color:#0068ff;font-weight:bold;">👉 Cần tư vấn kỹ hơn, anh/chị nhắn Zalo cho Em nhé!</a>
- Tiếng Anh: <br><a href="https://zalo.me/0963111234" style="color:#0068ff;font-weight:bold;">👉 Need more help? Chat with us on Zalo!</a>

# DỮ LIỆU SẢN PHẨM PHÙ HỢP
${JSON.stringify(relevantProducts)}`;
}

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
      content: String(msg.content).trim().slice(0, 1000),
    }))
    .slice(-20);
}

module.exports.default = async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Rate limit
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  if (checkRateLimit(ip)) {
    return res.status(429).json({ error: "Too many requests" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const message = String(body?.message || "").trim().slice(0, 500);
  const context = String(body?.context || "").trim().slice(0, 300);
  const history = sanitizeHistory(body?.history);

  if (!message) {
    return res.status(400).json({ error: "Missing message" });
  }

  const products = await getProductsCached();
  const relevantProducts = findRelevantProducts(message, products);
  const systemPrompt = buildSystemPrompt(context, relevantProducts);

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: message },
  ];

  // ---- STREAMING RESPONSE ----
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const stream = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 800,
      temperature: 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        // SSE format: "data: ...\n\n"
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (e) {
    console.error("OpenAI stream error:", e.message);
    res.write(`data: ${JSON.stringify({ error: "AI error" })}\n\n`);
    res.end();
  }
};
