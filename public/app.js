/**
 * app.js — 프론트엔드 메인 로직
 */

const $ = id => document.getElementById(id);

let allResults = [];       // 전체 검색 결과 (플랫폼 포함)
let currentProduct = null; // 현재 제품 정보

// ── 유틸 ──
function show(id)  { $(id)?.classList.remove('hidden'); }
function hide(id)  { $(id)?.classList.add('hidden'); }
function showError(msg) {
  $('error-msg').textContent = msg;
  show('error-msg');
}

// ── 채널 상태 칩 ──
const channelChips = new Map();
function setChannelStatus(channel, status) {
  if (!channelChips.has(channel)) {
    const chip = document.createElement('span');
    chip.className = 'channel-chip';
    chip.textContent = channel;
    chip.id = `chip-${channel}`;
    $('channel-status').appendChild(chip);
    channelChips.set(channel, chip);
  }
  const chip = channelChips.get(channel);
  chip.className = `channel-chip ${status}`;
}

// ── 진행바 ──
function setProgress(done, total) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  $('progress-bar').style.width = pct + '%';
  $('progress-count').textContent = `${done} / ${total}`;
}

// ── 제품 정보 렌더링 ──
function renderProduct(product) {
  $('product-image').src = product.imageUrl || '';
  $('product-image').style.display = product.imageUrl ? '' : 'none';
  $('product-title').textContent = product.title || '(제목 없음)';
  const meta = [product.brand, product.price].filter(Boolean).join(' · ');
  $('product-meta').textContent = meta;
  show('product-card');
}

// ── 키워드 표시 ──
function renderKeywords(kw) {
  $('keywords-display').textContent = `${kw.ko}  /  ${kw.en}  /  ${kw.zh}`;
}

// ── 영상 카드 생성 ──
function createVideoCard(item) {
  if (item.type === 'image_search' || item.type === 'search_link') {
    const a = document.createElement('a');
    a.href = item.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'image-search-card';
    a.innerHTML = `
      <span class="image-search-icon">${item.platformIcon || '🔍'}</span>
      <div class="image-search-info">
        <div class="image-search-platform">${item.platform}</div>
        <div class="image-search-desc">${item.title}</div>
      </div>
      <span style="color:#bbb;font-size:18px;">→</span>
    `;
    return a;
  }

  const a = document.createElement('a');
  a.href = item.url || '#';
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.className = 'video-card';

  // 자막 배지
  let badge = '';
  if (item.hasSubtitle === false) {
    badge = '<span class="subtitle-badge badge-no">자막 없음</span>';
  } else if (item.hasSubtitle === true) {
    badge = '<span class="subtitle-badge badge-yes">자막 있음</span>';
  }

  const thumbHtml = item.thumbnail
    ? `<img class="video-thumb" src="${item.thumbnail}" alt="" loading="lazy" onerror="this.parentNode.innerHTML='<div class=video-thumb-placeholder>${item.platformIcon || '🎬'}</div>'">`
    : `<div class="video-thumb-placeholder">${item.platformIcon || '🎬'}</div>`;

  a.innerHTML = `
    <div class="video-thumb-wrap">
      ${thumbHtml}
      ${badge}
    </div>
    <div class="video-body">
      <div class="video-platform">${item.platformIcon || ''} ${item.platform}</div>
      <div class="video-title">${item.title || '(제목 없음)'}</div>
    </div>
  `;
  return a;
}

// ── 결과 렌더링 ──
function renderResults(channels) {
  // 전체 결과 평탄화
  allResults = [];
  channels.forEach(ch => {
    (ch.results || []).forEach(r => allResults.push(r));
  });

  // 타입별 분류
  const imageSearchItems = allResults.filter(r => r.type === 'image_search');
  const searchLinkItems  = allResults.filter(r => r.type === 'search_link');
  const videoItems = allResults.filter(r => r.type === 'video');
  const noSubtitle  = videoItems.filter(r => r.hasSubtitle === false);
  const hasSubtitle = videoItems.filter(r => r.hasSubtitle === true);
  const unanalyzed  = videoItems.filter(r => r.hasSubtitle === null || r.hasSubtitle === undefined);

  // 요약
  if (searchLinkItems.length > 0) {
    $('result-summary').textContent =
      `SerpAPI 키 없음 — 채널 직접 검색 링크 ${searchLinkItems.length}개 · 이미지 검색 ${imageSearchItems.length}개`;
  } else {
    $('result-summary').textContent =
      `총 ${videoItems.length}개 영상 · 자막 없음 ${noSubtitle.length}개 · 이미지 검색 ${imageSearchItems.length}개`;
  }

  // 자막 없음
  if (noSubtitle.length > 0) {
    $('count-no-subtitle').textContent = `(${noSubtitle.length}개)`;
    const grid = $('grid-no-subtitle');
    grid.innerHTML = '';
    noSubtitle.forEach(item => grid.appendChild(createVideoCard(item)));
    show('section-no-subtitle');
  }

  // 이미지 검색
  if (imageSearchItems.length > 0) {
    const grid = $('grid-image-search');
    grid.innerHTML = '';
    imageSearchItems.forEach(item => grid.appendChild(createVideoCard(item)));
    show('section-image-search');
  }

  // 채널 검색 링크 (SerpAPI 없을 때)
  if (searchLinkItems.length > 0) {
    const el = $('section-search-links');
    if (el) {
      const grid = $('grid-search-links');
      grid.innerHTML = '';
      searchLinkItems.forEach(item => grid.appendChild(createVideoCard(item)));
      show('section-search-links');
    }
  }

  // 미분석 (자막 분석 전)
  if (unanalyzed.length > 0) {
    $('count-unanalyzed').textContent = `(${unanalyzed.length}개)`;
    const grid = $('grid-unanalyzed');
    grid.innerHTML = '';
    unanalyzed.forEach(item => grid.appendChild(createVideoCard(item)));
    show('section-unanalyzed');
  }

  // 자막 있음
  if (hasSubtitle.length > 0) {
    $('count-has-subtitle').textContent = `(${hasSubtitle.length}개)`;
    const grid = $('grid-has-subtitle');
    grid.innerHTML = '';
    hasSubtitle.forEach(item => grid.appendChild(createVideoCard(item)));
    show('section-has-subtitle');
  }

  show('results-section');
}

