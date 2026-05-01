import OpenAI from "openai";

export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Chỉ hỗ trợ POST" });

  try {

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const body = req.body || {};
    const message = body.message;
    const history = body.history || [];

    if (!message) {
      return res.status(400).json({ error: "Thiếu message" });
    }

    const messages = [

      // 🎯 SYSTEM (định hình AI)
      {
        role: "system",
        content: `
Bạn là nhân viên bán hàng chuyên nghiệp cho shop ly rượu vang RONA tại Việt Nam.

QUY TẮC:
- Trả lời tiếng Việt tự nhiên
- Không lặp câu hỏi
- Hiểu ngữ cảnh hội thoại
- Khi khách nói "có / ok / loại nào cũng được" → tự gợi ý sản phẩm cụ thể
- Luôn tư vấn 1–3 lựa chọn rõ ràng
- Hướng tới chốt đơn nhẹ nhàng
`
      },

      // 🧠 HISTORY (giúp AI nhớ chat)
      ...history,

      // 👤 câu mới nhất
      {
        role: "user",
        content: message
      }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7
    });

    return res.status(200).json({
      reply: completion.choices[0].message.content
    });

  } catch (err) {
    console.log(err);
    return res.status(500).json({
      error: err.message
    });
  }
}
