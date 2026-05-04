const { OpenAI } = require("openai");

let stats = { totalVisits: 0, uniqueIPs: new Set(), recentQuestions: [] };

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { message } = req.body || {};
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || "Unknown";
    const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));

    if (message && message !== "Duy_Check_68") {
      stats.totalVisits++;
      if (ip !== "Unknown") stats.uniqueIPs.add(ip);
      stats.recentQuestions.push({ q: message, time: now.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) });
      if (stats.recentQuestions.length > 50) stats.recentQuestions.shift();
    }

    if (message === "Duy_Check_68") {
      return res.status(200).json({ reply: `📊 **ADMIN RONA BÁO CÁO**:\nKhách hôm nay: **${stats.uniqueIPs.size}**.\nTổng tương tác: ${stats.totalVisits}.` });
    }

    let products = [];
    try {
      const auth = Buffer.from(`${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`).toString("base64");
      const sapoRes = await fetch(`https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=250&fields=title,alias`, { 
        headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/json" } 
      });
      const data = await sapoRes.json();
      products = (data.products || []).map(p => ({ name: p.title, url: `https://lyuongruouvang.com/products/${p.alias}` }));
    } catch (e) { console.error("Sapo Error"); }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3, 
      messages: [
        {
          role: "system",
          content: `Bạn là Le Dzuy - Sommelier tại RONA. Tư vấn SIÊU NGẮN (1-2 câu).
          
          BẮT BUỘC TRẢ LỜI THEO CẤU TRÚC:
          1. Link Sản phẩm/Tìm kiếm: 
             - Nếu tìm thấy trong danh sách: <a href="URL" style="color:#8b0000; font-weight:bold; text-decoration:underline;">Tên Sản Phẩm</a>.
             - Nếu không thấy hoặc khách hỏi mã (như 715, 680...): <a href="https://lyuongruouvang.com/search?query=${encodeURIComponent(message)}" style="color:#8b0000; font-weight:bold; text-decoration:underline;">Kết quả tìm kiếm "${message}" tại đây</a>.
          
          2. Link Danh mục tương ứng (Dựa vào từ khóa khách hỏi để chọn 1 link phù hợp nhất):
             - Nếu hỏi ly vang/ly pha lê: <br>🍷 Xem thêm: <a href="https://lyuongruouvang.com/ly-uong-ruou-vang" style="color:#8b0000; font-weight:bold;">Danh mục Ly Uống Rượu Vang</a>
             - Nếu hỏi ly vang đỏ: <br>🍷 Xem thêm: <a href="https://lyuongruouvang.com/ly-vang-do" style="color:#8b0000; font-weight:bold;">Danh mục Ly Vang Đỏ</a>
             - Nếu hỏi ly Champagne/nổ: <br>🥂 Xem thêm: <a href="https://lyuongruouvang.com/ly-ruou-vang-no-champagne" style="color:#8b0000; font-weight:bold;">Danh mục Ly Champagne</a>
             - Nếu hỏi bình thở/decanter: <br>🏺 Xem thêm: <a href="https://lyuongruouvang.com/binh-tho-ruou-vang-decanter" style="color:#8b0000; font-weight:bold;">Danh mục Bình Thở Decanter</a>
             - Nếu hỏi ly rượu mạnh/whisky: <br>🥃 Xem thêm: <a href="https://lyuongruouvang.com/ly-ruou-manh" style="color:#8b0000; font-weight:bold;">Danh mục Ly Rượu Mạnh</a>
             - Mặc định nếu không rõ: <br>🍷 Xem thêm: <a href="https://lyuongruouvang.com/ly-uong-ruou-vang" style="color:#8b0000; font-weight:bold;">Bộ sưu tập Ly Pha Lê Cao Cấp</a>

          3. Câu chốt Zalo: <br><a href="https://zalo.me/0963111234" style="color:#0068ff; font-weight:bold;">👉 Chat Zalo Duy chốt đơn ngay!</a>

          DATA: ${JSON.stringify(products)}`
        },
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });
  } catch (err) {
    return res.status(200).json({ reply: "Duy đang bận, sếp nhắn Zalo nhé! <br><a href='https://zalo.me/0963111234' style='color:#0068ff; font-weight:bold;'>👉 Chat Zalo Duy</a>" });
  }
};
