const router = require('express').Router()
const db = require('../db')

function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key']
  if (!key) return res.status(401).json({ error: 'Missing X-Api-Key' })
  const server = db.prepare('SELECT * FROM servers WHERE api_key = ?').get(key)
  if (!server) return res.status(401).json({ error: 'Invalid API key' })
  req.server = server; next()
}

router.post('/stats', requireApiKey, (req, res) => {
  const { tps, player_count, max_players, uptime_seconds, memory_used, memory_max, mspt,
          cpu_process, cpu_system, phys_used, phys_total, swap_used, swap_total, disk_used, disk_total } = req.body
  db.prepare(`INSERT INTO stats (server_id,tps,player_count,max_players,uptime_seconds,memory_used,memory_max,mspt,cpu_process,cpu_system,phys_used,phys_total,swap_used,swap_total,disk_used,disk_total,online) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`)
    .run(req.server.id, tps??null, player_count??0, max_players??0, uptime_seconds??0, memory_used??0, memory_max??0, mspt??null, cpu_process??null, cpu_system??null, phys_used??0, phys_total??0, swap_used??0, swap_total??0, disk_used??0, disk_total??0)
  res.json({ ok: true })
})

router.post('/platform', requireApiKey, (req, res) => {
  const { server_software, server_version, mc_version, online_mode, os, cpu_name, java_version, jvm } = req.body
  db.prepare(`INSERT OR REPLACE INTO platform_info (server_id,server_software,server_version,mc_version,online_mode,os,cpu_name,java_version,jvm,ts) VALUES (?,?,?,?,?,?,?,?,?,strftime('%s','now'))`)
    .run(req.server.id, server_software||'', server_version||'', mc_version||'', online_mode?1:0, os||'', cpu_name||'', java_version||'', jvm||'')
  res.json({ ok: true })
})

router.post('/player', requireApiKey, (req, res) => {
  const { player_name, player_uuid, event_type } = req.body
  if (!player_name || !['player_join','player_leave'].includes(event_type)) return res.status(400).json({ error: 'Invalid' })
  db.prepare('INSERT INTO player_events (server_id,player_name,player_uuid,event_type) VALUES (?,?,?,?)').run(req.server.id, player_name, player_uuid||'', event_type)
  res.json({ ok: true })
})

router.post('/chat', requireApiKey, (req, res) => {
  const { player_name, player_uuid, message } = req.body
  if (!player_name || !message) return res.status(400).json({ error: 'Invalid' })
  db.prepare('INSERT INTO chat_messages (server_id,player_name,player_uuid,message) VALUES (?,?,?,?)').run(req.server.id, player_name, player_uuid||'', message)
  res.json({ ok: true })
})

router.get('/chat/:serverId', require('../middleware/auth'), (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id=? AND owner_id=?').get(req.params.serverId, req.user.id)
  if (!server) return res.status(404).json({ error: 'Not found' })
  res.json(db.prepare('SELECT * FROM chat_messages WHERE server_id=? ORDER BY ts DESC LIMIT 200').all(server.id))
})

router.post('/death', requireApiKey, (req, res) => {
  const { player_name, player_uuid, death_message } = req.body
  if (!player_name) return res.status(400).json({ error: 'Invalid' })
  db.prepare('INSERT INTO death_events (server_id,player_name,player_uuid,death_message) VALUES (?,?,?,?)').run(req.server.id, player_name, player_uuid||'', death_message||'died')
  res.json({ ok: true })
})

router.post('/kill', requireApiKey, (req, res) => {
  const { killer_name, killer_uuid, victim_name, victim_uuid } = req.body
  if (!killer_name || !victim_name) return res.status(400).json({ error: 'Invalid' })
  db.prepare('INSERT INTO kill_events (server_id,killer_name,killer_uuid,victim_name,victim_uuid) VALUES (?,?,?,?,?)').run(req.server.id, killer_name, killer_uuid||'', victim_name, victim_uuid||'')
  res.json({ ok: true })
})

router.post('/command', requireApiKey, (req, res) => {
  const { player_name, player_uuid, command } = req.body
  if (!player_name || !command) return res.status(400).json({ error: 'Invalid' })
  db.prepare('INSERT INTO command_events (server_id,player_name,player_uuid,command) VALUES (?,?,?,?)').run(req.server.id, player_name, player_uuid||'', command)
  res.json({ ok: true })
})

router.post('/offline', requireApiKey, (req, res) => {
  db.prepare('INSERT INTO stats (server_id,tps,player_count,online) VALUES (?,0,0,0)').run(req.server.id)
  res.json({ ok: true })
})

module.exports = router
