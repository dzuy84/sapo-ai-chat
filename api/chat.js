import OpenAI from "openai";

// Bộ nhớ tạm để lưu số liệu (Sẽ reset khi Vercel ngủ, nhưng vẫn rất hữu ích để theo dõi trong ngày)
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

    // --- PHẦN GHI CHÉP BÍ MẬT ---
    stats.totalVisits++;
    if (ip) stats.uniqueIPs.add(ip);
    // Lưu lại 10 câu hỏi gần nhất của khách
    if (message && message !== "Duy_Check_68") {
        stats.recentQuestions.push({ q: message, time: new Date().toLocaleTimeString('vi-VN'), page: context });
        if (stats.recentQuestions.length > 10) stats.recentQuestions.shift();
    }

    // --- KIỂM TRA MẬT MÃ ADMIN ---
    if (message === "Duy_Check_68") {
      const questionList = stats.recentQuestions.map(item => `- [${item.time}] ${item.q} (tại: ${item.page})`).join("\n");
      return res.status(200).json({ 
        reply: `📊 **BÁO CÁO QUẢN TRỊ RONA** 📊\n\n` +
               `🔸 **Tổng lượt chat:** ${stats.totalVisits}\n` +
               `🔸 **Số khách (IP) duy nhất:** ${stats.uniqueIPs.size}\n` +
               `🔸 **IP của sếp hiện tại:** ${ip || "Ẩn"}\n\n` +
               `❓ **Các câu hỏi gần đây:**\n${questionList || "Chưa có dữ liệu khách hỏi."}\n\n` +
               `💡 *Dữ liệu này sẽ tự xóa nếu hệ thống không có người truy cập trong thời gian dài.*`
      });
    }

    // --- LOGIC TƯ VẤN BÁN HÀNG (GIỮ NGUYÊN) ---
    const auth = Buffer.from(`${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`).toString("base64");
    const shop = process.env.SAPO_STORE_ALIAS;

    const sapoRes = await fetch(
      `https://${shop}.mysapo.net/admin/products.json?limit=250&fields=title,variants,alias,product_type,tags`,
      { headers: { Authorization: `Basic ${auth}` } }
    );

    const data = await sapoRes.json();
    const products = (data.products || []).map(p => ({
      name: p.title,
      type: p.product_type,
      tags: p.tags,
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
          content: `Bạn là Le Dzuy - Chuyên gia Sommelier tại Pha Lê RONA. Tư vấn nịnh khách, link không dùng target_blank. Cấu trúc link: <a href="URL" style="color:#8b0000;font-weight:bold;text-decoration:underline;">Tên sản phẩm</a>. DANH SÁCH: ${JSON.stringify(products)}`
        },
        { role: "user", content: `(Khách xem: ${context}) - Câu hỏi: ${message}` }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
