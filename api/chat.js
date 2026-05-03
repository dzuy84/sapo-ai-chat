import OpenAI from "openai";
import nodemailer from "nodemailer";

let stats = { totalVisits: 0, uniqueIPs: new Set(), recentQuestions: [], lastEmailSentDay: null };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { message, history, context, ip } = req.body || {}; 
    const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
    const today = now.toLocaleDateString('vi-VN');
    const currentHour = now.getHours();

    if (message && message !== "111234") {
      stats.totalVisits++;
      if (ip) stats.uniqueIPs.add(ip);
      stats.recentQuestions.push({ q: message, time: now.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) });
    }

    if (currentHour >= 22 && stats.lastEmailSentDay !== today && stats.recentQuestions.length > 0) {
      stats.lastEmailSentDay = today; 
      sendReportEmail(stats, today).catch(e => {});
    }

    // ===============================
    // 🔥 GỌI SAPO API TÌM SẢN PHẨM
    // ===============================

    let productHTML = "";
    let searchLink = "";

    if (message) {
      const keyword = message.toLowerCase();

      // link search web
      searchLink = `https://lyuongruouvang.com/search?query=${encodeURIComponent(keyword)}`;

      try {
        const response = await fetch(
          `https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=5&title=${encodeURIComponent(keyword)}`,
          {
            headers: {
              Authorization:
                "Basic " +
                Buffer.from(
                  `${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`
                ).toString("base64"),
            },
          }
        );

        const data = await response.json();

        if (data.products && data.products.length > 0) {
          const items = data.products.slice(0, 5);

          productHTML =
            "<br/><b>🔎 Sản phẩm phù hợp:</b><br/>" +
            items.map(p => 
              `👉 <a href="https://lyuongruouvang.com/products/${p.handle}" target="_blank">${p.title}</a>`
            ).join("<br/>");
        }
      } catch (e) {
        console.log("Sapo API lỗi:", e);
      }
    }

    // ===============================
    // 🤖 GPT TRẢ LỜI NHƯ CŨ
    // ===============================

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1, 
      messages: [
        {
          role: "system",
          content: `Bạn là Hương Lan - Sommelier tại RONA.

Luôn ưu tiên hướng khách đến link sản phẩm.`
        },
        ...(history || []), 
        { role: "user", content: message }
      ]
    });

    let reply = completion.choices[0].message.content;

    // ===============================
    // 🎯 GẮN SEARCH + SẢN PHẨM
    // ===============================

    reply += `<br/><br/>👉 Xem tất cả tại đây:<br/>
    <a href="${searchLink}" target="_blank">${searchLink}</a>`;

    if (productHTML) {
      reply += `<br/>${productHTML}`;
    }

    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(200).json({ reply: "Hương Lan đang kiểm tra kho hàng, Duy nhắn Zalo để mình hỗ trợ ngay nhé!" });
  }
}

async function sendReportEmail(data, dateStr) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  let transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
  const listHtml = data.recentQuestions.map(i => `<li><b>[${i.time}]</b>: ${i.q}</li>`).join("");
  return transporter.sendMail({
    from: `"RONA AI Report" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: `[BÁO CÁO RONA] ${dateStr}`,
    html: `<div style="font-family:sans-serif; padding:20px; border:1px solid #8b0000; border-radius:10px;">
           <h2 style="color:#8b0000;">Tổng kết chat ngày ${dateStr}</h2>
           <p>Số khách IP khác nhau: <b>${data.uniqueIPs.size}</b></p>
           <hr><ul>${listHtml}</ul></div>`
  });
}
