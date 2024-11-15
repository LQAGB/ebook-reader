const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 确保数据目录存在
const dbDir = path.join(__dirname, '../data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(path.join(dbDir, 'books.db'));

// 初始化数据库表
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY,
        original_name TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_type TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_read DATETIME,
        current_page INTEGER DEFAULT 1
    )`);
});

module.exports = db; 