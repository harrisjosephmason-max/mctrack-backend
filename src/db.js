const initSqlJs = require('sql.js')
const path = require('path')
const fs = require('fs')

const DB_PATH = path.join(__dirname, '../../data.db')
let db = null

async function getDb() {
  if (db) return db
  const SQL = await initSqlJs()
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH))
  } else {
    db = new SQL.Database()
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, discord_id TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL, avatar TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL,
      name TEXT NOT NULL, api_key TEXT UNIQUE NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS link_codes (
      code TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT, server_id TEXT NOT NULL,
      tps REAL, player_count INTEGER, max_players INTEGER,
      uptime_seconds INTEGER, memory_used INTEGER, memory_max INTEGER,
      mspt REAL, online INTEGER DEFAULT 1,
      ts INTEGER DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS player_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, server_id TEXT NOT NULL,
      player_name TEXT NOT NULL, player_uuid TEXT,
      event_type TEXT NOT NULL, ts INTEGER DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, server_id TEXT NOT NULL,
      player_name TEXT NOT NULL, player_uuid TEXT,
      message TEXT NOT NULL, ts INTEGER DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS death_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, server_id TEXT NOT NULL,
      player_name TEXT NOT NULL, player_uuid TEXT,
      death_message TEXT, ts INTEGER DEFAULT (strftime('%s','now'))
    );
  `)
  save()
  return db
}

function save() {
  if (!db) return
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()))
}

function run(sql, params = []) { db.run(sql, params); save() }

function get(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  if (stmt.step()) { const row = stmt.getAsObject(); stmt.free(); return row }
  stmt.free(); return undefined
}

function all(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free(); return rows
}

function prepare(sql) {
  return {
    run:  (...params) => run(sql, params.flat()),
    get:  (...params) => get(sql, params.flat()),
    all:  (...params) => all(sql, params.flat()),
  }
}

module.exports = { getDb, prepare, run, get, all, save }
