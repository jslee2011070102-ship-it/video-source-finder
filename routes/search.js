const express  = require('express');
const router   = express.Router();
const { searchAllChannels, translateKeyword } = require('../lib/searcher');

// POST /api/search  { keyword, imageUrl }
router.post('/', async (req, res) => {
  const { keyword, imageUrl } = req.body;
  if (!keyword) {
    return res.status(400).json({ error: '키워드가 필요합니다.' });
  }

  try {
    // 키워드 번역
    const { en, zh } = await translateKeyword(keyword);
    console.log(`검색 키워드: ${keyword} / ${en} / ${zh}`);

    // 16개 채널 병렬 검색
    const channelResults = await searchAllChannels(keyword, en, zh, imageUrl);

    res.json({
      keyword: { ko: keyword, en, zh },
      channels: channelResults
    });
  } catch (e) {
    console.error('검색 오류:', e.message);
    res.status(500).json({ error: '검색 실패: ' + e.message });
  }
});

module.exports = router;
