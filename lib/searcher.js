/**
 * lib/searcher.js
 * 16개 채널 검색
 * - SerpAPI 있으면: 실제 검색 결과 가져오기
 * - SerpAPI 없으면: 각 채널 검색 링크 카드 생성 (폴백)
 * - Bilibili: SerpAPI site: 검색으로 처리
 */

const axios = require('axios');

const SERP_KEY = process.env.SERP_API_KEY;
const HAS_SERP = !!(SERP_KEY && SERP_KEY !== 'your_serpapi_key_here');

if (!HAS_SERP) {
  console.log('[searcher] SerpAPI 키 없음 → 검색 링크 카드 모드로 동작');
}

/* ── Google Translate 무료 API ── */
async function translateKeyword(keyword) {
  try {
    const [enRes, zhRes] = await Promise.all([
      axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=en&dt=t&q=${encodeURIComponent(keyword)}`),
      axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=zh-CN&dt=t&q=${encodeURIComponent(keyword)}`)
    ]);
    return { en: enRes.data[0][0][0], zh: zhRes.data[0][0][0] };
  } catch {
    return { en: keyword, zh: keyword };
  }
}

/* ── SerpAPI 요청 ── */
async function serpSearch(params) {
  if (!HAS_SERP) return {};
  try {
    const res = await axios.get('https://serpapi.com/search', {
      params: { api_key: SERP_KEY, ...params },
      timeout: 15000
    });
    return res.data;
  } catch (e) {
    console.warn(`SerpAPI 오류 (${params.engine}):`, e.response?.status || e.message);
    return {};
  }
}

/* ── SerpAPI: TikTok ── */
async function searchTikTok(keyword) {
  const data = await serpSearch({ engine: 'tiktok', search_query: keyword });
  return (data.video_results || []).slice(0, 8).map(v => ({
    platform: 'TikTok', platformIcon: '🎵',
    title: v.title || '', url: v.share_url || v.video_url || '',
    thumbnail: v.thumbnail || '', type: 'video'
  }));
}

/* ── SerpAPI: Pinterest ── */
async function searchPinterest(keyword) {
  const data = await serpSearch({ engine: 'pinterest', q: keyword });
  return (data.pins_results || []).slice(0, 6).map(p => ({
    platform: 'Pinterest', platformIcon: '📌',
    title: p.title || p.description || '', url: p.link || '',
    thumbnail: p.image_src || p.thumbnail || '', type: 'video'
  }));
}

/* ── SerpAPI: Google site: 검색 ── */
async function searchGoogleSite(keyword, site, platform, icon) {
  const data = await serpSearch({ engine: 'google', q: `site:${site} ${keyword}`, num: 6, tbm: 'vid' });
  const raw  = data.organic_results || data.video_results || [];
  return raw.slice(0, 5).map(r => ({
    platform, platformIcon: icon,
    title: r.title || '', url: r.link || '',
    thumbnail: r.thumbnail?.src || r.thumbnail || '', type: 'video'
  }));
}

/* ── 폴백: 검색 링크 카드 (SerpAPI 없을 때) ── */
function buildSearchLinkCard(platform, icon, searchUrl) {
  return {
    platform, platformIcon: icon,
    title: `${platform} 에서 검색하기 →`,
    url: searchUrl, thumbnail: '', type: 'search_link'
  };
}

/* ── 이미지 검색 링크 ── */
function buildImageSearchLinks(imageUrl) {
  if (!imageUrl) return [];
  const enc = encodeURIComponent(imageUrl);
  return [
    { platform: 'Google Lens',  platformIcon: '🔍', title: 'Google Lens 이미지 검색', url: `https://lens.google.com/uploadbyurl?url=${enc}`,                  thumbnail: imageUrl, type: 'image_search' },
    { platform: 'Yandex',       platformIcon: '🟡', title: 'Yandex 이미지 검색',      url: `https://yandex.com/images/search?url=${enc}&rpt=imageview`,           thumbnail: imageUrl, type: 'image_search' },
    { platform: 'Baidu',        platformIcon: '🔵', title: 'Baidu 이미지 검색',        url: `https://graph.baidu.com/pcpage/similar?originImageUrl=${enc}`,         thumbnail: imageUrl, type: 'image_search' },
    { platform: 'Bing',         platformIcon: '🪟', title: 'Bing 이미지 검색',         url: `https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:${enc}`, thumbnail: imageUrl, type: 'image_search' },
  ];
}

