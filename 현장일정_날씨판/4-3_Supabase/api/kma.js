// GET /api/kma?region=대전 – 지역 일정, 오늘 예보, 일정별 판단
const { SUPABASE_URL, SUPABASE_KEY } = require('../config.js');
const { REGIONS, judge } = require('../logic.js');

const GRID = { '세종': [66, 103], '대전': [67, 100], '태안': [48, 109], '보령': [54, 100] };
const REGION_ALIASES = { sejong: '세종', daejeon: '대전', taean: '태안', boryeong: '보령' };
const KST_OFFSET = 9 * 60 * 60 * 1000;

function formatDate(date) {
  return String(date.getUTCFullYear())
    + String(date.getUTCMonth() + 1).padStart(2, '0')
    + String(date.getUTCDate()).padStart(2, '0');
}

function baseTime(now) {
  const kst = new Date(now.getTime() + KST_OFFSET);
  const forecastDate = formatDate(kst);
  const minutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  const slots = [2, 5, 8, 11, 14, 17, 20, 23];
  const available = slots.filter((hour) => hour * 60 + 10 <= minutes);
  let baseHour;

  if (available.length) {
    baseHour = available[available.length - 1];
  } else {
    kst.setUTCDate(kst.getUTCDate() - 1);
    baseHour = 23;
  }

  return {
    date: formatDate(kst),
    time: String(baseHour).padStart(2, '0') + '00',
    forecastDate,
  };
}

function maxValue(items, category) {
  const values = items
    .filter((item) => item.category === category)
    .map((item) => Number(item.fcstValue))
    .filter(Number.isFinite);
  return values.length ? Math.max(...values) : null;
}

async function loadWeather(region, key, time) {
  const grid = GRID[region];
  const serviceKey = key.includes('%') ? key : encodeURIComponent(key);
  const url = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst'
    + '?serviceKey=' + serviceKey
    + '&pageNo=1&numOfRows=1000&dataType=JSON'
    + '&base_date=' + time.date + '&base_time=' + time.time
    + '&nx=' + grid[0] + '&ny=' + grid[1];
  const response = await fetch(url);
  const text = await response.text();

  if (!text.trim().startsWith('{')) {
    const message = text.match(/<returnAuthMsg>([^<]+)</) || text.match(/<errMsg>([^<]+)</);
    throw new Error('기상청 키 오류: ' + (message ? message[1] : text.slice(0, 120)));
  }

  const json = JSON.parse(text);
  if (!response.ok || json.response.header.resultCode !== '00') {
    throw new Error(json.response.header.resultMsg || '기상청 응답 코드 ' + response.status);
  }

  const allItems = json.response.body.items.item || [];
  const todayItems = allItems.filter((item) => item.fcstDate === time.forecastDate);
  const tempMax = maxValue(todayItems, 'TMX');
  const weather = {
    tempMax: tempMax === null ? maxValue(todayItems, 'TMP') : tempMax,
    windMax: maxValue(todayItems, 'WSD'),
    rainProb: maxValue(todayItems, 'POP'),
  };

  if (Object.values(weather).some((value) => value === null)) {
    throw new Error('오늘 예보 자료가 아직 준비되지 않았습니다');
  }
  return weather;
}

async function loadTasks(region) {
  const url = new URL('/rest/v1/wx_tasks', SUPABASE_URL);
  url.searchParams.set('select', 'title,region,kind,owner');
  url.searchParams.set('region', 'eq.' + region);
  url.searchParams.set('order', 'id.asc');

  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || 'Supabase 응답 코드 ' + response.status);
  }
  return data;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET 요청만 지원합니다' });
  }

  const requestedRegion = Array.isArray(req.query.region) ? req.query.region[0] : req.query.region;
  const region = REGION_ALIASES[requestedRegion] || requestedRegion;
  if (!region || !REGIONS[region]) {
    return res.status(400).json({ error: '지원 지역: 세종, 대전, 태안, 보령' });
  }
  if (!process.env.KMA_KEY) {
    return res.status(500).json({ error: 'Vercel 환경변수 KMA_KEY 가 없음' });
  }
  if (!SUPABASE_URL || SUPABASE_URL.includes('여기에')
    || !SUPABASE_KEY || SUPABASE_KEY.includes('여기에')) {
    return res.status(500).json({ error: 'config.js 에 Supabase 주소와 공개용 키를 설정하세요' });
  }
  if (/^sb_secret_/.test(SUPABASE_KEY) || SUPABASE_KEY.includes('service_role')) {
    return res.status(500).json({ error: 'config.js 에 공개용 키만 설정하세요' });
  }

  try {
    const time = baseTime(new Date());
    const [weather, tasks] = await Promise.all([
      loadWeather(region, process.env.KMA_KEY, time),
      loadTasks(region),
    ]);
    const result = tasks.map((task) => ({
      ...task,
      weather,
      judgment: judge(task.kind, weather),
    }));
    return res.status(200).json({ region, weather, tasks: result });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
};

module.exports.baseTime = baseTime;
module.exports.maxValue = maxValue;