import OpenAI from "openai";
import nodemailer from "nodemailer";

// Bộ nhớ tạm trong ngày (Sẽ reset khi Vercel nghỉ)
let stats = { totalVisits: 0, uniqueIPs: new Set(), recentQuestions: [], lastEmailSentDay: null };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { message, context, ip } = req.body || {};
    const today = new Date().toLocaleDateString('vi-VN');

    // 1. GHI CHÉP DỮ LIỆU BÍ MẬT
    stats.totalVisits++;
    if (ip && ip !== "Ẩn") stats.uniqueIPs.add(ip);
    if (message && message !== "Duy_Check_68") {
      stats.recentQuestions.push({ 
        q: message, 
        time: new Date().toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}), 
        page: context || "Trang chủ" 
      });
      if (stats.recentQuestions.length > 50) stats.recentQuestions.shift();
    }

    // 2. TỰ ĐỘNG GỬI MAIL BÁO CÁO LÚC 22H (HOẶC KHI CÓ TIN NHẮN SAU 22H)
    const currentHour = new Date().getHours();
    if (currentHour >= 22 && stats.lastEmailSentDay !== today && stats.recentQuestions.length > 0) {
      try {
        await sendReportEmail();
        stats.lastEmailSentDay = today;
      } catch (e) { console.error("Lỗi gửi mail:", e); }
    }

    // 3. MẬT MÃ ADMIN XEM NHANH TRÊN WEB
    if (message === "Duy_Check_68") {
      let loc = "Chưa rõ";
      try { const r = await fetch(`https://ipapi.co/${ip}/json/`); const d = await r.json(); loc = `${d.city}, ${d.region}`; } catch(e){}
      const qs = stats.recentQuestions.map(i => `• ${i.q}\n  └ ${i.page}`).join("\n");
      return res.status(200).json({ reply: `📊 **QUẢN TRỊ RONA**\n\n🔹 Chat: ${stats.totalVisits}\n🔹 Khách: ${stats.uniqueIPs.size}\n📍 Vị trí: ${loc}\n\n❓ **CÂU HỎI GẦN ĐÂY:**\n${qs || "Trống"}\n\n📧 *Báo cáo chi tiết đã được gửi vào Gmail của sếp!*` });
    }

    // 4. LOGIC BÁN HÀNG THÔNG MINH
    const auth = Buffer.from(`${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`).toString("base64");
    const sapoRes = await fetch(`https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=250&fields=title,variants,alias,product_type`, { headers: { Authorization: `Basic ${auth}` } });
    const data = await sapoRes.json();
    const products = data.products.map(p => ({ name: p.title, type: p.product_type, price: p.variants[0].price, url: `https://lyuongruouvang.com/products/${p.alias}` }));

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: `Bạn là Le Dzuy - Sommelier tại RONA. 
          1. Nếu khách hỏi mua/giao hàng, đưa link Zalo: <a href="https://zalo.me/0963111234" style="color:#0068ff;font-weight:bold;">Chat Zalo với Duy</a>.
          2. Tư vấn ly to cho vang đỏ, ly nhỏ cho vang trắng. Nịnh khách có gu.
          3. LUÔN gợi ý thêm 1 sản phẩm liên quan.
          4. Link HTML: <a href="URL" style="color:#8b0000;font-weight:bold;text-decoration:underline;">Tên sản phẩm</a>. Không dùng Markdown.
          DANH SÁCH: ${JSON.stringify(products)}`
        },
        { role: "user", content: `(Khách xem: ${context})