// ── 자막 AI 분석 버튼 ──
$('btn-analyze')?.addEventListener('click', async () => {
  const toAnalyze = allResults.filter(r => r.type === 'video' && r.hasSubtitle === undefined);
  if (toAnalyze.length === 0) return;

  $('btn-analyze').textContent = '🤖 분석 중...';
  $('btn-analyze').disabled = true;

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results: toAnalyze })
    });
    const data = await res.json();

    if (data.results) {
      // 분석 결과를 allResults에 반영
      const analyzed = new Map(data.results.map(r => [r.url, r]));
      allResults = allResults.map(r => analyzed.get(r.url) || r);

      // 결과 다시 렌더링
      const pseudoChannels = [{ results: allResults }];
      renderResults(pseudoChannels);
    }
  } catch (e) {
    alert('자막 분석 실패: ' + e.message);
  } finally {
    $('btn-analyze').textContent = '🤖 자막 AI 분석';
    $('btn-analyze').disabled = false;
  }
});

// ── 필터 버튼 ──
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const f = btn.dataset.filter;
    const sections = {
      'section-no-subtitle':  ['all', 'no-subtitle'],
      'section-image-search': ['all', 'image_search'],
      'section-unanalyzed':   ['all'],
      'section-has-subtitle': ['all', 'has-subtitle']
    };
    Object.entries(sections).forEach(([id, filters]) => {
      const el = $(id);
      if (!el) return;
      el.style.display = filters.includes(f) ? '' : 'none';
    });
  });
});

// ── 메인 검색 플로우 ──
$('btn-search').addEventListener('click', startSearch);
$('coupang-url').addEventListener('keydown', e => {
  if (e.key === 'Enter') startSearch();
});

async function startSearch() {
  const url = $('coupang-url').value.trim();
  if (!url) { showError('쿠팡 URL을 입력해주세요.'); return; }
  if (!url.includes('coupang.com')) { showError('쿠팡(coupang.com) URL만 지원합니다.'); return; }

  hide('error-msg');
  hide('product-card');
  hide('progress-section');
  hide('results-section');
  hide('section-no-subtitle');
  hide('section-image-search');
  hide('section-search-links');
  hide('section-has-subtitle');
  hide('section-unanalyzed');
  $('channel-status').innerHTML = '';
  channelChips.clear();
  allResults = [];

  $('btn-search').disabled = true;
  $('btn-search').textContent = '⏳ 로딩 중...';

  // ── Step 1: 제품 정보 스크래핑 ──
  try {
    $('progress-text').textContent = '쿠팡 제품 정보 로딩 중...';
    setProgress(0, 1);
    show('progress-section');

    const productRes = await fetch('/api/product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const product = await productRes.json();

    if (!productRes.ok) {
      showError(product.error || '제품 정보 로딩 실패');
      return;
    }

    currentProduct = product;
    renderProduct(product);

  } catch (e) {
    showError('서버 연결 실패. node server.js가 실행 중인지 확인하세요.');
    return;
  } finally {
    $('btn-search').disabled = false;
    $('btn-search').textContent = '🔍 분석 시작';
  }

  // ── Step 2: 채널 검색 ──
  const CHANNELS = [
    'TikTok','Pinterest','Bilibili','Douyin','Kwai','Instagram',
    '小红书','Lemon8','Amazon','AliExpress','1688','Alibaba',
    'Taobao','Tmall','Lazada','Shopee','이미지 검색'
  ];
  const total = CHANNELS.length;
  CHANNELS.forEach(ch => setChannelStatus(ch, 'loading'));
  $('progress-text').textContent = '채널 검색 중...';
  setProgress(0, total);

  try {
    const searchRes = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: currentProduct.keyword || currentProduct.title,
        imageUrl: currentProduct.imageUrl
      })
    });
    const searchData = await searchRes.json();

    if (!searchRes.ok) {
      showError(searchData.error || '검색 실패');
      return;
    }

    renderKeywords(searchData.keyword);

    // 채널별 결과 반영
    let done = 0;
    searchData.channels.forEach(ch => {
      done++;
      const status = ch.results?.length > 0 ? 'done' : 'error';
      setChannelStatus(ch.channel, status);
      setProgress(done, total);
    });

    $('progress-text').textContent = `검색 완료 — 총 ${searchData.channels.reduce((s, c) => s + (c.results?.length || 0), 0)}개 결과`;
    renderResults(searchData.channels);

  } catch (e) {
    showError('검색 중 오류 발생: ' + e.message);
  }
}
