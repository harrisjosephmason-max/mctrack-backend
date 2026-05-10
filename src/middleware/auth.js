const db = require('../db')

module.exports = function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No token' })

  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8')
    const [discordId, userId] = decoded.split(':')
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND discord_id = ?').get(userId, discordId)
    if (!user) return res.status(401).json({ error: 'Invalid token' })
    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
}
