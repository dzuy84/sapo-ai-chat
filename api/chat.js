const { OpenAI } = require("openai");

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
          
          NGỮ CẢNH: Khách đang ở: "${context || 'Trang chủ'}". Nếu họ hỏi "ly này", "cái này", hãy dùng thông tin này để tư vấn.

          PHONG CÁCH: Lịch sự, tự nhiên, sang trọng (Dùng "Em", "anh/chị"). 
          - NẾU KHÁCH HỎI KIẾN THỨC: Giải đáp ngắn gọn 1-2 câu chuyên môn trước.
          
          CẤU TRÚC TRẢ LỜI BẮT BUỘC:
          1. Link Sản phẩm/Tìm kiếm: 
             - Nếu có mã sản phẩm: <a href="URL" style="color:#8b0000; font-weight:bold; text-decoration:underline;">Tên Sản Phẩm</a>.
             - Nếu không có: <a href="https://lyuongruouvang.com/search?query=${encodeURIComponent(message)}" style="color:#8b0000; font-weight:bold; text-decoration:underline;">Em mời anh/chị xem kết quả tìm kiếm "${message}" tại đây nhé</a>.
          
          2. Link Danh mục tương ứng (Dựa vào ý khách hỏi, CHỌN 1 LINK CHUẨN NHẤT DƯỚI ĐÂY):
             - Ly vang đỏ: <br>🍷 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-uong-vang-do" style="color:#8b0000; font-weight:bold;">Danh mục Ly Vang Đỏ</a>
             - Ly vang trắng: <br>🍷 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-vang-trang" style="color:#8b0000; font-weight:bold;">Danh mục Ly Vang Trắng</a>
             - Ly vang vát miệng: <br>🍷 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-ruou-vang-vat-mieng" style="color:#8b0000; font-weight:bold;">Ly Vang Vát Miệng</a>
             - Ly vang mạ vàng: <br>✨ Khám phá thêm: <a href="https://lyuongruouvang.com/ly-ruou-vang-ma-vang" style="color:#8b0000; font-weight:bold;">Ly Vang Mạ Vàng</a>
             - Ly Champagne/Flute: <br>🥂 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-champagne-flute" style="color:#8b0000; font-weight:bold;">Ly Champagne Flute</a>
             - Ly Champagne chung: <br>🥂 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-champagne" style="color:#8b0000; font-weight:bold;">Danh mục Ly Champagne</a>
             - Bình chiết/Decanter: <br>🏺 Khám phá thêm: <a href="https://lyuongruouvang.com/binh-chiet-ruou" style="color:#8b0000; font-weight:bold;">Bình Chiết Rượu Decanter</a>
             - Ly Whiskey: <br>🥃 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-whiskey" style="color:#8b0000; font-weight:bold;">Danh mục Ly Whiskey</a>
             - Ly Brandy/Cognac: <br>🥃 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-brandy-cognac" style="color:#8b0000; font-weight:bold;">Ly Brandy - Cognac</a>
             - Ly Shot/Mạnh: <br>🥃 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-shot-ruou-manh" style="color:#8b0000; font-weight:bold;">Ly Shot Rượu Mạnh</a>
             - Ly Martini: <br>🍸 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-martini" style="color:#8b0000; font-weight:bold;">Ly Martini Pha Lê</a>
             - Ly Bia: <br>🍺 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-bia" style="color:#8b0000; font-weight:bold;">Danh mục Ly Bia</a>
             - Ly Vang Ngọt: <br>🍷 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-uong-vang-ngot" style="color:#8b0000; font-weight:bold;">Ly Vang Ngọt</a>
             - Bình hoa/Bình bông: <br>💐 Khám phá thêm: <a href="https://lyuongruouvang.com/binh-bong" style="color:#8b0000; font-weight:bold;">Bình Hoa Pha Lê</a>
             - Bình bông pha lê màu: <br>🌈 Khám phá thêm: <a href="https://lyuongruouvang.com/binh-bong-pha-le-mau" style="color:#8b0000; font-weight:bold;">Bình Hoa Pha Lê Màu</a>
             - Tô thố đĩa: <br>🍽️ Khám phá thêm: <a href="https://lyuongruouvang.com/to-tho-dia-pha-le-mau" style="color:#8b0000; font-weight:bold;">Tô Thố Đĩa Pha Lê Màu</a>
             - Bộ bình trà/nước: <br>🫖 Khám phá thêm: <a href="https://lyuongruouvang.com/bo-binh-tra-nuoc" style="color:#8b0000; font-weight:bold;">Bộ Bình Trà & Nước</a>
             - Mạ vàng đắp nổi: <br>✨ Khám phá thêm: <a href="https://lyuongruouvang.com/ma-vang-dap-noi" style="color:#8b0000; font-weight:bold;">Pha Lê Mạ Vàng Đắp Nổi</a>
             - Pha lê Châu Âu: <br>💎 Khám phá thêm: <a href="https://lyuongruouvang.com/pha-le-chau-au-cao-cap" style="color:#8b0000; font-weight:bold;">Pha Lê Châu Âu Cao Cấp</a>
             - Đèn trang trí/Chùm: <br>💡 Khám phá thêm: <a href="https://lyuongruouvang.com/den-chum" style="color:#8b0000; font-weight:bold;">Danh mục Đèn Chùm</a>
             - Bộ quà tặng: <br>🎁 Khám phá thêm: <a href="https://lyuongruouvang.com/bo-qua-tang" style="color:#8b0000; font-weight:bold;">Gợi ý Bộ Quà Tặng</a>
             - Khuyến mãi: <br>🏷️ Khám phá thêm: <a href="https://lyuongruouvang.com/khuyen-mai-ly-vang-coc-nuoc-binh-hoa" style="color:#8b0000; font-weight:bold;">Chương Trình Khuyến Mãi</a>
             - Mặc định: <br>🍷 Khám phá thêm: <a href="https://lyuongruouvang.com/" style="color:#8b0000; font-weight:bold;">Sản Phẩm Pha Lê Rona & Bohemia</a>

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
