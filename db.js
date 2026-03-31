const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.join(__dirname, "station2.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("SQLite connection error:", err);
  } else {
    console.log("Connected to SQLite:", dbPath);
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS inbound_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_callsign TEXT NOT NULL,
      destination_callsign TEXT NOT NULL,
      aprs_msg_no TEXT,
      queue_id TEXT,
      part_no INTEGER,
      part_total INTEGER,
      recipient_email TEXT,
      message_text TEXT,
      raw_payload TEXT NOT NULL,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'received',
      error TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reassembled_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_callsign TEXT NOT NULL,
      destination_callsign TEXT NOT NULL,
      queue_id TEXT NOT NULL,
      recipient_email TEXT,
      full_message TEXT,
      total_parts INTEGER,
      reassembled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'ready_for_email',
      error TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS outbound_emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reassembled_id INTEGER NOT NULL,
      recipient_email TEXT NOT NULL,
      subject TEXT,
      body TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sent_at DATETIME,
      error TEXT
     )
   `);	
});

console.log("Connected to SQLite:", dbPath);

module.exports = db;
