const express = require('express');
const multer = require('multer');
const path = require('path');
const bookService = require('./services/bookService');
const fs = require('fs');
const mammoth = require('mammoth');
const EPub = require('epub');
const { PDFDocument } = require('pdf-lib');
const { createCanvas, loadImage } = require('canvas');
const session = require('express-session');
const bcrypt = require('bcrypt');
const SQLiteStore = require('connect-sqlite3')(session);

// 立即输出启动信息
console.log('正在启动服务器...');

const app = express();
const port = process.env.PORT || 3000;

// 确保必要的目录存在
const ensureDirectories = () => {
  const dirs = ['public/uploads', 'database'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
};

// 立即创建目录
console.log('正在检查必要目录...');
ensureDirectories();

// 添加请求日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// 配置模板引擎和静态文件
console.log('正在配置Express...');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 支持的文件类型
const SUPPORTED_TYPES = {
  'application/epub+zip': '.epub',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/x-pdf': '.pdf',
  'application/acrobat': '.pdf',
  'applications/vnd.pdf': '.pdf',
  'text/x-pdf': '.pdf',
  'application/x-msword': '.doc',
  'application/octet-stream': '.epub'
};

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'public/uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 解码原始文件名
    const originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    // 生成唯一文件名
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    // 获取文件扩展名
    const ext = path.extname(originalname).toLowerCase();
    // 生成最终的文件名
    const filename = `${uniqueSuffix}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // 解码文件名用于日志
    const filename = Buffer.from(file.originalname, 'latin1').toString('utf8');
    console.log('上传文件名:', filename);
    console.log('文件类型:', file.mimetype);
    
    // 获取文件扩展名
    const ext = path.extname(filename).toLowerCase();
    const allowedExtensions = ['.epub', '.pdf', '.txt', '.doc', '.docx'];
    
    // 检查文件类型是否支持（通过 MIME 类型或扩展名）
    if (SUPPORTED_TYPES[file.mimetype] || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件格式。支持的格式：EPUB、PDF、TXT、DOC、DOCX'));
    }
  }
});

// 添加会话中间件
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: './database'
  }),
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30天
  }
}));

// 添加用户认证中间件
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, error: '请先登录' });
  }
  next();
};

// 路由处理
console.log('正在设置路由...');

app.get('/', async (req, res) => {
  try {
    if (!req.session.userId) {
      res.render('library', { books: [], user: null });
      return;
    }
    const books = await bookService.getAllBooks(req.session.userId);
    const user = await bookService.getUserById(req.session.userId);
    res.render('library', { books, user });
  } catch (error) {
    console.error('获取图书列表失败:', error);
    res.status(500).send('获取图书列表失败');
  }
});

app.get('/reader/:id', async (req, res) => {
  try {
    console.log('访问阅读器，书籍ID:', req.params.id);
    const book = await bookService.getBookById(req.params.id);
    if (!book) {
      return res.status(404).send('未找到该书籍');
    }

    // 从数据库中获取保存的字体大小设置，如果没有则使用默认值
    let currentFontSize = 100;
    if (book.readProgress) {
      try {
        const progress = JSON.parse(book.readProgress);
        if (progress.fontSize) {
          currentFontSize = progress.fontSize;
        }
      } catch (error) {
        console.error('解析字体大小设置失败:', error);
      }
    }

    res.render('reader', { 
      book, 
      currentFontSize,
      MIN_FONT_SIZE: 80,
      MAX_FONT_SIZE: 150,
      FONT_STEP: 10
    });
  } catch (error) {
    console.error('获取书籍失败:', error);
    res.status(500).send('获取书籍失败');
  }
});

// 修改上传路由
app.post('/upload', requireAuth, upload.single('book'), async (req, res) => {
  try {
    console.log('处理上传文件...');
    if (!req.file) {
      return res.status(400).send('请选择要上传的电子书');
    }
    
    // 解码原始文件名
    const originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    console.log('原始文件名:', originalname);
    
    // 获取文件类型
    const fileType = path.extname(originalname).toLowerCase();
    
    // 去除文件扩展名并保存到数据库
    const title = originalname.replace(/\.[^/.]+$/, '');
    await bookService.addBook({
      title: title,
      path: req.file.filename,
      fileType: fileType,
      uploadDate: new Date(),
      userId: req.session.userId
    });
    
    console.log('文件上传成功:', title);
    res.redirect('/');
  } catch (error) {
    console.error('上传失败:', error);
    res.status(400).send(error.message);
  }
});

app.get('/convert-doc', async (req, res) => {
  try {
    const filePath = path.join(__dirname, 'public', req.query.path);
    const result = await mammoth.convertToHtml({path: filePath});
    res.send(result.value);
  } catch (error) {
    console.error('Word文档转换失败:', error);
    res.status(500).send('文档转换失败');
  }
});

// 删除路由
app.delete('/books/:id', requireAuth, async (req, res) => {
  const bookId = req.params.id;
  console.log('收到删除请求，ID:', bookId);
  
  if (!bookId) {
    return res.status(400).json({
      success: false,
      error: '未提供书籍ID'
    });
  }

  try {
    await bookService.deleteBook(bookId);
    console.log('书籍删除成功，ID:', bookId);
    res.json({ success: true });
  } catch (error) {
    console.error('删除书籍失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '删除失败'
    });
  }
});

// 添加用户注册路由
app.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    // 检查用户名是否已存在
    const existingUser = await bookService.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ success: false, error: '用户名已存在' });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 创建用户
    const userId = await bookService.createUser({
      username,
      password: hashedPassword,
      email
    });

    // 设置会话
    req.session.userId = userId;
    
    res.json({ success: true });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ success: false, error: '注册失败' });
  }
});

// 添加用户登录路由
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 获取用户
    const user = await bookService.getUserByUsername(username);
    if (!user) {
      return res.status(400).json({ success: false, error: '用户名或密码错误' });
    }

    // 验证密码
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ success: false, error: '用户名或密码错误' });
    }

    // 设置会话
    req.session.userId = user.id;
    
    res.json({ success: true });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ success: false, error: '登录失败' });
  }
});

// 添加登出路由
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('登出失败:', err);
      res.status(500).json({ success: false, error: '登出失败' });
    } else {
      res.json({ success: true });
    }
  });
});

// 修改保存进度的路由
app.post('/books/:id/progress', async (req, res) => {
    try {
        const { id } = req.params;
        const progress = req.body;
        
        console.log('接收到进度更新:', { bookId: id, progress });

        if (!progress || typeof progress.percentage === 'undefined') {
            return res.status(400).json({ 
                success: false, 
                error: '无效的进度数据' 
            });
        }

        await bookService.updateReadingProgress(id, JSON.stringify(progress));
        console.log('进度更新成功');
        res.json({ success: true });
    } catch (error) {
        console.error('保存进度失败:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || '保存进度失败' 
        });
    }
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).send('服务出错了！');
});

// 初始化数据库并启动服务器
console.log('正在初始化数据库...');
bookService.initDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log('\n=================================');
      console.log(`服务器成功启动！`);
      console.log(`访问地址: http://localhost:${port}`);
      console.log('=================================\n');
    });
  })
  .catch(error => {
    console.error('服务器启动失败:', error);
    process.exit(1);
  });

// 捕获未处理的异常
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
});

// 确保文件末尾没有多余的空格或特殊字符 