/**
 * lib/coupang.js
 * Playwright + stealth 설정으로 쿠팡 봇 감지 우회 후 제품 정보 추출
 */

let chromium;
try {
  // playwright-extra + stealth 플러그인 우선 사용
  const { chromium: extraChromium } = require('playwright-extra');
  const stealth = require('puppeteer-extra-plugin-stealth');
  extraChromium.use(stealth());
  chromium = extraChromium;
  console.log('[coupang] stealth 모드 활성화');
} catch {
  // 미설치 시 기본 playwright fallback
  chromium = require('playwright').chromium;
  console.log('[coupang] 기본 playwright 모드');
}

async function scrapeProduct(url) {
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Upgrade-Insecure-Requests': '1'
    }
  });

  const page = await context.newPage();

  // webdriver 감지 차단
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => ({ length: 3 }) });
    window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {}, app: {} };
    Object.defineProperty(navigator, 'permissions', {
      get: () => ({ query: () => Promise.resolve({ state: 'granted' }) })
    });
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 쿠팡 봇 감지 우회: 랜덤 딜레이 + 마우스 이동 시뮬레이션
    await page.waitForTimeout(1500 + Math.random() * 1000);
    await page.mouse.move(300 + Math.random() * 200, 300 + Math.random() * 200);
    await page.waitForTimeout(500);

    // Access Denied 감지
    const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 100) || '');
    if (bodyText.toLowerCase().includes('access denied') || bodyText.includes('접근이 제한')) {
      throw new Error('쿠팡이 접근을 차단했습니다. 잠시 후 다시 시도해주세요.');
    }

    // 제품 페이지 로드 대기 (h1 요소)
    try {
      await page.waitForSelector('h1, .prod-buy-header__title', { timeout: 8000 });
    } catch {
      // 타임아웃이어도 계속 진행
    }

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
        const dt = document.title.replace(/\s*[-|]\s*쿠팡.*$/i, '').trim();
        if (dt && !dt.toLowerCase().includes('access')) title = dt.substring(0, 100);
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
        '.prod-img img',
        'img[class*="detail"]'
      ];
      let imageUrl = null;
      for (const sel of imgSelectors) {
        const el = document.querySelector(sel);
        if (el && el.src && el.src.startsWith('http') && !el.src.includes('icon')) {
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

    if (!data.title || data.title.toLowerCase().includes('access denied')) {
      throw new Error('제품 정보를 찾을 수 없습니다. URL이 올바른지 확인해주세요.');
    }

    return data;
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeProduct };
