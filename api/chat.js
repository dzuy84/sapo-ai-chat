const { OpenAI } = require("openai");

// Biến lưu trữ thống kê tạm thời trên Vercel (Vẫn giữ để sếp check bằng lệnh Duy_Check_68)
let stats = { totalVisits: 0, uniqueIPs: new Set(), recentQuestions: [] };

module.exports = async (req, res) => {
  // 1. CẤU HÌNH CORS TRỰC TIẾP
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { message, context } = req.body || {};
    
    // Tự động lấy IP của khách
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || "Unknown";
    
    const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));

    // Lưu thống kê vào bộ nhớ tạm
    if (message && message !== "Duy_Check_68") {
      stats.totalVisits++;
      if (ip && ip !== "Unknown") stats.uniqueIPs.add(ip);
      stats.recentQuestions.push({ 
        q: message, 
        time: now.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) 
      });
      if (stats.recentQuestions.length > 50) stats.recentQuestions.shift();
    }

    // Lệnh bí mật của Admin - Xem trực tiếp trong khung chat
    if (message === "Duy_Check_68") {
      return res.status(200).json({ reply: `📊 **ADMIN RONA BÁO CÁO**:\nHôm nay đã tiếp **${stats.uniqueIPs.size}** khách qua IP duy nhất.\nTổng số tương tác: ${stats.totalVisits}.` });
    }

    // Lấy dữ liệu kho từ Sapo
    let products = [];
    try {
      const sapoAlias = process.env.SAPO_STORE_ALIAS; 
      const sapoToken = process.env.SAPO_API_SECRET; 
      
      const sapoRes = await fetch(`https://${sapoAlias}.mysapo.net/admin/products.json?limit=150&fields=title,variants,alias`, { 
        headers: { 
          "X-Sapo-Access-Token": sapoToken,
          "Content-Type": "application/json"
        } 
      });
      const data = await sapoRes.json();
      products = (data.products || []).map(p => ({ 
        name: p.title, 
        url: `https://lyuongruouvang.com/products/${p.alias}` 
      }));
    } catch (e) {
      console.error("Lỗi lấy Sapo:", e);
    }

    // Kịch bản chốt sale OpenAI
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.4, 
      messages: [
        {
          role: "system",
          content: `Bạn là Le Dzuy - Sommelier cao cấp tại RONA. 
          
          PHONG CÁCH TƯ VẤN:
          1. Ngôn ngữ sang trọng, lịch sự nhưng gần gũi (Dùng "Duy", "anh/chị").
          2. Kiến thức: Phải am hiểu về pha lê Bohemia (Tiệp Khắc) - nhắc đến độ trong suốt, tiếng vang và sự tinh xảo.
          3. Kịch bản bán hàng: 
             - Nếu khách hỏi về ly vang: Phân biệt ly Bordeaux (vang đậm) và Burgundy (vang thanh).
             - Nếu khách lo vỡ: Cam kết bảo hành 1 đổi 1 khi vận chuyển.
             - Nếu khách hỏi xuất xứ: Khẳng định 100% nhập khẩu từ Tiệp Khắc/Slovakia (CO/CQ đầy đủ).
          4. ĐỊNH DẠNG BẮT BUỘC:
             - PHẢI dùng thẻ <a> cho sản phẩm: <a href="URL" style="color:#8b0000; font-weight:bold; text-decoration:underline;">Tên Sản Phẩm</a>.
             - Luôn điều hướng về Zalo Duy: <a href="https://zalo.me/0963111234" style="color:#0068ff; font-weight:bold;">Chat Zalo với Duy ngay</a>.
          
          DANH SÁCH SẢN PHẨM HIỆN CÓ: ${JSON.stringify(products)}`
        },
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    console.error("Lỗi Server:", err);
    return res.status(200).json({ reply: "Duy đang bận phục vụ rượu cho khách, anh/chị nhắn Zalo Duy tư vấn ngay nhé! <br><a href='https://zalo.me/0963111234' style='color:#0068ff; font-weight:bold;'>👉 Chat Zalo với Duy</a>" });
  }
};
