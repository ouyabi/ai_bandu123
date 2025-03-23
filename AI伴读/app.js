// DOM Elements
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.querySelector('.sidebar');
const sections = document.querySelectorAll('.section');
const navLinks = document.querySelectorAll('.main-nav a');

// Mobile Menu Toggle
menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    menuToggle.classList.toggle('active');
});

// Close sidebar when clicking outside
document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
        sidebar.classList.remove('active');
        menuToggle.classList.remove('active');
    }
});

// Navigation
function setActiveSection(hash) {
    const targetId = hash.slice(1) || 'home';
    sections.forEach(section => {
        section.classList.remove('active');
        if (section.id === targetId) {
            section.classList.add('active');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === hash) {
            link.classList.add('active');
        }
    });
}

// Handle navigation
window.addEventListener('hashchange', () => {
    setActiveSection(window.location.hash);
});

// Set initial active section
setActiveSection(window.location.hash);

// Search functionality
const searchInput = document.querySelector('.search-box input');
const noteCards = document.querySelectorAll('.note-card');

searchInput?.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    noteCards.forEach(card => {
        const title = card.querySelector('h3').textContent.toLowerCase();
        const content = card.querySelector('.note-preview').textContent.toLowerCase();
        const isVisible = title.includes(searchTerm) || content.includes(searchTerm);
        card.style.display = isVisible ? 'block' : 'none';
    });
});

// Chat functionality
const chatInput = document.querySelector('.chat-input textarea');
const sendButton = document.querySelector('.send-btn');
const chatMessages = document.querySelector('.chat-messages');
const uploadPreview = document.querySelector('.upload-preview');
const imageUpload = document.getElementById('image-upload');
const fileUpload = document.getElementById('file-upload');

let uploadedFiles = [];
let processedFiles = [];

