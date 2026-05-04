const { OpenAI } = require("openai");

// Biến lưu trữ thống kê tạm thời trên Vercel
let stats = { totalVisits: 0, uniqueIPs: new Set(), recentQuestions: [] };

module.exports = async (req, res) => {
  // 1. CẤU HÌNH CORS TRỰC TIẾP
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  // Xử lý bước kiểm tra an ninh (Preflight) của trình duyệt
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

    // Lấy dữ liệu kho từ Sapo (Đã dùng đủ combo API KEY + SECRET)
    let products = [];
    try {
      const sapoAlias = process.env.SAPO_STORE_ALIAS; 
      const sapoKey = process.env.SAPO_API_KEY;
      const sapoSecret = process.env.SAPO_API_SECRET; 
      
      // Mã hóa API Key và Secret thành chuỗi Base64 chuẩn của Sapo
      const auth = Buffer.from(`${sapoKey}:${sapoSecret}`).toString("base64");
      
      // Vẫn giữ mốc 250 sản phẩm để vét sâu hơn vào kho
      const sapoRes = await fetch(`https://${sapoAlias}.mysapo.net/admin/products.json?limit=250&fields=title,variants,alias`, { 
        headers: { 
          "Authorization": `Basic ${auth}`,
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
      model: "gpt-4o-mini", // Đã chuyển sang model nhanh - bổ - rẻ
      temperature: 0.4, 
      messages: [
        {
          role: "system",
          content: `Bạn là Le Dzuy - Sommelier cao cấp tại RONA. 
          
          PHONG CÁCH TƯ VẤN (QUAN TRỌNG: SIÊU NGẮN GỌN, VÀO THẲNG VẤN ĐỀ):
          1. Trả lời CỰC KỲ NGẮN GỌN, súc tích (Tối đa 2-3 câu). TUYỆT ĐỐI KHÔNG mở bài hay kết luận dài dòng.
          2. Ngôn ngữ lịch sự, chốt sale nhanh (Dùng "Duy", "anh/chị").
          3. Kịch bản: 
             - Chỉ nhấn mạnh đúng 1 ưu điểm (Pha lê Tiệp Khắc/Slovakia siêu trong suốt HOẶC cam kết 1 đổi 1 nếu vỡ).
          4. ĐỊNH DẠNG BẮT BUỘC:
             - NẾU CÓ SẢN PHẨM TRONG DANH SÁCH: Đưa ngay link: <a href="URL" style="color:#8b0000; font-weight:bold; text-decoration:underline;">Tên Sản Phẩm</a>.
             - NẾU KHÔNG THẤY TRONG DANH SÁCH: TUYỆT ĐỐI KHÔNG CÁO LỖI. Tạo ngay link tìm kiếm: <a href="https://lyuongruouvang.com/search?query=TỪ_KHÓA_KHÁCH_HỎI" style="color:#8b0000; font-weight:bold; text-decoration:underline;">Xem ngay các mẫu TỪ_KHÓA_KHÁCH_HỎI tại đây</a>.
             - Câu chốt luôn là: <br><a href="https://zalo.me/0963111234" style="color:#0068ff; font-weight:bold;">👉 Chat Zalo Duy để đặt hàng ngay!</a>
          
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
