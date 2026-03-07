import os
import json
import feedparser
import requests
from bs4 import BeautifulSoup
import google.generativeai as genai
from datetime import datetime
from collections import OrderedDict

RSS_SOURCES = [
    {"name": "PubMed (Nursing Research)", "url": "https://pubmed.ncbi.nlm.nih.gov/rss/search/1/?limit=1&term=nursing"},
    {"name": "WHO (World Health Organization)", "url": "https://www.who.int/rss-feeds/news-english.xml"},
    {"name": "NIH (National Institutes of Health)", "url": "https://www.nih.gov/news-events/news-releases/rss.xml"},
    {"name": "ScienceDaily (Nursing News)", "url": "https://www.sciencedaily.com/rss/health_medicine/nursing.xml"},
    {"name": "MedlinePlus (Health News)", "url": "https://medlineplus.gov/feeds/news_en.xml"}
]

GENRES = ["公衆衛生", "精神", "感染症", "急性期", "地域", "研究", "その他"]

api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("Error: GEMINI_API_KEY is not set.")
    exit(1)
genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-2.5-flash')

SEEN_FILE = "seen_urls.json"
seen_urls = set(json.load(open(SEEN_FILE, encoding="utf-8"))) if os.path.exists(SEEN_FILE) else set()

ARTICLES_FILE = "articles_data.json"
all_articles_data = json.load(open(ARTICLES_FILE, encoding="utf-8")) if os.path.exists(ARTICLES_FILE) else []

new_count = 0
today = datetime.now().strftime("%Y-%m-%d")

for source in RSS_SOURCES:
    try:
        feed = feedparser.parse(source["url"])
        if not feed.entries:
            continue
        for entry in feed.entries[:20]:
            article_url = entry.link
            if article_url in seen_urls:
                continue
            full_text = ""
            try:
                headers = {'User-Agent': 'Mozilla/5.0'}
                r = requests.get(article_url, headers=headers, timeout=10)
                soup = BeautifulSoup(r.text, 'html.parser')
                full_text = " ".join([p.get_text(strip=True) for p in soup.find_all('p')])[:10000]
            except Exception as e:
                print(f"Scraping failed: {e}")
                full_text = getattr(entry, 'summary', '')
            if not full_text.strip():
                continue

            prompt = f"""
以下の英語の医療・看護系ニュースについて2つのタスクを行ってください。

【タスク1】日本の現役看護師向けに1000文字以内で日本語に翻訳・要約する。
ルール：
- 「#」「##」「###」などのMarkdown記号は一切使わない
- 箇条書きの「-」「*」も使わない
- 見出しは「【見出し】」形式を使う
- 段落ごとに改行して読みやすくする

【タスク2】以下から最も適切なジャンルを1つ選ぶ：
公衆衛生、精神、感染症、急性期、地域、研究、その他

必ず以下のフォーマットのみで返すこと：
SUMMARY:
（要約本文）
GENRE:（ジャンル名のみ）

タイトル: {entry.title}
元記事テキスト: {full_text}
"""
            try:
                ai_response = model.generate_content(prompt)
                raw = ai_response.text.strip()
                if "SUMMARY:" in raw and "GENRE:" in raw:
                    ai_summary = raw.split("GENRE:")[0].replace("SUMMARY:", "").strip()
                    genre_raw = raw.split("GENRE:")[-1].strip()
                    genre = genre_raw if genre_raw in GENRES else "その他"
                else:
                    ai_summary = raw
                    genre = "その他"
            except Exception as e:
                print(f"AI error: {e}")
                continue

            all_articles_data.insert(0, {
                "date": today,
                "published": getattr(entry, 'published', today),
                "source": source["name"],
                "title": entry.title,
                "summary": ai_summary,
                "genre": genre,
                "url": entry.link
            })
            seen_urls.add(article_url)
            new_count += 1
            print(f"Added [{genre}]: {entry.title}")
    except Exception as e:
        print(f"Error: {source['name']}: {e}")

print(f"新着記事数: {new_count}")

with open(SEEN_FILE, "w", encoding="utf-8") as f:
    json.dump(list(seen_urls), f, ensure_ascii=False, indent=2)
with open(ARTICLES_FILE, "w", encoding="utf-8") as f:
    json.dump(all_articles_data, f, ensure_ascii=False, indent=2)

# 日付×ジャンルでグループ化
grouped_by_date = OrderedDict()
for article in all_articles_data:
    d = article["date"]
    g = article.get("genre", "その他")
    if d not in grouped_by_date:
        grouped_by_date[d] = OrderedDict()
    if g not in grouped_by_date[d]:
        grouped_by_date[d][g] = []
    grouped_by_date[d][g].append(article)

# ジャンル横断でグループ化
grouped_by_genre = OrderedDict()
for g in GENRES:
    grouped_by_genre[g] = []
