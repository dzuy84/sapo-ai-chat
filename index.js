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

    // 1. Tối ưu tìm kiếm: Lấy top 5 sản phẩm mới nhất nếu tìm kiếm theo từ khóa không ra
    // Điều này giúp AI luôn có dữ liệu thật để "nhìn" vào
    const searchUrl = `https://${sapoAlias}.mysapo.net/admin/products.json?title=${encodeURIComponent(message)}&limit=5`;
    
    const sapoRes = await fetch(searchUrl, { 
      headers: { "X-Sapo-Access-Token": sapoToken, "Content-Type": "application/json" } 
    });
    const sapoData = await sapoRes.json();
    let productContext = "";

    if (sapoData.products && sapoData.products.length > 0) {
      productContext = "DANH SÁCH SẢN PHẨM THẬT TẠI KHO RONA:\\n" + sapoData.products.map(p => {
        const price = p.variants && p.variants[0] ? Number(p.variants[0].price).toLocaleString('vi-VN') : "Liên hệ";
        return `- ${p.title}: ${price}đ. Link: https://lyuongruouvang.com/products/${p.handle}`;
      }).join("\\n");
    } else {
      productContext = "Không tìm thấy sản phẩm khớp hoàn toàn trong tìm kiếm nhanh.";
    }

    // 2. Thiết lập tính cách Sommelier đẳng cấp cho Hương Lan
    const finalSystemPrompt = `Bạn là Hương Lan - Chuyên gia Sommelier tư vấn pha lê RONA.
    NHIỆM VỤ: Tư vấn các dòng ly vang, bình thở (decanter) Bohemia và Rona.
    
    DỮ LIỆU TỪ KHO HÀNG (DÙNG ĐỂ BÁO GIÁ):
    ${productContext}
    
    THÔNG TIN TRANG KHÁCH ĐANG XEM:
    ${context}
    
    QUY TẮC BẮT BUỘC:
    1. Tuyệt đối không được bịa giá (như 456k hay bất kỳ giá nào khác). Nếu không thấy giá trong dữ liệu kho, hãy nói "Duy hãy nhắn tin để em báo giá chính xác nhất".
    2. Nếu có sản phẩm trong kho, trình bày theo dạng: Tên sản phẩm - Giá - Link mua hàng.
    3. Trả lời lịch sự, tinh tế theo phong cách thưởng thức rượu vang cao cấp.
    4. Nếu khách hỏi chung chung, mời xem bộ sưu tập: https://lyuongruouvang.com/collections/all`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: finalSystemPrompt },
        ...history, 
        { role: "user", content: message }
      ],
      temperature: 0.7 // Giúp AI trả lời tự nhiên hơn
    });

    res.json({ reply: response.choices[0].message.content });
  } catch (error) { 
    console.error("Lỗi:", error);
    res.status(500).json({ reply: "Duy ơi, em đang kiểm tra lại kho một chút, sếp chờ em tí nhé!" }); 
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server RONA Live tại port ${PORT}`));
