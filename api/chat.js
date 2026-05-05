const { OpenAI } = require("openai");

module.exports.config = { maxDuration: 30 };

// ===== 1. KHỞI TẠO BIẾN TOÀN CỤC =====
let openai;
function getOpenAI() {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

let cachedProducts = [];
let lastFetch = 0;

// ===== 2. QUẢN LÝ DỮ LIỆU SẢN PHẨM (SAPO) =====
async function fetchProducts() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const auth = Buffer.from(`${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`).toString("base64");
    
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
  if (Date.now() - lastFetch < 5 * 60 * 1000 && cachedProducts.length > 0) return cachedProducts;
  cachedProducts = await fetchProducts();
  lastFetch = Date.now();
  return cachedProducts;
}

// ===== 3. LOGIC TÌM KIẾM SẢN PHẨM PHÙ HỢP =====
function findRelevantProducts(message, products) {
  if (!Array.isArray(products)) return [];
  const stopwords = new Set(["mua","gia","bao","nhieu","cho","xem","cai","nay","em","anh","chi","oi","nhe"]);
  const synonymMap = { whiskey: "whisky" };
  const tokens = String(message || "").toLowerCase().split(/\s+/).filter((t) => t.length > 1 && !stopwords.has(t)).map((t) => synonymMap[t] || t);
  if (tokens.length === 0) return [];

  return products.map((p) => {
    let score = 0;
    const name = String(p?.name || "").toLowerCase();
    tokens.forEach((t) => { if (name.includes(t)) score++; });
    return { ...p, score };
  }).filter((p) => p.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
}

// ===== 4. CẤU TRÚC PROMPT & LỊCH SỬ =====
function buildSystemPrompt(context, relevantProducts) {
  return `
# VAI TRO: Chuyen gia tu van pha le THIEN AN (RONA & Bohemia).
# CONTEXT: Khach dang o: "${context || "Trang chu"}".
# LOGIC: 
1. Link san pham: <a href="URL" style="color:#8b0000;font-weight:bold;">Ten san pham</a>.
2. Neu khong co sp dung y: <a href="https://lyuongruouvang.com/search?query=KEYWORD">Xem ket qua "KEYWORD"</a>.
# SAN PHAM GOI Y: ${JSON.stringify(relevantProducts)}
# KET: <br><a href="https://zalo.me/0963111234" style="color:#0068ff;font-weight:bold;">👉 Chat Zalo Duy chot don ngay!</a>`;
}

function sanitizeHistory(rawHistory) {
  if (!Array.isArray(rawHistory)) return [];
  return rawHistory.filter(msg => msg && (msg.role === "user" || msg.role === "assistant")).slice(-10);
}

// ===== 5. HÀM GỌI AI CÓ RETRY (Hoàn thiện đoạn của anh) =====
async function callOpenAIWithRetry(aiClient, messages, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await aiClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7,
      });
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await new Promise(res => setTimeout(res, 1000 * (i + 1))); // Đợi xíu rồi thử lại
    }
  }
}

// ===== 6. MAIN HANDLER (MODULE EXPORTS) =====
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { message, context, history } = req.body || {};
    if (!message) return res.status(400).json({ reply: "Thieu tin nhan." });

    const [allProducts, aiClient] = await Promise.all([getProductsCached(), getOpenAI()]);
    const relevant = findRelevantProducts(message, allProducts);
    
    const finalMessages = [
      { role: "system", content: buildSystemPrompt(context, relevant) },
      ...sanitizeHistory(history),
      { role: "user", content: message }
    ];

    const completion = await callOpenAIWithRetry(aiClient, finalMessages);
    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    console.error("Loi:", err);
    return res.status(200).json({ 
      reply: "Dạ em đang bận chút, anh nhắn Zalo em tư vấn ngay nhé! <br><a href='https://zalo.me/0963111234'>👉 Chat Zalo</a>" 
    });
  }
};
