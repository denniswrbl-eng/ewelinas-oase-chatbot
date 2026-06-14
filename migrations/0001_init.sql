-- Migration: 0001_init.sql
-- DSGVO-konform: kein Klartext-Prompt, nur Hash + Char-Count

CREATE TABLE IF NOT EXISTS chatbot_requests (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ts             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ip_hash        TEXT,
  origin         TEXT,
  user_agent     TEXT,
  prompt_hash    TEXT,
  prompt_chars   INTEGER,
  response_chars INTEGER,
  model          TEXT,
  latency_ms     INTEGER,
  status         TEXT    NOT NULL DEFAULT 'ok',
  error          TEXT
);
