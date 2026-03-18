/**
 * lib/coupang.js
 * Playwright로 쿠팡 상품 페이지에서 제품명과 이미지 URL 추출
 */

const { chromium } = require('playwright');

async function scrapeProduct(url) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'ko-KR'
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    const data = await page.evaluate(() => {
      // ── 제품명 ──
      const titleSelectors = [
        'h1.prod-buy-header__title',
        '.prod-buy-header__title',
        'h1[class*="title"]',
        'h1'
      ];
      let title = null;
      for (const sel of titleSelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim()) {
          title = el.textContent.trim().substring(0, 100);
          break;
        }
      }
      if (!title) {
        title = document.title.replace(/\s*[-|]\s*쿠팡.*$/i, '').trim().substring(0, 100);
      }

      // ── 키워드 (URL q= 파라미터 우선) ──
      const qParam = new URLSearchParams(window.location.search).get('q');
      const keyword = qParam ? qParam.trim() : (title ? title.substring(0, 50) : null);

      // ── 대표 이미지 URL ──
      const imgSelectors = [
        '.prod-image__detail img',
        '[class*="prod-image"] img',
        '.thumbnail-image img',
        '[class*="thumbnail"] img',
        '.prod-img img'
      ];
      let imageUrl = null;
      for (const sel of imgSelectors) {
        const el = document.querySelector(sel);
        if (el && el.src && el.src.startsWith('http')) {
          imageUrl = el.src;
          break;
        }
      }

      // ── 브랜드 ──
      const brandEl = document.querySelector('.prod-brand-name, [class*="brand-name"], .vendor-name');
      const brand = brandEl ? brandEl.textContent.trim().substring(0, 30) : null;

      // ── 가격 ──
      const priceEl = document.querySelector('.total-price strong, [class*="price"] strong, .sale-price');
      const price = priceEl ? priceEl.textContent.replace(/[^0-9,]/g, '') + '원' : null;

      return { title, keyword, imageUrl, brand, price };
    });

    return data;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeProduct };
