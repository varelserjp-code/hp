import os
import json
import feedparser
import requests
from bs4 import BeautifulSoup
import google.generativeai as genai
from datetime import datetime

# 1. RSSソース
RSS_SOURCES = [
    {"name": "PubMed (Nursing Research)", "url": "https://pubmed.ncbi.nlm.nih.gov/rss/search/1/?limit=1&term=nursing"},
    {"name": "WHO (World Health Organization)", "url": "https://www.who.int/rss-feeds/news-english.xml"},
    {"name": "NIH (National Institutes of Health)", "url": "https://www.nih.gov/news-events/news-releases/rss.xml"},
    {"name": "ScienceDaily (Nursing News)", "url": "https://www.sciencedaily.com/rss/health_medicine/nursing.xml"},
    {"name": "MedlinePlus (Health News)", "url": "https://medlineplus.gov/feeds/news_en.xml"}
]

# 2. AI設定
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("Error: GEMINI_API_KEY is not set in GitHub Secrets.")
    exit(1)

genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-2.5-flash')

# 3. 取得済みURLを読み込む（重複スキップ用）
SEEN_FILE = "seen_urls.json"
if os.path.exists(SEEN_FILE):
    with open(SEEN_FILE, "r", encoding="utf-8") as f:
        seen_urls = set(json.load(f))
else:
    seen_urls = set()

# 4. 既存の記事HTMLを読み込む（蓄積用）
EXISTING_FILE = "nurse-news.html"
existing_articles = ""
if os.path.exists(EXISTING_FILE):
    with open(EXISTING_FILE, "r", encoding="utf-8") as f:
        existing_html = f.read()
    # 既存記事部分だけ抽出
    start = existing_html.find('<!-- ARTICLES_START -->')
    end = existing_html.find('<!-- ARTICLES_END -->')
    if start != -1 and end != -1:
        existing_articles = existing_html[start + len('<!-- ARTICLES_START -->'):end]

# 5. 新着記事を取得・要約
new_articles_html = ""
new_count = 0

for source in RSS_SOURCES:
    try:
        feed = feedparser.parse(source["url"])
        if not feed.entries:
            continue

        # 全件処理（最大20件）
        for entry in feed.entries[:20]:
            article_url = entry.link

            # 取得済みはスキップ
            if article_url in seen_urls:
                continue

            full_text = ""
            try:
                headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
                response = requests.get(article_url, headers=headers, timeout=10)
                soup = BeautifulSoup(response.text, 'html.parser')
                paragraphs = soup.find_all('p')
                full_text = " ".join([p.get_text(strip=True) for p in paragraphs])
                full_text = full_text[:10000]
            except Exception as scrape_error:
                print(f"Scraping failed for {article_url}: {scrape_error}")
                full_text = entry.summary if 'summary' in entry else ''

            if not full_text.strip():
                continue

            prompt = f"""
以下の英語の医療・看護系ニュースを、日本の現役看護師向けに【1000文字以内】でわかりやすく日本語に翻訳・要約してください。

以下のルールを厳守してください：
- 「#」「##」「###」などのMarkdown記号は一切使わない
- 箇条書きの「-」「*」も使わない
- 見出しをつけたい場合は「【見出し】」の形式を使う
- 段落ごとに改行して読みやすくする
- 専門用語は適切に使いつつ、論理的に解説する

タイトル: {entry.title}
元記事テキスト:
{full_text}
"""

            try:
                response = model.generate_content(prompt)
                ai_summary = response.text
            except Exception as ai_error:
                print(f"AI error for {article_url}: {ai_error}")
                continue

            # 日付
            published = ""
            if hasattr(entry, 'published'):
                published = entry.published

            new_articles_html += f"""
          <article>
            <p class="meta">{source["name"]}　{published}</p>
            <h2 class="article-title">{entry.title}</h2>
            <div class="summary">{ai_summary.replace(chr(10), '<br>')}</div>
            <div class="source-box">
              <strong>ソース・引用元</strong><br>
              配信元：{source["name"]}<br>
              原文URL：<a href="{entry.link}" target="_blank" rel="noopener">{entry.link}</a>
            </div>
          </article>
"""
            seen_urls.add(article_url)
            new_count += 1
            print(f"Added: {entry.title}")

    except Exception as e:
        print(f"Error processing {source['name']}: {e}")
        continue

print(f"新着記事数: {new_count}")

# 6. 取得済みURLを保存
with open(SEEN_FILE, "w", encoding="utf-8") as f:
    json.dump(list(seen_urls), f, ensure_ascii=False, indent=2)

# 7. HTMLを生成（新着を上に、既存を下に）
all_articles = new_articles_html + existing_articles

final_html = f"""<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Nursing News | VARELSER</title>
  <style>
    :root{{
      --bg: #fff;
      --fg: #111;
      --muted: rgba(0,0,0,.55);
      --border: #e8e8e8;
      --accent: #0056b3;
      --card-bg: #fafafa;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--fg);
      font-family: ui-sans-serif, system-ui, -apple-system,
        "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Segoe UI", sans-serif;
      line-height: 1.8;
      font-size: 16px;
    }}
    .container {{
      max-width: 800px;
      margin: 0 auto;
      padding: 48px 24px;
    }}
    .back-link {{
      display: inline-block;
      margin-bottom: 32px;
      color: var(--muted);
      text-decoration: none;
      font-size: 14px;
    }}
    .back-link:hover {{ color: var(--fg); }}
    .page-title {{
      font-size: 22px;
      font-weight: 700;
      margin: 0 0 8px;
      letter-spacing: .02em;
    }}
    .page-desc {{
      color: var(--muted);
      font-size: 13px;
      margin: 0 0 48px;
    }}
    article {{
      margin-bottom: 56px;
      padding-bottom: 48px;
      border-bottom: 1px solid var(--border);
    }}
    article:last-child {{
      border-bottom: none;
    }}
    .meta {{
      font-size: 12px;
      color: var(--muted);
      margin: 0 0 10px;
      letter-spacing: .02em;
    }}
    .article-title {{
      font-size: 19px;
      font-weight: 700;
      margin: 0 0 20px;
      line-height: 1.5;
      letter-spacing: .01em;
    }}
    .summary {{
      font-size: 15px;
      color: #222;
      line-height: 1.9;
      margin-bottom: 24px;
    }}
    .source-box {{
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px 16px;
      font-size: 13px;
      color: #555;
      line-height: 1.7;
    }}
    .source-box strong {{
      color: var(--fg);
      display: block;
      margin-bottom: 4px;
    }}
    .source-box a {{
      color: var(--accent);
      word-break: break-all;
    }}
  </style>
</head>
<body>
  <div class="container">
    <a href="/hp/" class="back-link">← ホームに戻る</a>
    <p class="page-title">最新の医療・看護ニュース</p>
    <p class="page-desc">海外の最新医療ニュースをAIで要約し、定期配信しています。</p>
<!-- ARTICLES_START -->
{all_articles}
<!-- ARTICLES_END -->
  </div>
</body>
</html>"""

with open(EXISTING_FILE, "w", encoding="utf-8") as f:
    f.write(final_html)

print("生成完了。")
