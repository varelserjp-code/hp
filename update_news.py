import os
import json
import feedparser
import requests
from bs4 import BeautifulSoup
import google.generativeai as genai
from datetime import datetime

RSS_SOURCES = [
    {"name": "PubMed (Nursing Research)", "url": "https://pubmed.ncbi.nlm.nih.gov/rss/search/1/?limit=1&term=nursing"},
    {"name": "WHO (World Health Organization)", "url": "https://www.who.int/rss-feeds/news-english.xml"},
    {"name": "NIH (National Institutes of Health)", "url": "https://www.nih.gov/news-events/news-releases/rss.xml"},
    {"name": "ScienceDaily (Nursing News)", "url": "https://www.sciencedaily.com/rss/health_medicine/nursing.xml"},
    {"name": "MedlinePlus (Health News)", "url": "https://medlineplus.gov/feeds/news_en.xml"}
]

api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("Error: GEMINI_API_KEY is not set in GitHub Secrets.")
    exit(1)

genai.configure(api_key=api_key)
model = genai.GenerativeModel("gemini-2.5-flash")

SEEN_FILE = "seen_urls.json"
if os.path.exists(SEEN_FILE):
    with open(SEEN_FILE, "r", encoding="utf-8") as f:
        seen_urls = set(json.load(f))
else:
    seen_urls = set()

EXISTING_FILE = "nurse-news.html"
existing_articles = ""
if os.path.exists(EXISTING_FILE):
    with open(EXISTING_FILE, "r", encoding="utf-8") as f:
        existing_html = f.read()
    start = existing_html.find("<!-- ARTICLES_START -->")
    end = existing_html.find("<!-- ARTICLES_END -->")
    if start != -1 and end != -1:
        existing_articles = existing_html[start + len("<!-- ARTICLES_START -->"):end]

new_articles_html = ""
new_count = 0

for source in RSS_SOURCES:
    try:
        feed = feedparser.parse(source["url"])
        if not feed.entries:
            print(f"No entries: {source['name']}")
            continue

        for entry in feed.entries[:20]:
            article_url = getattr(entry, "link", "").strip()
            if not article_url:
                continue

            if article_url in seen_urls:
                continue

            full_text = ""
            try:
                headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
                response = requests.get(article_url, headers=headers, timeout=10)
                response.raise_for_status()
                soup = BeautifulSoup(response.text, "html.parser")
                paragraphs = soup.find_all("p")
                full_text = " ".join([p.get_text(strip=True) for p in paragraphs])
                full_text = full_text[:10000]
            except Exception as scrape_error:
                print(f"Scraping failed for {article_url}: {scrape_error}")
                full_text = entry.summary if hasattr(entry, "summary") else ""

            if not full_text.strip():
                print(f"Empty text: {article_url}")
                continue

            prompt = f"""
以下の英語の医療・看護系ニュースを、日本の現役看護師向けに1000文字以内でわかりやすく日本語に翻訳・要約してください。

ルール:
- Markdown記号は使わない
- 箇条書き記号は使わない
- 段落ごとに改行する
- 専門用語は適切に使う
- 自然な日本語で書く

タイトル: {entry.title}
元記事テキスト:
{full_text}
"""

            try:
                response = model.generate_content(prompt)
                ai_summary = getattr(response, "text", "") or ""
                ai_summary = ai_summary.strip()

                print(f"AI raw length: {len(ai_summary)} / {entry.title}")

                if not ai_summary:
                    print(f"AI returned empty text: {article_url}")
                    continue

            except Exception as ai_error:
                print(f"AI error for {article_url}: {repr(ai_error)}")
                continue

            published = getattr(entry, "published", "")

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
        print(f"Error processing {source['name']}: {repr(e)}")
        continue

print(f"新着記事数: {new_count}")

with open(SEEN_FILE, "w", encoding="utf-8") as f:
    json.dump(list(seen_urls), f, ensure_ascii=False, indent=2)

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
