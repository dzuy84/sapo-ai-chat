const { OpenAI } = require("openai");

// ===== OPENAI SINGLETON =====
let openai;
function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

// ===== CACHE =====
let cachedProducts = [];
let lastFetch = 0;

async function fetchProducts() {
  try {
    if (!process.env.SAPO_STORE_ALIAS) throw new Error("Thiếu SAPO_STORE_ALIAS trong env");

    const auth = Buffer.from(
      `${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`
    ).toString("base64");

    const res = await fetch(
      `https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=250&fields=title,alias`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) throw new Error(`Sapo ${res.status}`);
    const data = await res.json();

    return (data.products || []).map((p) => ({
      name: p.title,
      url: `https://lyuongruouvang.com/products/${p.alias}`,
    }));
  } catch (e) {
    console.error("Sapo error:", e.message);
    return [];
  }
}

async function getProductsCached() {
  if (Date.now() - lastFetch < 5 * 60 * 1000 && cachedProducts.length) {
    return cachedProducts;
  }
  cachedProducts = await fetchProducts();
  lastFetch = Date.now();
  return cachedProducts;
}

// ===== INTENT =====
function detectIntent(message) {
  const m = message.toLowerCase();

  return {
    buying: /mua|giá|bao nhiêu|ship|còn hàng|order/i.test(m),
    gift: /tặng|biếu|quà/i.test(m),
    decor: /trang trí|bình hoa|đèn/i.test(m),
    drink: /vang|rượu|whiskey|champagne/i.test(m),
  };
}

// ===== PRODUCT MATCH (STOPWORDS + SYNONYMS + SCORING) =====
function findRelevantProducts(message, products) {
  const stopwords = new Set([
    "mua", "giá", "bao", "nhiêu", "cho", "tôi", "em", "anh", "chị",
    "cần", "muốn", "hỏi", "ơi", "nhé", "nha", "được", "không", "có", "xem"
  ]);

  const synonymMap = {
    whiskey: "whisky",
    "vang đỏ": "vang",
    "vang trắng": "vang",
    bình: "bình",
    hoa: "hoa",
    đèn: "đèn",
  };

  const tokens = message
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1 && !stopwords.has(t))
    .map((t) => synonymMap[t] || t);

  if (tokens.length === 0) return [];

  const scored = products.map((p) => {
    const name = p.name.toLowerCase();
    let score = 0;

    tokens.forEach((t) => {
      if (name.includes(t)) score++;
    });

    return { ...p, score };
  });

  return scored
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

// ===== SANITIZE CONTEXT =====
function sanitizeContext(context) {
  if (!Array.isArray(context)) return [];

  return context.slice(-6).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content).slice(0, 300),
  }));
}

// ===== MAIN =====
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Method not allowed" });
  }

  try {
    let { message, context } = req.body || {};

    if (typeof message !== "string") message = "";
    message = message.trim();

    if (!message) {
      return res.status(400).json({ reply: "Tin nhắn không hợp lệ." });
    }

    const products = await getProductsCached();
    const relevantProducts = findRelevantProducts(message, products);
    const intent = detectIntent(message);
    const safeContext = sanitizeContext(context);

    // ===== MODE =====
    let mode = "normal";
    if (intent.gift) mode = "gift";
    else if (intent.decor) mode = "decor";
    else if (intent.drink) mode = "drink";

    const systemPrompt = `
Bạn là nhân viên tư vấn pha lê cao cấp của THIÊN ÂN (ly, bình, quà tặng, trang trí).

MỤC TIÊU:
- Hiểu đúng nhu cầu khách
- Tư vấn đúng sản phẩm
- Dẫn khách đến mua hàng hoặc Zalo

PHONG CÁCH:
- Tự nhiên, lịch sự
- Ngắn gọn, thuyết phục
- Không lan man

MODE: ${mode}

LUẬT:
- gift → gợi ý bộ quà tặng cao cấp
- decor → bình hoa, đèn
- drink → ly, decanter
- buying → trả lời rõ + gợi ý sản phẩm

SẢN PHẨM:
${JSON.stringify(relevantProducts)}

NẾU KHÔNG CÓ SẢN PHẨM:
→ gợi ý link danh mục phù hợp

LINK DANH MỤC:
- Trang chủ: https://lyuongruouvang.com/
- Quà tặng: https://lyuongruouvang.com/bo-qua-tang
- Bình hoa: https://lyuongruouvang.com/binh-bong
- Ly vang đỏ: https://lyuongruouvang.com/ly-uong-vang-do

QUY TẮC LINK:
- Dùng thẻ HTML <a href="LINK">Tên sản phẩm</a>
- Tối đa 3 link trong một câu trả lời

KẾT:
👉 Cần hỗ trợ nhanh, anh/chị nhắn Zalo em nhé: https://zalo.me/0963111234
`;

    const openai = getOpenAI();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: intent.buying ? 0.7 : 0.5,
      max_tokens: 700,
      messages: [
        { role: "system", content: systemPrompt },
        ...safeContext,
        { role: "user", content: message },
      ],
    });

    console.log("TOKENS:", completion.usage);

    return res.status(200).json({
      reply: completion.choices[0].message.content,
    });
  } catch (err) {
    console.error("ERROR:", err.message);

    return res.status(200).json({
      reply:
        "Em đang bận chút, anh/chị nhắn Zalo em tư vấn nhanh nhé 👉 https://zalo.me/0963111234",
    });
  }
};
