const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

// 创建数据库连接
const db = new sqlite3.Database(path.join(__dirname, '../database/books.db'));

const bookService = {
  // 初始化数据库
  initDatabase: () => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // 创建用户表
        db.run(`CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) reject(err);
        });

        // 创建书籍表（添加用户ID外键）
        db.run(`CREATE TABLE IF NOT EXISTS books (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          path TEXT NOT NULL,
          fileType TEXT NOT NULL,
          coverPath TEXT,
          uploadDate DATETIME,
          lastRead DATETIME,
          readProgress TEXT,
          userId INTEGER,
          FOREIGN KEY(userId) REFERENCES users(id)
        )`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  },

  // 获取所有书籍
  getAllBooks: (userId) => {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          books.*,
          CASE 
            WHEN lastRead IS NULL THEN 0
            ELSE 1
          END as has_read,
          COALESCE(lastRead, uploadDate) as sort_date
        FROM books 
        WHERE userId = ? 
        ORDER BY 
          has_read DESC,
          sort_date DESC,
          uploadDate DESC
      `, [userId], (err, rows) => {
        if (err) {
          console.error('获取书籍列表失败:', err);
          reject(err);
        } else {
          console.log('获取书籍列表成功, 数量:', rows.length);
          resolve(rows);
        }
      });
    });
  },

  // 根据ID获取书籍
  getBookById: (id) => {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT *, (SELECT COUNT(*) FROM books b2 WHERE b2.id = books.id AND readProgress IS NOT NULL) as hasProgress FROM books WHERE id = ?',
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  },

  // 添加新书籍
  addBook: (book) => {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO books (title, path, fileType, coverPath, uploadDate, userId) VALUES (?, ?, ?, ?, ?, ?)',
        [book.title, book.path, book.fileType, book.coverPath, book.uploadDate, book.userId],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  },

  // 更新封面路径
  updateCoverPath: (bookId, coverPath) => {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE books SET coverPath = ? WHERE id = ?',
        [coverPath, bookId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  // 添加删除书籍方法
  deleteBook: async (id) => {
    console.log('开始删除书籍，ID:', id);
    
    // 首先获取书籍信息
    const book = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM books WHERE id = ?', [id], (err, row) => {
        if (err) {
          console.error('查询书籍失败:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });

    if (!book) {
      console.error('未找到书籍:', id);
      throw new Error('Book not found');
    }

    console.log('找到书籍:', book);

    // 删除文件
    try {
      // 删除书籍文件
      const bookPath = path.join(__dirname, '../public/uploads', book.path);
      console.log('正在删除书籍文件:', bookPath);
      await fs.unlink(bookPath);
      
      // 如果有封面，也删除封面
      if (book.coverPath) {
        const coverPath = path.join(__dirname, '../public', book.coverPath);
        console.log('正在删除封面文件:', coverPath);
        await fs.unlink(coverPath).catch(err => {
          console.warn('删除封面失败:', err);
        });
      }
    } catch (error) {
      console.error('删除文件失败:', error);
      // 继续删除数据库记录，即使文件删除失败
    }

    // 删除数据库记录
    return new Promise((resolve, reject) => {
      console.log('正在删除数据库记录...');
      db.run('DELETE FROM books WHERE id = ?', [id], (err) => {
        if (err) {
          console.error('删除数据库记录失败:', err);
          reject(err);
        } else {
          console.log('删除成功');
          resolve();
        }
      });
    });
  },

  // 添加用户相关方法
  createUser: (user) => {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
        [user.username, user.password, user.email],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  },

  getUserByUsername: (username) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  getUserById: (id) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  // 在 bookService 对象中添加新方法
  updateReadingProgress: (bookId, progress) => {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      console.log('更新阅读进度:', { bookId, progress, now });
      
      db.run(
        'UPDATE books SET readProgress = ?, lastRead = datetime("now", "localtime") WHERE id = ?',
        [progress, bookId],
        (err) => {
          if (err) {
            console.error('数据库更新失败:', err);
            reject(err);
          } else {
            console.log('数据库更新成功');
            resolve();
          }
        }
      );
    });
  }
};

module.exports = bookService; 