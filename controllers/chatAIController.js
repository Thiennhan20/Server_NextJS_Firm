const axios = require('axios');

// Danh sách các model được duyệt từ ưu tiên cao nhất xuống thấp nhất
// Nếu model 1 lỗi/quá tải, nó tự động nhảy sang model 2, 3...
const GEMINI_MODELS = [
    'gemini-3.1-pro-preview',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
];

const generateResponse = async (req, res) => {
    try {
        const { messages, system } = req.body;
        
        if (!process.env.GEMINI_API_KEY) {
            return res.json({ reply: "Hệ thống AI chưa được nạp GEMINI_API_KEY trên Server!" });
        }

        // Đảo chuẩn định dạng OpenAI sang chuẩn Gemini
        const formattedContents = messages.map(msg => ({
            role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        let finalResponseText = null;
        let lastError = null;

        // Cơ chế Auto-Fallback: Thử từng Model trong danh sách
        for (const modelName of GEMINI_MODELS) {
            try {
                const response = await axios.post(
                    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`,
                    {
                        systemInstruction: { parts: [{ text: system || '' }] },
                        contents: formattedContents,
                    },
                    {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 15000 // Chờ tối đa 15 giây, nếu treo tự động chuyển model khác
                    }
                );

                const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                    finalResponseText = text;
                    console.log(`✅ [ChatAI] Gọi thành công model: ${modelName}`);
                    break; // Thoát vòng lặp ngay khi lấy được kết quả
                }
            } catch (err) {
                lastError = err;
                console.warn(`⚠️ [ChatAI] Bỏ qua ${modelName} (Lỗi HTTP ${err.response?.status || 'Timeout'}). Đang chuyển model...`);
                // Vòng lặp sẽ tiếp tục sang model kế tiếp
            }
        }

        // Kiểm tra kết quả cuối cùng
        if (finalResponseText) {
            return res.json({ reply: finalResponseText });
        } else {
            console.error('❌ [ChatAI] TOÀN BỘ MODEL ĐỀU SẬP. Lỗi cuối cùng:', lastError?.response?.data || lastError?.message);
            return res.status(500).json({ error: 'Nguồn AI đang quá tải lượt dùng. Xin chờ một chút!' });
        }
    } catch (error) {
        console.error('❌ [ChatAI] Lỗi Server Nội Bộ:', error.message);
        res.status(500).json({ error: 'Hệ thống AI đang bảo trì. Vui lòng thử lại sau.' });
    }
};

module.exports = { generateResponse };
