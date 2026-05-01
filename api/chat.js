export default async function handler(req, res) {
  // Chỉ cho phép POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Chỉ hỗ trợ POST" });
  }

  try {
    // Parse body an toàn (fix lỗi undefined req.body)
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const message = body?.message;

    if (!message) {
      return res.status(400).json({ error: "Thiếu message" });
    }

    // Gọi OpenAI API trực tiếp (KHÔNG cần SDK)
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
                "Bạn là nhân viên tư vấn bán ly rượu vang cao cấp thương hiệu RONA (Slovakia). Trả lời ngắn gọn, dễ hiểu, tập trung tư vấn sản phẩm và chốt sale nhẹ nhàng.",
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

    // xử lý lỗi từ OpenAI
    if (!data.choices || !data.choices[0]) {
      return res.status(500).json({
        error: "OpenAI không trả dữ liệu",
        detail: data,
      });
    }

    return res.status(200).json({
      reply: data.choices[0].message.content,
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message,
    });
  }
}
