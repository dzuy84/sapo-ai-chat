import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  try {
    const { message } = req.body;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Bạn là nhân viên tư vấn bán ly rượu vang RONA. Trả lời ngắn gọn, dễ hiểu, có gợi ý mua hàng."
        },
        {
          role: "user",
          content: message
        }
      ],
    });

    res.status(200).json({
      reply: completion.choices[0].message.content
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
