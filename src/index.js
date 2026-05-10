require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { getDb } = require('./db')
const { onBackendStart } = require('./discord')

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}))
app.use(express.json())

app.use('/api/auth',    require('./routes/auth'))
app.use('/api/servers', require('./routes/servers'))
app.use('/api/events',  require('./routes/events'))
app.use('/api/link',    require('./routes/link'))

const PORT = process.env.PORT || 3001

getDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PulseMC backend running on http://localhost:${PORT}`)
    onBackendStart().catch(console.error)
  })
}).catch(err => {
  console.error('Failed to init database:', err)
  process.exit(1)
})
