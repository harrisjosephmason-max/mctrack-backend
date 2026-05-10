const router = require('express').Router()
const db = require('../db')
const { randomUUID } = require('crypto')

const DISCORD_CLIENT_ID     = process.env.DISCORD_CLIENT_ID
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET
const FRONTEND_URL          = process.env.FRONTEND_URL || 'http://localhost:3000'
const REDIRECT_URI          = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/auth/callback`

router.get('/login', (req, res) => {
  const params = new URLSearchParams({
    client_id:     DISCORD_CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         'identify',
  })
  res.redirect(`https://discord.com/oauth2/authorize?${params}`)
})

router.get('/callback', async (req, res) => {
  const { code } = req.query
  if (!code) return res.redirect(`${FRONTEND_URL}/?error=no_code`)

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  REDIRECT_URI,
      }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) throw new Error('No access token')

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    })
    const discordUser = await userRes.json()

    let user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(discordUser.id)
    if (!user) {
      const id = randomUUID()
      db.prepare('INSERT INTO users (id, discord_id, username, avatar) VALUES (?, ?, ?, ?)')
        .run(id, discordUser.id, discordUser.username, discordUser.avatar || '')
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
    } else {
      db.prepare('UPDATE users SET username = ?, avatar = ? WHERE discord_id = ?')
        .run(discordUser.username, discordUser.avatar || '', discordUser.id)
    }

    const token = Buffer.from(`${user.discord_id}:${user.id}`).toString('base64')
    res.redirect(
      `${FRONTEND_URL}/auth/callback?token=${token}&username=${encodeURIComponent(user.username)}&avatar=${user.avatar || ''}&discord_id=${user.discord_id}`
    )
  } catch (err) {
    console.error('Auth error:', err)
    res.redirect(`${FRONTEND_URL}/?error=auth_failed`)
  }
})

router.get('/me', require('../middleware/auth'), (req, res) => {
  const { id, discord_id, username, avatar } = req.user
  res.json({ id, discord_id, username, avatar })
})

module.exports = router
