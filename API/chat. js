const express = require('express');
const cors = require('cors');
const { OpenAI } = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

// OpenAI sẽ lấy Key từ phần Environment Variables sếp đã cài trên Vercel
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/api/chat', async (req, res) => {
  const { message, history = [], context = "" } = req.body;
  
  try {
    const sapoAlias = process.env.SAPO_STORE_ALIAS; 
    const sapoToken = process.env.SAPO_API_SECRET; 

    // 1. TÌM KIẾM SẢN PHẨM TỪ KHO SAPO (Dùng query để tìm rộng, dễ ra kết quả hơn)
    const searchUrl = `https://${sapoAlias}.mysapo.net/admin/products.json?query=${encodeURIComponent(message)}&limit=5`;
    
    const sapoRes = await fetch(searchUrl, { 
      headers: { 
        "X-Sapo-Access-Token": sapoToken, 
        "Content-Type": "application/json" 
      } 
    });

    const sapoData = await sapoRes.json();
    let productContext = "";

    if (sapoData.products && sapoData.products.length > 0) {
      productContext = "DỮ LIỆU KHO HÀNG THẬT TẠI RONA (DÙNG ĐỂ BÁO GIÁ):\\n" + sapoData.products.map(p => {
        const price = (p.variants && p.variants[0] && Number(p.variants[0].price) > 0) 
                      ? Number(p.variants[0].price).toLocaleString('vi-VN') + "đ" 
                      : "Liên hệ";
        return `- ${p.title}: ${price}. Link: https://lyuongruouvang.com/products/${p.handle}`;
      }).join("\\n");
    } else {
      productContext = "Hiện tại không tìm thấy sản phẩm này trong kho nhanh.";
    }

    // 2. THIẾT LẬP LỜI THOẠI ĐẲNG CẤP CHO HƯƠNG LAN
    const finalSystemPrompt = `Bạn là Hương Lan - Chuyên gia Sommelier tư vấn pha lê cao cấp RONA.
    NHIỆM VỤ: Tư vấn các dòng ly vang, bình thở pha lê Bohemia và Rona.
    
    NGỮ CẢNH TRANG WEB KHÁCH ĐANG XEM: ${context}
    DỮ LIỆU KHO HÀNG SAPO: ${productContext}
    
    QUY TẮC BẮT BUỘC:
    1. TUYỆT ĐỐI KHÔNG BỊA GIÁ. Chỉ báo giá và gửi link từ DỮ LIỆU KHO HÀNG bên trên.
    2. Nếu không thấy hàng, hãy mời khách xem bộ sưu tập tại: https://lyuongruouvang.com/collections/all
    3. Trả lời lịch sự, tinh tế, am hiểu sâu về văn hóa rượu vang.
    4. Trình bày: Tên sản phẩm - Giá - Link mua hàng.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: finalSystemPrompt },
        ...history, 
        { role: "user", content: message }
      ],
      temperature: 0.7
    });

    res.status(200).json({ reply: response.choices[0].message.content });

  } catch (error) { 
    console.error("Lỗi Vercel:", error);
    res.status(500).json({ reply: "Duy ơi, Hương Lan đang gặp chút sự cố kết nối, sếp chờ em 1 phút nhé!" }); 
  }
});

module.exports = app;
