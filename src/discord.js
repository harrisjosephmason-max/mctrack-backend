const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
const DEPLOY_CHANNEL    = '1502492325065130147'
const JOIN_CHANNEL      = '1503154384077590650'
const STATUS_CHANNEL    = '1503154467812671728'

const BASE = 'https://discord.com/api/v10'

async function discordRequest(method, path, body) {
  if (!BOT_TOKEN) return
  try {
    await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Authorization': `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (e) {
    console.error('Discord API error:', e.message)
  }
}

async function clearChannel(channelId) {
  try {
    const res = await fetch(`${BASE}/channels/${channelId}/messages?limit=100`, {
      headers: { 'Authorization': `Bot ${BOT_TOKEN}` }
    })
    const msgs = await res.json()
    if (!Array.isArray(msgs) || msgs.length === 0) return
    if (msgs.length === 1) {
      await discordRequest('DELETE', `/channels/${channelId}/messages/${msgs[0].id}`)
    } else {
      const ids = msgs.map(m => m.id)
      await discordRequest('POST', `/channels/${channelId}/messages/bulk-delete`, { messages: ids })
    }
  } catch (e) {
    console.error('Discord clear error:', e.message)
  }
}

async function sendEmbed(channelId, embed) {
  await discordRequest('POST', `/channels/${channelId}/messages`, { embeds: [embed] })
}

// Called on backend start
async function onBackendStart() {
  if (!BOT_TOKEN) return
  const ts = Math.floor(Date.now() / 1000)

  // Clear and resend deploy channel
  await clearChannel(DEPLOY_CHANNEL)
  await sendEmbed(DEPLOY_CHANNEL, {
    title: '🚀 PulseMC Backend Deployed',
    description: 'The backend has restarted and is now live.',
    color: 0x38bdf8,
    fields: [
      { name: 'Time', value: `<t:${ts}:F>`, inline: true },
      { name: 'Status', value: '✅ Online', inline: true },
    ],
    footer: { text: 'PulseMC' },
    timestamp: new Date().toISOString(),
  })

  // Clear and resend status channel
  await clearChannel(STATUS_CHANNEL)
  await sendEmbed(STATUS_CHANNEL, {
    title: '📊 PulseMC Status',
    description: 'Backend is operational.',
    color: 0x10b981,
    fields: [
      { name: 'Uptime', value: '100%', inline: true },
      { name: 'Started', value: `<t:${ts}:R>`, inline: true },
    ],
    footer: { text: 'PulseMC • Updates on restart' },
    timestamp: new Date().toISOString(),
  })
}

// Called when a user logs into dashboard
async function onUserJoin(username, avatarUrl) {
  if (!BOT_TOKEN) return
  const ts = Math.floor(Date.now() / 1000)
  await sendEmbed(JOIN_CHANNEL, {
    title: '👤 Dashboard Login',
    description: `**${username}** signed in to the PulseMC dashboard.`,
    color: 0x818cf8,
    thumbnail: avatarUrl ? { url: avatarUrl } : undefined,
    fields: [
      { name: 'Time', value: `<t:${ts}:F>`, inline: true },
    ],
    footer: { text: 'PulseMC' },
    timestamp: new Date().toISOString(),
  })
}

module.exports = { onBackendStart, onUserJoin }
