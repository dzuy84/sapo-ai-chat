const { OpenAI } = require("openai");

module.exports.config = { maxDuration: 30 };

// ===== OPENAI =====
let openai;
function getOpenAI() {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

// ===== CACHE =====
let cachedProducts = [];
let lastFetch = 0;

// ===== BỎ DẤU TIẾNG VIỆT =====
function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ===== FETCH SAPO (CÓ PAGINATION) =====
async function fetchProducts() {
  try {
    let all = [];

    for (let page = 1; page <= 3; page++) { // tối đa 750 sản phẩm
      const res = await fetch(
        `https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=250&page=${page}&fields=title,handle`,
        {
          headers: {
            "X-Sapo-Access-Token": process.env.SAPO_API_SECRET,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) throw new Error(`Sapo ${res.status}`);

      const data = await res.json();
      if (!data.products || data.products.length === 0) break;

      all = all.concat(data.products);
    }

    console.log("TOTAL PRODUCTS:", all.length);

    return all.map((p) => ({
      name: p.title,
      nameNorm: normalize(p.title),
      url: `https://lyuongruouvang.com/products/${p.handle}`,
    }));
  } catch (e) {
    console.error("SAPO ERROR:", e.message);
    return [];
  }
}

// ===== CACHE 5 PHÚT =====
async function getProductsCached() {
  if (Date.now() - lastFetch < 5 * 60 * 1000 && cachedProducts.length > 0) {
    return cachedProducts;
  }
  cachedProducts = await fetchProducts();
  lastFetch = Date.now();
  return cachedProducts;
}

// ===== SEARCH THÔNG MINH =====
function findRelevantProducts(message, products) {
  if (!Array.isArray(products)) return [];

  const msg = normalize(message);

  const stopwords = new Set([
    "mua","gia","bao","nhieu","cho","xem","cai","nay",
    "em","anh","chi","oi","nhe",
  ]);

  const tokens = msg
    .split(/\s+/)
    .filter((t) => t.length > 1 && !stopwords.has(t));

  if (tokens.length === 0) return [];

  const scored = products.map((p) => {
    let score = 0;

    tokens.forEach((t) => {
      if (p.nameNorm.includes(t)) score += 2;
    });

    if (p.nameNorm.includes(msg)) score += 5;

    return { ...p, score };
  });

  return scored
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8); // tăng lên 8 sản phẩm
}

// ===== RATE LIMIT =====
const ipHits = new Map();
function checkRateLimit(ip) {
  if (ipHits.size > 10000) ipHits.clear();

  const hits = (ipHits.get(ip) || 0) + 1;
  ipHits.set(ip, hits);

  setTimeout(() => ipHits.delete(ip), 60000);

  return hits > 20;
}

// ===== PROMPT =====
function buildSystemPrompt(context, relevantProducts) {
  return `
Bạn là chuyên gia tư vấn ly rượu vang cao cấp RONA & Bohemia.

Phong cách:
- Nói tự nhiên, chuyên nghiệp
- Ngắn gọn 3-4 câu
- Tập trung chốt đơn

QUY TẮC:
- Nếu có sản phẩm → PHẢI chèn link dạng:
<a href="URL" style="color:#8b0000;font-weight:bold;text-decoration:underline;">Tên sản phẩm</a>

- Nếu không có → dùng link tìm kiếm:
<a href="https://lyuongruouvang.com/search?query=${context || ""}" style="color:#8b0000;font-weight:bold;">Xem sản phẩm</a>

DỮ LIỆU SẢN PHẨM:
${JSON.stringify(relevantProducts)}

LUÔN thêm 1 link danh mục:
🍷 <a href="https://lyuongruouvang.com/" style="color:#8b0000;font-weight:bold;">Xem thêm sản phẩm</a>

KẾT THÚC:
<br><a href="https://zalo.me/0963111234" style="color:#0068ff;font-weight:bold;">👉 Chat Zalo để được tư vấn</a>
`;
}

// ===== CLEAN HISTORY =====
function sanitizeHistory(rawHistory) {
  if (!Array.isArray(rawHistory)) return [];

  return rawHistory
    .filter(
      (msg) =>
        msg &&
        (msg.role === "user" || msg.role === "assistant") &&
        typeof msg.content === "string"
    )
    .map((msg) => ({
      role: msg.role,
      content: msg.content.slice(0, 500),
    }))
    .slice(-8);
}

// ===== MAIN =====
module.exports = async function (req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "OPTIONS, POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ reply: "Method not allowed" });

  try {
    const { message, history = [], context } = req.body;

    if (!message) {
      return res.status(400).json({ reply: "Tin nhắn lỗi." });
    }

    const ip =
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      "unknown";

    if (checkRateLimit(ip)) {
      return res.status(429).json({
        reply: "Bạn thao tác nhanh quá, thử lại sau nhé!",
      });
    }

    console.log("USER:", message);

    const products = await getProductsCached();
    const relevantProducts = findRelevantProducts(message, products);

    console.log("MATCH:", relevantProducts.length);

    const ai = getOpenAI();

    const messages = [
      { role: "system", content: buildSystemPrompt(context, relevantProducts) },
      ...sanitizeHistory(history),
      { role: "user", content: message },
    ];

    // ===== STREAM =====
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      temperature: 0.5,
      max_tokens: 300,
      messages,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) {
        res.write(`data: ${JSON.stringify({ delta: text })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();

  } catch (err) {
    console.error("ERROR:", err);

    if (!res.headersSent) {
      return res.status(200).json({
        reply:
          '👉 Hệ thống bận, nhắn Zalo giúp mình nhé! <br><a href="https://zalo.me/0963111234" style="color:#0068ff;font-weight:bold;">Chat Zalo</a>',
      });
    }

    try {
      res.write("data: [ERROR]\n\n");
      res.end();
    } catch {}
  }
};
