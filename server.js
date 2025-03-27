const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const pdf = require('pdf-parse');
const { textToSpeech } = require('./tts');
require('dotenv').config();

const app = express();

// 设置端口
const PORT = process.env.PORT || 3000;

// 添加聊天历史记录数组
let chatHistory = [];

// 配置 CORS
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS.split(','),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 配置文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // 处理文件名编码
        const originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const filename = Date.now() + '-' + originalname;
        cb(null, filename);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: process.env.MAX_FILE_SIZE * 1024 * 1024  // 从环境变量获取文件大小限制
    }
});

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// 设置静态文件目录
app.use(express.static(path.join(__dirname, 'AI伴读')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/audio', express.static(path.join(__dirname, 'public/audio')));

// 确保必要的目录存在
const uploadDir = path.join(__dirname, 'uploads');
const audioDir = path.join(__dirname, 'public', 'audio');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
}

// 默认路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'AI伴读', 'index.html'));
});

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// 检查必要的环境变量
if (!DEEPSEEK_API_KEY) {
    console.error('错误: 未设置 DEEPSEEK_API_KEY 环境变量');
    process.exit(1);
}

// 添加文件类型检查函数
function isEbook(filename) {
    const allowedTypes = ['.txt', '.pdf', '.epub', '.mobi', '.doc', '.docx'];
    const ext = '.' + filename.split('.').pop().toLowerCase();
    return allowedTypes.includes(ext);
}

// 处理文件上传
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            console.error('上传错误: 没有文件被上传');
            return res.status(400).json({
                success: false,
                error: '没有文件被上传'
            });
        }

        // 确保uploads目录存在
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // 获取文件信息
        const fileInfo = {
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: req.file.size,
            path: req.file.path
        };

        console.log('文件上传成功:', fileInfo);

        // 验证文件是否真实存在
        if (!fs.existsSync(req.file.path)) {
            throw new Error('文件保存失败');
        }

        res.json({
            success: true,
            file: fileInfo
        });
    } catch (error) {
        console.error('上传错误:', error);
        // 如果文件存在但发生其他错误，清理文件
        if (req.file && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (unlinkError) {
                console.error('清理文件失败:', unlinkError);
            }
        }
        res.status(500).json({
            success: false,
            error: error.message || '文件上传失败'
        });
    }
});

// 处理聊天请求
app.post('/api/chat', async (req, res) => {
    try {
        const { message, files } = req.body;
        let fullMessage = message || '';
        let systemPrompt = '';

        // 检查是否有上传的文件
        if (files && files.length > 0) {
            const file = files[0]; // 获取第一个文件
            if (isEbook(file.originalname)) {
                // 如果是电子书，构建作者视角的系统提示词
                const bookName = file.originalname.replace(/\.[^/.]+$/, ''); // 移除文件扩展名
                systemPrompt = `你现在是《${bookName}》的作者。请以作者的身份和口吻与用户对话。你的回答应该：
1. 体现作者对作品的深入理解和独特见解
2. 使用温和、专业的语气
3. 在回答中适当引用作品内容
4. 保持作者的专业性和权威性
5. 如果用户的问题超出作品范围，请礼貌地说明并引导回到作品相关话题

请记住：你就是这本书的作者，要用作者的身份和语气来回答。`;

                // 添加文件内容到消息中
                fullMessage += '\n\n以下是上传的书籍内容片段（可参考）：\n';
                fullMessage += `\n${file.originalname}:\n${file.content}\n`;
            } else {
                // 如果不是电子书，返回提示信息
                return res.json({
                    reply: "请上传电子书，我将以作者的身份和你聊天！"
                });
            }
        }

        // 如果没有文件且没有消息，返回提示
        if (!files?.length && !message?.trim()) {
            return res.json({
                reply: "请上传电子书，我将以作者的身份和你聊天！"
            });
        }

        try {
            // 记录上下文
            chatHistory.push({ role: 'user', content: fullMessage });

            // 只保留最近几轮对话（避免过长）
            const recentMessages = chatHistory.slice(-5);

            const response = await axios.post(DEEPSEEK_API_URL, {
                messages: [
                    { role: "system", content: systemPrompt || "你是一个友好的AI助手。" },
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

            if (!response.data || !response.data.choices || !response.data.choices[0]) {
                throw new Error('API 响应格式错误');
            }

            const reply = response.data.choices[0].message.content;

            // 也加入历史
            chatHistory.push({ role: 'assistant', content: reply });

            res.json({ reply });
        } catch (error) {
            console.error('API调用错误:', error.response?.data || error.message);
            throw new Error(error.response?.data?.error || '与AI服务通信失败，请稍后重试');
        }
    } catch (error) {
        console.error('聊天请求错误:', error);
        res.status(500).json({ error: error.message || '服务器错误，请稍后重试' });
    }
});

// 文件读取接口
app.get('/api/read/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        // 验证文件名，防止目录遍历攻击
        if (filename.includes('..') || filename.includes('/')) {
            throw new Error('无效的文件名');
        }

        const filePath = path.join(__dirname, 'uploads', filename);
        
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            console.error('文件不存在:', filePath);
            return res.status(404).json({ error: '文件不存在' });
        }

        // 异步读取文件
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.error('文件读取失败:', err);
                return res.status(500).json({ error: '文件读取失败' });
            }
            res.json({ content: data });
        });
    } catch (error) {
        console.error('文件读取错误:', error);
        res.status(400).json({ error: error.message });
    }
});

// TTS接口
app.post('/api/tts', async (req, res) => {
    try {
        const { text } = req.body;
        const filename = `voice_${Date.now()}.mp3`;
        const audioPath = await textToSpeech(text, filename);
        res.json({ url: audioPath });
    } catch (error) {
        console.error('TTS Error:', error);
        res.status(500).json({ error: '语音合成失败' });
    }
});

// 修改监听配置
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://116.205.119.164:${PORT}`);
    console.log(`Upload directory: ${uploadDir}`);
    console.log(`Audio directory: ${audioDir}`);
}); 