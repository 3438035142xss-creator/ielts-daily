/**
 * 前端逻辑：
 * 1. 加载 data/daily-content.json
 * 2. 渲染单词/口语/语法/时政
 * 3. Web Speech API 朗读单词、例句、电影台词、口语范例
 */

const DATA_URL = 'data/daily-content.json';

// ============ 工具 ============

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============ Web Speech API 发音 ============

const synth = window.speechSynthesis;
let currentUtterance = null;
let currentButton = null;

// 选择最佳英语语音
function pickEnglishVoice() {
  const voices = synth.getVoices();
  if (!voices.length) return null;
  // 优先选 en-US/en-GB 的女声/男声
  const preferred = [
    'Google US English', 'Google UK English Female', 'Google UK English Male',
    'Microsoft Aria Online (Natural) - English (United States)',
    'Microsoft Guy Online (Natural) - English (United States)',
    'Samantha', 'Daniel', 'Karen'
  ];
  for (const name of preferred) {
    const v = voices.find(v => v.name === name);
    if (v) return v;
  }
  // 退而求其次：任意 en-* 语音
  return voices.find(v => /^en(-|_)/i.test(v.lang)) || voices[0];
}

let englishVoice = null;
if (synth) {
  // 语音可能异步加载
  englishVoice = pickEnglishVoice();
  synth.onvoiceschanged = () => { englishVoice = pickEnglishVoice(); };
}

/**
 * 朗读文本
 * @param {string} text - 要朗读的文本
 * @param {HTMLElement} btn - 触发按钮（用于视觉反馈）
 * @param {object} opts - { rate, pitch }
 */
function speak(text, btn, opts = {}) {
  if (!synth) {
    alert('当前浏览器不支持语音合成 (Speech Synthesis)。请使用 Chrome/Edge/Safari。');
    return;
  }
  // 如果正在朗读，先停止
  if (synth.speaking) {
    synth.cancel();
    if (currentButton) currentButton.classList.remove('speaking');
    // 如果点击的就是当前正在朗读的按钮，则停止即可
    if (btn === currentButton) {
      currentButton = null;
      return;
    }
  }

  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  if (englishVoice) u.voice = englishVoice;
  u.rate = opts.rate || 0.95;
  u.pitch = opts.pitch || 1;

  u.onstart = () => {
    if (btn) {
      btn.classList.add('speaking');
      currentButton = btn;
    }
  };
  u.onend = u.onerror = () => {
    if (btn) btn.classList.remove('speaking');
    currentButton = null;
  };

  currentUtterance = u;
  synth.speak(u);
}

// ============ 渲染函数 ============

function renderDate(dateStr, weekday) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  document.getElementById('dateBadge').textContent =
    `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} · ${weekday}`;
}

const PRIORITY_LABELS = {
  high:   { text: '重点', cls: 'high' },
  medium: { text: '常用', cls: 'medium' },
  low:    { text: '进阶', cls: 'low' }
};

function renderWord(word, stats) {
  document.getElementById('wordText').textContent = word.word;
  document.getElementById('wordPhonetic').textContent = word.phonetic || '';
  document.getElementById('wordPos').textContent = word.partOfSpeech || '';
  document.getElementById('wordLevel').textContent = `IELTS ${word.ieltsLevel || '6+'}`;

  // 优先级标签
  const pr = PRIORITY_LABELS[word.priority] || PRIORITY_LABELS.medium;
  const prEl = document.getElementById('wordPriority');
  prEl.className = `word-priority ${pr.cls}`;
  prEl.textContent = `${pr.text} ${stats.wordPriorityPosition || ''}/${stats.wordPriorityTotal || ''}`;

  document.getElementById('wordDefinition').textContent = word.definition;
  document.getElementById('wordExampleEn').textContent = word.example;
  document.getElementById('wordExampleZh').textContent = word.exampleTranslation;

  document.getElementById('wordIndex').textContent =
    `${stats.wordIndex} / ${stats.totalWords}`;

  // 电影台词
  if (word.movieQuote) {
    const mq = word.movieQuote;
    document.getElementById('movieQuoteText').textContent = `"${mq.quote}"`;
    document.getElementById('movieMeta').textContent =
      `— ${mq.character || ''}, ${mq.movie || ''} (${mq.year || ''})`;

    // YouGlish 链接
    const yg = document.getElementById('youglishLink');
    if (word.youglish) {
      yg.href = word.youglish;
      yg.style.display = '';
    } else {
      yg.style.display = 'none';
    }

    // YouTube 搜索链接（用电影名 + 台词搜索）
    const yt = document.getElementById('youtubeLink');
    const searchTerm = encodeURIComponent(`${mq.movie || ''} ${mq.year || ''} clip`);
    yt.href = `https://www.youtube.com/results?search_query=${searchTerm}`;
  }

  // 关键词缓存，供发音按钮使用
  cachedData.word = word;
}

