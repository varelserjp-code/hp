import os
import re
import feedparser
import google.generativeai as genai

# 1. 外部情報の取得
RSS_URL = "https://pubmed.ncbi.nlm.nih.gov/rss/search/1/?limit=1&term=nursing"
feed = feedparser.parse(RSS_URL)
latest_entry = feed.entries[0]

# 2. AIによる日本語要約
genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel('gemini-2.5-flash')

prompt = f"""
以下の英語の医療・看護系ニュースのタイトルと概要を、日本の現役看護師向けに分かりやすく300文字程度の日本語で要約してください。AdSenseのコンテンツとして価値が出るように、専門的な用語も適切に用いて論理的な解説を含めてください。

タイトル: {latest_entry.title}
リンク: {latest_entry.link}
概要: {latest_entry.summary}
"""

response = model.generate_content(prompt)
ai_summary = response.text

# 3. HTMLファイルへの書き込み用にフォーマット
new_html_content = f"""
  <article>
    <h3><a href="{latest_entry.link}" target="_blank" rel="noopener">{latest_entry.title}</a></h3>
    <p>{ai_summary.replace(chr(10), '<br>')}</p>
    <small>自動更新日時: {feed.feed.updated}</small>
  </article>
"""

# 4. nurse-news.html の読み込みと物理的な書き換え処理
file_path = "nurse-news.html"

with open(file_path, "r", encoding="utf-8") as file:
    html_data = file.read()

# 正規表現で と の間を置換
pattern = r"()(.*?)()"
updated_html = re.sub(pattern, rf"\1\n{new_html_content}\n\3", html_data, flags=re.DOTALL)

with open(file_path, "w", encoding="utf-8") as file:
    file.write(updated_html)

print("nurse-news.html のAI要約テキスト更新が完了しました。")
