CREATE TABLE IF NOT EXISTS birthdays (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  year INTEGER,
  calendar TEXT NOT NULL DEFAULT 'solar' CHECK (calendar IN ('solar', 'lunar')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_birthdays_date ON birthdays(date);
