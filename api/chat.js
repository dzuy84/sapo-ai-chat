const { OpenAI } = require("openai");

// --- HỆ THỐNG CACHE & THỐNG KÊ ---
let cachedProducts = [];
let lastFetch = 0;
const CACHE_TIME = 5 * 60 * 1000;
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

    // Track ý định mua hàng
    const buyingIntent = /giá|bao nhiêu|mua|đặt|ship|tư vấn|mẫu|khuyến mãi|giảm giá/i.test(message);

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

    // --- LẤY DATA SÂU (GIÁ, MÔ TẢ) ---
    if (Date.now() - lastFetch > CACHE_TIME || cachedProducts.length === 0) {
      try {
        const auth = Buffer.from(`${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`).toString("base64");
        const sapoRes = await fetch(`https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=250&fields=title,alias,variants,body_html`, { 
          headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/json" } 
        });
        const data = await sapoRes.json();
        cachedProducts = (data.products || []).map(p => ({
          name: p.title,
          price: p.variants?.[0]?.price ? parseInt(p.variants[0].price).toLocaleString('vi-VN') + 'đ' : "Liên hệ",
          desc: p.body_html ? p.body_html.replace(/<[^>]*>/g, '').substring(0, 150) : "",
          url: `https://lyuongruouvang.com/products/${p.alias}`
        }));
        lastFetch = Date.now();
      } catch (e) { console.error("Sapo API Error"); }
    }

    // Tự tìm sản phẩm trong câu hỏi
    const foundProduct = cachedProducts.find(p => message.toLowerCase().includes(p.name.toLowerCase()));
    const productInfoInject = foundProduct ? `Khách đang quan tâm: ${foundProduct.name} (Giá: ${foundProduct.price}). Mô tả: ${foundProduct.desc}` : "";

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.65, 
      messages: [
        {
          role: "system",
          content: `Bạn là Le Dzuy - Chuyên gia Sommelier tại RONA. 
          
          NGỮ CẢNH: Khách xem trang: "${context}". ${productInfoInject}

          CHIẾN LƯỢC CHỐT SALE:
          1. Trả lời duyên dáng, sang trọng (Xưng "Duy/Em", gọi "anh/chị").
          2. Nếu khách hỏi giá/mua: Báo giá chính xác từ dữ liệu, khẳng định pha lê Bohemia/Rona đẳng cấp Tiệp Khắc. Cam kết 1 đổi 1 nếu vỡ khi vận chuyển.
          3. Nếu khách hỏi kiến thức (dung tích, loại ly): Giải thích chuyên sâu Sommelier ngắn gọn.
          4. Tuyệt đối không nói "không có hàng". Nếu không thấy mã đó, hãy gợi ý mẫu tương tự và khẳng định nó đẹp/phù hợp hơn.
          5. ÉP MUA: Mời khách sang Zalo để nhận "Ưu đãi riêng cho khách VIP".

          DANH MỤC ĐIỀU HƯỚNG (BẮT BUỘC KÈM THEO):
          - Khuyến mãi: <a href="https://lyuongruouvang.com/khuyen-mai-ly-vang-coc-nuoc-binh-hoa">🎁 Ưu Đãi Khuyến Mãi</a>
          - Ly Vang Đỏ: <a href="https://lyuongruouvang.com/ly-uong-vang-do">🍷 Ly Vang Đỏ</a>
          - Ly Vang Trắng: <a href="https://lyuongruouvang.com/ly-vang-trang">🥂 Ly Vang Trắng</a>
          - Ly Champagne: <a href="https://lyuongruouvang.com/ly-champagne">🥂 Ly Champagne</a>
          - Bình Decanter: <a href="https://lyuongruouvang.com/binh-chiet-ruou">🏺 Bình Chiết Decanter</a>
          - Quà tặng: <a href="https://lyuongruouvang.com/bo-qua-tang">🎁 Bộ Quà Tặng Sang Trọng</a>
          - Ly Whisky: <a href="https://lyuongruouvang.com/ly-whiskey">🥃 Ly Whisky</a>
          - Pha lê Mạ Vàng: <a href="https://lyuongruouvang.com/ma-vang-dap-noi">✨ Pha Lê Mạ Vàng</a>

          CÂU CHỐT: <br><a href="https://zalo.me/0963111234" style="color:#0068ff; font-weight:bold;">👉 Nhắn Zalo Duy nhận ưu đãi VIP ngay!</a>
          
          DATA: ${JSON.stringify(cachedProducts.slice(0, 100))}`
        },
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    console.error(err);
    return res.status(200).json({ reply: "Dạ Duy đây, anh/chị nhắn Zalo Duy tư vấn ưu đãi nhé! 🍷 <br><a href='https://zalo.me/0963111234' style='color:#0068ff; font-weight:bold;'>👉 Chat Zalo Duy ngay</a>" });
  }
};
