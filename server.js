const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const bookService = require('./services/bookService');

const app = express();

// 基础配置
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use('/books', express.static(path.join(__dirname, 'data/books')));
app.use(fileUpload({
    limits: { fileSize: 100 * 1024 * 1024 },
    abortOnLimit: true,
    createParentPath: true,
    debug: true
}));
app.use(express.json());

// 安全配置
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
        },
    },
}));

// 限制上传频率
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: '请求过于频繁，请稍后再试' }
});

// 路由处理
app.post('/upload', uploadLimiter, async (req, res) => {
    try {
        if (!req.files || !req.files.book) {
            return res.status(400).json({ error: '没有上传文件' });
        }

        const book = req.files.book;
        const ext = path.extname(book.name).toLowerCase().substring(1);
        const allowedExts = ['pdf', 'epub', 'txt', 'docx', 'mobi'];
        
        if (!allowedExts.includes(ext)) {
            return res.status(400).json({ error: '不支持的文件格式' });
        }

        await bookService.addBook(book);
        res.redirect('/library');

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: '文件上传失败' });
    }
});

app.get('/library', async (req, res) => {
    try {
        const books = await bookService.getAllBooks();
        res.render('library', { books });
    } catch (error) {
        res.status(500).render('error', { message: '获取图书列表失败' });
    }
});

app.get('/read/:id', async (req, res) => {
    try {
        const book = await bookService.getBook(req.params.id);
        if (!book) {
            return res.status(404).render('error', { message: '文件不存在' });
        }
        
        if (!['pdf', 'epub', 'txt'].includes(book.file_type)) {
            return res.status(400).render('error', { message: '不支持的文件格式' });
        }
        
        res.render('reader', { book });
    } catch (error) {
        res.status(500).render('error', { message: '读取文件失败' });
    }
});

// API 路由
app.post('/api/books/:id/progress', async (req, res) => {
    try {
        const { page } = req.body;
        await bookService.updateLastRead(req.params.id, page);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: '更新阅读进度失败' });
    }
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).render('error', { 
        message: process.env.NODE_ENV === 'development' 
            ? err.message 
            : '服务器内部错误'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 