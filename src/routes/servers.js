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
      tps: latest?.tps ?? null,
      player_count: latest?.player_count ?? 0,
      max_players: latest?.max_players ?? 0,
      uptime_seconds: latest?.uptime_seconds ?? 0,
      memory_used: latest?.memory_used ?? 0,
      memory_max: latest?.memory_max ?? 0,
      mspt: latest?.mspt ?? null,
      last_seen: latest?.ts ?? null,
    }
  })
  res.json(result)
})

router.get('/:id', requireAuth, (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id)
  if (!server) return res.status(404).json({ error: 'Not found' })
  const latest = db.prepare('SELECT * FROM stats WHERE server_id = ? ORDER BY ts DESC LIMIT 1').get(server.id)
  const recentEvents = db.prepare('SELECT * FROM player_events WHERE server_id = ? ORDER BY ts DESC LIMIT 50').all(server.id)
  const recentDeaths = db.prepare('SELECT * FROM death_events WHERE server_id = ? ORDER BY ts DESC LIMIT 50').all(server.id)
  res.json({
    id: server.id, name: server.name, created_at: server.created_at,
    online: latest?.online === 1,
    tps: latest?.tps ?? null,
    player_count: latest?.player_count ?? 0,
    max_players: latest?.max_players ?? 0,
    uptime_seconds: latest?.uptime_seconds ?? 0,
    memory_used: latest?.memory_used ?? 0,
    memory_max: latest?.memory_max ?? 0,
    mspt: latest?.mspt ?? null,
    last_seen: latest?.ts ?? null,
    recent_events: recentEvents,
    recent_deaths: recentDeaths,
  })
})

router.get('/:id/graph', requireAuth, (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id)
  if (!server) return res.status(404).json({ error: 'Not found' })
  const metric = ['tps','player_count','memory_used','mspt'].includes(req.query.metric) ? req.query.metric : 'tps'
  const range  = parseInt(req.query.range) || 3600
  const since  = Math.floor(Date.now() / 1000) - range
  const bucket = Math.max(Math.floor(range / 60), 10)
  const rows = db.prepare(`
    SELECT (ts / ${bucket}) * ${bucket} as bucket, AVG(${metric}) as value
    FROM stats WHERE server_id = ? AND ts > ?
    GROUP BY bucket ORDER BY bucket ASC
  `).all(server.id, since)
  res.json({ metric, range, data: rows })
})

router.delete('/:id', requireAuth, (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id)
  if (!server) return res.status(404).json({ error: 'Not found' })
  db.prepare('DELETE FROM servers WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router