function formatAIResponse(text) {
    // 移除多余的#号和星号
    text = text.replace(/^#+\s*$/gm, '');
    text = text.replace(/\*\*(.*?)\*\*/g, '$1');
    text = text.replace(/\*(.*?)\*/g, '$1');
    
    // 处理标题（从最长的匹配开始）
    text = text.replace(/###\s+(.*?)(?:\n|$)/g, '<h3>$1</h3>\n');
    text = text.replace(/##\s+(.*?)(?:\n|$)/g, '<h2>$1</h2>\n');
    text = text.replace(/#\s+(.*?)(?:\n|$)/g, '<h1>$1</h1>\n');
    
    // 处理有序和无序列表
    text = text.replace(/^\d+\.\s+(.*)$/gm, '<li>$1</li>');
    text = text.replace(/^[-*]\s+(.*)$/gm, '<li>$1</li>');
    
    // 将连续的列表项包装在ol或ul中
    text = text.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
    
    // 处理段落，忽略已经处理过的HTML标签
    const paragraphs = text.split('\n\n');
    text = paragraphs.map(paragraph => {
        paragraph = paragraph.trim();
        if (paragraph && !paragraph.match(/<[h|ul|li|ol][^>]*>/)) {
            return `<p>${paragraph}</p>`;
        }
        return paragraph;
    }).join('\n');
    
    // 清理多余的空行
    text = text.replace(/\n{3,}/g, '\n\n');
    
    // 清理段落内的多余换行
    text = text.replace(/<p>(.*?)<\/p>/gs, (match, p1) => {
        return `<p>${p1.replace(/\n/g, ' ').trim()}</p>`;
    });
    
    return text;
}

// 播放TTS语音
function playTTSFromServer(text) {
    fetch('/api/tts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
    })
    .then(res => res.json())
    .then(data => {
        if (data.url) {
            const audio = new Audio(data.url);
            audio.play().catch(err => {
                console.error('语音播放失败：', err);
            });
        }
    })
    .catch(err => {
        console.error('语音合成失败：', err);
    });
}

// 在AI回复处理中使用TTS
function handleAIResponse(replyText) {
    playTTSFromServer(replyText);
}

// 修改addMessage函数，添加语音按钮
function addMessage(content, isAI = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isAI ? 'ai' : 'user'}`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // 如果是AI消息，进行格式化处理
    if (isAI) {
        messageContent.innerHTML = formatAIResponse(content);
    } else {
        messageContent.innerHTML = content;
    }
    
    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function uploadFiles(files) {
    try {
        const results = [];
        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);

            console.log('开始上传文件:', file.name);
            const response = await fetch('http://localhost:3000/api/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || '上传失败');
            }

            // 读取上传的文件内容
            const fileResponse = await fetch(`/api/read/${data.file.filename}`);
            const fileData = await fileResponse.json();

            results.push({
                filename: data.file.filename,
                originalname: data.file.originalname,
                content: fileData.content
            });
        }
        console.log('所有文件上传成功:', results);
        return results;
    } catch (error) {
        console.error('文件上传错误:', error);
        addMessage(`文件上传失败: ${error.message}`, true);
        return [];
    }
}

// 阅读历史功能
let readingHistory = [];

// 从localStorage加载阅读历史
function loadReadingHistory() {
    readingHistory = JSON.parse(localStorage.getItem('readingHistory') || '[]');
    updateHistoryList();
}

// 保存阅读历史到localStorage
function saveReadingHistory() {
    localStorage.setItem('readingHistory', JSON.stringify(readingHistory));
}

// 添加文件到阅读历史
function addToReadingHistory(file) {
    const historyItem = {
        id: Date.now(),
        fileName: file.name,
        fileType: file.type,
        uploadTime: new Date().toISOString(),
        lastReadTime: new Date().toISOString(),
        readCount: 1
    };
    
    readingHistory.unshift(historyItem);
    saveReadingHistory();
    updateHistoryList();
}

// 更新阅读历史列表显示
function updateHistoryList() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;

    const sortSelect = document.getElementById('historySort');
    const sortValue = sortSelect?.value || 'time-desc';
    
    // 排序历史记录
    const sortedHistory = [...readingHistory].sort((a, b) => {
        if (sortValue === 'time-desc') {
            return new Date(b.lastReadTime) - new Date(a.lastReadTime);
        } else {
            return new Date(a.lastReadTime) - new Date(b.lastReadTime);
        }
    });
    
    historyList.innerHTML = sortedHistory.map(item => `
        <div class="history-item">
            <div class="history-item-info">
                <div class="history-item-title">${item.fileName}</div>
                <div class="history-item-meta">
                    <span>上传时间: ${new Date(item.uploadTime).toLocaleString()}</span>
                    <span>最后阅读: ${new Date(item.lastReadTime).toLocaleString()}</span>
                    <span>阅读次数: ${item.readCount}次</span>
                </div>
            </div>
            <div class="history-item-actions">
                <button onclick="continueReading('${item.id}')">
                    <i class="fas fa-book-open"></i>
                    继续阅读
                </button>
                <button onclick="removeFromHistory('${item.id}')">
                    <i class="fas fa-trash"></i>
                    删除记录
                </button>
            </div>
        </div>
    `).join('');
}

// 继续阅读功能
window.continueReading = function(id) {
    const item = readingHistory.find(item => item.id === Number(id));
    if (item) {
        item.lastReadTime = new Date().toISOString();
        item.readCount += 1;
        saveReadingHistory();
        updateHistoryList();
        
        // 切换到AI助手页面并加载文件
        sections.forEach(section => section.classList.remove('active'));
        document.getElementById('ai-assistant').classList.add('active');
    }
};

// 从历史记录中删除
window.removeFromHistory = function(id) {
    if (confirm('确定要删除这条阅读记录吗？')) {
        readingHistory = readingHistory.filter(item => item.id !== Number(id));
        saveReadingHistory();
        updateHistoryList();
    }
};

// 文件上传处理
async function handleFileUpload(file) {
    try {
        // 放宽文件大小限制
        if (file.size > 500 * 1024 * 1024) {
            throw new Error('文件大小不能超过500MB');
        }

        // 创建上传预览
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.innerHTML = `
            <div class="upload-info">
                <i class="fas fa-file-alt"></i>
                <div class="file-name">${file.name}</div>
                <div class="upload-progress">
                    <div class="progress-bar"></div>
                    <div class="progress-text">准备上传...</div>
                </div>
            </div>
        `;
        uploadPreview.appendChild(previewItem);

        // 使用FormData上传文件
        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        
        // 进度处理
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                const progressBar = previewItem.querySelector('.progress-bar');
                const progressText = previewItem.querySelector('.progress-text');
                if (progressBar && progressText) {
                    progressBar.style.width = `${percent}%`;
                    progressText.textContent = `上传中 ${percent}%`;
                }
            }
        };

        // 使用Promise包装XHR请求
        const response = await new Promise((resolve, reject) => {
            xhr.onload = () => {
                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.success) {
                            const progressText = previewItem.querySelector('.progress-text');
                            if (progressText) {
                                progressText.textContent = '上传完成';
                            }
                            console.log('文件上传成功:', response);
                            resolve(response);
                        } else {
                            reject(new Error(response.error || '上传失败'));
                        }
                    } catch (e) {
                        reject(new Error('解析响应失败'));
                    }
                } else {
                    reject(new Error(`上传失败: ${xhr.status}`));
                }
            };

            xhr.onerror = () => reject(new Error('网络错误'));
            xhr.open('POST', '/api/upload');
            xhr.send(formData);
        });

        // 添加到上传文件列表
        uploadedFiles.push(file);

        // 添加到阅读历史
        addToReadingHistory(file);

        return response;
    } catch (error) {
        console.error('文件处理错误:', error);
        const errorMessage = error.message || '文件上传失败';
        addMessage(errorMessage, true);
        
        // 移除预览
        const previewItem = Array.from(uploadPreview.children).find(
            item => item.querySelector('.file-name')?.textContent === file.name
        );
        if (previewItem) {
            previewItem.remove();
        }
        
        throw error;
    }
}

// 添加文件删除功能
window.removeFile = function(button, fileName) {
    const element = button.closest('.preview-item');
    element.remove();
    uploadedFiles = uploadedFiles.filter(file => file.name !== fileName);
};

imageUpload?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFileUpload(file);
    }
});

fileUpload?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFileUpload(file);
    }
});

// 发送消息给AI
async function sendMessageToAI(message) {
    try {
        // 首先上传所有文件
        let fileContents = [];
        if (uploadedFiles.length > 0) {
            console.log('准备上传文件:', uploadedFiles);
            fileContents = await uploadFiles(uploadedFiles);
            console.log('文件上传完成:', fileContents);
        }

        // 显示加载状态
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message ai loading';
        loadingDiv.innerHTML = '<div class="message-content">正在思考中...</div>';
        chatMessages.appendChild(loadingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        const response = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message,
                files: fileContents
            })
        });

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }

        // 移除加载状态消息
        if (loadingDiv && loadingDiv.parentNode) {
            loadingDiv.remove();
        }
        
        // 添加AI回复并播放语音
        addMessage(data.reply, true);
        playTTSFromServer(data.reply);
        
        return data.reply;
    } catch (error) {
        console.error('Error:', error);
        // 移除加载状态消息
        const loadingMessage = document.querySelector('.message.ai.loading');
        if (loadingMessage) {
            loadingMessage.remove();
        }
        return '抱歉，发生了一些错误，请稍后重试。';
    }
}

// 修改发送按钮的事件处理
sendButton?.addEventListener('click', async () => {
    const message = chatInput.value.trim();
    if (message || uploadedFiles.length > 0) {
        // 显示用户消息
        let userContent = '';
    if (message) {
            userContent += message;
        }
        if (uploadedFiles.length > 0) {
            userContent += '<div class="uploaded-files">';
            uploadedFiles.forEach(file => {
                userContent += `<div class="file-item">${file.name}</div>`;
            });
            userContent += '</div>';
        }
        addMessage(userContent);
        
        // 清空输入和预览
        chatInput.value = '';
        uploadPreview.innerHTML = '';
        
        // 获取AI响应
        const aiResponse = await sendMessageToAI(message);
        
        // 如果返回错误消息，显示错误
        if (aiResponse.includes('抱歉，发生了一些错误')) {
            addMessage(aiResponse, true);
        }

        // 清空上传的文件
        uploadedFiles = [];
        processedFiles = [];
    }
});

chatInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendButton.click();
    }
});

// Reading progress
const progressBar = document.querySelector('.progress');
let readingTime = 0;

// 模拟阅读时间更新
if (progressBar) {
    setInterval(() => {
        readingTime++;
        const progress = Math.min((readingTime / 100) * 100, 100);
        progressBar.style.width = `${progress}%`;
        
        const timeDisplay = document.querySelector('.reading-progress p');
        if (timeDisplay) {
            timeDisplay.textContent = `已阅读 ${readingTime} 分钟`;
        }
    }, 60000); // 每分钟更新一次
}

// 添加笔记功能
const newNoteBtn = document.querySelector('.new-note-btn');
const notesGrid = document.querySelector('.notes-grid');

newNoteBtn?.addEventListener('click', () => {
    const noteTemplate = `
        <article class="note-card">
            <div class="note-header">
                <h3>新笔记</h3>
                <span class="date">${new Date().toLocaleDateString()}</span>
            </div>
            <p class="note-preview">开始写下你的想法...</p>
            <div class="note-footer">
                <div class="tags">
                    <span class="tag">未分类</span>
                </div>
                <button class="more-btn"><i class="fas fa-ellipsis-h"></i></button>
            </div>
        </article>
    `;
    
    notesGrid.insertAdjacentHTML('afterbegin', noteTemplate);
});

// 动画效果
document.querySelectorAll('.card, .note-card, .feature-item').forEach(element => {
    element.addEventListener('mouseover', () => {
        element.style.transform = 'translateY(-5px)';
    });
    
    element.addEventListener('mouseout', () => {
        element.style.transform = 'translateY(0)';
    });
});

// 主题切换功能（待实现）
const themes = {
    light: {
        '--background-color': '#ffffff',
        '--text-color': '#333333',
        '--sidebar-color': '#f5f5f5',
        '--card-bg': '#ffffff',
        '--border-color': '#e0e0e0'
    },
    dark: {
        '--background-color': '#342f2f',
        '--text-color': '#ffffff',
        '--sidebar-color': '#1f1f1f',
        '--card-bg': 'rgba(255,255,255,0.1)',
        '--border-color': 'rgba(255,255,255,0.2)'
    }
};

// 后续可以添加主题切换功能 

// 页面切换功能
const sidebarNavLinks = document.querySelectorAll('.sidebar-nav a');

sidebarNavLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').slice(1);
        sections.forEach(section => {
            section.classList.remove('active');
            if (section.id === targetId) {
                section.classList.add('active');
            }
        });
        sidebarNavLinks.forEach(nav => nav.classList.remove('active'));
        link.classList.add('active');
    });
});

document.getElementById('toggleReadingMode').addEventListener('click', function() {
    document.body.classList.toggle('dark-mode');
});

// 开启阅读之旅按钮点击事件
document.querySelector('.cta-button').addEventListener('click', function() {
    // 隐藏所有sections
    sections.forEach(section => section.classList.remove('active'));
    
    // 显示AI助手section
    document.getElementById('ai-assistant').classList.add('active');
    
    // 更新导航栏激活状态
    navLinks.forEach(link => {
        link.classList.remove('active');
        if(link.getAttribute('href') === '#ai-assistant') {
            link.classList.add('active');
        }
    });
});

// 阅读进度追踪
let dailyReadingTime = 0;
let weeklyReadingTime = 0;
let streak = 0;

// 从localStorage加载数据
function loadReadingStats() {
    const stats = JSON.parse(localStorage.getItem('readingStats') || '{}');
    dailyReadingTime = stats.dailyTime || 0;
    weeklyReadingTime = stats.weeklyTime || 0;
    streak = stats.streak || 0;
    
    updateReadingStats();
}

// 保存数据到localStorage
function saveReadingStats() {
    const stats = {
        dailyTime: dailyReadingTime,
        weeklyTime: weeklyReadingTime,
        streak: streak,
        lastUpdate: new Date().toISOString()
    };
    localStorage.setItem('readingStats', JSON.stringify(stats));
}

// 更新UI显示
function updateReadingStats() {
    // 更新每日进度
    const dailyProgress = document.getElementById('daily-progress');
    const dailyPercentage = Math.min((dailyReadingTime / 60) * 100, 100);
    dailyProgress.style.width = `${dailyPercentage}%`;
    document.getElementById('time-spent').textContent = Math.floor(dailyReadingTime);
    
    // 更新每周进度
    const weeklyProgress = document.getElementById('weekly-progress');
    const weeklyPercentage = Math.min((weeklyReadingTime / 420) * 100, 100);
    weeklyProgress.style.width = `${weeklyPercentage}%`;
    document.getElementById('weekly-time').textContent = (weeklyReadingTime / 60).toFixed(1);
    
    // 更新连续打卡
    document.getElementById('streak-count').textContent = streak;
}

// 模拟阅读时间增加
function simulateReading() {
    dailyReadingTime += 1;
    weeklyReadingTime += 1;
    
    // 如果达到每日目标，增加连续打卡天数
    if (dailyReadingTime >= 60 && dailyReadingTime - 1 < 60) {
        streak += 1;
    }
    
    updateReadingStats();
    saveReadingStats();
}

// 检查并重置每日/每周数据
function checkAndResetStats() {
    const stats = JSON.parse(localStorage.getItem('readingStats') || '{}');
    const lastUpdate = stats.lastUpdate ? new Date(stats.lastUpdate) : new Date();
    const now = new Date();
    
    // 检查是否需要重置每日数据
    if (lastUpdate.getDate() !== now.getDate()) {
        dailyReadingTime = 0;
    }
    
    // 检查是否需要重置每周数据
    if (lastUpdate.getDay() > now.getDay()) {
        weeklyReadingTime = 0;
    }
    
    // 检查是否中断连续打卡
    const daysDiff = Math.floor((now - lastUpdate) / (1000 * 60 * 60 * 24));
    if (daysDiff > 1) {
        streak = 0;
    }
}

// 初始化
loadReadingStats();
checkAndResetStats();

// 每分钟更新一次阅读时间
setInterval(simulateReading, 60000);

// 添加排序事件监听
document.getElementById('historySort')?.addEventListener('change', updateHistoryList);

// 初始化加载历史记录
loadReadingHistory();

// 书库和收藏夹功能
let myBooks = [];
let favorites = [];

// 从localStorage加载数据
function loadLibraryData() {
    myBooks = JSON.parse(localStorage.getItem('myBooks') || '[]');
    favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    updateBookGrid();
    updateFavoritesGrid();
}

// 保存数据到localStorage
function saveLibraryData() {
    localStorage.setItem('myBooks', JSON.stringify(myBooks));
    localStorage.setItem('favorites', JSON.stringify(favorites));
}

// 添加书籍
async function addBook(file) {
    const book = {
        id: Date.now(),
        name: file.name,
        type: file.type,
        size: file.size,
        addedTime: new Date().toISOString(),
        lastReadTime: null,
        readCount: 0
    };
    
    myBooks.unshift(book);
    saveLibraryData();
    updateBookGrid();
}

// 更新书籍列表显示
function updateBookGrid() {
    const bookGrid = document.getElementById('bookGrid');
    if (!bookGrid) return;

    const searchTerm = document.getElementById('bookSearch')?.value.toLowerCase() || '';
    const sortValue = document.getElementById('bookSort')?.value || 'time';
    
    let sortedBooks = [...myBooks];
    
    // 排序
    if (sortValue === 'name') {
        sortedBooks.sort((a, b) => a.name.localeCompare(b.name));
    } else {
        sortedBooks.sort((a, b) => new Date(b.addedTime) - new Date(a.addedTime));
    }
    
    // 搜索过滤
    if (searchTerm) {
        sortedBooks = sortedBooks.filter(book => 
            book.name.toLowerCase().includes(searchTerm)
        );
    }
    
    bookGrid.innerHTML = sortedBooks.map(book => `
        <div class="book-card" data-id="${book.id}">
            <button class="favorite-btn ${favorites.some(f => f.id === book.id) ? 'active' : ''}"
                    onclick="toggleFavorite(${book.id})">
                <i class="fas fa-star"></i>
            </button>
            <div class="book-cover">
                <i class="fas fa-book"></i>
            </div>
            <div class="book-info">
                <div class="book-title">${book.name}</div>
                <div class="book-meta">
                    添加时间: ${new Date(book.addedTime).toLocaleDateString()}
                </div>
            </div>
            <div class="book-actions">
                <button class="book-btn" onclick="readBook(${book.id})">
                    <i class="fas fa-book-open"></i>
                    开始阅读
                </button>
                <button class="book-btn" onclick="deleteBook(${book.id})">
                    <i class="fas fa-trash"></i>
                    删除
                </button>
            </div>
        </div>
    `).join('');
}

// 更新收藏夹显示
function updateFavoritesGrid() {
    const favoritesGrid = document.getElementById('favoritesGrid');
    if (!favoritesGrid) return;

    const searchTerm = document.getElementById('favoriteSearch')?.value.toLowerCase() || '';
    const sortValue = document.getElementById('favoriteSort')?.value || 'time';
    
    let sortedFavorites = [...favorites];
    
    // 排序
    if (sortValue === 'name') {
        sortedFavorites.sort((a, b) => a.name.localeCompare(b.name));
    } else {
        sortedFavorites.sort((a, b) => new Date(b.favoriteTime) - new Date(a.favoriteTime));
    }
    
    // 搜索过滤
    if (searchTerm) {
        sortedFavorites = sortedFavorites.filter(book => 
            book.name.toLowerCase().includes(searchTerm)
        );
    }
    
    favoritesGrid.innerHTML = sortedFavorites.map(book => `
        <div class="book-card">
            <button class="book-btn favorite active" onclick="toggleFavorite(${book.id})">
                <i class="fas fa-star"></i>
            </button>
            <div class="book-cover">
                <i class="fas fa-book"></i>
            </div>
            <div class="book-info">
                <div class="book-title">${book.name}</div>
                <div class="book-meta">
                    收藏时间: ${new Date(book.favoriteTime).toLocaleDateString()}
                </div>
            </div>
            <div class="book-actions">
                <button class="book-btn" onclick="readBook(${book.id})">
                    <i class="fas fa-book-open"></i>
                    开始阅读
                </button>
            </div>
        </div>
    `).join('');
}

// 切换收藏状态
window.toggleFavorite = function(bookId) {
    const book = myBooks.find(b => b.id === bookId);
    if (!book) return;
    
    const favoriteIndex = favorites.findIndex(f => f.id === bookId);
    const favoriteBtn = document.querySelector(`.book-card[data-id="${bookId}"] .favorite-btn`);
    
    if (favoriteIndex === -1) {
        // 添加到收藏
        favorites.unshift({
            ...book,
            favoriteTime: new Date().toISOString()
        });
        favoriteBtn?.classList.add('active');
    } else {
        // 取消收藏
        favorites.splice(favoriteIndex, 1);
        favoriteBtn?.classList.remove('active');
    }
    
    saveLibraryData();
    updateFavoritesGrid();
};

// 开始阅读
window.readBook = function(bookId) {
    const book = myBooks.find(b => b.id === bookId) || favorites.find(f => f.id === bookId);
    if (!book) return;
    
    // 更新阅读时间和次数
    book.lastReadTime = new Date().toISOString();
    book.readCount = (book.readCount || 0) + 1;
    
    // 切换到AI助手页面
    sections.forEach(section => section.classList.remove('active'));
    document.getElementById('ai-assistant').classList.add('active');
    
    saveLibraryData();
    updateBookGrid();
    updateFavoritesGrid();
};

// 删除书籍
window.deleteBook = function(bookId) {
    if (!confirm('确定要删除这本书吗？')) return;
    
    myBooks = myBooks.filter(book => book.id !== bookId);
    favorites = favorites.filter(book => book.id !== bookId);
    
    saveLibraryData();
    updateBookGrid();
    updateFavoritesGrid();
};

// 文件上传处理
document.getElementById('bookUpload')?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
        await addBook(file);
    }
});

// 搜索和排序事件监听
document.getElementById('bookSearch')?.addEventListener('input', updateBookGrid);
document.getElementById('bookSort')?.addEventListener('change', updateBookGrid);
document.getElementById('favoriteSearch')?.addEventListener('input', updateFavoritesGrid);
document.getElementById('favoriteSort')?.addEventListener('change', updateFavoritesGrid);

// 初始化加载数据
loadLibraryData();

// 页面加载时恢复收藏状态
function restoreFavoriteState() {
    const favorites = JSON.parse(localStorage.getItem('favorites') || '{}');
    document.querySelectorAll('.book-card').forEach(card => {
        const bookId = card.dataset.id;
        const favoriteBtn = card.querySelector('.favorite-btn');
        if (favorites[bookId]) {
            favoriteBtn.classList.add('active');
        }
    });
}

// 页面加载完成后恢复收藏状态
document.addEventListener('DOMContentLoaded', restoreFavoriteState); 