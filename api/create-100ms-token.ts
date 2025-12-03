import { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';

const HMS_MANAGEMENT_TOKEN = process.env.HMS_MANAGEMENT_TOKEN!;
const HMS_APP_TOKEN_SECRET = process.env.HMS_APP_TOKEN_SECRET!;
const HMS_ACCESS_KEY = process.env.HMS_ACCESS_KEY!;
const HMS_TEMPLATE_ID = process.env.HMS_TEMPLATE_ID!;

function generateToken(roomId: string, userId: string, role = 'host') {
  const currentTime = Math.floor(Date.now() / 1000);

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
  };

  return jwt.sign(payload, HMS_APP_TOKEN_SECRET, { algorithm: 'HS256' });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { userId, friendId, userName = 'User' } = req.body;

    if (!userId || !friendId) {
      return res.status(400).json({ error: 'Missing userId or friendId' });
    }

    // Create unique room ID
    const roomId = [userId, friendId].sort().join('-') + '-call';

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
    });

    if (!createRoomRes.ok && createRoomRes.status !== 409) {
      const errorData = await createRoomRes.text();
      console.error('Failed to create room:', errorData);
      throw new Error(`Failed to create room: ${createRoomRes.status}`);
    }

    // Generate auth token
    const authToken = generateToken(roomId, userId, 'host');

    return res.status(200).json({
      token: authToken,
      roomId,
      userName,
    });
  } catch (error) {
    console.error('Token generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate token',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
