const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const bookService = require('./services/bookService');
const fs = require('fs');

// 在文件最开始添加更多调试信息
console.log('Starting server initialization...');

// 确保必要的目录存在
const requiredDirs = [
    './public',
    './public/uploads',
    './public/lib',
    './data',
    './data/books',
    './views'
];

requiredDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        console.log(`Creating directory: ${dir}`);
        fs.mkdirSync(dir, { recursive: true });
    } else {
        console.log(`Directory exists: ${dir}`);
    }
});

// Express 应用配置
const app = express();
console.log('Express app created');

// 视图引擎配置
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
console.log('View engine configured:', path.join(__dirname, 'views'));

// 静态文件配置
app.use(express.static(path.join(__dirname, 'public')));
app.use('/books', express.static(path.join(__dirname, 'data/books')));
console.log('Static directories configured');

// 中间件配置
app.use(express.json());
console.log('JSON middleware configured');

// 添加速率限制中间件
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 10, // 限制每个IP 15分钟内最多10次上传
    message: { error: '请求过于频繁，请稍后再试' },
    standardHeaders: true,
    legacyHeaders: false
});

// 文件上传配置
app.use(fileUpload({
    limits: { fileSize: 100 * 1024 * 1024 },
    abortOnLimit: true,
    createParentPath: true,
    debug: true,
    useTempFiles: true,
    tempFileDir: path.join(__dirname, 'tmp')
}));
console.log('File upload configured');

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

// 路由处理
app.get('/', (req, res) => {
    console.log('Handling root route request');
    console.log('Headers:', req.headers);
    console.log('URL:', req.url);
    
    try {
        res.render('index', {}, (err, html) => {
            if (err) {
                console.error('Error rendering index:', err);
                res.status(500).send('Error rendering page');
            } else {
                res.send(html);
            }
        });
    } catch (error) {
        console.error('Error in root route:', error);
        res.status(500).send('Server error');
    }
});

app.post('/upload', uploadLimiter, async (req, res) => {
    try {
        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).json({ error: '没有上传文件' });
        }

        if (!req.files.book) {
            return res.status(400).json({ error: '文件字段名称必须为 book' });
        }

        const book = req.files.book;
        const ext = path.extname(book.name).toLowerCase().substring(1);
        const allowedExts = ['pdf', 'epub', 'txt', 'docx', 'mobi'];
        
        if (!allowedExts.includes(ext)) {
            return res.status(400).json({ error: '不支持的文件格式' });
        }

        // 添加文件类型验证
        const allowedMimeTypes = [
            'application/pdf',
            'application/epub+zip',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/x-mobipocket-ebook',
            'text/plain'
        ];

        if (!allowedMimeTypes.includes(book.mimetype)) {
            return res.status(400).json({ error: '不支持的文件类型' });
        }

        await bookService.addBook(book);
        res.redirect('/library');

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: '文件上传失败', details: error.message });
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
    console.error('Global error handler:', err);
    res.status(500).render('error', { 
        message: process.env.NODE_ENV === 'development' 
            ? err.message 
            : '服务器内部错误'
    });
});

// 404 处理
app.use((req, res) => {
    console.log('404 Not Found:', req.url);
    res.status(404).render('error', { message: '页面不存在' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Root directory: ${__dirname}`);
    console.log(`Views directory: ${path.join(__dirname, 'views')}`);
    console.log('Available routes:');
    console.log('- GET  /');
    console.log('- GET  /library');
    console.log('- GET  /read/:id');
    console.log('- POST /upload');
    console.log('- POST /api/books/:id/progress');
}); 