function renderSpeaking(speaking, stats) {
  document.getElementById('speakingPart').textContent = speaking.part;
  document.getElementById('speakingTopic').textContent = speaking.topic;
  document.getElementById('speakingIndex').textContent =
    `${stats.speakingIndex} / ${stats.totalSpeaking}`;

  // 问题列表
  const qBox = document.getElementById('speakingQuestions');
  const questions = speaking.questions || (speaking.cueCard ? [speaking.cueCard] : []);
  qBox.innerHTML = questions.map(q =>
    `<div class="question-item">${escapeHtml(q)}</div>`
  ).join('');

  // 范例答案
  document.getElementById('speakingAnswer').textContent = speaking.sampleAnswer;

  // 关键词
  const kwBox = document.getElementById('speakingKeywords');
  if (speaking.keywords && speaking.keywords.length) {
    kwBox.innerHTML =
      `<span class="kw-label">🔑 关键词（点击发音）：</span>` +
      speaking.keywords.map(k =>
        `<span class="kw" data-speak-text="${escapeHtml(k)}">${escapeHtml(k)}</span>`
      ).join('');
  } else {
    kwBox.innerHTML = '';
  }

  document.getElementById('speakingTip').textContent = speaking.tips || '';

  cachedData.speaking = speaking;
}

function renderGrammar(grammar, stats) {
  document.getElementById('grammarTitle').textContent = grammar.title;
  document.getElementById('grammarCategory').textContent = grammar.category;
  document.getElementById('grammarExplanation').textContent = grammar.explanation;
  document.getElementById('grammarStructure').textContent = grammar.structure;

  const examplesBox = document.getElementById('grammarExamples');
  examplesBox.innerHTML = grammar.examples.map(ex => `
    <div class="example-item">
      <div class="example-row">
        <p class="example-en">${escapeHtml(ex.sentence)}</p>
        <button class="speak-btn-small" data-speak-text="${escapeHtml(ex.sentence)}" title="朗读">🔊</button>
      </div>
      <p class="example-zh">${escapeHtml(ex.translation)}</p>
      ${ex.note ? `<p class="example-note">${escapeHtml(ex.note)}</p>` : ''}
    </div>
  `).join('');

  document.getElementById('grammarTip').textContent = grammar.ieltsTip || '';
  document.getElementById('grammarIndex').textContent =
    `${stats.grammarIndex} / ${stats.totalGrammar}`;
}

// 新闻
let allNews = [];

function renderNews(newsList) {
  allNews = newsList;
  document.getElementById('newsCount').textContent = `${newsList.length} 条`;

  const categories = ['all', ...new Set(newsList.map(n => n.category).filter(Boolean))];
  const filterBox = document.querySelector('.news-filter');
  filterBox.innerHTML = categories.map((cat, i) => `
    <button class="filter-btn ${i === 0 ? 'active' : ''}" data-cat="${escapeHtml(cat)}">
      ${cat === 'all' ? '全部' : escapeHtml(cat)}
    </button>
  `).join('');

  renderNewsList(newsList);
}

