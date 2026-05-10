const router = require('express').Router()
const db = require('../db')

function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key']
  if (!key) return res.status(401).json({ error: 'Missing X-Api-Key header' })
  const server = db.prepare('SELECT * FROM servers WHERE api_key = ?').get(key)
  if (!server) return res.status(401).json({ error: 'Invalid API key' })
  req.server = server
  next()
}

// POST /api/events/stats
router.post('/stats', requireApiKey, (req, res) => {
  const { tps, player_count, max_players, uptime_seconds, memory_used, memory_max, mspt } = req.body
  db.prepare(`
    INSERT INTO stats (server_id, tps, player_count, max_players, uptime_seconds, memory_used, memory_max, mspt, online)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(req.server.id, tps??null, player_count??0, max_players??0, uptime_seconds??0, memory_used??0, memory_max??0, mspt??null)
  res.json({ ok: true })
})

// POST /api/events/player
router.post('/player', requireApiKey, (req, res) => {
  const { player_name, player_uuid, event_type } = req.body
  if (!player_name || !['player_join','player_leave'].includes(event_type))
    return res.status(400).json({ error: 'Invalid payload' })
  db.prepare('INSERT INTO player_events (server_id, player_name, player_uuid, event_type) VALUES (?, ?, ?, ?)')
    .run(req.server.id, player_name, player_uuid||'', event_type)
  res.json({ ok: true })
})

// POST /api/events/chat
router.post('/chat', requireApiKey, (req, res) => {
  const { player_name, player_uuid, message } = req.body
  if (!player_name || !message) return res.status(400).json({ error: 'Invalid payload' })
  db.prepare('INSERT INTO chat_messages (server_id, player_name, player_uuid, message) VALUES (?, ?, ?, ?)')
    .run(req.server.id, player_name, player_uuid||'', message)
  res.json({ ok: true })
})

// GET /api/events/chat/:serverId
router.get('/chat/:serverId', require('../middleware/auth'), (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ? AND owner_id = ?').get(req.params.serverId, req.user.id)
  if (!server) return res.status(404).json({ error: 'Not found' })
  const rows = db.prepare('SELECT * FROM chat_messages WHERE server_id = ? ORDER BY ts DESC LIMIT 100').all(server.id)
  res.json(rows)
})

// POST /api/events/death
router.post('/death', requireApiKey, (req, res) => {
  const { player_name, player_uuid, death_message } = req.body
  if (!player_name) return res.status(400).json({ error: 'Invalid payload' })
  db.prepare('INSERT INTO death_events (server_id, player_name, player_uuid, death_message) VALUES (?, ?, ?, ?)')
    .run(req.server.id, player_name, player_uuid||'', death_message||'died')
  res.json({ ok: true })
})

// POST /api/events/offline
router.post('/offline', requireApiKey, (req, res) => {
  db.prepare('INSERT INTO stats (server_id, tps, player_count, online) VALUES (?, 0, 0, 0)').run(req.server.id)
  res.json({ ok: true })
})

module.exports = router
