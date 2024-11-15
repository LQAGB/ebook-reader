const fs = require('fs');
const path = require('path');

const libsDir = path.join(__dirname, '../public/lib');

// 创建目录
const dirs = ['pdf.js', 'epub.js', 'jszip'].map(dir => path.join(libsDir, dir));
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// 复制文件
const files = [
    {
        src: '../node_modules/pdfjs-dist/build/pdf.min.js',
        dest: 'pdf.js/pdf.min.js'
    },
    {
        src: '../node_modules/pdfjs-dist/build/pdf.worker.min.js',
        dest: 'pdf.js/pdf.worker.min.js'
    },
    {
        src: '../node_modules/epubjs/dist/epub.min.js',
        dest: 'epub.js/epub.min.js'
    },
    {
        src: '../node_modules/jszip/dist/jszip.min.js',
        dest: 'jszip/jszip.min.js'
    }
];

files.forEach(file => {
    const srcPath = path.join(__dirname, file.src);
    const destPath = path.join(libsDir, file.dest);
    
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied ${file.dest}`);
    } else {
        console.error(`Source file not found: ${file.src}`);
    }
}); 