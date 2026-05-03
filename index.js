const express = require('express');
const cors = require('cors');
const { OpenAI } = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/chat', async (req, res) => {
  const { message, history = [], context = "" } = req.body;
  
  try {
    const sapoAlias = process.env.SAPO_STORE_ALIAS; 
    const sapoToken = process.env.SAPO_API_SECRET; 

    // 1. GỌI API SAPO - DÙNG QUERY ĐỂ TÌM KIẾM RỘNG (DỄ RA KẾT QUẢ HƠN)
    const searchUrl = `https://${sapoAlias}.mysapo.net/admin/products.json?query=${encodeURIComponent(message)}&limit=5`;
    
    console.log("Đang gọi Sapo tại:", searchUrl); // Để Duy xem trong Logs Render

    const sapoRes = await fetch(searchUrl, { 
      headers: { 
        "X-Sapo-Access-Token": sapoToken, 
        "Content-Type": "application/json" 
      } 
    });

    const sapoData = await sapoRes.json();
    let productContext = "";

    // Kiểm tra nếu có sản phẩm trả về
    if (sapoData.products && sapoData.products.length > 0) {
      productContext = "DANH SÁCH SẢN PHẨM THẬT TẠI KHO RONA:\\n" + sapoData.products.map(p => {
        // Lấy giá của phiên bản đầu tiên, nếu không có thì báo Liên hệ
        const price = (p.variants && p.variants[0] && p.variants[0].price > 0) 
                      ? Number(p.variants[0].price).toLocaleString('vi-VN') + "đ" 
                      : "Liên hệ";
        return `- ${p.title}: ${price}. Link: https://lyuongruouvang.com/products/${p.handle}`;
      }).join("\\n");
      console.log("Đã tìm thấy sản phẩm từ Sapo.");
    } else {
      productContext = "KHÔNG tìm thấy sản phẩm nào khớp trong kho Sapo cho từ khóa này.";
      console.log("Sapo không trả về sản phẩm nào.");
    }

    // 2. THIẾT LẬP LỜI THOẠI CHO HƯƠNG LAN
    const finalSystemPrompt = `Bạn là Hương Lan - Chuyên gia tư vấn pha lê cao cấp của RONA (lyuongruouvang.com).
    
    DỮ LIỆU KHO HÀNG THỰC TẾ (CHỈ DÙNG DỮ LIỆU NÀY ĐỂ BÁO GIÁ):
    ${productContext}
    
    THÔNG TIN TRANG WEB KHÁCH ĐANG XEM:
    ${context}
    
    QUY TẮC BẮT BUỘC:
    1. Tuyệt đối KHÔNG tự bịa giá. Nếu trong dữ liệu kho báo "KHÔNG tìm thấy", hãy lịch sự mời khách xem tất cả mẫu tại: https://lyuongruouvang.com/collections/all
    2. Nếu khách hỏi về mẫu cụ thể, hãy tư vấn dựa trên Tên, Giá và gửi kèm Link sản phẩm đó.
    3. Trả lời chuyên nghiệp, am hiểu về rượu vang và ly pha lê Bohemia, Rona.
    4. Không nhắc đến các mã code hay thuật ngữ kỹ thuật với khách hàng.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: finalSystemPrompt },
        ...history, 
        { role: "user", content: message }
      ],
      temperature: 0.7
    });

    res.json({ reply: response.choices[0].message.content });

  } catch (error) { 
    console.error("LỖI HỆ THỐNG:", error);
    res.status(500).json({ reply: "Duy ơi, em đang gặp chút vấn đề khi kết nối kho hàng, sếp đợi em 1 phút nhé!" }); 
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server RONA đã sẵn sàng trên port ${PORT}`));
