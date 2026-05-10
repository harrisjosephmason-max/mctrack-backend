const router = require('express').Router()
const db = require('../db')
const requireAuth = require('../middleware/auth')
const { randomUUID } = require('crypto')

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

router.post('/generate', requireAuth, (req, res) => {
  db.prepare('DELETE FROM link_codes WHERE user_id = ?').run(req.user.id)
  const code = generateCode()
  const expiresAt = Math.floor(Date.now() / 1000) + 300
  db.prepare('INSERT INTO link_codes (code, user_id, expires_at) VALUES (?, ?, ?)')
    .run(code, req.user.id, expiresAt)
  res.json({ code, expires_in: 300 })
})

router.post('/redeem', (req, res) => {
  const { code, server_name } = req.body
  if (!code || !server_name)
    return res.status(400).json({ error: 'Missing code or server_name' })

  const now = Math.floor(Date.now() / 1000)
  const linkCode = db.prepare(
    'SELECT * FROM link_codes WHERE code = ? AND expires_at > ?'
  ).get(code, now)
  if (!linkCode) return res.status(404).json({ error: 'Invalid or expired code' })

  const existing = db.prepare(
    'SELECT * FROM servers WHERE owner_id = ? AND name = ?'
  ).get(linkCode.user_id, server_name)
  if (existing) {
    db.prepare('DELETE FROM link_codes WHERE code = ?').run(code)
    return res.json({ server_id: existing.id, api_key: existing.api_key, message: 'Already linked' })
  }

  const serverId = randomUUID()
  const apiKey = randomUUID().replace(/-/g, '')
  db.prepare('INSERT INTO servers (id, owner_id, name, api_key) VALUES (?, ?, ?, ?)')
    .run(serverId, linkCode.user_id, server_name, apiKey)
  db.prepare('DELETE FROM link_codes WHERE code = ?').run(code)

  res.json({ server_id: serverId, api_key: apiKey, message: 'Server linked successfully' })
})

module.exports = router
