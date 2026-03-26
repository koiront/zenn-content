#!/usr/bin/env node

/**
 * generate-article.js
 * 
 * トピックを指定してAIで記事の下書きを生成するスクリプト
 * 
 * Usage:
 *   node scripts/generate-article.js --topic ai-001
 *   node scripts/generate-article.js --topic ai-001 --lang ja
 *   node scripts/generate-article.js --topic ai-001 --lang en
 *   node scripts/generate-article.js --topic ai-001 --lang both
 *   node scripts/generate-article.js --list              # トピック一覧表示
 *   node scripts/generate-article.js --interactive       # 対話モードでトピック選択
 * 
 * Environment variables:
 *   GEMINI_API_KEY    - Google Gemini API key (primary)
 *   ANTHROPIC_API_KEY - Anthropic Claude API key (fallback)
 */

const fs = require('fs');
const path = require('path');

const TOPICS_PATH = path.join(__dirname, '..', 'topics.json');
const PROMPTS_DIR = path.join(__dirname, '..', 'prompts');
const ARTICLES_DIR = path.join(__dirname, '..', 'articles');

// ─── Helpers ───────────────────────────────────────────

function loadTopics() {
  const raw = fs.readFileSync(TOPICS_PATH, 'utf-8');
  return JSON.parse(raw);
}

function findTopic(topicId) {
  const data = loadTopics();
  for (const [catKey, cat] of Object.entries(data.categories)) {
    const found = cat.topics.find(t => t.id === topicId);
    if (found) return { ...found, category: cat.label };
  }
  return null;
}

function listTopics() {
  const data = loadTopics();
  console.log('\n📋 トピック一覧:\n');
  for (const [catKey, cat] of Object.entries(data.categories)) {
    console.log(`  [${cat.label}]`);
    for (const topic of cat.topics) {
      const statusIcon = {
        'idea': '💡',
        'draft': '📝',
        'review': '👀',
        'published': '✅'
      }[topic.status] || '❓';
      console.log(`    ${statusIcon} ${topic.id}: ${topic.title_ja}`);
      console.log(`       EN: ${topic.title_en}`);
      console.log(`       Status: ${topic.status} | Priority: ${topic.priority}`);
    }
    console.log();
  }
}

function generateSlug(topicId, lang) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${topicId}-${lang}-${date}`;
}

function loadPrompt(lang) {
  const promptPath = path.join(PROMPTS_DIR, `article-${lang}.md`);
  return fs.readFileSync(promptPath, 'utf-8');
}

// ─── AI API Calls ──────────────────────────────────────

async function callGeminiAPI(prompt, systemPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY が設定されていません');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        }
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callClaudeAPI(prompt, systemPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY が設定されていません');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.content?.map(c => c.text).join('') || '';
}

async function generateWithAI(prompt, systemPrompt, provider = 'gemini') {
  console.log(`\n🤖 ${provider === 'gemini' ? 'Gemini' : 'Claude'} API で生成中...`);

  try {
    if (provider === 'gemini') {
      return await callGeminiAPI(prompt, systemPrompt);
    } else {
      return await callClaudeAPI(prompt, systemPrompt);
    }
  } catch (err) {
    if (provider === 'gemini') {
      console.log(`⚠️  Gemini API 失敗。Claude にフォールバック...`);
      return await callClaudeAPI(prompt, systemPrompt);
    }
    throw err;
  }
}

// ─── Article Generation ────────────────────────────────

async function generateArticle(topicId, lang) {
  const topic = findTopic(topicId);
  if (!topic) {
    console.error(`❌ トピック "${topicId}" が見つかりません`);
    process.exit(1);
  }

  const title = lang === 'ja' ? topic.title_ja : topic.title_en;
  const systemPrompt = loadPrompt(lang);

  const userPrompt = systemPrompt
    .replace('{{title}}', title)
    .replace('{{category}}', topic.category)
    .replace('{{notes}}', topic.notes || '');

  const content = await generateWithAI(
    `以下のトピックについて記事を生成してください:\nタイトル: ${title}\nカテゴリ: ${topic.category}\n補足: ${topic.notes || 'なし'}`,
    systemPrompt,
    'gemini'
  );

  // Save to articles directory
  const slug = generateSlug(topicId, lang);
  const filePath = path.join(ARTICLES_DIR, `${slug}.md`);

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`\n✅ 記事を生成しました: articles/${slug}.md`);
  console.log(`   タイトル: ${title}`);
  console.log(`   言語: ${lang}`);
  console.log(`\n📝 次のステップ:`);
  console.log(`   1. articles/${slug}.md を開いて内容を確認`);
  console.log(`   2. 自分の知見・経験を加筆`);
  console.log(`   3. published: true に変更`);
  console.log(`   4. git add → commit → push で公開`);

  return filePath;
}

// ─── CLI ───────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--list')) {
    listTopics();
    return;
  }

  if (args.includes('--help') || args.length === 0) {
    console.log(`
Zenn 記事生成ツール

Usage:
  node scripts/generate-article.js --topic <id> [--lang <ja|en|both>]
  node scripts/generate-article.js --list

Options:
  --topic <id>    生成するトピックID (例: ai-001)
  --lang <lang>   言語 (ja / en / both) デフォルト: both
  --list          トピック一覧を表示
  --help          ヘルプを表示

Environment:
  GEMINI_API_KEY     Gemini API キー (必須)
  ANTHROPIC_API_KEY  Claude API キー (フォールバック用)
    `);
    return;
  }

  const topicIdx = args.indexOf('--topic');
  if (topicIdx === -1 || !args[topicIdx + 1]) {
    console.error('❌ --topic <id> を指定してください');
    process.exit(1);
  }
  const topicId = args[topicIdx + 1];

  const langIdx = args.indexOf('--lang');
  const lang = langIdx !== -1 ? args[langIdx + 1] : 'both';

  if (lang === 'both') {
    await generateArticle(topicId, 'ja');
    await generateArticle(topicId, 'en');
  } else {
    await generateArticle(topicId, lang);
  }
}

main().catch(err => {
  console.error('❌ エラー:', err.message);
  process.exit(1);
});
