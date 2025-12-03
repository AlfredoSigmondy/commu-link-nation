// Development server for Vite with API support
import { createServer as createViteServer } from 'vite'
import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function createServer() {
  const app = express()
  
  // Parse JSON bodies
  app.use(express.json())

  // API Routes
  app.post('/api/create-100ms-token', async (req, res) => {
    try {
      // Dynamically import the handler
      const module = await import('./src/pages/api/create-100ms-token.ts?raw')
      const handlerModule = await import('./dist-api/create-100ms-token.js').catch(() => null)
      
      // Create a mock NextApiRequest
      const mockReq = {
        method: 'POST',
        body: req.body,
        url: req.url,
        headers: req.headers
      }
      
      // Create a mock NextApiResponse
      let responseData = null
      let statusCode = 200
      const mockRes = {
        setHeader: (key, val) => res.setHeader(key, val),
        status: (code) => {
          statusCode = code
          return {
            json: (data) => {
              responseData = data
              res.status(code).json(data)
            },
            end: () => {
              res.status(code).end()
            }
          }
        },
        json: (data) => {
          res.status(statusCode).json(data)
        },
        end: (data) => {
          res.status(statusCode).end(data)
        }
      }

      // Inline handler for token generation
      const jwt = await import('jsonwebtoken')
      const HMS_MANAGEMENT_TOKEN = process.env.HMS_MANAGEMENT_TOKEN
      const HMS_APP_TOKEN_SECRET = process.env.HMS_APP_TOKEN_SECRET
      const HMS_ACCESS_KEY = process.env.HMS_ACCESS_KEY
      const HMS_TEMPLATE_ID = process.env.HMS_TEMPLATE_ID

      function generateToken(roomId, userId, role = 'host') {
        const currentTime = Math.floor(Date.now() / 1000)
        const payload = {
          access_key: HMS_ACCESS_KEY,
          room_id: roomId,
          user_id: userId,
          role: role,
          type: 'app',
          version: 2,
          iat: currentTime,
          nbf: currentTime,
          exp: currentTime + 24 * 60 * 60,
        }
        return jwt.default.sign(payload, HMS_APP_TOKEN_SECRET, { algorithm: 'HS256' })
      }

      const { userId, friendId, userName = 'User' } = req.body

      if (!userId || !friendId) {
        return res.status(400).json({ error: 'Missing userId or friendId' })
      }

      const roomId = [userId, friendId].sort().join('-') + '-call'

      // Create room via 100ms Management API
      const createRoomRes = await fetch('https://api.100ms.live/v2/rooms', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HMS_MANAGEMENT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: roomId,
          description: 'Private 1-on-1 call',
          template_id: HMS_TEMPLATE_ID,
        }),
      })

      if (!createRoomRes.ok && createRoomRes.status !== 409) {
        const errorData = await createRoomRes.text()
        console.error('Failed to create room:', errorData)
        throw new Error(`Failed to create room: ${createRoomRes.status}`)
      }

      // Generate auth token
      const authToken = generateToken(roomId, userId, 'host')

      return res.status(200).json({
        token: authToken,
        roomId,
        userName,
      })
    } catch (error) {
      console.error('Token generation error:', error)
      return res.status(500).json({ 
        error: 'Failed to generate token',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Create Vite server in middleware mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  })

  // Use vite's connect instance as middleware
  app.use(vite.middlewares)

  // Serve index.html for SPA routing
  app.use('*', async (req, res) => {
    try {
      const url = req.originalUrl
      let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8')
      template = await vite.transformIndexHtml(url, template)
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template)
    } catch (e) {
      vite.ssrFixStacktrace(e)
      console.log(e.stack)
      res.status(500).end(e.stack)
    }
  })

  const PORT = process.env.PORT || 5173
  return app.listen(PORT, () => {
    console.log(`✓ Server running at http://localhost:${PORT}/`)
  })
}

createServer()
