const initSqlJs = require('sql.js')
const path = require('path')
const fs   = require('fs')
const DB_PATH = path.join(__dirname, '../../data.db')
let db = null

async function getDb() {
  if (db) return db
  const SQL = await initSqlJs()
  db = fs.existsSync(DB_PATH) ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database()
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
      uptime_seconds INTEGER, memory_used INTEGER, memory_max INTEGER, mspt REAL,
      cpu_process REAL, cpu_system REAL,
      phys_used INTEGER, phys_total INTEGER,
      swap_used INTEGER, swap_total INTEGER,
      disk_used INTEGER, disk_total INTEGER,
      online INTEGER DEFAULT 1,
      ts INTEGER DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS platform_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT, server_id TEXT UNIQUE NOT NULL,
      server_software TEXT, server_version TEXT, mc_version TEXT,
      online_mode INTEGER, os TEXT, cpu_name TEXT, java_version TEXT, jvm TEXT,
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
    CREATE TABLE IF NOT EXISTS kill_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, server_id TEXT NOT NULL,
      killer_name TEXT NOT NULL, killer_uuid TEXT,
      victim_name TEXT NOT NULL, victim_uuid TEXT,
      ts INTEGER DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS command_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, server_id TEXT NOT NULL,
      player_name TEXT NOT NULL, player_uuid TEXT,
      command TEXT NOT NULL, ts INTEGER DEFAULT (strftime('%s','now'))
    );
  `)
  save()
  return db
}

function save() { if (!db) return; fs.writeFileSync(DB_PATH, Buffer.from(db.export())) }
function run(sql, params=[]) { db.run(sql, params); save() }
function get(sql, params=[]) { const s=db.prepare(sql); s.bind(params); if(s.step()){const r=s.getAsObject();s.free();return r} s.free(); return undefined }
function all(sql, params=[]) { const s=db.prepare(sql); s.bind(params); const rows=[]; while(s.step()) rows.push(s.getAsObject()); s.free(); return rows }
function prepare(sql) { return { run:(...p)=>run(sql,p.flat()), get:(...p)=>get(sql,p.flat()), all:(...p)=>all(sql,p.flat()) } }
module.exports = { getDb, prepare, run, get, all, save }
