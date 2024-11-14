let book = null;
let rendition = null;
let currentBookData = null;

// 保存阅读进度的函数
function saveReadingProgress(bookData) {
    const savedBooks = JSON.parse(localStorage.getItem('savedBooks') || '{}');
    savedBooks[bookData.key] = bookData;
    localStorage.setItem('savedBooks', JSON.stringify(savedBooks));
}

// 获取特定书籍的阅读进度
function getReadingProgress(bookKey) {
    const savedBooks = JSON.parse(localStorage.getItem('savedBooks') || '{}');
    return savedBooks[bookKey] || null;
}

// 生成书籍唯一标识
async function generateBookKey(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

document.getElementById('book-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.epub')) {
        try {
            // 生成书籍唯一标识
            const bookKey = await generateBookKey(file);
            
            // 显示阅读器容器
            document.querySelector('.upload-section').style.display = 'none';
            document.getElementById('reader').hidden = false;

            // 加载电子书
            book = ePub(file);
            
            // 获取书籍信息
            const metadata = await book.loaded.metadata;
            currentBookData = {
                key: bookKey,
                title: metadata.title,
                author: metadata.creator,
                fileName: file.name,
                lastLocation: null,
                timestamp: Date.now()
            };

            // 检查是否有保存的进度
            const savedProgress = getReadingProgress(bookKey);
            
            rendition = book.renderTo('viewer', {
                width: '100%',
                height: '100%',
                spread: 'none'
            });

            // 如果有保存的进度，跳转到上次阅读位置
            if (savedProgress && savedProgress.lastLocation) {
                await rendition.display(savedProgress.lastLocation);
            } else {
                await rendition.display();
            }

            // 监听位置变化，保存进度
            rendition.on('relocated', (location) => {
                currentBookData.lastLocation = location.start.cfi;
                currentBookData.timestamp = Date.now();
                saveReadingProgress(currentBookData);
                updateProgressDisplay(location);
            });

            // 绑定翻页事件
            document.getElementById('prev').addEventListener('click', () => {
                rendition.prev();
            });

            document.getElementById('next').addEventListener('click', () => {
                rendition.next();
            });

            // 添加键盘快捷键
            document.addEventListener('keyup', (e) => {
                if (e.key === 'ArrowLeft') rendition.prev();
                if (e.key === 'ArrowRight') rendition.next();
            });

        } catch (error) {
            console.error('Error loading book:', error);
            alert('加载电子书时出错，请重试');
        }
    }
});

// 更新进度显示
function updateProgressDisplay(location) {
    const progressElement = document.getElementById('progress-display');
    const currentPage = location.start.displayed.page;
    const totalPages = location.start.displayed.total;
    const percentage = ((currentPage / totalPages) * 100).toFixed(1);
    progressElement.textContent = `阅读进度：${percentage}%`;
} 