const express = require('express');
const cors = require('cors');
const { OpenAI } = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/chat', async (req, res) => {
  // Sếp thêm cái "context" vào đây để nhận dữ liệu từ website gửi sang
  const { message, history = [], context = "" } = req.body;
  
  try {
    const sapoAlias = process.env.SAPO_STORE_ALIAS; 
    const sapoToken = process.env.SAPO_API_SECRET; 

    // 1. Tìm sản phẩm trong kho Sapo dựa trên tin nhắn của khách
    const sapoRes = await fetch(
      `https://${sapoAlias}.mysapo.net/admin/products/search.json?query=${encodeURIComponent(message)}&limit=3`,
      { headers: { "X-Sapo-Access-Token": sapoToken, "Content-Type": "application/json" } }
    );
    const sapoData = await sapoRes.json();
    let productContext = "";

    if (sapoData.products && sapoData.products.length > 0) {
      productContext = "DỮ LIỆU KHO RONA (ƯU TIÊN):\\n" + sapoData.products.map(p => 
        `- ${p.title}: ${Number(p.variants[0].price).toLocaleString('vi-VN')}đ. Link: https://lyuongruouvang.com/products/${p.handle}`
      ).join("\\n");
    } else {
      productContext = "Không tìm thấy trong tìm kiếm nhanh. Hãy kiểm tra thông tin trang hiện tại.";
    }

    // 2. Kết hợp với thông tin sản phẩm khách đang xem (Context từ web gửi sang)
    const finalSystemPrompt = `Bạn là Hương Lan - Chuyên gia Sommelier của RONA.
    NHIỆM VỤ: Tư vấn đẳng cấp về pha lê Bohemia và Rona.
    
    NGỮ CẢNH TRANG HIỆN TẠI: ${context}
    
    DỮ LIỆU KHO HÀNG: ${productContext}
    
    QUY TẮC:
    1. Chỉ dùng Link và Giá từ dữ liệu thật phía trên. Không tự bịa link.
    2. Nếu khách hỏi về sản phẩm họ đang xem (trong Ngữ cảnh trang), hãy tư vấn sâu dựa trên mô tả đó.
    3. Nếu không có hàng, dẫn khách về: https://lyuongruouvang.com/collections/all`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: finalSystemPrompt },
        ...history, 
        { role: "user", content: message }
      ],
    });

    res.json({ reply: response.choices[0].message.content });
  } catch (error) { 
    console.error("Lỗi:", error);
    res.status(500).json({ reply: "Hương Lan đang kiểm tra lại kho, Duy chờ em tí nhé!" }); 
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server RONA chạy tại port ${PORT}`));
