import json
import os
import re
import shutil
from datetime import datetime
from html import escape
from urllib.parse import urlsplit, urlunsplit

import feedparser
import requests
from bs4 import BeautifulSoup
from google import genai

RSS_SOURCES = [
    {
        "name": "PubMed (Nursing Research)",
        "url": "https://pubmed.ncbi.nlm.nih.gov/rss/search/1/?limit=10&term=nursing",
    },
    {
        "name": "WHO (World Health Organization)",
        "url": "https://www.who.int/rss-feeds/news-english.xml",
    },
    {
        "name": "NIH (National Institutes of Health)",
        "url": "https://www.nih.gov/news-events/news-releases/rss.xml",
    },
    {
        "name": "ScienceDaily (Nursing News)",
        "url": "https://www.sciencedaily.com/rss/health_medicine/nursing.xml",
    },
    {
        "name": "MedlinePlus (Health News)",
        "url": "https://medlineplus.gov/feeds/news_en.xml",
    },
]

SITE_DIR = "docs"
SEEN_FILE = "seen_urls.json"
EXISTING_FILE = os.path.join(SITE_DIR, "nurse-news.html")
BACKUP_DIR = "backups"
MAX_PER_SOURCE = 20
REQUEST_TIMEOUT = 15
MAX_ARTICLE_TEXT = 10000
MAX_FALLBACK_TEXT = 4000
ENABLE_BACKUP = os.environ.get("ENABLE_BACKUP", "0") == "1"


def log(message: str) -> None:
    print(message, flush=True)


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def ensure_backup_dir() -> None:
    ensure_dir(BACKUP_DIR)


def backup_file_if_exists(path: str) -> None:
    if not ENABLE_BACKUP:
        return
    if not os.path.exists(path):
        return
    ensure_backup_dir()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(BACKUP_DIR, f"{os.path.basename(path)}.{timestamp}.bak")
    shutil.copy2(path, backup_path)
    log(f"[INFO] バックアップ作成: {backup_path}")


