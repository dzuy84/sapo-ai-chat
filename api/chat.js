export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Chỉ hỗ trợ POST" });
  }

  try {
    // ✅ FIX TRIỆT ĐỂ req.body = undefined
    const buffers = [];

    for await (const chunk of req) {
      buffers.push(chunk);
    }

    const rawBody = Buffer.concat(buffers).toString();

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      return res.status(400).json({
        error: "Body không phải JSON hợp lệ",
        raw: rawBody,
      });
    }

    const message = body.message;

    if (!message) {
      return res.status(400).json({ error: "Thiếu message" });
    }

    // Gọi OpenAI API
    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "Bạn là nhân viên tư vấn bán ly rượu vang RONA, trả lời ngắn gọn, dễ hiểu, có chốt sale nhẹ.",
            },
            {
              role: "user",
              content: message,
            },
          ],
        }),
      }
    );

    const data = await response.json();

    return res.status(200).json({
      reply: data.choices?.[0]?.message?.content || "Không có phản hồi",
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message,
    });
  }
}
