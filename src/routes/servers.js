const router = require('express').Router()
const db = require('../db')
const requireAuth = require('../middleware/auth')

router.get('/', requireAuth, (req, res) => {
  const servers = db.prepare('SELECT * FROM servers WHERE owner_id = ?').all(req.user.id)
  const result = servers.map(s => {
    const latest = db.prepare('SELECT * FROM stats WHERE server_id = ? ORDER BY ts DESC LIMIT 1').get(s.id)
    return {
      id: s.id, name: s.name, created_at: s.created_at,
      online: latest?.online === 1,
      tps: latest?.tps ?? null, player_count: latest?.player_count ?? 0,
      max_players: latest?.max_players ?? 0, uptime_seconds: latest?.uptime_seconds ?? 0,
      memory_used: latest?.memory_used ?? 0, memory_max: latest?.memory_max ?? 0,
      mspt: latest?.mspt ?? null, last_seen: latest?.ts ?? null,
    }
  })
  res.json(result)
})

router.get('/:id', requireAuth, (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id)
  if (!server) return res.status(404).json({ error: 'Not found' })

  const latest   = db.prepare('SELECT * FROM stats WHERE server_id = ? ORDER BY ts DESC LIMIT 1').get(server.id)
  const platform = db.prepare('SELECT * FROM platform_info WHERE server_id = ?').get(server.id)
  const today    = Math.floor(Date.now()/1000) - 86400

  const joins_today    = db.prepare('SELECT COUNT(*) as c FROM player_events WHERE server_id=? AND event_type="player_join" AND ts>?').get(server.id,today)?.c??0
  const leaves_today   = db.prepare('SELECT COUNT(*) as c FROM player_events WHERE server_id=? AND event_type="player_leave" AND ts>?').get(server.id,today)?.c??0
  const deaths_today   = db.prepare('SELECT COUNT(*) as c FROM death_events WHERE server_id=? AND ts>?').get(server.id,today)?.c??0
  const kills_today    = db.prepare('SELECT COUNT(*) as c FROM kill_events WHERE server_id=? AND ts>?').get(server.id,today)?.c??0
  const chats_today    = db.prepare('SELECT COUNT(*) as c FROM chat_messages WHERE server_id=? AND ts>?').get(server.id,today)?.c??0
  const commands_today = db.prepare('SELECT COUNT(*) as c FROM command_events WHERE server_id=? AND ts>?').get(server.id,today)?.c??0
  const peak_today     = db.prepare('SELECT MAX(player_count) as m FROM stats WHERE server_id=? AND ts>?').get(server.id,today)?.m??0
  const unique_today   = db.prepare('SELECT COUNT(DISTINCT player_name) as c FROM player_events WHERE server_id=? AND event_type="player_join" AND ts>?').get(server.id,today)?.c??0
  const avg_session    = joins_today>0&&leaves_today>0 ? `${Math.max(1,Math.round((leaves_today/joins_today)*5))}m` : '—'

  const recent_deaths   = db.prepare('SELECT * FROM death_events WHERE server_id=? ORDER BY ts DESC LIMIT 50').all(server.id)
  const recent_kills    = db.prepare('SELECT * FROM kill_events WHERE server_id=? ORDER BY ts DESC LIMIT 50').all(server.id)
  const recent_commands = db.prepare('SELECT * FROM command_events WHERE server_id=? ORDER BY ts DESC LIMIT 50').all(server.id)

  res.json({
    id: server.id, name: server.name, created_at: server.created_at,
    online: latest?.online===1,
    tps: latest?.tps??null, player_count: latest?.player_count??0,
    max_players: latest?.max_players??0, uptime_seconds: latest?.uptime_seconds??0,
    memory_used: latest?.memory_used??0, memory_max: latest?.memory_max??0,
    mspt: latest?.mspt??null, last_seen: latest?.ts??null,
    cpu: {
      process_pct: latest?.cpu_process??null, system_pct: latest?.cpu_system??null,
      phys_used: latest?.phys_used??0, phys_total: latest?.phys_total??0,
      swap_used: latest?.swap_used??0, swap_total: latest?.swap_total??0,
      disk_used: latest?.disk_used??0, disk_total: latest?.disk_total??0,
    },
    platform: platform ? {
      server_software: platform.server_software, server_version: platform.server_version,
      mc_version: platform.mc_version, online_mode: platform.online_mode===1,
      os: platform.os, cpu_name: platform.cpu_name,
      java_version: platform.java_version, jvm: platform.jvm,
    } : {},
    joins_today, leaves_today, deaths_today, kills_today, chats_today, commands_today,
    peak_today, unique_today, avg_session,
    recent_deaths, recent_kills, recent_commands,
  })
})

router.post('/:id/rename', requireAuth, (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id=? AND owner_id=?').get(req.params.id, req.user.id)
  if (!server) return res.status(404).json({ error: 'Not found' })
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' })
  db.prepare('UPDATE servers SET name=? WHERE id=?').run(name.trim(), server.id)
  res.json({ ok: true })
})

router.get('/:id/graph', requireAuth, (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id=? AND owner_id=?').get(req.params.id, req.user.id)
  if (!server) return res.status(404).json({ error: 'Not found' })
  const metric = ['tps','player_count','memory_used','mspt','cpu_process','cpu_system'].includes(req.query.metric) ? req.query.metric : 'tps'
  const range  = parseInt(req.query.range)||3600
  const since  = Math.floor(Date.now()/1000)-range
  const bucket = Math.max(Math.floor(range/60),10)
  const rows = db.prepare(`SELECT (ts/${bucket})*${bucket} as bucket, AVG(${metric}) as value FROM stats WHERE server_id=? AND ts>? GROUP BY bucket ORDER BY bucket ASC`).all(server.id,since)
  res.json({ metric, range, data: rows })
})

router.delete('/:id', requireAuth, (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id=? AND owner_id=?').get(req.params.id, req.user.id)
  if (!server) return res.status(404).json({ error: 'Not found' })
  db.prepare('DELETE FROM servers WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router
