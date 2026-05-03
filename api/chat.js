const { OpenAI } = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

module.exports = async (req, res) => {
  // CORS - Giúp chat chạy trên web lyuongruouvang.com không bị chặn
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { message, history = [] } = req.body;

  try {
    const sapoAlias = process.env.SAPO_STORE_ALIAS; // ly-uong-ruou-vang
    const sapoToken = process.env.SAPO_API_SECRET; // Mã token 07c03d...

    let productContext = "";
    try {
      // Tìm kiếm sản phẩm (Search API của Sapo ổn định hơn tìm theo Title)
      const sapoRes = await fetch(
        `https://${sapoAlias}.mysapo.net/admin/products/search.json?query=${encodeURIComponent(message)}&limit=3`,
        {
          headers: {
            "X-Sapo-Access-Token": sapoToken,
            "Content-Type": "application/json"
          }
        }
      );
      const sapoData = await sapoRes.json();

      if (sapoData.products && sapoData.products.length > 0) {
        productContext = "DỮ LIỆU KHO HÀNG THẬT (PHẢI DÙNG GIÁ VÀ LINK NÀY):\\n" + 
          sapoData.products.map(p => {
            const price = p.variants[0]?.price ? Number(p.variants[0].price).toLocaleString("vi-VN") + "đ" : "Liên hệ";
            return `- ${p.title}\\n  Giá: ${price}\\n  Link: https://lyuongruouvang.com/products/${p.handle}`;
          }).join("\\n\\n");
      } else {
        productContext = "KHÔNG TÌM THẤY SẢN PHẨM. Chỉ được phép dẫn khách về: https://lyuongruouvang.com/collections/all";
      }
    } catch (e) {
      productContext = "Lỗi kết nối kho. Dẫn khách về trang chủ: https://lyuongruouvang.com";
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: `Bạn là Hương Lan - chuyên gia tư vấn pha lê RONA. 
          QUY TẮC: Chỉ được dùng thông tin sản phẩm trong dữ liệu sau: ${productContext}. 
          Nếu dữ liệu ghi 'Không tìm thấy', tuyệt đối không được tự bịa tên ly hay giá tiền.` 
        },
        ...history,
        { role: "user", content: message },
      ],
    });

    res.status(200).json({ reply: response.choices[0].message.content });

  } catch (error) {
    res.status(500).json({ reply: "Hương Lan đang cập nhật kho hàng, Duy chờ em tí nhé!" });
  }
};
