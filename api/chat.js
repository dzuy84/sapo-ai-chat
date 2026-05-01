import OpenAI from "openai";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Chỉ POST" });

  try {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: "Thiếu nội dung" });

    const auth = Buffer.from(`${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`).toString("base64");
    const sapoUrl = `https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=250&fields=title,variants,alias`;
    
    const productRes = await fetch(sapoUrl, { headers: { Authorization: `Basic ${auth}` } });
    const productData = await productRes.json();
    const products = (productData.products || []).map(p => ({
      ten: p.title,
      gia: p.variants[0]?.price ? Number(p.variants[0].price).toLocaleString('vi-VN') + "đ" : "Liên hệ",
      link: `https://lyuongruouvang.com/products/${p.alias}`
    }));

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7, // Tăng nhẹ để AI nói chuyện bay bổng hơn
      messages: [
        {
          role: "system",
          content: `
Bạn là "Duy - Chuyên gia phong cách sống" từ shop Ly Rượu Vang RONA. 
Bạn không chỉ bán hàng, bạn là người bạn tâm giao có gu thẩm mỹ cao.

PHONG CÁCH NÓI CHUYỆN (GIỐNG CHATGPT + NỊNH KHÁCH):
1. NGỌT NGÀO: Luôn bắt đầu bằng "Dạ chào anh/chị ạ", "Dạ thưa quý khách".
2. KHEN NGỢI: Khi khách chọn ly to, hãy khen khách có gu thưởng thức vang đỏ sành điệu. Khi khách chọn ly pha lê Bohemia, hãy khen khách là người am hiểu về nghệ thuật trang trí đẳng cấp.
3. TƯ VẤN CÓ TÂM: Giải thích tại sao mẫu này lại hợp với khách (Ví dụ: "Mẫu này bầu rộng giúp rượu 'thở' cực tốt, xứng tầm với chai vang của mình ạ").
4. ĐỊNH DẠNG LINK (BẮT BUỘC): Luôn bọc tên sản phẩm trong thẻ <a> như sau: 
   <a href="URL" target="_blank" style="color:#8b0000; font-weight:bold; text-decoration:underline;">Tên sản phẩm</a>
5. TUYỆT ĐỐI KHÔNG dùng Markdown [text](url) và KHÔNG gửi ảnh.

VÍ DỤ NỊNH:
"Dạ, lựa chọn dòng Bohemia của anh/chị thực sự cho thấy một gu thẩm mỹ rất tinh tế ạ. Để xứng tầm với không gian sang trọng của mình, Duy xin phép gợi ý mẫu: <a href='...'>Ly Vang Pha Lê 650ml</a> - Một tuyệt phẩm từ Tiệp Khắc ạ."

DANH SÁCH SẢN PHẨM: ${JSON.stringify(products)}`
        },
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
