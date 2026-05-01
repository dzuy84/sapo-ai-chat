import OpenAI from "openai";

export default async function handler(req, res) {

  // ===== CORS =====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Chỉ hỗ trợ POST" });
  }

  try {

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const body = req.body || {};
    const message = body.message;

    if (!message) {
      return res.status(400).json({ error: "Thiếu message" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Bạn là nhân viên tư vấn bán hàng chuyên nghiệp cho website ly rượu vang RONA tại Việt Nam.

Nhiệm vụ:
- Trả lời bằng tiếng Việt
- Ngắn gọn, dễ hiểu
- Tư vấn đúng sản phẩm ly rượu vang
- Gợi ý mua hàng nhẹ nhàng
- Luôn có hướng chốt đơn tự nhiên (ví dụ: "Bạn muốn mình tư vấn mẫu phù hợp không?")
- Không nói dài dòng
`
        },
        {
          role: "user",
          content: message
        }
      ],
      temperature: 0.7
    });

    return res.status(200).json({
      reply: completion.choices[0].message.content
    });

  } catch (err) {
    console.log("OPENAI ERROR:", err);

    return res.status(500).json({
      error: "Server error: " + err.message
    });
  }
}
