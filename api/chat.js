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

    if (message && message !== "Duy_Check_68") {
      stats.recentQuestions.push({ q: message, time: now.toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}) });
      if (stats.recentQuestions.length > 30) stats.recentQuestions.shift();
    }

    // LỌC SẢN PHẨM THÔNG MINH ĐỂ TIẾT KIỆM TOKEN
    let relevantProducts = [];
    try {
      const auth = Buffer.from(`${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`).toString("base64");
      const sapoRes = await fetch(`https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=150&fields=title,alias`, { headers: { Authorization: `Basic ${auth}` } });
      const data = await sapoRes.json();
      
      const keyword = (message || "").toLowerCase();
      relevantProducts = (data.products || [])
        .filter(p => keyword.split(' ').some(word => word.length > 1 && p.title.toLowerCase().includes(word)) || keyword.length < 3)
        .slice(0, 8) // Chỉ lấy 8 mẫu sát nhất
        .map(p => ({ n: p.title, u: `https://lyuongruouvang.com/products/${p.alias}` }));
    } catch (e) {}

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Vừa rẻ vừa nhanh
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `Bạn là Le Dzuy - Sommelier RONA. 
          1. Tư vấn đẳng cấp, KHÔNG dùng dấu sao (**).
          2. Link sản phẩm PHẢI dùng: <a href="u" style="color:#8b0000;font-weight:bold;text-decoration:underline;">n</a>.
          3. Link Zalo Duy: <a href="https://zalo.me/0963111234" style="color:#0068ff;font-weight:bold;">Chat Zalo với Duy</a>.
          DANH SÁCH: ${JSON.stringify(relevantProducts)}`
        },
        { role: "user", content: `Khách đang xem: ${context}. Câu hỏi: ${message}` }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    return res.status(200).json({ reply: "Duy bận tí, sếp nhắn Zalo Duy nhé!" });
  }
}

// Hàm gửi mail (Duy giữ nguyên phần sendReportEmail bên dưới code cũ của Duy nhé)
