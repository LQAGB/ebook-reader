class Reader {
    constructor() {
        this.viewer = document.getElementById('viewer');
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.currentPageEl = document.getElementById('current-page');
        this.totalPagesEl = document.getElementById('total-pages');
        this.tocEl = document.getElementById('toc');
        
        this.setupSidebar();
        this.initReader();
    }

    setupSidebar() {
        const toggleBtn = document.getElementById('toggle-sidebar');
        const sidebar = document.getElementById('sidebar');
        
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    async initReader() {
        switch(fileExt) {
            case 'pdf':
                await this.initPDFReader();
                break;
            case 'epub':
                await this.initEPUBReader();
                break;
            case 'txt':
                await this.initTXTReader();
                break;
            default:
                this.viewer.innerHTML = '<p>不支持的文件格式</p>';
        }
    }

    async initPDFReader() {
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/lib/pdf.js/pdf.worker.min.js';

        try {
            const pdf = await pdfjsLib.getDocument(filePath).promise;
            this.totalPagesEl.textContent = pdf.numPages;
            let currentPage = 1;

            const renderPage = async (pageNum) => {
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1.5 });
                
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };

                await page.render(renderContext).promise;
                this.viewer.innerHTML = '';
                this.viewer.appendChild(canvas);
                this.currentPageEl.textContent = pageNum;
                this.saveProgress(pageNum);
            };

            this.prevBtn.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderPage(currentPage);
                }
            });

            this.nextBtn.addEventListener('click', () => {
                if (currentPage < pdf.numPages) {
                    currentPage++;
                    renderPage(currentPage);
                }
            });

            renderPage(currentPage);
        } catch (error) {
            console.error('Error loading PDF:', error);
            this.viewer.innerHTML = '<p>PDF 加载失败</p>';
        }
    }

    async initEPUBReader() {
        try {
            const book = ePub(filePath);
            const rendition = book.renderTo(this.viewer, {
                width: '100%',
                height: '600px',
                flow: "paginated",
                manager: "default"
            });

            rendition.display();

            // 添加键盘事件支持
            document.addEventListener('keyup', (e) => {
                if (e.key === 'ArrowLeft') rendition.prev();
                if (e.key === 'ArrowRight') rendition.next();
            });

            this.prevBtn.addEventListener('click', () => {
                rendition.prev();
            });

            this.nextBtn.addEventListener('click', () => {
                rendition.next();
            });

            // 加载目录
            const toc = await book.loaded.navigation;
            if (toc) {
                const tocItems = toc.toc.map(item => 
                    `<div class="toc-item" data-href="${item.href}">${item.label}</div>`
                ).join('');
                this.tocEl.innerHTML = tocItems;

                this.tocEl.addEventListener('click', (e) => {
                    if (e.target.classList.contains('toc-item')) {
                        const href = e.target.dataset.href;
                        rendition.display(href);
                    }
                });
            }

            // 更新页码信息
            rendition.on('relocated', (location) => {
                const currentPage = location.start.displayed.page;
                const totalPages = book.locations.total;
                this.currentPageEl.textContent = currentPage;
                this.totalPagesEl.textContent = totalPages || '-';
                this.saveProgress(currentPage);
            });

        } catch (error) {
            console.error('Error loading EPUB:', error);
            this.viewer.innerHTML = '<p>EPUB 加载失败</p>';
        }
    }

    async initTXTReader() {
        try {
            const response = await fetch(filePath);
            const text = await response.text();
            
            // 将文本分页
            const words = text.split(/\s+/);
            const wordsPerPage = 500;
            const pages = [];
            
            for (let i = 0; i < words.length; i += wordsPerPage) {
                pages.push(words.slice(i, i + wordsPerPage).join(' '));
            }

            let currentPage = 0;
            this.totalPagesEl.textContent = pages.length;

            const showPage = (pageNum) => {
                this.viewer.innerHTML = `<div class="txt-page">${pages[pageNum]}</div>`;
                this.currentPageEl.textContent = pageNum + 1;
                this.saveProgress(pageNum + 1);
            };

            this.prevBtn.addEventListener('click', () => {
                if (currentPage > 0) {
                    currentPage--;
                    showPage(currentPage);
                }
            });

            this.nextBtn.addEventListener('click', () => {
                if (currentPage < pages.length - 1) {
                    currentPage++;
                    showPage(currentPage);
                }
            });

            // 添加键盘事件支持
            document.addEventListener('keyup', (e) => {
                if (e.key === 'ArrowLeft' && currentPage > 0) {
                    currentPage--;
                    showPage(currentPage);
                }
                if (e.key === 'ArrowRight' && currentPage < pages.length - 1) {
                    currentPage++;
                    showPage(currentPage);
                }
            });

            showPage(currentPage);
        } catch (error) {
            console.error('Error loading TXT:', error);
            this.viewer.innerHTML = '<p>TXT 加载失败</p>';
        }
    }

    async saveProgress(page) {
        try {
            await fetch(`/api/books/${book.id}/progress`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ page })
            });
        } catch (error) {
            console.error('Failed to save progress:', error);
        }
    }
}

// 初始化阅读器
document.addEventListener('DOMContentLoaded', () => {
    new Reader();
}); 