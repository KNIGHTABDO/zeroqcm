# FMPC QCM Data Snapshot

## s1-fmpc-snapshot.json

Pre-scraped S1 FMPC question bank. Self-hosted, zero external dependency.

| Field | Value |
|-------|-------|
| Source | DariQCM (public free platform) |
| Faculty | FMPC — Université Hassan II Casablanca |
| Semester | S1 |
| Questions | 10,697 |
| Choices | 51,484 |
| Avg choices/Q | 4.8 |
| Scraped | 2026-02-22 |

## Structure
```json
{
  "meta": { ... },
  "modules": [ { "id", "nom", "total_questions" } ],
  "questions": [
    {
      "id": 12345,
      "text": "Question text in French",
      "source": "2024 Décembre",
      "type": "qcm",
      "module_id": 26,
      "choices": [
        { "id": 1, "text": "A- ...", "correct": true, "pct": 91.24, "explication": "..." }
      ]
    }
  ]
}
```

## Supabase
Live database: `clcbqtkyrtntixdspxiw.supabase.co`
All 10,697 questions + 51,484 choices are already loaded.
