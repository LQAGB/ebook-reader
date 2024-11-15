const db = require('../models/database');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class BookService {
    constructor() {
        this.uploadDir = path.join(__dirname, '../data/books');
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    async addBook(file) {
        const id = uuidv4();
        const ext = path.extname(file.name);
        const fileName = `${id}${ext}`;
        const filePath = path.join(this.uploadDir, fileName);

        return new Promise((resolve, reject) => {
            file.mv(filePath, async (err) => {
                if (err) return reject(err);

                db.run(`
                    INSERT INTO books (id, original_name, file_name, file_size, file_type, mime_type)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    id,
                    file.name,
                    fileName,
                    file.size,
                    ext.substring(1),
                    file.mimetype
                ], (err) => {
                    if (err) return reject(err);
                    resolve(id);
                });
            });
        });
    }

    async getAllBooks() {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM books ORDER BY upload_date DESC', (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    async getBook(id) {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM books WHERE id = ?', [id], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    }

    async updateLastRead(id, page) {
        return new Promise((resolve, reject) => {
            db.run(`
                UPDATE books 
                SET last_read = CURRENT_TIMESTAMP,
                    current_page = ?
                WHERE id = ?
            `, [page, id], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    getFilePath(fileName) {
        return path.join(this.uploadDir, fileName);
    }
}

module.exports = new BookService(); 