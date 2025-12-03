import { VercelRequest, VercelResponse } from '@vercel/node';

const DAILY_API_KEY = process.env.DAILY_API_KEY!;

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

    // Create unique room name
    const roomName = [userId, friendId].sort().join('-') + '-call';

    // Create room via Daily API
    const createRoomRes = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: roomName,
        properties: {
          max_participants: 2,
          enable_knocking: false,
          enable_screenshare: true,
        },
      }),
    });

    if (!createRoomRes.ok) {
      const errorData = await createRoomRes.text();
      console.error('Failed to create room:', errorData);
      throw new Error(`Failed to create room: ${createRoomRes.status}`);
    }

    const roomData = await createRoomRes.json();

    // Generate token for user
    const tokenRes = await fetch(`https://api.daily.co/v1/meeting-tokens`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        room_name: roomName,
        user_name: userName,
      }),
    });

    if (!tokenRes.ok) {
      throw new Error('Failed to generate token');
    }

    const tokenData = await tokenRes.json();

    return res.status(200).json({
      url: roomData.url,
      token: tokenData.token,
      roomName,
    });
  } catch (error) {
    console.error('Room creation error:', error);
    return res.status(500).json({
      error: 'Failed to create room',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
