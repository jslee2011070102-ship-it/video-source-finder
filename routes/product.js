const express = require('express');
const router  = express.Router();
const { scrapeProduct } = require('../lib/coupang');

// POST /api/product  { url }
router.post('/', async (req, res) => {
  const { url } = req.body;
  if (!url || !url.includes('coupang.com')) {
    return res.status(400).json({ error: '유효한 쿠팡 URL을 입력해주세요.' });
  }

  try {
    const product = await scrapeProduct(url);
    if (!product?.title) {
      return res.status(404).json({ error: '제품 정보를 찾을 수 없습니다. URL을 확인해주세요.' });
    }
    res.json(product);
  } catch (e) {
    console.error('스크래핑 오류:', e.message);
    res.status(500).json({ error: '제품 정보 로딩 실패: ' + e.message });
  }
});

module.exports = router;
