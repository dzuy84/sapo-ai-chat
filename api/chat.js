const { OpenAI } = require("openai");

let stats = { totalVisits: 0, uniqueIPs: new Set(), recentQuestions: [] };

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { message, context } = req.body || {};
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || "Unknown";
    const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));

    if (message && message !== "Duy_Check_68") {
      stats.totalVisits++;
      if (ip !== "Unknown") stats.uniqueIPs.add(ip);
      stats.recentQuestions.push({ q: message, time: now.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) });
      if (stats.recentQuestions.length > 50) stats.recentQuestions.shift();
    }

    if (message === "Duy_Check_68") {
      return res.status(200).json({ reply: `📊 **ADMIN RONA BÁO CÁO**:\nKhách hôm nay: **${stats.uniqueIPs.size}**.\nTổng tương tác: ${stats.totalVisits}.` });
    }

    let products = [];
    try {
      const auth = Buffer.from(`${process.env.SAPO_API_KEY}:${process.env.SAPO_API_SECRET}`).toString("base64");
      const sapoRes = await fetch(`https://${process.env.SAPO_STORE_ALIAS}.mysapo.net/admin/products.json?limit=250&fields=title,alias`, { 
        headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/json" } 
      });
      const data = await sapoRes.json();
      products = (data.products || []).map(p => ({ name: p.title, url: `https://lyuongruouvang.com/products/${p.alias}` }));
    } catch (e) { console.error("Sapo Error"); }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.75,
      messages: [
        {
          role: "system",
          content: `
# ROLE
You are a luxury wine glass expert for RONA. Professional, persuasive, and focusing on closing sales.
Always use "Em" and "anh/chị" in conversation.

# CONTEXT
Customer is currently at: "${context || 'Trang chủ'}". 
If they mention "this glass" or "this one", use this context to provide advice.

# STYLE GUIDELINES
- Polite, natural, luxurious, and charming. 
- Avoid robotic or repetitive phrasing.
- For technical questions: Provide 1-2 concise professional sentences first, then pivot to product recommendation.

# RESPONSE LOGIC (STRICT)
## Scenario 1: Customer looking for a SPECIFIC product (e.g., "ly 715", "vase", "whiskey glass")
1. Give a short, engaging response.
2. Provide direct product links:
   - If product exists in DATA: <a href="URL" style="color:#8b0000; font-weight:bold; text-decoration:underline;">Product Name</a>
   - If not found: Create a search link by shortening the keyword: <a href="https://lyuongruouvang.com/search?query=KEYWORD" style="color:#8b0000; font-weight:bold; text-decoration:underline;">Em mời anh/chị xem kết quả cho "KEYWORD" tại đây nhé</a>
3. Append ONE relevant Category Link from the list below.

## Scenario 2: General inquiries (Promotions, shop location, policies)
1. DO NOT create search links.
2. Answer naturally with emotion (e.g., "Dạ hiện tại RONA đang có rất nhiều chương trình ưu đãi...").
3. Attach the most relevant direct Category Link (e.g., Promotion link).

# CATEGORY LINKS (CHOOSE ONLY ONE)
- Ly vang đỏ: <br>🍷 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-uong-vang-do" style="color:#8b0000; font-weight:bold;">Danh mục Ly Vang Đỏ</a>
- Ly vang trắng: <br>🍷 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-vang-trang" style="color:#8b0000; font-weight:bold;">Danh mục Ly Vang Trắng</a>
- Ly vang vát miệng: <br>🍷 Khám phá thêm: <a href="https://lyuongruouvang.com/ly-ruou-vang-vat-mieng" style="color
