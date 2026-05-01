import OpenAI from "openai";

export default async function handler(req, res) {
  // ================= 1. CẤU HÌNH CORS =================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Chỉ chấp nhận phương thức POST" });

  try {
    const { message } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: "Thiếu nội dung tin nhắn (message)" });
    }

    // ================= 2. LẤY DỮ LIỆU TỪ SAPO =================
    // Tạo mã xác thực từ API Key và API Secret trong biến môi trường
    const auth = Buffer.from(
      `${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`
    ).toString("base64");

    // Gọi API Sapo (Sử dụng domain .mysapo.net để đảm bảo quyền Admin)
    const sapoUrl = `https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=250&fields=title,variants,alias`;
    
    const productRes = await fetch(sapoUrl, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json"
      }
    });

    if (!productRes.ok) {
      const errorText = await productRes.text();
      throw new Error(`Lỗi kết nối Sapo (${productRes.status}): ${errorText}`);
    }

    const productData = await productRes.json();
    const rawProducts = productData.products || [];

    // Tối ưu hóa dữ liệu để gửi cho AI (giảm tiêu tốn Token)
    const productsForAI = rawProducts.map(p => ({
      ten: p.title,
      gia: p.variants[0]?.price,
      link: `https://lyuongruouvang.com/products/${p.alias}`
    }));

    // ================= 3. GỬI CHO OPENAI (GPT-4o-mini) =================
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3, // Thấp để AI trả lời chính xác, không sáng tạo quá mức
      messages: [
        {
          role: "system",
          content: `
Bạn là chuyên viên tư vấn khách hàng của shop "Ly Rượu Vang RONA".
Nhiệm vụ: Dựa vào danh sách sản phẩm bên dưới để tư vấn cho khách.

QUY TẮC BẮT BUỘC:
1. Chỉ tư vấn sản phẩm CÓ TRONG DANH SÁCH.
2. Nếu không thấy sản phẩm khách cần, hãy xin lỗi lịch sự và đề xuất khách để lại số điện thoại hoặc xem các mẫu tương tự.
3. Câu trả lời ngắn gọn, chuyên nghiệp, thân thiện.
4. Khi gửi tên sản phẩm, hãy kèm theo giá và đường link để khách nhấn vào xem.

DANH SÁCH SẢN PHẨM THỰC TẾ TỪ CỬA HÀNG:
${JSON.stringify(productsForAI)}
`
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    // ================= 4. TRẢ KẾT QUẢ =================
    return res.status(200).json({
      reply: completion.choices[0].message.content,
      count: productsForAI.length, // Trả về số lượng để bạn dễ kiểm tra
      success: true
    });

  } catch (err) {
    console.error("API ERROR LOG:", err.message);
    return res.status(500).json({
      error: "Đã xảy ra lỗi hệ thống",
      detail: err.message
    });
  }
}
