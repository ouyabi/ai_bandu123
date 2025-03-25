let chatHistory = [];


const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

const DEEPSEEK_API_KEY = 'sk-65a646d3cad34d61ba02807e428b8999';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
app.post('/api/chat', async (req, res) => {
    try {
        const { message, files } = req.body;
        let fullMessage = message || '';
        let bookName = files && files[0] ? files[0].filename.replace(/\.(pdf|txt)$/i, '') : '某本书';

        if (files && files.length > 0) {
            fullMessage += '\n\n以下是上传的书籍内容片段（可参考）：\n';
            files.forEach(file => {
                fullMessage += `\n${file.filename}:\n${file.content}\n`;
            });
        }

        // 构建系统提示词（角色扮演）
        const systemPrompt = `你现在是《${bookName}》的作者，你非常了解书中内容。请根据用户提出的问题，结合书中内容，以作者的身份来解释和对话。你的语气可以温柔、有耐心、有情绪表达。`;

        // 记录上下文
        chatHistory.push({ role: 'user', content: fullMessage });

        // 只保留最近几轮对话（避免过长）
        const recentMessages = chatHistory.slice(-5);

        const response = await axios.post(DEEPSEEK_API_URL, {
            messages: [
                { role: "system", content: systemPrompt },
                ...recentMessages
            ],
            model: "deepseek-chat",
            temperature: 0.7,
            max_tokens: 1000
        }, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const reply = response.data.choices[0].message.content;

        // 也加入历史
        chatHistory.push({ role: 'assistant', content: reply });

        res.json({ reply });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: '服务器错误，请稍后重试' });
    }
});


const PORT = 3000;
app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
}); 