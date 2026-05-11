const router = require('express').Router()
const db = require('../db')
const requireAuth = require('../middleware/auth')

const ADMIN_ID = '922113203205464135'

// Public stats for Discord bot - no auth needed
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

function requireAdmin(req, res, next) {
  if (req.user.discord_id !== ADMIN_ID) return res.status(403).json({ error: 'Forbidden' })
  next()
}

router.get('/stats', requireAuth, requireAdmin, (req, res) => {
  const todayStart = Math.floor(Date.now()/1000) - 86400

  const total_users   = db.prepare('SELECT COUNT(*) as c FROM users').get()?.c ?? 0
  const total_servers = db.prepare('SELECT COUNT(*) as c FROM servers').get()?.c ?? 0
  const events_today  = db.prepare('SELECT COUNT(*) as c FROM player_events WHERE ts > ?').get(todayStart)?.c ?? 0
  const chats_today   = db.prepare('SELECT COUNT(*) as c FROM chat_messages WHERE ts > ?').get(todayStart)?.c ?? 0

  // Online servers (had a stat in last 30s)
  const recent = Math.floor(Date.now()/1000) - 30
  const online_servers = db.prepare('SELECT COUNT(DISTINCT server_id) as c FROM stats WHERE ts > ? AND online = 1').get(recent)?.c ?? 0

  const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 50').all()

  const servers = db.prepare('SELECT s.*, u.username as owner_username FROM servers s LEFT JOIN users u ON s.owner_id = u.id ORDER BY s.created_at DESC').all()
  const serversWithStatus = servers.map(s => {
    const latest = db.prepare('SELECT online FROM stats WHERE server_id = ? ORDER BY ts DESC LIMIT 1').get(s.id)
    return { ...s, online: latest?.online === 1 }
  })

  res.json({
    overview: { total_users, total_servers, online_servers, events_today, chats_today },
    users,
    servers: serversWithStatus,
  })
})

module.exports = router
