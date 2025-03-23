const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const pdf = require('pdf-parse');
const { textToSpeech } = require('./tts');
const app = express();

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
        fileSize: 500 * 1024 * 1024  // 500MB
    }
});

app.use(cors());
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

// 处理文件上传
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            throw new Error('没有文件被上传');
        }

        // 获取文件信息
        const fileInfo = {
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: req.file.size,
            path: req.file.path
        };

        console.log('文件上传成功:', fileInfo);

        res.json({
            success: true,
            file: fileInfo
        });
    } catch (error) {
        console.error('上传错误:', error);
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

        // 如果有文件内容，添加到消息中
        if (files && files.length > 0) {
            fullMessage += '\n\n文件内容：\n';
            files.forEach(file => {
                fullMessage += `\n${file.filename}:\n${file.content}\n`;
            });
        }

        const response = await axios.post(DEEPSEEK_API_URL, {
            messages: [
                {
                    role: "user",
                    content: fullMessage
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

// 文件读取接口
app.get('/api/read/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: '文件读取失败' });
        }
        res.json({ content: data });
    });
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

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
}); 