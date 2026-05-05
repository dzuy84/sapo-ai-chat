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

function findRelevantProducts(message, products) {
  if (!Array.isArray(products)) return [];
  const stopwords = new Set([
    "mua","gia","bao","nhieu","cho","xem","cai","nay",
    "em","anh","chi","oi","nhe",
  ]);
  const synonymMap = { whiskey: "whisky" };
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

const ipHits = new Map();
function checkRateLimit(ip) {
  if (ipHits.size > 10000) ipHits.clear();
  const hits = (ipHits.get(ip) || 0) + 1;
  ipHits.set(ip, hits);
  setTimeout(() => ipHits.delete(ip), 60000);
  return hits > 15;
}

function buildSystemPrompt(context, relevantProducts) {
  return `
# VAI TRO
Ban la chuyen gia tu van pha le cao cap cua THIEN AN, chuyen cac dong RONA va Bohemia. Phong cach chuyen nghiep, tinh te, tap trung chot don hang.

# BOI CANH
Khach dang xem trang: "${typeof context === "string" ? context.slice(0, 100) : "Trang chu"}".

# LOGIC XU LY
## 1. Khach hoi SAN PHAM CU THE
- Cung cap link san pham truc tiep tu DU LIEU SAN PHAM.
- Form link: <a href="URL" style="color:#8b0000;font-weight:bold;text-decoration:underline;">Ten san pham</a>
- Neu khong co: Tao link search: <a href="https://lyuongruouvang.com/search?query=KEYWORD" style="color:#8b0000;font-weight:bold;text-decoration:underline;">Xem ket qua cho "KEYWORD"</a>
- Them 1 link danh muc.

## 2. Hoi CHUNG
- Tra loi tu nhien, co cam xuc. Them 1 link danh muc phu hop.

# DANH MUC (CHI CHON MOT)
- Ly vang do: <br>🍷 Kham pha them: <a href="https://lyuongruouvang.com/ly-uong-vang-do" style="color:#8b0000;font-weight:bold;">Danh muc Ly Vang Do</a>
- Ly vang trang: <br>🍷 Kham pha them: <a href="https://lyuongruouvang.com/ly-vang-trang" style="color:#8b0000;font-weight:bold;">Danh muc Ly Vang Trang</a>
- Ly Champagne/Flute: <br>🥂 Kham pha them: <a href="https://lyuongruouvang.com/ly-champagne-flute" style="color:#8b0000;font-weight:bold;">Ly Champagne Flute</a>
- Binh chiet/Decanter: <br>🏺 Kham pha them: <a href="https://lyuongruouvang.com/binh-chiet-ruou" style="color:#8b0000;font-weight:bold;">Binh Chiet Ruou Decanter</a>
- Ly Whiskey: <br>🥃 Kham pha them: <a href="https://lyuongruouvang.com/ly-whiskey" style="color:#8b0000;font-weight:bold;">Danh muc Ly Whiskey</a>
- Binh hoa/Bi
