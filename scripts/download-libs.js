const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const libs = [
    {
        url: 'https://unpkg.com/jszip@3.1.5/dist/jszip.min.js',
        path: 'public/js/lib/jszip.min.js',
        fallback: 'https://cdn.jsdelivr.net/npm/jszip@3.1.5/dist/jszip.min.js'
    },
    {
        url: 'https://unpkg.com/epubjs/dist/epub.min.js',
        path: 'public/js/lib/epub.min.js',
        fallback: 'https://cdn.jsdelivr.net/npm/epubjs/dist/epub.min.js'
    },
    {
        url: 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js',
        path: 'public/js/lib/pdf.min.js',
        fallback: 'https://mozilla.github.io/pdf.js/build/pdf.min.js'
    },
    {
        url: 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
        path: 'public/js/lib/pdf.worker.min.js',
        fallback: 'https://mozilla.github.io/pdf.js/build/pdf.worker.min.js'
    }
];

async function downloadWithRetry(url, fallbackUrl, filePath, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const currentUrl = i === 0 ? url : fallbackUrl;
            console.log(`Attempting to download from ${currentUrl}`);
            
            const response = await axios({
                url: currentUrl,
                method: 'GET',
                responseType: 'arraybuffer',
                timeout: 10000, // 10 seconds timeout
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, response.data);
            console.log(`Successfully downloaded: ${filePath}`);
            return;
        } catch (error) {
            console.error(`Attempt ${i + 1} failed for ${url}:`, error.message);
            if (i === retries - 1) {
                throw new Error(`Failed to download after ${retries} attempts`);
            }
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

async function downloadAll() {
    console.log('Starting downloads...');
    const results = [];
    
    for (const lib of libs) {
        try {
            await downloadWithRetry(lib.url, lib.fallback, lib.path);
            results.push({ path: lib.path, success: true });
        } catch (error) {
            console.error(`Failed to download ${lib.path}:`, error.message);
            results.push({ path: lib.path, success: false, error: error.message });
        }
    }

    // 打印下载结果摘要
    console.log('\nDownload Summary:');
    results.forEach(result => {
        if (result.success) {
            console.log(`✓ Success: ${result.path}`);
        } else {
            console.log(`✗ Failed: ${result.path} - ${result.error}`);
        }
    });

    // 检查是否所有文件都下载成功
    const allSuccess = results.every(r => r.success);
    if (!allSuccess) {
        console.error('\nSome downloads failed. Please try again or download manually.');
        process.exit(1);
    } else {
        console.log('\nAll downloads completed successfully!');
    }
}

// 添加错误处理
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
    process.exit(1);
});

downloadAll(); 