def load_seen_urls() -> set[str]:
    if os.path.exists(SEEN_FILE):
        try:
            with open(SEEN_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                return set(str(item) for item in data if item)
        except Exception as e:
            log(f"[WARN] seen_urls.json 読み込み失敗: {e}")
    return set()


def save_seen_urls(seen_urls: set[str]) -> None:
    with open(SEEN_FILE, "w", encoding="utf-8") as f:
        json.dump(sorted(seen_urls), f, ensure_ascii=False, indent=2)


def extract_existing_articles() -> str:
    if not os.path.exists(EXISTING_FILE):
        log("[INFO] 既存HTMLなし")
        return ""

    try:
        with open(EXISTING_FILE, "r", encoding="utf-8") as f:
            existing_html = f.read()
    except Exception as e:
        log(f"[WARN] 既存HTML読み込み失敗: {e}")
        return ""

    start_marker = "<!-- ARTICLES_START -->"
    end_marker = "<!-- ARTICLES_END -->"

    start = existing_html.find(start_marker)
    end = existing_html.find(end_marker)

    if start != -1 and end != -1 and end > start:
        extracted = existing_html[start + len(start_marker):end].strip()
        log(f"[INFO] 既存記事ブロック抽出: {len(extracted)} 文字")
        return extracted

    log("[WARN] 既存HTMLに記事マーカーが見つかりません")
    return ""


def clean_text(raw_text: str) -> str:
    text = BeautifulSoup(raw_text or "", "html.parser").get_text(" ", strip=True)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        return ""
    parts = urlsplit(url)
    clean_query = "&".join(
        part for part in parts.query.split("&") if part and not part.startswith("utm_")
    )
    return urlunsplit((parts.scheme, parts.netloc, parts.path, clean_query, ""))


def format_published(entry) -> str:
    published = clean_text(getattr(entry, "published", "") or getattr(entry, "updated", ""))
    if published:
        return published
    published_parsed = getattr(entry, "published_parsed", None) or getattr(entry, "updated_parsed", None)
    if published_parsed:
        try:
            return datetime(*published_parsed[:6]).strftime("%Y-%m-%d %H:%M")
        except Exception:
            pass
    return "日時不明"


def fetch_article_text(article_url: str, fallback_summary: str) -> str:
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; NurseNewsBot/1.0; +https://github.com/)",
        }
        response = requests.get(article_url, headers=headers, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        paragraphs = soup.find_all("p")
        full_text = " ".join(p.get_text(" ", strip=True) for p in paragraphs)
        full_text = clean_text(full_text)[:MAX_ARTICLE_TEXT]

        if full_text:
            return full_text

        log(f"[WARN] 本文抽出結果が空: {article_url}")
    except Exception as scrape_error:
        log(f"[WARN] スクレイピング失敗: {article_url} / {scrape_error}")

    fallback_text = clean_text(fallback_summary)[:MAX_FALLBACK_TEXT]
    if fallback_text:
        log(f"[INFO] RSS summary を代替使用: {article_url}")
        return fallback_text

    return ""


def summarize_with_gemini(client: genai.Client, title: str, full_text: str) -> str:
    prompt = f"""以下の英語の医療・看護系ニュースを、日本の現役看護師向けに1000文字以内でわかりやすく日本語に翻訳・要約してください。

ルール:
- Markdown記号は使わない
- 箇条書き記号は使わない
- 段落ごとに改行する
- 専門用語は適切に使う
- 自然な日本語で書く

タイトル: {title}
元記事テキスト:
{full_text}
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )
    ai_summary = (getattr(response, "text", "") or "").strip()

    log(f"[DEBUG] AI raw length: {len(ai_summary)} / {title}")

    if not ai_summary:
        raise RuntimeError("Gemini returned empty text")

    return ai_summary


def build_article_html(source_name: str, published: str, title: str, summary: str, link: str) -> str:
    safe_source = escape(source_name)
    safe_published = escape(published)
    safe_title = escape(title)
    safe_summary = escape(summary).replace("\n", "<br>")
    safe_link = escape(link, quote=True)

    return f"""
          <article>
            <p class="meta">{safe_source}　{safe_published}</p>
            <h2 class="article-title">{safe_title}</h2>
            <div class="summary">{safe_summary}</div>
            <div class="source-box">
              <strong>ソース・引用元</strong><br>
              配信元：{safe_source}<br>
              原文URL：<a href="{safe_link}" target="_blank" rel="noopener">{safe_link}</a>
            </div>
          </article>
"""


def build_final_html(all_articles: str) -> str:
    return f"""<!doctype html>
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
      white-space: normal;
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


def main() -> None:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        log("Error: GEMINI_API_KEY is not set in GitHub Secrets.")
        raise SystemExit(1)

    ensure_dir(SITE_DIR)

    client = genai.Client(api_key=api_key)

    seen_urls = load_seen_urls()
    existing_articles = extract_existing_articles()

    log(f"[INFO] 既知URL数: {len(seen_urls)}")
    log(f"[INFO] 既存記事文字数: {len(existing_articles)}")

    new_articles_html = ""
    new_count = 0

    for source in RSS_SOURCES:
        try:
            log(f"[INFO] フィード取得開始: {source['name']}")
            feed = feedparser.parse(source["url"])
            entries = getattr(feed, "entries", []) or []

            if getattr(feed, "bozo", 0):
                log(f"[WARN] フィード解析警告: {source['name']} / {getattr(feed, 'bozo_exception', '')}")

            if not entries:
                log(f"[WARN] フィード記事なし: {source['name']}")
                continue

            for entry in entries[:MAX_PER_SOURCE]:
                article_url = normalize_url(getattr(entry, "link", ""))
                title = clean_text(getattr(entry, "title", "(no title)"))
                published = format_published(entry)
                fallback_summary = getattr(entry, "summary", "") or getattr(entry, "description", "") or ""

                if not article_url:
                    log(f"[WARN] URLなしでスキップ: {title}")
                    continue

                if article_url in seen_urls:
                    continue

                full_text = fetch_article_text(article_url, fallback_summary)
                if not full_text:
                    log(f"[WARN] 本文取得不可でスキップ: {article_url}")
                    continue

                try:
                    ai_summary = summarize_with_gemini(client, title, full_text)
                except Exception as ai_error:
                    log(f"[WARN] AI要約失敗: {article_url} / {repr(ai_error)}")
                    continue

                article_html = build_article_html(
                    source_name=source["name"],
                    published=published,
                    title=title,
                    summary=ai_summary,
                    link=article_url,
                )

                new_articles_html += article_html
                seen_urls.add(article_url)
                new_count += 1
                log(f"[INFO] Added: {title}")

        except Exception as e:
            log(f"[ERROR] ソース処理失敗 {source['name']}: {repr(e)}")
            continue

    log(f"[INFO] 新着記事数: {new_count}")

    all_articles = (new_articles_html + "\n" + existing_articles).strip()

    if not all_articles:
        log("[ERROR] 記事が0件のため nurse-news.html を上書きしません")
        raise SystemExit(1)

    if "<article" not in all_articles:
        log("[ERROR] articleタグが存在しないため nurse-news.html を上書きしません")
        raise SystemExit(1)

    final_html = build_final_html(all_articles)

    backup_file_if_exists(EXISTING_FILE)

    with open(EXISTING_FILE, "w", encoding="utf-8") as f:
        f.write(final_html)

    save_seen_urls(seen_urls)

    log("[INFO] 生成完了")


if __name__ == "__main__":
    main()
