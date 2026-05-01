import OpenAI from "openai";

// Bộ nhớ tạm để lưu số liệu trong ngày
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
    
    // Lưu câu hỏi khách (loại trừ mật mã của Duy)
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
      // Lấy thông tin vị trí từ IP (Dùng dịch vụ miễn phí của ip-api)
      let locationInfo = "Đang xác định...";
      try {
        const locRes = await fetch(`http://ip-api.com/json/${ip}?fields=city,regionName`);
        const locData = await locRes.json();
        if(locData.city) locationInfo = `${locData.city}, ${locData.regionName}`;
      } catch (e) { locationInfo = "Chưa rõ vị trí"; }

      const questionList = stats.recentQuestions.map(item => `• [${item.time}] ${item.q}\n  └ Tại: ${item.page}`).join("\n\n");

      return res.status(200).json({ 
        reply: `📊 **BÁO CÁO QUẢN TRỊ RONA** 📊\n\n` +
               `🔹 **Tổng lượt chat:** ${stats.totalVisits}\n` +
               `🔹 **Khách (IP) duy nhất:** ${stats.uniqueIPs.size}\n` +
               `📍 **Vị trí của Duy:** ${locationInfo}\n` +
               `🌐 **IP hiện tại:** ${ip}\n\n` +
               `❓ **CÂU HỎI GẦN ĐÂY:**\n${questionList || "_Đang chờ khách đầu tiên..._"}\n\n` +
               `---------------------------\n` +
               `💡 *Dữ liệu sẽ reset khi hệ thống tạm nghỉ.*`
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

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_
