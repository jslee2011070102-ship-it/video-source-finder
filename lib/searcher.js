/**
 * lib/searcher.js
 * 16개 채널에서 제품명(영어/중국어) + 이미지 URL로 동영상 검색
 * - SerpAPI : TikTok, Pinterest, Google(site: 필터)
 * - Bilibili 공식 API
 * - 이미지 검색 링크 (Google Lens, Yandex, Baidu)
 */

const axios = require('axios');

const SERP_KEY = process.env.SERP_API_KEY;

/* ── Google Translate 무료 API로 키워드 번역 ── */
async function translateKeyword(keyword) {
  try {
    const [enRes, zhRes] = await Promise.all([
      axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=en&dt=t&q=${encodeURIComponent(keyword)}`),
      axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=zh-CN&dt=t&q=${encodeURIComponent(keyword)}`)
    ]);
    return {
      en: enRes.data[0][0][0],
      zh: zhRes.data[0][0][0]
    };
  } catch {
    return { en: keyword, zh: keyword };
  }
}

/* ── SerpAPI 공통 요청 ── */
async function serpSearch(params) {
  if (!SERP_KEY) return [];
  try {
    const res = await axios.get('https://serpapi.com/search', {
      params: { api_key: SERP_KEY, ...params },
      timeout: 15000
    });
    return res.data;
  } catch (e) {
    console.warn(`SerpAPI 오류 (${params.engine}):`, e.message);
    return {};
  }
}

/* ── TikTok 검색 (SerpAPI) ── */
async function searchTikTok(keyword) {
  const data = await serpSearch({ engine: 'tiktok', search_query: keyword });
  const videos = data.video_results || [];
  return videos.slice(0, 8).map(v => ({
    platform: 'TikTok',
    platformIcon: '🎵',
    title: v.title || '',
    url: v.share_url || v.video_url || '',
    thumbnail: v.thumbnail || '',
    type: 'video'
  }));
}

/* ── Pinterest 검색 (SerpAPI) ── */
async function searchPinterest(keyword) {
  const data = await serpSearch({ engine: 'pinterest', q: keyword });
  const pins = data.pins_results || [];
  return pins.filter(p => p.tracking_url?.includes('video') || p.description?.toLowerCase().includes('video'))
    .slice(0, 5).map(p => ({
      platform: 'Pinterest',
      platformIcon: '📌',
      title: p.title || p.description || '',
      url: p.link || '',
      thumbnail: p.thumbnail || p.image_src || '',
      type: 'video'
    }));
}

/* ── Google 검색 + site 필터 (SerpAPI) ── */
async function searchGoogleSite(keyword, site, platform, icon) {
  const data = await serpSearch({
    engine: 'google',
    q: `site:${site} ${keyword} video`,
    num: 6
  });
  const results = data.organic_results || [];
  return results.slice(0, 5).map(r => ({
    platform,
    platformIcon: icon,
    title: r.title || '',
    url: r.link || '',
    thumbnail: r.thumbnail || '',
    type: 'video'
  }));
}

/* ── Bilibili 공식 API ── */
async function searchBilibili(keyword) {
  try {
    const res = await axios.get('https://api.bilibili.com/x/web-interface/search/type', {
      params: { keyword, search_type: 'video', page: 1, pagesize: 8 },
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.bilibili.com' },
      timeout: 10000
    });
    const videos = res.data?.data?.result || [];
    return videos.slice(0, 8).map(v => ({
      platform: 'Bilibili',
      platformIcon: '📺',
      title: v.title?.replace(/<[^>]+>/g, '') || '',
      url: `https://www.bilibili.com/video/${v.bvid}`,
      thumbnail: v.pic ? (v.pic.startsWith('http') ? v.pic : 'https:' + v.pic) : '',
      type: 'video'
    }));
  } catch (e) {
    console.warn('Bilibili API 오류:', e.message);
    return [];
  }
}

