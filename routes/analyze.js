const express = require('express');
const router  = express.Router();
const { analyzeResults } = require('../lib/vision');

// POST /api/analyze  { results: [{url, thumbnail, type, ...}] }
router.post('/', async (req, res) => {
  const { results } = req.body;
  if (!Array.isArray(results) || results.length === 0) {
    return res.status(400).json({ error: '분석할 결과 배열이 필요합니다.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(400).json({ error: 'OPENAI_API_KEY가 설정되지 않았습니다.' });
  }

  try {
    const analyzed = await analyzeResults(results);
    res.json({ results: analyzed });
  } catch (e) {
    console.error('Vision 분석 오류:', e.message);
    res.status(500).json({ error: '자막 분석 실패: ' + e.message });
  }
});

module.exports = router;