/* ── 전체 채널 검색 ── */
async function searchAllChannels(keyword, keywordEn, keywordZh, imageUrl) {
  const en        = encodeURIComponent(keywordEn);
  const zh        = encodeURIComponent(keywordZh);
  const enNoSpace = encodeURIComponent(keywordEn.replace(/ /g, ''));

  // ── 채널 정의 ──
  const CHANNELS = [
    { name: 'TikTok',       icon: '🎵', searchUrl: `https://www.tiktok.com/search?q=${en}` },
    { name: '抖音 Douyin',  icon: '🎵', searchUrl: `https://www.douyin.com/search/${zh}` },
    { name: '快手 Kwai',    icon: '⚡', searchUrl: `https://www.kwai.com/search?keyword=${en}` },
    { name: 'Bilibili',     icon: '📺', searchUrl: `https://search.bilibili.com/video?keyword=${zh}` },
    { name: 'Instagram',    icon: '📸', searchUrl: `https://www.instagram.com/explore/tags/${enNoSpace}` },
    { name: '小红书',       icon: '🛍️', searchUrl: `https://www.xiaohongshu.com/search_result?keyword=${zh}` },
    { name: 'Lemon8',       icon: '🍋', searchUrl: `https://www.lemon8-app.com/search?keyword=${en}` },
    { name: 'Pinterest',    icon: '📌', searchUrl: `https://www.pinterest.com/search/pins/?q=${en}` },
    { name: 'Amazon',       icon: '🛒', searchUrl: `https://www.amazon.com/s?k=${en}` },
    { name: 'AliExpress',   icon: '🛍️', searchUrl: `https://www.aliexpress.com/wholesale?SearchText=${en}` },
    { name: '1688',         icon: '🏭', searchUrl: `https://s.1688.com/selloffer/offerlist.htm?keywords=${zh}` },
    { name: 'Alibaba',      icon: '🌐', searchUrl: `https://www.alibaba.com/trade/search?SearchText=${en}` },
    { name: 'Taobao',       icon: '🧡', searchUrl: `https://s.taobao.com/search?q=${zh}` },
    { name: 'Tmall',        icon: '🏪', searchUrl: `https://list.tmall.com/search_product.htm?q=${zh}` },
    { name: 'Lazada',       icon: '🌏', searchUrl: `https://www.lazada.com/catalog/?q=${en}` },
    { name: 'Shopee',       icon: '🟠', searchUrl: `https://shopee.com/search?keyword=${en}` },
  ];

  let channelResults;

  if (HAS_SERP) {
    // ── SerpAPI 모드: 실제 검색 결과 병렬 수집 ──
    // 각 job에 채널 메타(폴백 URL 포함)도 함께 전달
    const jobs = [
      { ch: CHANNELS[0],  p: searchTikTok(keywordEn) },
      { ch: CHANNELS[7],  p: searchPinterest(keywordEn) },
      { ch: CHANNELS[3],  p: searchGoogleSite(keywordZh, 'bilibili.com',    'Bilibili',    '📺') },
      { ch: CHANNELS[1],  p: searchGoogleSite(keywordZh, 'douyin.com',      '抖音 Douyin', '🎵') },
      { ch: CHANNELS[2],  p: searchGoogleSite(keywordEn, 'kwai.com',        '快手 Kwai',   '⚡') },
      { ch: CHANNELS[4],  p: searchGoogleSite(keywordEn, 'instagram.com',   'Instagram',   '📸') },
      { ch: CHANNELS[5],  p: searchGoogleSite(keywordZh, 'xiaohongshu.com', '小红书',      '🛍️') },
      { ch: CHANNELS[6],  p: searchGoogleSite(keywordEn, 'lemon8-app.com',  'Lemon8',      '🍋') },
      { ch: CHANNELS[8],  p: searchGoogleSite(keywordEn, 'amazon.com',      'Amazon',      '🛒') },
      { ch: CHANNELS[9],  p: searchGoogleSite(keywordEn, 'aliexpress.com',  'AliExpress',  '🛍️') },
      { ch: CHANNELS[10], p: searchGoogleSite(keywordZh, '1688.com',        '1688',        '🏭') },
      { ch: CHANNELS[11], p: searchGoogleSite(keywordEn, 'alibaba.com',     'Alibaba',     '🌐') },
      { ch: CHANNELS[12], p: searchGoogleSite(keywordZh, 'taobao.com',      'Taobao',      '🧡') },
      { ch: CHANNELS[13], p: searchGoogleSite(keywordZh, 'tmall.com',       'Tmall',       '🏪') },
      { ch: CHANNELS[14], p: searchGoogleSite(keywordEn, 'lazada.com',      'Lazada',      '🌏') },
      { ch: CHANNELS[15], p: searchGoogleSite(keywordEn, 'shopee.com',      'Shopee',      '🟠') },
    ];

    const settled = await Promise.allSettled(jobs.map(j => j.p));

    channelResults = settled.map((result, i) => {
      const { ch } = jobs[i];
      const items = result.status === 'fulfilled' ? result.value : [];
      // 결과가 없으면 검색 링크 카드로 자동 폴백
      if (items.length === 0) {
        return { channel: ch.name, results: [ buildSearchLinkCard(ch.name, ch.icon, ch.searchUrl) ] };
      }
      return { channel: ch.name, results: items };
    });

  } else {
    // ── 폴백 모드: 검색 링크 카드 생성 ──
    channelResults = CHANNELS.map(ch => ({
      channel: ch.name,
      results: [ buildSearchLinkCard(ch.name, ch.icon, ch.searchUrl) ]
    }));
  }

  // 이미지 검색 링크 추가
  if (imageUrl) {
    channelResults.push({ channel: '이미지 검색', results: buildImageSearchLinks(imageUrl) });
  }

  return channelResults;
}

module.exports = { searchAllChannels, translateKeyword, HAS_SERP };
