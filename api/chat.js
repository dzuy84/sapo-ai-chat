import OpenAI from "openai";
import nodemailer from "nodemailer";

let stats = { totalVisits: 0, uniqueIPs: new Set(), recentQuestions: [], lastEmailSentDay: null };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { message, context, ip } = req.body || {};
    const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
    const today = now.toLocaleDateString('vi-VN');

    // 1. GOM DỮ LIỆU BÁO CÁO (Tốn rất ít token)
    if (message && message !== "Duy_Check_68") {
      stats.recentQuestions.push({ q: message, time: now.toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}) });
      if (stats.recentQuestions.length > 30) stats.recentQuestions.shift();
    }

    // 2. LẤY VÀ LỌC SẢN PHẨM (Để tiết kiệm token)
    let relevantProducts = [];
    try {
      const auth = Buffer.from(`${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`).toString("base64");
      const sapoRes = await fetch(`https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=100&fields=title,alias`, { headers: { Authorization: `Basic ${auth}` } });
      const data = await sapoRes.json();
      
      // CHỈ lấy sản phẩm có tên khớp với từ khóa khách hỏi (Ví dụ: khách hỏi "ly vang" thì chỉ lấy ly vang)
      const keyword = message.toLowerCase();
      relevantProducts = (data.products || [])
        .filter(p => keyword.split(' ').some(word => p.title.toLowerCase().includes(word)) || keyword.length < 3)
        .slice(0, 10) // Chỉ gửi tối đa 10 sản phẩm liên quan nhất cho AI
        .map(p => ({ n: p.title, u: `https://lyuongruouvang.com/products/${p.alias}` }));
    } catch (e) {}

    if (message === "Duy_Check_68") return res.status(200).json({ reply: `📊 Khách: ${stats.recentQuestions.length}.` });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Dùng bản mini: Rẻ hơn 10 lần mà vẫn rất thông minh cho việc tư vấn
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `Bạn là Sommelier Le Dzuy. Tư vấn pha lê RONA. 
          - Dùng thẻ <a> cho link: <a href="u" style="color:#8b0000;font-weight:bold;">n</a>.
          - Zalo: <a href="https://zalo.me/0963111234" style="color:#0068ff;font-weight:bold;">Chat Zalo</a>.
          SP GỢI Ý: ${JSON.stringify(relevantProducts)}`
        },
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    return res.status(200).json({ reply: "Duy bận tí, nhắn Zalo Duy nhé!" });
  }
}
// ... (Hàm gửi mail giữ nguyên như cũ)
