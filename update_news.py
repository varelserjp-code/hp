import json
import os
import re
from collections import OrderedDict
from datetime import datetime, timezone, timedelta

import feedparser
import requests
from bs4 import BeautifulSoup

try:
    import google.generativeai as genai
except Exception:
    genai = None


RSS_SOURCES = [
    {"name": "PubMed (Nursing Research)", "url": "https://pubmed.ncbi.nlm.nih.gov/rss/search/1/?limit=10&term=nursing"},
    {"name": "WHO (World Health Organization)", "url": "https://www.who.int/rss-feeds/news-english.xml"},
    {"name": "NIH (National Institutes of Health)", "url": "https://www.nih.gov/news-events/news-releases/rss.xml"},
    {"name": "ScienceDaily (Nursing News)", "url": "https://www.sciencedaily.com/rss/health_medicine/nursing.xml"},
    {"name": "MedlinePlus (Health News)", "url": "https://medlineplus.gov/feeds/news_en.xml"},
]

GENRES = ["公衆衛生", "精神", "感染症", "急性期", "地域", "研究", "その他"]
JST = timezone(timedelta(hours=9))
TODAY = datetime.now(JST).strftime("%Y-%m-%d")

SEEN_FILE = "seen_urls.json"
ARTICLES_FILE = "articles_data.json"
HTML_FILE = "nurse-news.html"

MAX_PER_SOURCE = 10
REQUEST_TIMEOUT = 20


def log(msg: str) -> None:
    print(msg, flush=True)


