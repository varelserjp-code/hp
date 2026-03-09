name: Daily Nursing News Update

on:
  schedule:
    - cron: '0 22 * * *'
    - cron: '0 3 * * *'
    - cron: '0 8 * * *'
  workflow_dispatch:

jobs:
  update-news:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Show files
        run: |
          pwd
          ls -la
          find . -maxdepth 3 -type f | sort

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install feedparser requests beautifulsoup4 google-generativeai

      - name: Verify update_news.py exists
        run: |
          test -f update_news.py

      - name: Run updater
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: |
          python update_news.py

      - name: Show git diff
        run: |
          git status
          git diff -- nurse-news.html seen_urls.json backups || true

      - name: Commit and push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add nurse-news.html seen_urls.json backups || true
          if git diff --cached --quiet; then
            echo "No changes to commit"
            exit 0
          fi
          git commit -m "Automated update: nursing news"
          git push
