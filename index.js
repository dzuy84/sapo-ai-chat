
const express = require('express');
const cors = require('cors');
const { OpenAI } = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/chat', async (req, res) => {
  const { message, history = [] } = req.body;
  try {
    const sapoAlias = process.env.SAPO_STORE_ALIAS; 
    const sapoToken = process.env.SAPO_API_SECRET; 

    // Gọi API Sapo để lấy hàng thật
    const sapoRes = await fetch(
      `https://${sapoAlias}.mysapo.net/admin/products/search.json?query=${encodeURIComponent(message)}&limit=3`,
      { headers: { "X-Sapo-Access-Token": sapoToken, "Content-Type": "application/json" } }
    );
    const sapoData = await sapoRes.json();
    let productContext = "";

    if (sapoData.products?.length > 0) {
      productContext = "DỮ LIỆU KHO RONA:\\n" + sapoData.products.map(p => 
        `- ${p.title}: ${Number(p.variants[0].price).toLocaleString('vi-VN')}đ. Link: https://lyuongruouvang.com/products/${p.handle}`
      ).join("\\n");
    } else {
      productContext = "Không tìm thấy mẫu này, mời xem: https://lyuongruouvang.com/collections/all";
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `Bạn là Hương Lan RONA. CHỈ dùng link/giá từ đây: ${productContext}. Tuyệt đối không tự bịa.` },
        ...history, { role: "user", content: message }
      ],
    });
    res.json({ reply: response.choices[0].message.content });
  } catch (error) { res.status(500).json({ reply: "Duy chờ em tí nhé!" }); }
});

app.listen(process.env.PORT || 3000);
