const { OpenAI } = require("openai");

// --- HỆ THỐNG CACHING TĂNG TỐC & GIẢM LAG ---
let cachedProducts = [];
let lastFetch = 0;
const CACHE_TIME = 5 * 60 * 1000; // 5 phút làm mới kho hàng một lần

let stats = { totalVisits: 0, uniqueIPs: new Set(), recentQuestions: [] };

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { message, context } = req.body || {};
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || "Unknown";
    const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));

    // --- TRACK Ý ĐỊNH MUA HÀNG ---
    const buyingIntent = /giá|bao nhiêu|mua|đặt|ship|tư vấn|mẫu/i.test(message);

    if (message && message !== "Duy_Check_68") {
      stats.totalVisits++;
      if (ip !== "Unknown") stats.uniqueIPs.add(ip);
      stats.recentQuestions.push({ q: message, intent: buyingIntent, time: now.toLocaleTimeString('vi-VN') });
      if (stats.recentQuestions.length > 50) stats.recentQuestions.shift();
    }

    if (message === "Duy_Check_68") {
      const intentCount = stats.recentQuestions.filter(q => q.intent).length;
      return res.status(200).json({ reply: `📊 **ADMIN RONA BÁO CÁO**:\n- Khách: **${stats.uniqueIPs.size}**\n- Tương tác: ${stats.totalVisits}\n- Khách tiềm năng (hỏi giá/mua): **${intentCount}**` });
    }

    // --- LẤY DATA SÂU (GIÁ, MÔ TẢ, DUNG TÍCH) & CACHE ---
    if (Date.now() - lastFetch > CACHE_TIME || cachedProducts.length === 0) {
      try {
        const auth = Buffer.from(`${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`).toString("base64");
        // Lấy thêm fields variants (giá) và body_html (mô tả)
        const sapoRes = await fetch(`https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=250&fields=title,alias,variants,body_html`, { 
          headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/json" } 
        });
        const data = await sapoRes.json();
        cachedProducts = (data.products || []).map(p => ({
          name: p.title,
          price: p.variants?.[0]?.price ? parseInt(p.variants[0].price).toLocaleString('vi-VN') + 'đ' : "Liên hệ Duy",
          desc: p.body_html ? p.body_html.replace(/<[^>]*>/g, '').substring(0, 150) : "",
          url: `https://lyuongruouvang.com/products/${p.alias}`
        }));
        lastFetch = Date.now();
      } catch (e) { console.error("Sapo API Error"); }
    }

    // --- LOGIC TỰ HIỂU TỪ KHÓA SẢN PHẨM ---
    const foundProduct = cachedProducts.find(p => message.toLowerCase().includes(p.name.toLowerCase()));
    const productInfoInject = foundProduct ? `Khách đang quan tâm cụ thể: ${foundProduct.name} - Giá: ${foundProduct.price}.` : "";

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.65, 
      messages: [
        {
          role: "system",
          content: `Bạn là Le Dzuy - Bậc thầy tư vấn pha lê tại RONA. 
          
          NGỮ CẢNH: Khách đang xem: "${context}". ${productInfoInject}

          CHIẾN LƯỢC BÁN HÀNG SÁT THỦ (QUY TẮC VÀNG):
          1. KHÔNG trả lời máy móc theo bước. Phải linh hoạt, có cảm xúc như người bán hàng thật.
          2. NẾU KHÁCH HỎI GIÁ: Giải thích ngắn gọn giá trị pha lê Bohemia trước khi báo giá. Ép khách mua ngay bằng ưu đãi hoặc cam kết bảo hành.
          3. NẾU KHÁCH PHÂN VÂN: Chỉ đề xuất DUY NHẤT 1 sản phẩm tốt nhất, đừng đưa nhiều link làm khách rối.
          4. NẾU KHÔNG CÓ HÀNG: Tuyệt đối không nói "không có". Hãy gợi ý sản phẩm gần nhất kèm câu: "Mẫu này đẳng cấp hơn nhiều anh/chị ạ".
          5. LUÔN DẪN DẮT: Mọi câu trả lời phải kết thúc bằng một lời mời hành động (Call to action).

          PHONG CÁCH GIAO TIẾP:
          - Dùng "Em" và "anh/chị". Thêm emoji tinh tế (🍷, ✨, 🥂).
          - Câu chữ ngắn, súc tích, cá nhân hóa theo câu hỏi.
          - Cam kết mạnh mẽ: "Duy bảo hành 1 đổi 1 tận nhà nếu vỡ, anh/chị yên tâm tuyệt đối".

          HƯỚNG DẪN LINK:
          - Link sản phẩm: <a href="URL" style="color:#8b0000; font-weight:bold; text-decoration:underline;">Tên Sản Phẩm - GIÁ</a>
          - Link danh mục: Luôn dùng link danh mục sếp Duy đã cài đặt nếu khách hỏi chung.
          - Luôn có Zalo: <br><a href="https://zalo.me/0963111234" style="color:#0068ff; font-weight:bold;">👉 Nhắn Zalo Duy chốt ưu đãi riêng ngay!</a>

          DATA KHO HÀNG: ${JSON.stringify(cachedProducts.slice(0, 100))}` // Gửi 100 sp để tiết kiệm token
        },
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });
  } catch (err) {
    return res.status(200).json({ reply: "Dạ Duy đây, anh/chị nhắn Zalo Duy tư vấn ngay nhé! 🍷 <br><a href='https://zalo.me/0963111234' style='color:#0068ff; font-weight:bold;'>👉 Chat Zalo Duy</a>" });
  }
};
