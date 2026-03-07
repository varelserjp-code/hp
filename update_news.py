import os
import feedparser
import requests
from bs4 import BeautifulSoup
import google.generativeai as genai

# 1. 権威ある複数の医療・看護系RSSソースのリスト
RSS_SOURCES = [
    {"name": "PubMed (Nursing Research)", "url": "https://pubmed.ncbi.nlm.nih.gov/rss/search/1/?limit=1&term=nursing"},
    {"name": "WHO (World Health Organization)", "url": "https://www.who.int/rss-feeds/news-english.xml"},
    {"name": "NIH (National Institutes of Health)", "url": "https://www.nih.gov/news-events/news-releases/rss.xml"},
    {"name": "ScienceDaily (Nursing News)", "url": "https://www.sciencedaily.com/rss/health_medicine/nursing.xml"},
    {"name": "MedlinePlus (Health News)", "url": "https://medlineplus.gov/feeds/news_en.xml"}
]

# 2. AIの初期設定とエラーチェック
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("Error: GEMINI_API_KEY is not set in GitHub Secrets.")
    exit(1)

genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-2.5-flash')

new_html_content = ""

# 3. 各ソースからデータを取得し、要約するループ処理
for source in RSS_SOURCES:
    try:
        feed = feedparser.parse(source["url"])
        if not feed.entries:
            continue
            
        latest_entry = feed.entries[0]
        article_url = latest_entry.link
        
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
            full_text = latest_entry.summary if 'summary' in latest_entry else ''

        prompt = f"""
        以下の英語の医療・看護系ニュース（元記事の抽出テキスト）を、日本の現役看護師向けに【1000文字以内】でわかりやすく日本語に翻訳・要約してください。
        情報のエビデンスやメカニズムが正確に伝わるよう、専門用語を適切に用いて論理的に解説してください。

        タイトル: {latest_entry.title}
        元記事テキスト:
        {full_text}
        """

        response = model.generate_content(prompt)
        ai_summary = response.text

        new_html_content += f"""
          <article style="margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid #eee;">
            <h3 style="font-size: 18px; margin-bottom: 10px;">{latest_entry.title}</h3>
            <p style="font-size: 15px; color: #333; line-height: 1.6;">{ai_summary.replace(chr(10), '<br>')}</p>
            
            <div style="margin-top: 20px; padding: 12px; background-color: #f5f5f5; border-radius: 6px; font-size: 13px; color: #555;">
              <strong style="color: #111;">【ソース・引用元】</strong><br>
              配信元機関: {source["name"]}<br>
              情報元URL: <a href="{latest_entry.link}" target="_blank" rel="noopener" style="color: #0056b3; word-break: break-all;">{latest_entry.link}</a>
            </div>
          </article>
        """
    except Exception as e:
        print(f"Error processing {source['name']}: {e}")
        continue

# 4. HTMLファイルを「丸ごと」上書き生成する（手作業でのHTML修正を不要にするロジック）
final_html = f"""<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Nursing News | VARELSER</title>
  <style>
    :root{{ --bg:#fff; --fg:#111; --muted:rgba(0,0,0,.55); }}
    body{{ margin:0; background:var(--bg); color:var(--fg); font-family: ui-sans-serif, system-ui, -apple-system, "Hiragino Kaku Gothic ProN","Noto Sans JP", sans-serif; line-height: 1.6; }}
    .container {{ max-width: 800px; margin: 0 auto; padding: 40px 20px; }}
    h1 {{ font-size: 24px; margin-bottom: 40px; border-bottom: 1px solid #eee; padding-bottom: 10px; }}
    .back-link {{ display: inline-block; margin-bottom: 30px; color: var(--muted); text-decoration: none; font-size: 14px; }}
    .back-link:hover {{ color: var(--fg); }}
  </style>
</head>
<body>
  <div class="container">
    <a href="/" class="back-link">← ホームに戻る</a>
    <h1>最新の医療・看護ニュース</h1>
    <p style="color:var(--muted); font-size:14px; margin-bottom:30px;">
      海外の最新医療ニュースをAIで要約し、定期配信しています。
    </p>
    {new_html_content}
  </div>
</body>
</html>"""

with open("nurse-news.html", "w", encoding="utf-8") as file:
    file.write(final_html)

print("ニュースページの完全上書き生成が完了しました。")
