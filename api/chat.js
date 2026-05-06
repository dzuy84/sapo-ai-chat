const { OpenAI } = require("openai");

module.exports.config = { maxDuration: 30 };

let openai;
function getOpenAI() {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

// ===== BỎ DẤU =====
function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ===== CACHE =====
let sitemapCache = [];
let sitemapTime = 0;

// ===== LOAD SITEMAP REAL =====
async function fetchSitemap() {
  try {
    const res = await fetch("https://lyuongruouvang.com/sitemap.xml");
    const xml = await res.text();

    const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);

    return urls.map(url => {
      const slug = url.replace("https://lyuongruouvang.com/", "");
      return {
        slug,
        name: normalize(slug.replace(/-/g, " "))
      };
    });

  } catch (e) {
    console.error("Sitemap lỗi:", e.message);
    return [];
  }
}

async function getSitemapCached() {
  if (Date.now() - sitemapTime < 10 * 60 * 1000 && sitemapCache.length) {
    return sitemapCache;
  }
  sitemapCache = await fetchSitemap();
  sitemapTime = Date.now();
  return sitemapCache;
}

// ===== TÌM DANH MỤC =====
function findCategory(message, sitemap) {
  const msg = normalize(message);

  let best = null;
  let bestScore = 0;

  sitemap.forEach((item) => {
    let score = 0;

    item.name.split(" ").forEach((w) => {
      if (msg.includes(w)) score++;
    });

    if (msg.includes(item.name)) score += 5;

    if (score > bestScore) {
      bestScore = score;
      best = item.slug;
    }
  });

  return best;
}

// ===== FETCH SAPO =====
let cachedProducts = [];
let lastFetch = 0;

async function fetchProducts() {
  try {
    const res = await fetch(
      `https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=250`,
      {
        headers: {
          "X-Sapo-Access-Token": process.env.SAPO_API_SECRET,
        },
      }
    );

    const data = await res.json();

    return (data.products || []).map((p) => ({
      name: p.title,
      nameNorm: normalize(p.title),
      url: `https://lyuongruouvang.com/products/${p.handle}`,
    }));
  } catch (e) {
    console.error("Sapo lỗi:", e.message);
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

// ===== SEARCH PRODUCT =====
function findProducts(message, products) {
  const msg = normalize(message);

  const tokens = msg.split(" ").filter(t => t.length > 1);

  const scored = products.map(p => {
    let score = 0;

    tokens.forEach(t => {
      if (p.nameNorm.includes(t)) score += 2;
    });

    if (p.nameNorm.includes(msg)) score += 5;

    return { ...p, score };
  });

  return scored
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

// ===== HTML =====
function buildProductHTML(products) {
  if (!products.length) return "";

  return products.map(p =>
    `🥂 <a href="${p.url}" style="color:#8b0000;font-weight:bold;">${p.name}</a>`
  ).join("<br>");
}

function buildCategoryLink(slug) {
  if (!slug) return "";
  return `<br>👉 <a href="https://lyuongruouvang.com/${slug}" style="color:#8b0000;font-weight:bold;">Xem danh mục</a>`;
}

// ===== MAIN =====
module.exports = async function (req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { message } = req.body;

    const sitemap = await getSitemapCached();
    const category = findCategory(message, sitemap);

    const products = await getProductsCached();
    const relevant = findProducts(message, products);

    const ai = getOpenAI();

    const response = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Bạn là chuyên gia tư vấn ly pha lê cao cấp, trả lời ngắn gọn và có xu hướng chốt đơn."
        },
        { role: "user", content: message }
      ]
    });

    const reply =
      response.choices[0].message.content +
      "<br><br>" +
      buildProductHTML(relevant) +
      buildCategoryLink(category) +
      `<br><a href="https://zalo.me/0963111234" style="color:#0068ff;font-weight:bold;">👉 Chat Zalo</a>`;

    res.status(200).json({ reply });

  } catch (err) {
    console.error(err);
    res.status(200).json({
      reply: '👉 Nhắn Zalo nhé <br><a href="https://zalo.me/0963111234">Chat</a>',
    });
  }
};
