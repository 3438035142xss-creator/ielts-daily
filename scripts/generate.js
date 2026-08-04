/**
 * 每日内容生成脚本
 * 由 GitHub Actions 每天 UTC 0:00 自动运行
 * 功能：抓取 RSS → 按优先级轮换词库 → 轮换语法点 → 轮换口语话题 → 输出 daily-content.json
 * 运行：node scripts/generate.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'daily-content.json');

// ============ 工具函数 ============

function readJson(filename) {
  const filePath = path.join(DATA_DIR, filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// 根据日期计算稳定索引（同一天结果一致）
function getDailyIndex(total, date = new Date()) {
  const epoch = new Date('2024-01-01T00:00:00Z');
  const days = Math.floor((date - epoch) / (1000 * 60 * 60 * 24));
  return ((days % total) + total) % total;
}

// 按优先级排序单词（high → medium → low）
function sortWordsByPriority(words, priorityOrder) {
  const order = priorityOrder || ['high', 'medium', 'low'];
  return [...words].sort((a, b) => {
    const ia = order.indexOf(a.priority || 'medium');
    const ib = order.indexOf(b.priority || 'medium');
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

// 简易 XML 标签提取
function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = xml.match(regex);
  return m ? m[1].trim() : '';
}

function extractAllItems(xml) {
  const items = [];
  const itemRegex = /<item[\s\S]*?<\/item>/gi;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[0];
    const title = extractTag(block, 'title')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, '')
      .trim();
    const link = extractTag(block, 'link')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .trim();
    const description = extractTag(block, 'description')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (title) items.push({ title, link, description });
  }
  return items;
}

async function fetchRss(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IELTS-Daily-Bot/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const items = extractAllItems(xml).slice(0, 3).map(item => ({
      title: item.title,
      description: item.description.slice(0, 200),
      link: item.link,
      source: source.name,
      language: source.language,
      category: source.category
    }));
    console.log(`  ✓ ${source.name}: ${items.length} 条`);
    return items;
  } catch (err) {
    console.log(`  ✗ ${source.name}: ${err.message}`);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

// ============ 主流程 ============

async function main() {
  console.log('=== IELTS Daily 内容生成 ===');
  console.log(`时间: ${new Date().toISOString()}\n`);

  // 1. 加载词库/语法库/口语库/RSS源
  const vocab = readJson('vocabulary.json');
  const grammar = readJson('grammar.json');
  const speaking = readJson('speaking.json');
  const rssConfig = readJson('rss-sources.json');

  // 2. 按优先级排序单词后轮换
  const sortedWords = sortWordsByPriority(vocab.words, vocab.priorityOrder);
  const wordIdx = getDailyIndex(sortedWords.length);
  const grammarIdx = getDailyIndex(grammar.grammarPoints.length);
  const speakingIdx = getDailyIndex(speaking.topics.length);
  const todayWord = sortedWords[wordIdx];
  const todayGrammar = grammar.grammarPoints[grammarIdx];
  const todaySpeaking = speaking.topics[speakingIdx];

  // 统计各优先级数量
  const priorityCounts = {};
  for (const w of vocab.words) {
    priorityCounts[w.priority || 'medium'] = (priorityCounts[w.priority || 'medium'] || 0) + 1;
  }
  // 计算当前词在所属优先级中的位置
  const samePriorityWords = sortedWords.filter(w => w.priority === todayWord.priority);
  const posInPriority = samePriorityWords.indexOf(todayWord) + 1;

  console.log(`今日单词 [${wordIdx + 1}/${sortedWords.length}] (优先级: ${todayWord.priority} 第 ${posInPriority}/${samePriorityWords.length}): ${todayWord.word}`);
  console.log(`今日语法 [${grammarIdx + 1}/${grammar.grammarPoints.length}]: ${todayGrammar.title}`);
  console.log(`今日口语 [${speakingIdx + 1}/${speaking.topics.length}]: ${todaySpeaking.topic} (${todaySpeaking.part})\n`);

  // 3. 抓取 RSS 新闻
  console.log('抓取 RSS 新闻源...');
  const results = await Promise.all(rssConfig.sources.map(fetchRss));
  let allNews = results.flat();

  // 去重
  const seen = new Set();
  allNews = allNews.filter(n => {
    const key = n.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (allNews.length === 0) {
    console.log('\n⚠ 所有 RSS 抓取失败，使用兜底新闻');
    allNews = rssConfig.fallbackNews.map(n => ({ ...n }));
  }

  // 按分类均衡
  const newsByCategory = {};
  for (const n of allNews) {
    if (!newsByCategory[n.category]) newsByCategory[n.category] = [];
    newsByCategory[n.category].push(n);
  }
  const balancedNews = [];
  for (const cat of Object.keys(newsByCategory).sort()) {
    balancedNews.push(...newsByCategory[cat].slice(0, 3));
  }
  const finalNews = balancedNews.slice(0, 12);

  console.log(`\n共获取 ${finalNews.length} 条新闻`);

  // 4. 组装并写入今日内容
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getUTCDay()];

  const output = {
    date: dateStr,
    weekday: weekday,
    generatedAt: today.toISOString(),
    word: todayWord,
    grammar: todayGrammar,
    speaking: todaySpeaking,
    news: finalNews,
    stats: {
      totalWords: vocab.words.length,
      totalGrammar: grammar.grammarPoints.length,
      totalSpeaking: speaking.topics.length,
      wordIndex: wordIdx + 1,
      grammarIndex: grammarIdx + 1,
      speakingIndex: speakingIdx + 1,
      priorityCounts: priorityCounts,
      wordPriority: todayWord.priority,
      wordPriorityPosition: posInPriority,
      wordPriorityTotal: samePriorityWords.length
    }
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\n✓ 已写入: ${path.relative(process.cwd(), OUTPUT_FILE)}`);
  console.log('\n=== 生成完成 ===');
}

main().catch(err => {
  console.error('生成失败:', err);
  process.exit(1);
});
