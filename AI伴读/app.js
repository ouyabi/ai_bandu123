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

function addMessage(content, isAI = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isAI ? 'ai' : 'user'}`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.innerHTML = content;
    
    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessageToAI(message) {
    try {
        const response = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message })
        });

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }
        return data.reply;
    } catch (error) {
        console.error('Error:', error);
        return '抱歉，发生了一些错误，请稍后重试。';
    }
}

sendButton?.addEventListener('click', async () => {
    const message = chatInput.value.trim();
    if (message) {
        addMessage(message);
        chatInput.value = '';
        
        // 显示加载状态
        const loadingMessage = '正在思考中...';
        addMessage(loadingMessage, true);
        
        // 获取AI响应
        const aiResponse = await sendMessageToAI(message);
        
        // 移除加载消息
        chatMessages.removeChild(chatMessages.lastChild);
        
        // 添加AI响应
        addMessage(aiResponse, true);
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