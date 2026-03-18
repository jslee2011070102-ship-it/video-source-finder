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
  // tbm 없이 일반 검색 — 비디오탭 제한 시 결과 없는 문제 방지
  const data = await serpSearch({ engine: 'google', q: `site:${site} ${keyword}`, num: 8, gl: 'us', hl: 'ko' });
  const raw  = data.organic_results || data.video_results || [];
  return raw.slice(0, 6).map(r => ({
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

  // 검색 링크 카드용: 브랜드 제외 단축 키워드 (2번째 단어부터 4개)
  const noBrandEn = keywordEn.split(' ').slice(1, 5).join(' ');
  const shortEn   = encodeURIComponent(noBrandEn);
  // 중국어 키워드: 한자가 포함된 단어만 추출 (브랜드명 영어 제거)
  const chWords = keywordZh.split(' ').filter(w => /[\u4e00-\u9fff]/.test(w));
  const noBrandZh = chWords.slice(0, 3).join(' ') || noBrandEn;
  const shortZh   = encodeURIComponent(noBrandZh);

  // ── 채널 정의 (검색 링크 카드용 URL: 단축 키워드 사용) ──
  const CHANNELS = [
    { name: 'TikTok',       icon: '🎵', searchUrl: `https://www.tiktok.com/search?q=${shortEn}` },
    { name: '抖音 Douyin',  icon: '🎵', searchUrl: `https://www.douyin.com/search/${shortZh}` },
    { name: '快手 Kwai',    icon: '⚡', searchUrl: `https://www.kwai.com/search?keyword=${shortEn}` },
    { name: 'Bilibili',     icon: '📺', searchUrl: `https://search.bilibili.com/video?keyword=${shortZh}` },
    { name: 'Instagram',    icon: '📸', searchUrl: `https://www.instagram.com/explore/tags/${enNoSpace}` },
    { name: '小红书',       icon: '🛍️', searchUrl: `https://www.xiaohongshu.com/search_result?keyword=${shortZh}&type=video` },
    { name: 'Lemon8',       icon: '🍋', searchUrl: `https://www.lemon8-app.com/search?keyword=${shortEn}` },
    { name: 'Pinterest',    icon: '📌', searchUrl: `https://www.pinterest.com/search/videos/?q=${shortEn}` },
    { name: 'Amazon',       icon: '🛒', searchUrl: `https://www.amazon.com/s?k=${shortEn}` },
    { name: 'AliExpress',   icon: '🛍️', searchUrl: `https://www.aliexpress.com/wholesale?SearchText=${shortEn}` },
    { name: '1688',         icon: '🏭', searchUrl: `https://s.1688.com/selloffer/offerlist.htm?keywords=${shortZh}` },
    { name: 'Alibaba',      icon: '🌐', searchUrl: `https://www.alibaba.com/trade/search?SearchText=${shortEn}` },
    { name: 'Taobao',       icon: '🧡', searchUrl: `https://s.taobao.com/search?q=${shortZh}` },
    { name: 'Tmall',        icon: '🏪', searchUrl: `https://list.tmall.com/search_product.htm?q=${shortZh}` },
    { name: 'Lazada',       icon: '🌏', searchUrl: `https://www.lazada.com/catalog/?q=${shortEn}` },
    { name: 'Shopee',       icon: '🟠', searchUrl: `https://shopee.com/search?keyword=${shortEn}` },
  ];

  let channelResults;

  if (HAS_SERP) {
    // ── SerpAPI 모드: 실제 검색 결과 병렬 수집 ──
    // 각 job에 채널 메타(폴백 URL 포함)도 함께 전달
    // SerpAPI용: 브랜드 제외 키워드 사용
    // Shopee/Lazada는 Google 인덱싱 안됨 → SerpAPI 호출 낭비 제거, 항상 링크 카드
    const jobs = [
      { ch: CHANNELS[0],  p: searchTikTok(noBrandEn) },
      { ch: CHANNELS[7],  p: searchPinterest(noBrandEn) },
      { ch: CHANNELS[3],  p: searchGoogleSite(noBrandZh, 'bilibili.com',    'Bilibili',    '📺') },
      { ch: CHANNELS[1],  p: searchGoogleSite(noBrandZh, 'douyin.com',      '抖音 Douyin', '🎵') },
      { ch: CHANNELS[2],  p: searchGoogleSite(noBrandEn, 'kwai.com',        '快手 Kwai',   '⚡') },
      { ch: CHANNELS[4],  p: searchGoogleSite(noBrandEn, 'instagram.com/reel', 'Instagram', '📸') },
      { ch: CHANNELS[5],  p: searchGoogleSite(noBrandZh, 'xiaohongshu.com', '小红书',      '🛍️') },
      { ch: CHANNELS[6],  p: searchGoogleSite(noBrandEn, 'lemon8-app.com',  'Lemon8',      '🍋') },
      { ch: CHANNELS[8],  p: searchGoogleSite(noBrandEn, 'amazon.com',      'Amazon',      '🛒') },
      { ch: CHANNELS[9],  p: searchGoogleSite(noBrandEn, 'aliexpress.com',  'AliExpress',  '🛍️') },
      { ch: CHANNELS[10], p: searchGoogleSite(noBrandZh, '1688.com',        '1688',        '🏭') },
      { ch: CHANNELS[11], p: searchGoogleSite(noBrandEn, 'alibaba.com',     'Alibaba',     '🌐') },
      { ch: CHANNELS[12], p: searchGoogleSite(noBrandZh, 'taobao.com',      'Taobao',      '🧡') },
      { ch: CHANNELS[13], p: searchGoogleSite(noBrandZh, 'tmall.com',       'Tmall',       '🏪') },
      // Lazada/Shopee: Google 미인덱스 → 항상 검색 링크 카드로 처리
      { ch: CHANNELS[14], p: Promise.resolve([]) },
      { ch: CHANNELS[15], p: Promise.resolve([]) },
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