def load_json_file(path, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        log(f"[WARN] JSON 読み込み失敗 {path}: {e}")
        return default


def save_json_file(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def clean_published(value: str) -> str:
    text = normalize_whitespace(value)
    text = text.replace("\u3000", " ")
    return text if text else TODAY


def fetch_article_text(article_url: str, fallback_summary: str) -> str:
    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36"
    }

    try:
        r = requests.get(article_url, headers=headers, timeout=REQUEST_TIMEOUT)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        paragraphs = [p.get_text(" ", strip=True) for p in soup.find_all("p")]
        full_text = normalize_whitespace(" ".join(paragraphs))[:12000]

        if full_text:
            return full_text

        log(f"[WARN] 本文抽出が空でした: {article_url}")

    except Exception as e:
        log(f"[WARN] スクレイピング失敗: {article_url} / {e}")

    fallback = normalize_whitespace(fallback_summary)[:4000]
    if fallback:
        log(f"[INFO] RSS summary を代替使用: {article_url}")
        return fallback

    return ""


def build_fallback_summary(title: str, full_text: str, source_name: str) -> str:
    text = normalize_whitespace(full_text)
    short = text[:420]
    return (
        f"【概要】{source_name} の記事「{title}」です。\n\n"
        f"AI 要約に失敗したため、原文から取得できた内容を簡易表示しています。\n\n"
        f"【原文抜粋】{short}"
    )


def infer_genre(text: str, title: str = "") -> str:
    hay = f"{title} {text}".lower()

    rules = [
        ("感染症", ["infection", "infectious", "flu", "covid", "virus", "viral", "bacteria", "syphilis", "hiv", "tb"]),
        ("精神", ["mental", "psychi", "depression", "anxiety", "suicide", "stress", "dementia"]),
        ("急性期", ["icu", "critical care", "emergency", "acute", "trauma", "surgery", "hospitalized"]),
        ("地域", ["community", "home care", "primary care", "local", "rural", "outpatient"]),
        ("研究", ["study", "research", "trial", "analysis", "review", "meta-analysis", "cohort"]),
        ("公衆衛生", ["public health", "vaccination", "prevention", "screening", "maternal", "population", "who"]),
    ]

    for genre, keywords in rules:
        if any(k in hay for k in keywords):
            return genre

    return "その他"


def summarize_with_gemini(title: str, full_text: str):
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")

    if genai is None:
        raise RuntimeError("google.generativeai could not be imported")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.5-flash")

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

タイトル: {title}
元記事テキスト: {full_text}
"""

    response = model.generate_content(prompt)
    raw = (getattr(response, "text", "") or "").strip()

    if not raw:
        raise RuntimeError("Gemini response was empty")

    log(f"[DEBUG] Gemini raw_length={len(raw)}")
    log(f"[DEBUG] Gemini raw_preview={raw[:300]!r}")

    if "SUMMARY:" in raw and "GENRE:" in raw:
        ai_summary = raw.split("GENRE:")[0].replace("SUMMARY:", "").strip()
        genre_raw = raw.split("GENRE:")[-1].strip()
        genre = genre_raw if genre_raw in GENRES else infer_genre(ai_summary, title)
    else:
        log("[WARN] Gemini format mismatch. SUMMARY/GENRE が見つかりません。")
        ai_summary = raw
        genre = infer_genre(raw, title)

    if not ai_summary.strip():
        raise RuntimeError("Gemini summary was empty after parsing")

    return ai_summary, genre


def dedupe_articles(items):
    seen = set()
    out = []

    for item in items:
        key = item.get("url") or (item.get("title"), item.get("published"), item.get("source"))
        if key in seen:
            continue
        seen.add(key)

        item["published"] = clean_published(item.get("published", TODAY))
        item["date"] = item.get("date") or TODAY
        item["genre"] = item.get("genre") if item.get("genre") in GENRES else infer_genre(item.get("summary", ""), item.get("title", ""))

        out.append(item)

    return out


def fmt_date(date_str):
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").strftime("%Y年%-m月%-d日")
    except Exception:
        return date_str


def build_html(all_articles_data):
    grouped_by_date = OrderedDict()
    for article in all_articles_data:
        d = article["date"]
        g = article.get("genre", "その他")
        grouped_by_date.setdefault(d, OrderedDict()).setdefault(g, []).append(article)

    grouped_by_genre = OrderedDict((g, []) for g in GENRES)
    for article in all_articles_data:
        g = article.get("genre", "その他")
        grouped_by_genre.setdefault(g, []).append(article)

    sidebar_date_html = ""
    for date, genres in grouped_by_date.items():
        total = sum(len(v) for v in genres.values())
        sidebar_date_html += f"""<div class="date-group">
  <button class="date-btn" onclick="toggleDate('{date}')">
    <span>{fmt_date(date)}</span><span class="count">{total}</span>
  </button>
  <div class="genre-list" id="genres-{date}">
"""
        for genre in genres:
            sidebar_date_html += f"""    <a href="#" class="genre-sublink" onclick="showDate('{date}'); return false;">{genre}<span class="count">{len(genres[genre])}</span></a>\n"""
        sidebar_date_html += "  </div>\n</div>\n"

    sidebar_genre_html = ""
    for genre, articles in grouped_by_genre.items():
        if not articles:
            continue
        sidebar_genre_html += f"""<a href="#" class="genre-link" onclick="showGenre('{genre}'); return false;">{genre}<span class="count">{len(articles)}</span></a>\n"""

    date_view_html = ""
    for date, genres in grouped_by_date.items():
        date_view_html += f"""<div class="date-section" id="{date}">
<h2 class="date-heading">{fmt_date(date)}</h2>
"""
        for genre, articles in genres.items():
            date_view_html += f"""<div class="genre-section">
<h3 class="genre-heading">{genre}</h3>
"""
            for a in articles:
                summary_html = (a["summary"] or "").replace("\n", "<br>")
                date_view_html += f"""  <article data-genre="{a['genre']}">
    <p class="meta">{a["source"]}　{a["published"]}</p>
    <h4 class="article-title">{a["title"]}</h4>
    <div class="summary">{summary_html}</div>
    <div class="source-box">
      <strong>ソース・引用元</strong><br>
      配信元：{a["source"]}<br>
      原文URL：<a href="{a["url"]}" target="_blank" rel="noopener">{a["url"]}</a>
    </div>
  </article>
"""
            date_view_html += "</div>\n"
        date_view_html += "</div>\n"

    return f"""<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Nursing News | VARELSER</title>
  <style>
    :root {{
      --bg:#fff;
      --fg:#111;
      --muted:rgba(0,0,0,.5);
      --border:#e8e8e8;
      --accent:#0056b3;
      --sidebar-bg:#fafafa;
      --hover:rgba(0,0,0,.04);
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
    .summary{{font-size:15px;color:#222;line-height:1.9;margin-bottom:18px;white-space:normal;}}
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
      if (!list) return;
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


def main():
    seen_urls = set(load_json_file(SEEN_FILE, []))
    all_articles_data = load_json_file(ARTICLES_FILE, [])
    all_articles_data = dedupe_articles(all_articles_data)

    log(f"[INFO] 既知URL数: {len(seen_urls)}")
    log(f"[INFO] 既存記事数: {len(all_articles_data)}")

    new_count = 0

    for source in RSS_SOURCES:
        log(f"[INFO] フィード取得開始: {source['name']}")

        try:
            feed = feedparser.parse(source["url"])
            entries = getattr(feed, "entries", []) or []

            if getattr(feed, "bozo", 0):
                log(f"[WARN] フィード解析警告: {source['name']} / {getattr(feed, 'bozo_exception', '')}")

            if not entries:
                log(f"[WARN] フィード記事なし: {source['name']}")
                continue

            for entry in entries[:MAX_PER_SOURCE]:
                article_url = getattr(entry, "link", "").strip()
                title = normalize_whitespace(getattr(entry, "title", "(no title)"))
                summary = getattr(entry, "summary", "") or getattr(entry, "description", "") or ""
                published = clean_published(getattr(entry, "published", TODAY))

                if not article_url:
                    log(f"[WARN] URLなしでスキップ: {title}")
                    continue

                if article_url in seen_urls:
                    continue

                full_text = fetch_article_text(article_url, summary)
                if not full_text:
                    log(f"[WARN] 本文も summary も取得できずスキップ: {article_url}")
                    continue

                try:
                    ai_summary, genre = summarize_with_gemini(title, full_text)
                    log(f"[INFO] AI要約成功: [{genre}] {title}")
                except Exception as e:
                    genre = infer_genre(full_text, title)
                    ai_summary = build_fallback_summary(title, full_text, source["name"])
                    log(f"[WARN] AI要約失敗のため簡易要約にフォールバック: {title} / {e}")

                all_articles_data.insert(0, {
                    "date": TODAY,
                    "published": published,
                    "source": source["name"],
                    "title": title,
                    "summary": ai_summary,
                    "genre": genre,
                    "url": article_url,
                })

                seen_urls.add(article_url)
                new_count += 1

        except Exception as e:
            log(f"[ERROR] ソース処理失敗: {source['name']} / {e}")

    all_articles_data = dedupe_articles(all_articles_data)

    save_json_file(SEEN_FILE, sorted(seen_urls))
    save_json_file(ARTICLES_FILE, all_articles_data)

    final_html = build_html(all_articles_data)
    with open(HTML_FILE, "w", encoding="utf-8") as f:
        f.write(final_html)

    log(f"[INFO] 新着記事数: {new_count}")
    log(f"[INFO] 保存完了: {HTML_FILE}, {ARTICLES_FILE}, {SEEN_FILE}")


if __name__ == "__main__":
    main()
