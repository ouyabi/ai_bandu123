const fs = require('fs');
const path = require('path');
const axios = require('axios');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // 默认是 Rachel 女声，支持中文

async function textToSpeech(text, filename) {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;
    const outputPath = path.join(__dirname, 'public', 'audio', filename);

    const response = await axios.post(url,
        {
            text,
            model_id: 'eleven_multilingual_v2', // 支持中文！
        },
        {
            headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            },
            responseType: 'arraybuffer'
        }
    );

    fs.writeFileSync(outputPath, response.data);
    return `/audio/${filename}`;
}

module.exports = { textToSpeech }; 