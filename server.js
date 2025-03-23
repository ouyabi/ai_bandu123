const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const pdf = require('pdf-parse');
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
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 500 * 1024 * 1024  // 增加到500MB
    }
});

app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// 设置静态文件目录
app.use(express.static(path.join(__dirname, 'AI伴读')));
app.use('/uploads', express.static('uploads'));

// 默认路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'AI伴读', 'index.html'));
});

const DEEPSEEK_API_KEY = 'sk-65a646d3cad34d61ba02807e428b8999';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// 处理文件上传
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            throw new Error('No file uploaded');
        }

        // 获取文件信息
        const fileInfo = {
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: req.file.size,
            path: req.file.path
        };

        // 这里可以添加文件处理逻辑
        // 1. 保存文件元数据到数据库
        // 2. 开始异步处理文件
        // 3. 返回文件ID给前端

        res.json({
            success: true,
            file: fileInfo
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            error: error.message
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

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
}); 