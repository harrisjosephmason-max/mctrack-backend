const router = require('express').Router()
const db = require('../db')
const requireAuth = require('../middleware/auth')

const ADMIN_ID = '922113203205464135'

function requireAdmin(req, res, next) {
  if (req.user.discord_id !== ADMIN_ID) return res.status(403).json({ error: 'Forbidden' })
  next()
}

// Add plan column to users if not exists (migration)
try {
  db.run('ALTER TABLE users ADD COLUMN plan TEXT DEFAULT "free"')
} catch {}

// Public stats for Discord bot
router.get('/public-stats', (req, res) => {
  const today  = Math.floor(Date.now()/1000) - 86400
  const recent = Math.floor(Date.now()/1000) - 30
  const total_users    = db.prepare('SELECT COUNT(*) as c FROM users').get()?.c ?? 0
  const total_servers  = db.prepare('SELECT COUNT(*) as c FROM servers').get()?.c ?? 0
  const online_servers = db.prepare('SELECT COUNT(DISTINCT server_id) as c FROM stats WHERE ts>? AND online=1').get(recent)?.c ?? 0
  const events_today   = db.prepare('SELECT COUNT(*) as c FROM player_events WHERE ts>?').get(today)?.c ?? 0
  const chats_today    = db.prepare('SELECT COUNT(*) as c FROM chat_messages WHERE ts>?').get(today)?.c ?? 0
  res.json({ total_users, total_servers, online_servers, events_today, chats_today })
})

// Full admin stats
router.get('/stats', requireAuth, requireAdmin, (req, res) => {
  const today  = Math.floor(Date.now()/1000) - 86400
  const recent = Math.floor(Date.now()/1000) - 30
  const total_users    = db.prepare('SELECT COUNT(*) as c FROM users').get()?.c ?? 0
  const total_servers  = db.prepare('SELECT COUNT(*) as c FROM servers').get()?.c ?? 0
  const online_servers = db.prepare('SELECT COUNT(DISTINCT server_id) as c FROM stats WHERE ts>? AND online=1').get(recent)?.c ?? 0
  const events_today   = db.prepare('SELECT COUNT(*) as c FROM player_events WHERE ts>?').get(today)?.c ?? 0
  const chats_today    = db.prepare('SELECT COUNT(*) as c FROM chat_messages WHERE ts>?').get(today)?.c ?? 0

  const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 100').all()
  const servers = db.prepare('SELECT s.*, u.username as owner_username FROM servers s LEFT JOIN users u ON s.owner_id=u.id ORDER BY s.created_at DESC').all()
  const serversWithStatus = servers.map(s => {
    const latest = db.prepare('SELECT online,tps,player_count FROM stats WHERE server_id=? ORDER BY ts DESC LIMIT 1').get(s.id)
    return { ...s, online: latest?.online===1, tps: latest?.tps, player_count: latest?.player_count }
  })

  res.json({
    overview: { total_users, total_servers, online_servers, events_today, chats_today },
    users,
    servers: serversWithStatus,
  })
})

// Set user plan
router.post('/users/:userId/plan', requireAuth, requireAdmin, (req, res) => {
  const { plan } = req.body
  if (!['free','premium'].includes(plan)) return res.status(400).json({ error: 'Invalid plan' })
  try {
    db.prepare('UPDATE users SET plan=? WHERE id=?').run(plan, req.params.userId)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
