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
        const { message } = req.body;
        const response = await axios.post(DEEPSEEK_API_URL, {
            messages: [
                {
                    role: "user",
                    content: message
                }
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

        res.json({
            reply: response.data.choices[0].message.content
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            error: '服务器错误，请稍后重试'
        });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
}); 