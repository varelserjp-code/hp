import os
import re
import feedparser
import google.generativeai as genai

# 1. 権威ある複数の医療・看護系RSSソースのリスト
RSS_SOURCES = [
    {
        "name": "PubMed (Nursing Research)",
        "url": "https://pubmed.ncbi.nlm.nih.gov/rss/search/1/?limit=1&term=nursing"
    },
    {
        "name": "WHO (World Health Organization)",
        "url": "https://www.who.int/rss-feeds/news-english.xml"
    },
    {
        "name": "NIH (National Institutes of Health)",
        "url": "https://www.nih.gov/news-events/news-releases/rss.xml"
    },
    {
        "name": "ScienceDaily (Nursing News)",
        "url": "https://www.sciencedaily.com/rss/health_medicine/nursing.xml"
    },
    {
        "name": "MedlinePlus (Health News)",
        "url": "https://medlineplus.gov/feeds/news_en.xml"
    }
]

# 2. AIの初期設定
genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel('gemini-2.5-flash')

new_html_content = ""

# 3. 各ソースからデータを取得し、要約するループ処理
for source in RSS_SOURCES:
    try:
        feed = feedparser.parse(source["url"])
        
        if not feed.entries:
            continue
            
        latest_entry = feed.entries[0]
        
        # AIへのプロンプト（1000文字以内、わかりやすさ、論理的解説を指示）
        prompt = f"""
        以下の英語の医療・看護系ニュースを、日本の現役看護師向けに【1000文字以内】でわかりやすく日本語に翻訳・要約してください。
        その際、情報のエビデンスやメカニズムが正確に伝わるよう、専門用語を適切に用いて論理的に解説してください。

        タイトル: {latest_entry.title}
        リンク: {latest_entry.link}
        概要: {latest_entry.summary if 'summary' in latest_entry else 'No summary provided.'}
        """

        response = model.generate_content(prompt)
        ai_summary = response.text

        # 4. 取得・要約した内容と「ソース・引用元」をHTMLとしてフォーマット
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

# 5. nurse-news.html の読み込みと物理的な書き換え処理
file_path = "nurse-news.html"

with open(file_path, "r", encoding="utf-8") as file:
    html_data = file.read()

pattern = r"()(.*?)()"
updated_html = re.sub(pattern, rf"\1\n{new_html_content}\n\3", html_data, flags=re.DOTALL)

with open(file_path, "w", encoding="utf-8") as file:
    file.write(updated_html)

print("要約テキストと引用元の更新が完了しました。")
