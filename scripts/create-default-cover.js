const fs = require('fs').promises;
const path = require('path');

async function createDefaultCover() {
  const svg = `
    <?xml version="1.0" encoding="UTF-8"?>
    <svg width="300" height="400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#f0f0f0;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#e0e0e0;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)"/>
      <rect width="90%" height="90%" x="5%" y="5%" fill="white" rx="10"/>
      <text x="50%" y="45%" font-family="Arial" font-size="40" fill="#666" text-anchor="middle" dominant-baseline="middle">
        NO COVER
      </text>
      <text x="50%" y="60%" font-family="Arial" font-size="16" fill="#999" text-anchor="middle" dominant-baseline="middle">
        默认封面
      </text>
    </svg>
  `;

  const coverDir = path.join(__dirname, '..', 'public', 'covers');
  await fs.mkdir(coverDir, { recursive: true });
  await fs.writeFile(path.join(coverDir, 'default.svg'), svg);
}

createDefaultCover().catch(console.error); 