require('dotenv').config();
const axios = require('axios');
const key = process.env.SERP_API_KEY;
console.log('키:', key ? key.substring(0, 15) + '...' : 'None');
axios.get('https://serpapi.com/account', {
  params: { api_key: key }, timeout: 10000
}).then(r => {
  const d = r.data;
  console.log('플랜:', d.plan_name);
  console.log('이번달 검색:', d.this_month_usage);
  console.log('한도:', d.plan_searches_left, '남음 /총', d.searches_per_month);
}).catch(e => {
  console.log('오류:', e.response?.status, JSON.stringify(e.response?.data));
});