for article in all_articles_data:
    g = article.get("genre", "その他")
    if g in grouped_by_genre:
        grouped_by_genre[g].append(article)

def fmt_date(date):
    try:
        return datetime.strptime(date, "%Y-%m-%d").strftime("%Y年%-m月%-d日")
    except:
        return date

# サイドバー：日付セクション
sidebar_date_html = ""
for date, genres in grouped_by_date.items():
    total = sum(len(v) for v in genres.values())
    sidebar_date_html += f'''<div class="date-group">
  <button class="date-btn" onclick="toggleDate('{date}')">
    <span>{fmt_date(date)}</span><span class="count">{total}</span>
  </button>
  <div class="genre-list" id="genres-{date}">
'''
    for genre in genres:
        sidebar_date_html += f'    <a href="#" class="genre-sublink" onclick="showDate(\'{date}\'); return false;">{genre}<span class="count">{len(genres[genre])}</span></a>\n'
    sidebar_date_html += '  </div>\n</div>\n'

# サイドバー：ジャンルセクション
sidebar_genre_html = ""
for genre, articles in grouped_by_genre.items():
    if not articles:
        continue
    sidebar_genre_html += f'<a href="#" class="genre-link" onclick="showGenre(\'{genre}\'); return false;">{genre}<span class="count">{len(articles)}</span></a>\n'

# 日付ビューの記事HTML
date_view_html = ""
for date, genres in grouped_by_date.items():
    date_view_html += f'<div class="date-section" id="{date}">\n<h2 class="date-heading">{fmt_date(date)}</h2>\n'
    for genre, articles in genres.items():
        date_view_html += f'<div class="genre-section">\n<h3 class="genre-heading">{genre}</h3>\n'
        for a in articles:
            summary_html = a["summary"].replace('\n', '<br>')
            date_view_html += f'''  <article data-genre="{a['genre']}">
    <p class="meta">{a["source"]}　{a["published"]}</p>
    <h4 class="article-title">{a["title"]}</h4>
    <div class="summary">{summary_html}</div>
    <div class="source-box">
      <strong>ソース・引用元</strong><br>
      配信元：{a["source"]}<br>
      原文URL：<a href="{a["url"]}" target="_blank" rel="noopener">{a["url"]}</a>
    </div>
  </article>\n'''
        date_view_html += '</div>\n'
    date_view_html += '</div>\n'

