// app.js – 화면 동작 (목록 그리기, 일정 추가)

let tasks = [];
let weatherByRegion = {};   // 03 단원에서 지역별 날씨를 넣음

async function loadTasks() {
  const msg = document.getElementById('msgBox');
  let base = [];
  try {
    const res = await fetch('data/tasks.json');
    if (!res.ok) throw new Error('응답 코드 ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('일정 데이터 형식이 올바르지 않습니다');
    base = data;
    msg.textContent = '';
  } catch (err) {
    msg.textContent = '일정 원본(data/tasks.json)을 읽지 못했습니다. 배포 주소로 열어 주세요.';
  }
  const saved = JSON.parse(localStorage.getItem('wx_added') || '[]');
  tasks = base.concat(saved);
}

async function loadWeather() {
  const box = document.getElementById('weatherBox');
  const test = new URLSearchParams(location.search).get('test');
  const failed = [];

  for (const region of Object.keys(REGIONS)) {
    try {
      const res = await fetch(weatherUrl(region));
      if (!res.ok) throw new Error('응답 코드 ' + res.status);
      weatherByRegion[region] = applyTest(toWeather(await res.json()), test);
    } catch (err) {
      failed.push(region + '(' + err.message + ')');
    }
  }

  box.textContent = failed.length
    ? '날씨를 받지 못한 지역 : ' + failed.join(', ') + ' — 목록은 그대로 볼 수 있음'
    : '오늘 날씨 : Open-Meteo 예보 (최고 기온 · 최대 풍속 · 강수확률)' + (test === 'wind' ? '  [시험: wind]' : '');
  renderTasks();
}

function weatherText(w) {
  return w ? w.tempMax + '℃ · ' + w.windMax + 'm/s · ' + w.rainProb + '%' : '-';
}

function renderTasks() {
  const body = document.getElementById('taskList');
  body.innerHTML = '';
  for (const t of tasks) {
    const w = weatherByRegion[t.region];
    const r = judge(t.kind, w);
    const tr = document.createElement('tr');
    for (const v of [t.title, t.region, t.kind, t.owner, weatherText(w)]) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    const td = document.createElement('td');
    td.textContent = r.text;
    td.className = r.level;
    tr.appendChild(td);
    body.appendChild(tr);
  }
}

function addTask(e) {
  e.preventDefault();
  const t = {
    title: document.getElementById('titleInput').value.trim(),
    region: document.getElementById('regionInput').value,
    kind: document.getElementById('kindInput').value,
    owner: document.getElementById('ownerInput').value.trim(),
  };
  if (!t.title || !t.owner) return;
  const saved = JSON.parse(localStorage.getItem('wx_added') || '[]');
  saved.push(t);
  localStorage.setItem('wx_added', JSON.stringify(saved));
  e.target.reset();
  tasks.push(t);
  renderTasks();
}

document.getElementById('taskForm').addEventListener('submit', addTask);
loadTasks().then(function () {
  renderTasks();
  loadWeather();
});
