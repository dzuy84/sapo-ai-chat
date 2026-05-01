import OpenAI from "openai";

let stats = {
  totalVisits: 0,
  uniqueIPs: new Set(),
  recentQuestions: []
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Chỉ POST" });

  try {
    const { message, context, ip } = req.body || {};
    
    // GHI CHÉP BÍ MẬT
    stats.totalVisits++;
    if (ip && ip !== "Không xác định") stats.uniqueIPs.add(ip);
    if (message && message !== "Duy_Check_68") {
        stats.recentQuestions.push({ 
          q: message, 
          time: new Date().toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}), 
          page: context || "Trang chủ" 
        });
        if (stats.recentQuestions.length > 15) stats.recentQuestions.shift();
    }

    // BÁO CÁO ADMIN
    if (message === "Duy_Check_68") {
      let locationInfo = "Không rõ vị trí";
      try {
        const locRes = await fetch(`https://ipapi.co/${ip}/json/`);
        const locData = await locRes.json();
        if(locData.city) locationInfo = `${locData.city}, ${locData.region}`;
      } catch (e) {}

      const questionList = stats.recentQuestions.map(item => `• [${item.time}] ${item.q}\n  └ Tại: ${item.page}`).join("\n\n");

      return res.status(200).json({ 
        reply: `📊 **BÁO CÁO ADMIN RONA**\n\n🔹 **Lượt chat:** ${stats.totalVisits}\n🔹 **Khách (IP):** ${stats.uniqueIPs.size}\n📍 **Vị trí khách:** ${locationInfo}\n\n❓ **CÂU HỎI GẦN ĐÂY:**\n${questionList || "_Chưa có khách hỏi._"}`
      });
    }

    // LOGIC TƯ VẤN (ÉP ĐỊNH DẠNG LINK)
    const auth = Buffer.from(`${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`).toString("base64");
    const shop = process.env.SAPO_STORE_ALIAS;
    const sapoRes = await fetch(`https://${shop}.mysapo.net/admin/products.json?limit=250&fields=title,variants,alias`, { headers: { Authorization: `Basic ${auth}` } });
    const data = await sapoRes.json();
    const products = (data.products || []).map(p => ({
      name: p.title,
      price: p.variants?.[0]?.price ? Number(p.variants[0].price).toLocaleString("vi-VN") + "đ" : "Liên hệ",
      url: `https://lyuongruouvang.com/products/${p.alias}`
    }));

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", 
      temperature: 0.3, // Giảm temperature để AI bớt "sáng tạo" linh tinh
      messages: [
        {
          role: "system",
          content: `Bạn là Le Dzuy - Sommelier tại RONA. 
          QUY TẮC CỰC KỲ QUAN TRỌNG:
          1. KHÔNG dùng Markdown [text](url). 
          2. Link sản phẩm BẮT BUỘC dùng thẻ HTML: <a href="URL" style="color:#8b0000;font-weight:bold;text-decoration:underline;">Tên sản phẩm</a>
          3. Không dùng target="_blank".
          4. Tư vấn nịnh khách, đẳng cấp. 
          DANH SÁCH: ${JSON.stringify(products)}`
        },
        { role: "user", content: `(Trang khách xem: ${context}) - Khách hỏi: ${message}` }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    return res.status(200).json({ reply: "Dạ Duy đây, kết nối hơi chậm tí, mình nhắn lại giúp Duy nhé!" });
  }
}
