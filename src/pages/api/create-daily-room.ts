// pages/api/create-daily-room.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const DAILY_API_KEY = process.env.DAILY_API_KEY?.trim();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!DAILY_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing API key' });
  }

  const { userId, friendId, userName = 'User' } = req.body as {
    userId?: string;
    friendId?: string;
    userName?: string;
  };

  if (!userId || !friendId) {
    return res.status(400).json({ error: 'userId and friendId are required' });
  }

  const roomName = [userId, friendId].sort().join('-') + '-private';

  try {
    // Try to get existing room
    const roomRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    });

    // Create room if it doesn't exist (404)
    if (roomRes.status === 404) {
      const createRes = await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DAILY_API_KEY}`,
        },
        body: JSON.stringify({
          name: roomName,
          privacy: 'private',
          properties: {
            exp: Math.floor(Date.now() / 1000) + 7200, // 2 hours from now
            eject_at_room_exp: true,
          },
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.text();
        console.error('Daily room creation failed:', err);
        return res.status(500).json({ error: 'Failed to create Daily room' });
      }
    }

    // Always create a fresh token
    const tokenRes = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: userName,
          user_id: userId,
          is_owner: false,
          exp: Math.floor(Date.now() / 1000) + 7200,
        },
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Daily token creation failed:', err);
      return res.status(500).json({ error: 'Failed to create meeting token' });
    }

    const { token } = await tokenRes.json();

    return res.status(200).json({
      url: `https://communitymatch.daily.co/${roomName}`, // Matches your app's subdomain vibe
      token,
      roomName,
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}