final_html = f"""<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Nursing News | VARELSER</title>
  <style>
    :root {{
      --bg:#fff; --fg:#111; --muted:rgba(0,0,0,.5);
      --border:#e8e8e8; --accent:#0056b3;
      --sidebar-bg:#fafafa; --hover:rgba(0,0,0,.04);
    }}
    *{{box-sizing:border-box;margin:0;padding:0;}}
    body{{background:var(--bg);color:var(--fg);font-family:ui-sans-serif,system-ui,-apple-system,"Hiragino Kaku Gothic ProN","Noto Sans JP","Segoe UI",sans-serif;line-height:1.8;font-size:16px;}}
    .layout{{display:flex;min-height:100vh;max-width:1100px;margin:0 auto;}}
    .sidebar{{width:210px;flex-shrink:0;background:var(--sidebar-bg);border-right:1px solid var(--border);padding:40px 0;position:sticky;top:0;height:100vh;overflow-y:auto;}}
    .sidebar-section{{margin-bottom:24px;}}
    .sidebar-title{{font-size:11px;font-weight:700;letter-spacing:.1em;color:var(--muted);padding:0 20px 10px;text-transform:uppercase;}}
    .sidebar-divider{{border:none;border-top:1px solid var(--border);margin:20px 20px;}}
    .date-group{{margin-bottom:2px;}}
    .date-btn{{width:100%;display:flex;justify-content:space-between;align-items:center;padding:9px 20px;background:none;border:none;border-left:2px solid transparent;cursor:pointer;color:var(--fg);font-size:13px;font-family:inherit;text-align:left;transition:background .15s,border-color .15s;}}
    .date-btn:hover{{background:var(--hover);border-left-color:var(--fg);}}
    .date-btn.open{{border-left-color:var(--fg);font-weight:600;}}
    .genre-list{{display:none;padding:2px 0 6px;background:#f0f0f0;}}
    .genre-list.open{{display:block;}}
    .genre-sublink{{display:flex;justify-content:space-between;align-items:center;padding:7px 20px 7px 32px;text-decoration:none;color:#444;font-size:12px;transition:background .15s;}}
    .genre-sublink:hover{{background:var(--hover);color:var(--fg);}}
    .genre-link{{display:flex;justify-content:space-between;align-items:center;padding:9px 20px;text-decoration:none;color:var(--fg);font-size:13px;border-left:2px solid transparent;transition:background .15s,border-color .15s;}}
    .genre-link:hover{{background:var(--hover);border-left-color:var(--fg);}}
    .genre-link.active{{border-left-color:var(--fg);font-weight:600;}}
    .count{{font-size:11px;color:var(--muted);background:var(--border);border-radius:999px;padding:1px 7px;flex-shrink:0;}}
    .main{{flex:1;padding:48px 48px 80px;min-width:0;}}
    .back-link{{display:inline-block;margin-bottom:32px;color:var(--muted);text-decoration:none;font-size:14px;}}
    .back-link:hover{{color:var(--fg);}}
    .page-title{{font-size:22px;font-weight:700;margin-bottom:6px;}}
    .page-desc{{color:var(--muted);font-size:13px;margin-bottom:56px;}}
    .view{{display:none;}}
    .view.active{{display:block;}}
    .date-section{{margin-bottom:64px;}}
    .date-heading{{font-size:15px;font-weight:700;letter-spacing:.05em;color:var(--muted);border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:28px;}}
    .genre-section{{margin-bottom:40px;}}
    .genre-heading{{font-size:13px;font-weight:700;letter-spacing:.08em;color:#fff;background:var(--fg);display:inline-block;padding:3px 12px;border-radius:4px;margin-bottom:20px;}}
    .genre-view-title{{font-size:18px;font-weight:700;margin-bottom:32px;padding-bottom:12px;border-bottom:1px solid var(--border);}}
    .genre-view-title span{{display:inline-block;background:var(--fg);color:#fff;padding:2px 12px;border-radius:4px;font-size:15px;margin-left:8px;}}
    article{{margin-bottom:40px;padding-bottom:36px;border-bottom:1px solid var(--border);}}
    article:last-child{{border-bottom:none;}}
    .meta{{font-size:12px;color:var(--muted);margin-bottom:8px;}}
    .article-title{{font-size:17px;font-weight:700;line-height:1.5;margin-bottom:16px;}}
    .summary{{font-size:15px;color:#222;line-height:1.9;margin-bottom:18px;}}
    .source-box{{background:var(--sidebar-bg);border:1px solid var(--border);border-radius:8px;padding:12px 16px;font-size:13px;color:#555;line-height:1.7;}}
    .source-box strong{{color:var(--fg);display:block;margin-bottom:4px;}}
    .source-box a{{color:var(--accent);word-break:break-all;}}
    @media(max-width:640px){{.sidebar{{display:none;}}.main{{padding:32px 20px 60px;}}}}
  </style>
</head>
<body>
  <div class="layout">
    <nav class="sidebar">
      <div class="sidebar-section">
        <p class="sidebar-title">日付</p>
        {sidebar_date_html}
      </div>
      <hr class="sidebar-divider">
      <div class="sidebar-section">
        <p class="sidebar-title">ジャンル</p>
        {sidebar_genre_html}
      </div>
    </nav>
    <div class="main">
      <a href="/hp/" class="back-link">← ホームに戻る</a>
      <p class="page-title">最新の医療・看護ニュース</p>
      <p class="page-desc">海外の最新医療ニュースをAIで要約し、定期配信しています。</p>
      <div class="view active" id="view-date">
        {date_view_html}
      </div>
      <div class="view" id="view-genre">
        <p class="genre-view-title">ジャンル：<span id="genre-view-label"></span></p>
        <div id="genre-articles"></div>
      </div>
    </div>
  </div>
  <script>
    function toggleDate(date) {{
      const list = document.getElementById('genres-' + date);
      const btn = list.previousElementSibling;
      list.classList.toggle('open');
      btn.classList.toggle('open');
    }}
    function showDate(date) {{
      document.getElementById('view-date').classList.add('active');
      document.getElementById('view-genre').classList.remove('active');
      document.querySelectorAll('.genre-link').forEach(l => l.classList.remove('active'));
      setTimeout(() => {{
        const el = document.getElementById(date);
        if (el) el.scrollIntoView({{behavior:'smooth', block:'start'}});
      }}, 50);
    }}
    function showGenre(genre) {{
      document.querySelectorAll('.genre-link').forEach(l => {{
        l.classList.toggle('active', l.textContent.trim().startsWith(genre));
      }});
      document.getElementById('view-date').classList.remove('active');
      document.getElementById('view-genre').classList.add('active');
      document.getElementById('genre-view-label').textContent = genre;
      const container = document.getElementById('genre-articles');
      container.innerHTML = '';
      document.querySelectorAll(`article[data-genre="${{genre}}"]`).forEach(a => {{
        container.appendChild(a.cloneNode(true));
      }});
      window.scrollTo({{top:0, behavior:'smooth'}});
    }}
    const firstBtn = document.querySelector('.date-btn');
    if (firstBtn) firstBtn.click();
  </script>
</body>
</html>"""

with open("nurse-news.html", "w", encoding="utf-8") as f:
    f.write(final_html)
print("生成完了。")
