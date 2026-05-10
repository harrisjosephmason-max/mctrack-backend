const TOKEN = process.env.DISCORD_BOT_TOKEN
const BASE  = 'https://discord.com/api/v10'

const CHANNELS = {
  deploy: '1502492325065130147',
  join:   '1503154384077590650',
  status: '1503154467812671728',
}

async function req(method, path, body) {
  if (!TOKEN) return null
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Authorization': `Bot ${TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'PulseMC/1.0',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    if (!res.ok) {
      console.error(`Discord ${method} ${path} → ${res.status}: ${text}`)
      return null
    }
    return text ? JSON.parse(text) : null
  } catch (e) {
    console.error('Discord fetch error:', e.message)
    return null
  }
}

async function clearChannel(id) {
  const msgs = await req('GET', `/channels/${id}/messages?limit=100`)
  if (!Array.isArray(msgs) || msgs.length === 0) return
  const ids = msgs.map(m => m.id)
  if (ids.length === 1) {
    await req('DELETE', `/channels/${id}/messages/${ids[0]}`)
  } else {
    // Bulk delete (messages must be < 14 days old)
    await req('POST', `/channels/${id}/messages/bulk-delete`, { messages: ids })
  }
}

async function sendEmbed(channelId, embed) {
  return req('POST', `/channels/${channelId}/messages`, { embeds: [embed] })
}

async function onBackendStart() {
  if (!TOKEN) { console.log('No DISCORD_BOT_TOKEN set — skipping Discord notifications'); return }
  const ts = Math.floor(Date.now() / 1000)

  await clearChannel(CHANNELS.deploy)
  await sendEmbed(CHANNELS.deploy, {
    title: '🚀 PulseMC Deployed',
    description: 'Backend restarted and is now live.',
    color: 0x38bdf8,
    fields: [
      { name: 'Time',   value: `<t:${ts}:F>`, inline: true },
      { name: 'Status', value: '✅ Online',    inline: true },
    ],
    footer: { text: 'PulseMC Backend' },
    timestamp: new Date().toISOString(),
  })

  await clearChannel(CHANNELS.status)
  await sendEmbed(CHANNELS.status, {
    title: '📊 PulseMC Status',
    description: '**Backend:** Online ✅\n**Uptime:** 100%',
    color: 0x10b981,
    fields: [
      { name: 'Started', value: `<t:${ts}:R>`, inline: true },
      { name: 'Version', value: 'v2.0',         inline: true },
    ],
    footer: { text: 'PulseMC • Refreshes on restart' },
    timestamp: new Date().toISOString(),
  })

  console.log('Discord notifications sent')
}

async function onUserJoin(username, avatarUrl) {
  if (!TOKEN) return
  const ts = Math.floor(Date.now() / 1000)
  await sendEmbed(CHANNELS.join, {
    title: '👤 Dashboard Login',
    description: `**${username}** signed in to PulseMC.`,
    color: 0x818cf8,
    thumbnail: avatarUrl ? { url: avatarUrl } : undefined,
    fields: [{ name: 'Time', value: `<t:${ts}:F>`, inline: true }],
    footer: { text: 'PulseMC' },
    timestamp: new Date().toISOString(),
  })
}

module.exports = { onBackendStart, onUserJoin }