function renderNewsList(list) {
  const ul = document.getElementById('newsList');
  if (list.length === 0) {
    ul.innerHTML = '<li class="loading-placeholder">该分类暂无新闻</li>';
    return;
  }
  ul.innerHTML = list.map(n => {
    const link = n.link || '#';
    const safeLink = /^https?:\/\//.test(link) || link === '#' ? link : '#';
    return `
      <li class="news-item">
        <a href="${escapeHtml(safeLink)}" target="_blank" rel="noopener noreferrer">
          <div class="news-title">${escapeHtml(n.title)}</div>
          ${n.description ? `<div class="news-desc">${escapeHtml(n.description)}</div>` : ''}
          <div class="news-meta">
            ${n.source ? `<span class="news-source">${escapeHtml(n.source)}</span>` : ''}
            ${n.category ? `<span class="news-cat">${escapeHtml(n.category)}</span>` : ''}
            ${n.language ? `<span class="news-lang">${escapeHtml(n.language === 'zh' ? '中文' : 'EN')}</span>` : ''}
          </div>
        </a>
      </li>
    `;
  }).join('');
}

// ============ 事件委托：处理所有发音按钮 ============

// 缓存当前数据，供发音按钮查找
const cachedData = { word: null, speaking: null };

document.addEventListener('click', (e) => {
  // 关键词点击发音
  const kw = e.target.closest('.kw');
  if (kw) {
    const text = kw.dataset.speakText;
    if (text) speak(text, kw, { rate: 0.9 });
    return;
  }

  // 通用：data-speak-text 朗读指定文本
  const textBtn = e.target.closest('[data-speak-text]');
  if (textBtn) {
    const text = textBtn.dataset.speakText;
    if (text) speak(text, textBtn, { rate: 0.95 });
    return;
  }

  // 目标型：data-speak-target
  const targetBtn = e.target.closest('[data-speak-target]');
  if (!targetBtn) return;
  const target = targetBtn.dataset.speakTarget;
  let text = '';
  let opts = {};
  switch (target) {
    case 'word':
      text = cachedData.word ? cachedData.word.word : '';
      opts = { rate: 0.85 };
      break;
    case 'example':
      text = cachedData.word ? cachedData.word.example : '';
      opts = { rate: 0.92 };
      break;
    case 'movie':
      text = cachedData.word && cachedData.word.movieQuote ? cachedData.word.movieQuote.quote : '';
      opts = { rate: 0.9, pitch: 0.95 };
      break;
    case 'speaking':
      text = cachedData.speaking ? cachedData.speaking.sampleAnswer : '';
      opts = { rate: 0.92 };
      break;
  }
  if (text) speak(text, targetBtn, opts);
});

// 页面卸载时停止朗读
window.addEventListener('beforeunload', () => {
  if (synth && synth.speaking) synth.cancel();
});

// ============ 错误兜底 ============

function renderError(msg) {
  document.getElementById('dateBadge').textContent = '加载失败';
  document.getElementById('newsList').innerHTML =
    `<li class="loading-placeholder">${escapeHtml(msg)}</li>`;
}

// ============ 主入口 ============

async function init() {
  try {
    const res = await fetch(DATA_URL + '?t=' + Date.now());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    renderDate(data.date, data.weekday);
    renderWord(data.word, data.stats);
    renderSpeaking(data.speaking, data.stats);
    renderGrammar(data.grammar, data.stats);
    renderNews(data.news);

    const s = data.stats;
    document.getElementById('footerMeta').textContent =
      `最后更新: ${data.generatedAt} · ` +
      `单词 ${s.wordIndex}/${s.totalWords} (${s.wordPriority}) · ` +
      `语法 ${s.grammarIndex}/${s.totalGrammar} · ` +
      `口语 ${s.speakingIndex}/${s.totalSpeaking}`;
  } catch (err) {
    console.error('加载失败:', err);
    renderError(
      '内容尚未生成。如果是首次部署，请等待 GitHub Actions 首次运行（或在 Actions 页面手动触发）。' +
      '本地预览需先运行 `node scripts/generate.js`。'
    );
  }
}

init();
