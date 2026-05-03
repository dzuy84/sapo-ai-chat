import OpenAI from "openai";
import nodemailer from "nodemailer";

// ===== 🔥 ENV =====
const SAPO_TOKEN = process.env.SAPO_STOREFRONT_TOKEN;
const STORE = process.env.SAPO_STORE_ALIAS;

let stats = { totalVisits: 0, uniqueIPs: new Set(), recentQuestions: [], lastEmailSentDay: null };


// ===== 🔥 DETECT KEYWORD =====
function detectKeyword(msg) {
  msg = msg.toLowerCase();

  // bắt dung tích
  const match = msg.match(/(\d+)\s?(ml|l|cc)?/);
  if (match) {
    let val = parseFloat(match[1]);

    if (msg.includes("l") && val < 10) val = val * 1000;

    return Math.round(val) + "ml";
  }

  if (msg.includes("vang đỏ")) return "vang đỏ";
  if (msg.includes("vang trắng")) return "vang trắng";

  return null;
}


// ===== 🔥 SEARCH SAPO =====
async function searchProducts(keyword) {
  try {
    const res = await fetch(`https://${STORE}.com/api/storefront/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sapo-Storefront-Access-Token": SAPO_TOKEN
      },
      body: JSON.stringify({
        query: `
        {
          products(first: 5, query: "${keyword}") {
            edges {
              node {
                name
                handle
                images(first:1){ edges{ node{ src } } }
                variants(first:1){ edges{ node{ price } } }
              }
            }
          }
        }`
      })
    });

    const json = await res.json();

    return json.data.products.edges.map(p => ({
      name: p.node.name,
      url: "https://lyuongruouvang.com/products/" + p.node.handle,
      image: p.node.images.edges[0]?.node.src,
      price: p.node.variants.edges[0]?.node.price
    }));

  } catch (e) {
    console.log("Search error:", e);
    return [];
  }
}


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

    // ===== 🔥 SEARCH TRƯỚC =====
    const keyword = detectKeyword(message);
    if (keyword) {
      const products = await searchProducts(keyword);

      if (products.length > 0) {
        return res.status(200).json({
          action: "show_products",
          products
        });
      }
    }

    // ===== 🤖 AI FALLBACK =====
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1, 
      messages: [
        {
          role: "system",
          content: `Bạn là Hương Lan - Sommelier tại RONA (lyuongruouvang.com). Bạn là chuyên gia tư vấn pha lê Bohemia (Tiệp), Rona (Slovakia) và đồ sứ cao cấp.

KIẾN THỨC MẶC ĐỊNH:
- Luôn có các dòng 350ml, 450ml, 550ml, 650ml, 750ml, 850ml
- Luôn khẳng định có hàng

Nguyên tắc:
- Nếu không có dữ liệu sản phẩm → hướng dẫn khách bấm 🔍 tìm kiếm
- Luôn kèm link danh mục phù hợp
- Trả lời ngắn gọn, bán hàng, chuyên nghiệp`
        },
        ...(history || []), 
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    return res.status(200).json({ reply: "Hương Lan đang kiểm tra kho hàng, Duy nhắn Zalo để mình hỗ trợ ngay nhé!" });
  }
}


// ===== EMAIL REPORT =====
async function sendReportEmail(data, dateStr) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;

  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });

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
