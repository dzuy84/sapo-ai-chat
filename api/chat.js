const express = require('express');
const cors = require('cors');
const { OpenAI } = require("openai");
const nodemailer = require("nodemailer");

const app = express();
app.use(cors());
app.use(express.json());

// Biến lưu trữ thống kê tạm thời trên Vercel
let stats = { totalVisits: 0, uniqueIPs: new Set(), recentQuestions: [], lastEmailSentDay: null };

app.post('/api/chat', async (req, res) => {
  try {
    const { message, context } = req.body || {};
    
    // Tự động lấy IP của khách qua header của Vercel để đếm số khách
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || "Unknown";
    
    const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
    const today = now.toLocaleDateString('vi-VN');
    const currentHour = now.getHours();

    // Lưu lại lịch sử câu hỏi và IP nếu không phải lệnh Admin
    if (message && message !== "Duy_Check_68") {
      stats.totalVisits++;
      if (ip && ip !== "Unknown") stats.uniqueIPs.add(ip);
      stats.recentQuestions.push({ 
        q: message, 
        time: now.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) 
      });
      // Giữ lại 50 câu hỏi gần nhất để không tràn bộ nhớ
      if (stats.recentQuestions.length > 50) stats.recentQuestions.shift();
    }

    // Tự động gửi Email sau 22h
    if (currentHour >= 22 && stats.lastEmailSentDay !== today && stats.recentQuestions.length > 0) {
      stats.lastEmailSentDay = today; 
      sendReportEmail(stats, today).catch(e => { stats.lastEmailSentDay = null; });
    }

    // Mã bí mật dành riêng cho Sếp Duy kiểm tra
    if (message === "Duy_Check_68") {
      return res.status(200).json({ reply: `📊 **ADMIN RONA BÁO CÁO**:\nHôm nay đã tiếp **${stats.uniqueIPs.size}** khách.\nEmail chi tiết sẽ được tự động gửi sau 22h!` });
    }

    // Lấy dữ liệu sản phẩm từ Sapo (Dùng X-Sapo-Access-Token đã chạy ổn định từ trước)
    let products = [];
    try {
      const sapoAlias = process.env.SAPO_STORE_ALIAS; 
      const sapoToken = process.env.SAPO_API_SECRET; 
      
      const sapoRes = await fetch(`https://${sapoAlias}.mysapo.net/admin/products.json?limit=150&fields=title,variants,alias`, { 
        headers: { 
          "X-Sapo-Access-Token": sapoToken,
          "Content-Type": "application/json"
        } 
      });
      const data = await sapoRes.json();
      products = (data.products || []).map(p => ({ 
        name: p.title, 
        url: `https://lyuongruouvang.com/products/${p.alias}` 
      }));
    } catch (e) {
      console.error("Lỗi lấy Sapo:", e);
    }

    // Khởi tạo OpenAI với kịch bản siêu sale của sếp
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // Chạy model 4o cực thông minh
      temperature: 0.4, 
      messages: [
        {
          role: "system",
          content: `Bạn là Le Dzuy - Sommelier cao cấp tại RONA. 
          
          PHONG CÁCH TƯ VẤN:
          1. Ngôn ngữ sang trọng, lịch sự nhưng gần gũi (Dùng "Duy", "anh/chị").
          2. Kiến thức: Phải am hiểu về pha lê Bohemia (Tiệp Khắc) - nhắc đến độ trong suốt, tiếng vang và sự tinh xảo.
          3. Kịch bản bán hàng: 
             - Nếu khách hỏi về ly vang: Phân biệt ly Bordeaux (vang đậm) và Burgundy (vang thanh).
             - Nếu khách lo vỡ: Cam kết bảo hành 1 đổi 1 khi vận chuyển.
             - Nếu khách hỏi xuất xứ: Khẳng định 100% nhập khẩu từ Tiệp Khắc/Slovakia (CO/CQ đầy đủ).
          4. ĐỊNH DẠNG BẮT BUỘC:
             - PHẢI dùng thẻ <a> cho sản phẩm: <a href="URL" style="color:#8b0000; font-weight:bold; text-decoration:underline;">Tên Sản Phẩm</a>.
             - Luôn điều hướng về Zalo Duy: <a href="https://zalo.me/0963111234" style="color:#0068ff; font-weight:bold;">Chat Zalo với Duy ngay</a>.
          
          DANH SÁCH SẢN PHẨM HIỆN CÓ: ${JSON.stringify(products)}`
        },
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({ reply: completion.choices[0].message.content });

  } catch (err) {
    console.error("Lỗi Server:", err);
    return res.status(200).json({ reply: "Duy đang bận phục vụ rượu cho khách, anh/chị nhắn Zalo Duy để được tư vấn ngay nhé! <br><a href='https://zalo.me/0963111234' style='color:#0068ff; font-weight:bold;'>👉 Chat Zalo với Duy</a>" });
  }
});

// Hàm gửi Email báo cáo
async function sendReportEmail(data, dateStr) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  let transporter = nodemailer.createTransport({ 
    service: 'gmail', 
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } 
  });
  
  const listHtml = data.recentQuestions.map(i => `<li><b>[${i.time}]</b>: ${i.q}</li>`).join("");
  
  return transporter.sendMail({
    from: `"Trợ Lý RONA" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: `[BÁO CÁO RONA] Tổng kết ngày ${dateStr}`,
    html: `<div style="font-family:sans-serif; padding:20px; border:1px solid #8b0000; border-radius: 8px;">
           <h2 style="color:#8b0000;">Tổng kết tương tác ngày ${dateStr}</h2>
           <p style="font-size: 16px;">🔹 Số lượng khách (IP duy nhất) đã chat: <b style="color:#8b0000; font-size:18px;">${data.uniqueIPs.size}</b></p>
           <hr style="border: 0; border-top: 1px solid #eee;">
           <p><b>Nội dung khách hàng quan tâm:</b></p>
           <ul style="line-height: 1.6;">${listHtml}</ul>
           </div>`
  });
}

// Bắt buộc phải có dòng này để Vercel hiểu đây là file API
module.exports = app;
