const { OpenAI } = require("openai");

// Cấu hình thời gian tối đa cho Vercel (tránh bị ngắt kết nối sớm)
module.exports.config = { maxDuration: 30 };

let openai;
function getOpenAI() {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

// Bộ nhớ đệm lưu sản phẩm 5 phút để web không bị chậm
let cachedProducts = [];
let lastFetch = 0;

async function fetchProducts() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // Đợi tối đa 3 giây
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

// Chấm điểm và lọc ra 5 sản phẩm chuẩn nhất theo câu hỏi của khách
function findRelevantProducts(message, products) {
  if (!Array.isArray(products)) return [];
  const stopwords = new Set([
    "mua","gia","bao","nhieu","cho","xem","cai","nay",
    "em","anh","chi","oi","nhe",
  ]);
  const synonymMap = { whiskey: "whisky", vang: "vang" };
  
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
    .slice(0, 5); // Lấy top 5
}

// Chặn spam tin nhắn liên tục
const ipHits = new Map();
function checkRateLimit(ip) {
  if (ipHits.size > 10000) ipHits.clear();
  const hits = (ipHits.get(ip) || 0) + 1;
  ipHits.set(ip, hits);
  setTimeout(() => ipHits.delete(ip), 60000); // Xóa sau 1 phút
  return hits > 15; // Quá 15 tin / phút thì chặn
}

// Bộ não của AI (Bao gồm danh mục chuẩn)
function buildSystemPrompt(context, relevantProducts) {
  return `# VAI TRO
Ban la chuyen gia tu van pha le cao cap cua THIEN AN, chuyen cac dong RONA Slovakia va Bohemia Tiep Khac. Phong cach chuyen nghiep, tinh te, tap trung chot don hang. Tra loi NGAN GON toi da 3-4 cau.

# BOI CANH
Khach dang xem trang: "${typeof context === "string" ? context.slice(0, 100) : "Trang chu"}".

# LOGIC XU LY
## 1. Khach hoi SAN PHAM CU THE
- Cung cap link san pham truc tiep tu DU LIEU SAN PHAM.
- Form link: <a href="URL" style="color:#8b0000;font-weight:bold;text-decoration:underline;">Ten san pham</a>
- Neu khong co: <a href="https://lyuongruouvang.com/search?query=KEYWORD" style="color:#8b0000;font-weight:bold;text-decoration:underline;">Xem ket qua cho "KEYWORD"</a>
- Kèm theo 1 link danh muc bên dưới.

## 2. Hoi CHUNG hoac KHONG TIM THAY SAN PHAM
- Tra loi tu nhien, ngan gon. Chon 1 link danh muc phu hop nhat ben duoi de gui cho khach.

# DANH MUC (CHI CHON MOT DE GUI NHO VAO YEU CAU CUA KHACH)
- Ly vang đỏ: <br>🍷 <a href="https://lyuongruouvang.com/ly-uong-vang-do" style="color:#8b0000;font-weight:bold;">Danh mục Ly Vang Đỏ</a>
- Ly vang trắng: <br>🍷 <a href="https://lyuongruouvang.com/ly-vang-trang" style="color:#8b0000;font-weight:bold;">Danh mục Ly Vang Trắng</a>
- Ly Champagne: <br>🥂 <a href="https://lyuongruouvang.com/ly-champagne-flute" style="color:#8b0000;font-weight:bold;">Ly Champagne Flute</a>
- Ly Whiskey: <br>🥃 <a href="https://lyuongruouvang.com/ly-whiskey" style="color:#8b0000;font-weight:bold;">Danh mục Ly Whiskey</a>
- Ly Brandy/Cognac: <br>🥃 <a href="https://lyuongruouvang.com/ly-brandy-cognac" style="color:#8b0000;font-weight:bold;">Ly Brandy & Cognac</a>
- Cốc nước/Ly pha lê: <br>🥛 <a href="https://lyuongruouvang.com/ly-coc" style="color:#8b0000;font-weight:bold;">Bộ sưu tập Cốc nước Pha lê</a>
- Bình chiết rượu (Decanter): <br>🏺 <a href="https://lyuongruouvang.com/binh-chiet-ruou" style="color:#8b0000;font-weight:bold;">Bình Chiết Rượu Decanter</a>
- Bộ bình ly uống rượu: <br>🍾 <a href="https://lyuongruouvang.com/bo-binh-ruou" style="color:#8b0000;font-weight:bold;">Bộ Bình Ly Uống Rượu</a>
- Ly mạ vàng: <br>✨ <a href="https://lyuongruouvang.com/ly-ruou-vang-ma-vang" style="color:#8b0000;font-weight:bold;">Bộ Sưu Tập Ly Pha Lê Mạ Vàng</a>
- Mạ vàng đắp nổi/hoa văn: <br>⚜️ <a href="https://lyuongruouvang.com/ma-vang-dap-noi" style="color:#8b0000;font-weight:bold;">Pha Lê Mạ Vàng Đắp Nổi Cao Cấp</a>
- Pha lê màu: <br>🌈 <a href="https://lyuongruouvang.com/pha-le-mau" style="color:#8b0000;font-weight:bold;">Bộ sưu tập Pha Lê Màu</a>
- Bộ bình trà/nước: <br>🫖 <a href="https://lyuongruouvang.com/bo-binh-tra-nuoc" style="color:#8b0000;font-weight:bold;">Bộ Bình Trà & Bình Nước</a>
- Bình hoa pha lê: <br>💐 <a href="https://lyuongruouvang.com/binh-bong" style="color:#8b0000;font-weight:bold;">Bình Hoa Pha Lê Cao Cấp</a>
- Tô, Thố, Đĩa: <br>🍽️ <a href="https://lyuongruouvang.com/to-tho" style="color:#8b0000;font-weight:bold;">Tô, Thố, Đĩa Pha Lê</a>
- Đèn chùm/Đèn trang trí: <br>💡 <a href="https://lyuongruouvang.com/den-chum" style="color:#8b0000;font-weight:bold;">Đèn Chùm Pha Lê Sang Trọng</a>
- Bộ Quà tặng: <br>🎁 <a href="https://lyuongruouvang.com/bo-qua-tang" style="color:#8b0000;font-weight:bold;">Bộ Quà Tặng Pha Lê</a>
- Mặc định: <br>💎 <a href="https://lyuongruouvang.com/" style="color:#8b0000;font-weight:bold;">Sản Phẩm Pha Lê RONA & Bohemia</a>

# CAU KET BAT BUOC
<br><a href="https://zalo.me/0963111234" style="color:#0068ff;font-weight:bold;">👉 Cần tư vấn thêm, nhắn Zalo cho Em nhé!</a>

# DU LIEU SAN PHAM THUC TE
${JSON.stringify(relevantProducts)}`;
}

// Xử lý lịch sử chat để AI nhớ ngữ cảnh
function sanitizeHistory(rawHistory) {
  if (!Array.isArray(rawHistory)) return [];
  return rawHistory
    .filter((msg) =>
      msg && typeof msg === "object" &&
      (msg.role === "user" || msg.role === "assistant") &&
      typeof msg.content === "string" &&
      msg.content.trim().length > 0
    )
    .map((msg) => ({
      role: msg.role,
      content: String(msg.content).trim().slice(0, 800),
    }))
    .slice(-10); // Chỉ nhớ 10 tin nhắn gần nhất cho tiết kiệm phí
}

module.exports = async function(req, res) {
  // Cấp quyền CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "OPTIONS, POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ reply: "Method not allowed" });

  const requiredEnv = ["OPENAI_API_KEY","SAPO_API_KEY","SAPO_API_SECRET","SAPO_STORE_ALIAS"];
  for (var i = 0; i < requiredEnv.length; i++) {
    if (!process.env[requiredEnv[i]]) {
      return res.status(500).json({ reply: "Hệ thống đang bảo trì." });
    }
  }

  try {
    var body = req.body || {};
    var message = body.message;
    var context = body.context;
    var history = body.history;

    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({ reply: "Tin nhắn không hợp lệ." });
    }
    message = message.trim().slice(0, 500);

    const ip = req.headers["x-forwarded-for"] || (req.socket && req.socket.remoteAddress) || "Unknown";
    if (checkRateLimit(ip)) {
      return res.status(429).json({ reply: "Anh/chị thao tác nhanh quá. Vui lòng thử lại sau 1 phút nhé!" });
    }

    console.log("[CHAT] " + ip + " | " + message.slice(0, 80));

    // Lấy dữ liệu và gọi AI
    const allProducts = await getProductsCached();
    const relevantProducts = findRelevantProducts(message, allProducts);
    const aiClient = getOpenAI();
    const cleanHistory = sanitizeHistory(history);

    const messages = [
      { role: "system", content: buildSystemPrompt(context, relevantProducts) },
      ...cleanHistory,
      { role: "user", content: message },
    ];

    // TRẢ LỜI THEO KIỂU GÕ CHỮ (STREAMING)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const stream = await aiClient.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      max_tokens: 300,
      stream: true,
      messages,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || "";
      if (delta) {
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }

    res.write(`data: [DONE]\n\n`);
    res.end();

  } catch (err) {
    console.error("Handler error:", err);
    if (!res.headersSent) {
      return res.status(200).json({
        reply: "Dạ em đang bận sắp xếp kho, anh/chị nhắn Zalo nhé! <br><a href='https://zalo.me/0963111234' style='color:#0068ff;font-weight:bold;'>👉 Chat Zalo với RONA</a>",
      });
    }
    try { res.write(`data: [ERROR]\n\n`); res.end(); } catch(e) {}
  }
};
