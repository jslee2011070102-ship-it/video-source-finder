/**
 * lib/vision.js
 * OpenAI GPT-4o mini Vision으로 영상 썸네일에
 * 하드코딩 자막(burnt-in subtitle) 존재 여부 분석
 */

const axios = require('axios');

const OPENAI_KEY = process.env.OPENAI_API_KEY;

/**
 * 썸네일 URL 하나에 대해 자막 여부 판정
 * @returns {{ hasSubtitle: boolean, confidence: string }}
 */
async function analyzeSubtitle(thumbnailUrl) {
  if (!OPENAI_KEY || !thumbnailUrl) {
    return { hasSubtitle: false, confidence: 'unknown' };
  }

  try {
    const res = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: thumbnailUrl, detail: 'low' }
              },
              {
                type: 'text',
                text: 'Does this video thumbnail/screenshot have burnt-in subtitles or hardcoded text overlaid across the video content? Answer only "yes" or "no".'
              }
            ]
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const answer = res.data.choices[0]?.message?.content?.toLowerCase().trim() || 'no';
    return {
      hasSubtitle: answer.startsWith('yes'),
      confidence: 'gpt4o-mini'
    };
  } catch (e) {
    console.warn('Vision API 오류:', e.message);
    return { hasSubtitle: false, confidence: 'error' };
  }
}

/**
 * 결과 배열 일괄 분석 (썸네일 있는 것만)
 * 병렬 처리, 최대 20개 제한
 */
async function analyzeResults(results) {
  const targets = results
    .filter(r => r.thumbnail && r.type === 'video')
    .slice(0, 20);

  const jobs = targets.map(async r => {
    const { hasSubtitle, confidence } = await analyzeSubtitle(r.thumbnail);
    return { ...r, hasSubtitle, subtitleConfidence: confidence };
  });

  const analyzed = await Promise.allSettled(jobs);
  const resultMap = new Map();
  analyzed.forEach(res => {
    if (res.status === 'fulfilled') {
      resultMap.set(res.value.url, res.value);
    }
  });

  return results.map(r => {
    if (resultMap.has(r.url)) return resultMap.get(r.url);
    return { ...r, hasSubtitle: null, subtitleConfidence: 'skipped' };
  });
}

module.exports = { analyzeSubtitle, analyzeResults };
