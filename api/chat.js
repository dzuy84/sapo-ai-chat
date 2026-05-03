const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { message, history = [] } = req.body;

  try {
    const sapoAlias = process.env.SAPO_STORE_ALIAS;
    const sapoToken = process.env.SAPO_API_SECRET;

    let productContext = "";

    try {
      // Gọi API Sapo tìm sản phẩm theo tiêu đề
      const sapoRes = await fetch(
        `https://${sapoAlias}.mysapo.net/admin/products.json?limit=3&title=${encodeURIComponent(message)}`,
        {
          headers: {
            "X-Sapo-Access-Token": sapoToken,
            "Content-Type": "application/json",
          },
        }
      );

      const sapoData = await sapoRes.json();

      if (sapoData.products && sapoData.products.length > 0) {
        productContext = "DANH SÁCH SẢN PHẨM TỪ KHO RONA (BẮT BUỘC DÙNG LINK NÀY):\\n" +
          sapoData.products.map((p) => {
            const price = p.variants?.[0]?.price ? Number(p.variants[0].price).toLocaleString("vi-VN") + "đ" : "Liên hệ";
            return `- ${p.title}\\n  Giá: ${price}\\n  Link: https://lyuongruouvang.com/products/${p.handle}`;
          }).join("\\n\\n");
      } else {
        productContext = "Không tìm thấy sản phẩm cụ thể. Mời khách xem tại: https://lyuongruouvang.com/collections/all";
      }
    } catch (err) {
      productContext = "Lỗi kết nối kho Sapo. Dẫn khách về: https://lyuongruouvang.com";
    }

    const aiRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Bạn là Hương Lan - chuyên gia tư vấn của RONA. 
          QUY TẮC: 
          1. Chỉ được dùng giá và link từ dữ liệu này: ${productContext}. 
          2. KHÔNG TỰ CHẾ link tham khảo chung chung. 
          3. Nếu có link sản phẩm cụ thể, phải liệt kê ra ngay.`
        },
        ...history,
        { role: "user", content: message },
      ],
    });

    return res.status(200).json({ reply: aiRes.choices[0].message.content });
  } catch (error) {
    return res.status(500).json({ reply: "Hương Lan đang bận một chút, Duy đợi em tí nhé!" });
  }
};
