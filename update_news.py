try:
    ai_response = model.generate_content(prompt)
    raw = getattr(ai_response, "text", "") or ""
    print(f"[DEBUG] title={entry.title}")
    print(f"[DEBUG] raw_length={len(raw)}")
    print(f"[DEBUG] raw_preview={raw[:300]!r}")

    raw = raw.strip()
    if not raw:
        print(f"[WARN] Gemini returned empty text: {entry.title}")
        continue

    if "SUMMARY:" in raw and "GENRE:" in raw:
        ai_summary = raw.split("GENRE:")[0].replace("SUMMARY:", "").strip()
        genre_raw = raw.split("GENRE:")[-1].strip()
        genre = genre_raw if genre_raw in GENRES else "その他"
    else:
        print(f"[WARN] Gemini format mismatch: {entry.title}")
        ai_summary = raw
        genre = "その他"

except Exception as e:
    print(f"[AI ERROR] title={entry.title} url={article_url} error={repr(e)}")
    continue
