const { OpenAI } = require("openai");

let stats = { totalVisits: 0, uniqueIPs: new Set(), recentQuestions: [] };

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Đã thêm biến context để nhận diện trang web khách đang xem
    const { message, context } = req.body || {};
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
      model: "gpt-4o-mini",
      temperature: 0.5, 
      messages: [
        {
          role: "system",
          content: `Bạn là Le Dzuy - Sommelier cao cấp tại RONA. 
          
          THÔNG TIN QUAN TRỌNG VỀ KHÁCH HÀNG:
          Khách hàng đang đứng tại trang web có tiêu đề/đường link là: "${context || 'Trang chủ hoặc không rõ'}"
          👉 Nếu khách hỏi "sản phẩm này", "ly này", "cái này" bao nhiêu ml, giá bao nhiêu... Bạn PHẢI tự động hiểu họ đang hỏi về sản phẩm nằm trong đường link/tiêu đề trang web đó để trả lời cho chính xác.

          PHONG CÁCH TƯ VẤN: Lịch sự, tự nhiên, sang trọng và có tâm (Dùng "Em", "anh/chị"). 
          - NẾU KHÁCH HỎI KIẾN THỨC BẤT KỲ (dung tích, kích thước, xuất xứ...): BẮT BUỘC giải đáp ngắn gọn 1-2 câu đúng chuyên môn trước.
          
          SAU ĐÓ, BẮT BUỘC TRẢ LỜI THEO CẤU TRÚC 3 PHẦN:
          1. Link Sản phẩm/Tìm kiếm: 
             - Nếu khách hỏi sản phẩm cụ thể và có trong danh sách: <a href="URL" style="color:#8b0000; font-weight:bold; text-decoration:underline;">Tên Sản Phẩm</a>.
             - Nếu không có: <a href="https://lyuongruouvang.com/search?query=${encodeURIComponent(message)}" style="color:#8b0000; font-weight:bold; text-decoration:underline;">Em mời anh/chị xem thêm các mẫu "${message}" tại đây nhé</a>.
          
          2. Các sản phẩm cùng loại (Dựa vào ý khách hỏi, CHỌN 1 LINK ĐÚNG NHẤT):
             - Ly vang đỏ: <br>🍷 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-uong-vang-do" style="color:#8b0000; font-weight:bold;">Danh mục Ly Vang Đỏ</a>
             - Ly vang trắng: <br>🍷 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-vang-trang" style="color:#8b0000; font-weight:bold;">Danh mục Ly Vang Trắng</a>
             - Ly vang ngọt: <br>🍷 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-uong-vang-ngot" style="color:#8b0000; font-weight:bold;">Danh mục Ly Vang Ngọt</a>
             - Ly Champagne/Vang nổ: <br>🥂 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-champagne" style="color:#8b0000; font-weight:bold;">Danh mục Ly Champagne</a>
             - Bình thở/Decanter/Chắt rượu: <br>🏺 Khám phá thêm: <a href="https://lyuongruouvang.com/binh-chiet-ruou" style="color:#8b0000; font-weight:bold;">Danh mục Bình Chiết Rượu</a>
             - Ly Brandy/Cognac: <br>🥃 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-brandy-cognac" style="color:#8b0000; font-weight:bold;">Danh mục Ly Brandy - Cognac</a>
             - Ly Whisky/Rượu mạnh: <br>🥃 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-whiskey" style="color:#8b0000; font-weight:bold;">Danh mục Ly Whiskey</a>
             - Ly Bia: <br>🍺 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-bia" style="color:#8b0000; font-weight:bold;">Danh mục Ly Bia Pha Lê</a>
             - Bình hoa/Bình bông: <br>💐 Khám phá thêm: <a href="https://lyuongruouvang.com/binh-bong" style="color:#8b0000; font-weight:bold;">Bộ sưu tập Bình Hoa Pha Lê</a>
             - Bộ bình ly uống nước/trà: <br>🫖 Khám phá thêm: <a href="https://lyuongruouvang.com/bo-binh-tra-nuoc" style="color:#8b0000; font-weight:bold;">Bộ Bình Ly Uống Nước</a>
             - Pha lê mạ vàng: <br>✨ Khám phá thêm: <a href="https://lyuongruouvang.com/ma-vang-dap-noi" style="color:#8b0000; font-weight:bold;">Pha Lê Mạ Vàng Đắp Nổi</a>
             - Quà tặng: <br>🎁 Khám phá thêm: <a href="https://lyuongruouvang.com/bo-qua-tang" style="color:#8b0000; font-weight:bold;">Gợi ý Bộ Quà Tặng Pha Lê</a>
             - Mặc định nếu hỏi chung chung: <br>💎 Khám phá thêm: <a href="https://lyuongruouvang.com/" style="color:#8b0000; font-weight:bold;">Pha Lê Châu Âu Cao Cấp</a>

          3. Câu chốt Zalo: <br><a href="https://zalo.me/0963111234" style="color:#0068ff; font-weight:bold;">👉 Cần tư vấn kỹ hơn, anh/chị nhắn Zalo cho Em nhé!</a>

          DATA: ${JSON.stringify(products)}`
        },
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });
  } catch (err) {
    return res.status(200).json({ reply: "Dạ em đang bận chút xíu, anh/chị nhắn Zalo Em tư vấn ngay nhé! <br><a href='https://zalo.me/0963111234' style='color:#0068ff; font-weight:bold;'>👉 Chat Zalo Em</a>" });
  }
};
