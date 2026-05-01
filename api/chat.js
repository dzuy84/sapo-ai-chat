import OpenAI from "openai";

// Bộ nhớ tạm trong ngày
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
    if (!message) return res.status(400).json({ error: "Thiếu nội dung" });

    // --- GHI CHÉP BÍ MẬT ---
    stats.totalVisits++;
    if (ip && ip !== "Không xác định") stats.uniqueIPs.add(ip);
    
    if (message && message !== "Duy_Check_68") {
        stats.recentQuestions.push({ 
          q: message, 
          time: new Date().toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}), 
          page: context || "Trang chủ" 
        });
        if (stats.recentQuestions.length > 10) stats.recentQuestions.shift();
    }

    // --- KIỂM TRA MẬT MÃ ADMIN ---
    if (message === "Duy_Check_68") {
      let locationInfo = "Không rõ vị trí";
      try {
        // Dùng API hỗ trợ HTTPS để không bị chặn
        const locRes = await fetch(`https://ipapi.co/${ip}/json/`);
        const locData = await locRes.json();
        if(locData.city) locationInfo = `${locData.city}, ${locData.region}`;
      } catch (e) { console.log("Lỗi lấy vị trí"); }

      const questionList = stats.recentQuestions.map(item => `• [${item.time}] ${item.q}\n  └ Tại: ${item.page}`).join("\n\n");

      return res.status(200).json({ 
        reply: `📊 **BÁO CÁO ADMIN RONA** 📊\n\n` +
               `🔹 **Lượt chat:** ${stats.totalVisits}\n` +
               `🔹 **Khách (IP):** ${stats.uniqueIPs.size}\n` +
               `📍 **Vị trí khách:** ${locationInfo}\n\n` +
               `❓ **CÂU HỎI GẦN ĐÂY:**\n${questionList || "_Chưa có khách hỏi._"}\n\n` +
               `---------------------------\n` +
               `💡 *Dữ liệu sẽ reset khi Vercel nghỉ ngơi.*`
      });
    }

    // --- LOGIC TƯ VẤN BÁN HÀNG ---
    const auth = Buffer.from(`${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`).toString("base64");
    const shop = process.env.SAPO_STORE_ALIAS;

    const sapoRes = await fetch(
      `https://${shop}.mysapo.net/admin/products.json?limit=250&fields=title,variants,alias,product_type,tags`,
      { headers: { Authorization: `Basic ${auth}` } }
    );

    const data = await sapoRes.json();
    const products = (data.products || []).map(p => ({
      name: p.title,
      price: p.variants?.[0]?.price ? Number(p.variants[0].price).toLocaleString("vi-VN") + "đ" : "Liên hệ",
      url: `https://lyuongruouvang.com/products/${p.alias}`
    }));

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o", 
      temperature: 0.6, 
      messages: [
        {
          role: "system",
          content: `Bạn là Le Dzuy - Sommelier tại RONA. Tư vấn nịnh khách, link không dùng target_blank. Danh sách sản phẩm: ${JSON.stringify(products)}`
        },
        { role: "user", content: `(Khách xem: ${context}) - Hỏi: ${message}` }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    console.error(err);
    return res.status(200).json({ reply: "Dạ Duy đang bận tí, mình nhắn lại giúp Duy nhé!" });
  }
}