/* ── 이미지 검색 링크 생성 (URL 방식) ── */
function buildImageSearchLinks(imageUrl) {
  if (!imageUrl) return [];
  const enc = encodeURIComponent(imageUrl);
  return [
    { platform: 'Google Lens',   platformIcon: '🔍', title: '이미지로 Google Lens 검색', url: `https://lens.google.com/uploadbyurl?url=${enc}`, thumbnail: imageUrl, type: 'image_search' },
    { platform: 'Yandex',        platformIcon: '🟡', title: '이미지로 Yandex 검색',      url: `https://yandex.com/images/search?url=${enc}&rpt=imageview`, thumbnail: imageUrl, type: 'image_search' },
    { platform: 'Baidu',         platformIcon: '🔵', title: '이미지로 Baidu 검색',        url: `https://graph.baidu.com/pcpage/similar?originImageUrl=${enc}`, thumbnail: imageUrl, type: 'image_search' },
  ];
}

/* ── 전체 채널 병렬 검색 ── */
async function searchAllChannels(keyword, keywordEn, keywordZh, imageUrl) {
  const channelJobs = [
    // SerpAPI: TikTok
    searchTikTok(keywordEn).then(r => ({ channel: 'TikTok',       results: r })),
    // SerpAPI: Pinterest
    searchPinterest(keywordEn).then(r => ({ channel: 'Pinterest',  results: r })),
    // Bilibili 공식 API
    searchBilibili(keywordZh).then(r => ({ channel: 'Bilibili',    results: r })),
    // Google site: 검색
    searchGoogleSite(keywordZh, 'douyin.com',       '抖音 Douyin',   '🎵').then(r => ({ channel: 'Douyin',      results: r })),
    searchGoogleSite(keywordEn, 'kwai.com',         '快手 Kwai',     '⚡').then(r => ({ channel: 'Kwai',        results: r })),
    searchGoogleSite(keywordEn, 'instagram.com',    'Instagram',    '📸').then(r => ({ channel: 'Instagram',   results: r })),
    searchGoogleSite(keywordZh, 'xiaohongshu.com',  '小红书',        '🛍️').then(r => ({ channel: 'Xiaohongshu', results: r })),
    searchGoogleSite(keywordEn, 'lemon8-app.com',   'Lemon8',       '🍋').then(r => ({ channel: 'Lemon8',      results: r })),
    searchGoogleSite(keywordEn, 'amazon.com',       'Amazon',       '🛒').then(r => ({ channel: 'Amazon',      results: r })),
    searchGoogleSite(keywordEn, 'aliexpress.com',   'AliExpress',   '🛍️').then(r => ({ channel: 'AliExpress',  results: r })),
    searchGoogleSite(keywordZh, '1688.com',         '1688 도매',    '🏭').then(r => ({ channel: '1688',        results: r })),
    searchGoogleSite(keywordEn, 'alibaba.com',      'Alibaba',      '🌐').then(r => ({ channel: 'Alibaba',     results: r })),
    searchGoogleSite(keywordZh, 'taobao.com',       'Taobao',       '🧡').then(r => ({ channel: 'Taobao',      results: r })),
    searchGoogleSite(keywordZh, 'tmall.com',        'Tmall',        '🏪').then(r => ({ channel: 'Tmall',       results: r })),
    searchGoogleSite(keywordEn, 'lazada.com',       'Lazada',       '🌏').then(r => ({ channel: 'Lazada',      results: r })),
    searchGoogleSite(keywordEn, 'shopee.com',       'Shopee',       '🟠').then(r => ({ channel: 'Shopee',      results: r })),
  ];

  const channelResults = await Promise.allSettled(channelJobs);

  const all = [];
  channelResults.forEach(res => {
    if (res.status === 'fulfilled') {
      all.push(res.value);
    }
  });

  // 이미지 검색 링크 추가
  if (imageUrl) {
    all.push({ channel: '이미지 검색', results: buildImageSearchLinks(imageUrl) });
  }

  return all;
}

module.exports = { searchAllChannels, translateKeyword };
