// pages/api/create-daily-room.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const DAILY_API_KEY = process.env.DAILY_API_KEY?.trim();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allssowed' });
  }

  if (!DAILY_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing DAILY_API_KEY' });
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
    // 1. Try to fetch existing room
<<<<<<< HEAD
    const roomUrl = `https://communitymatch.daily.co/${roomName}`;
=======
    let roomUrl = `https://communitymatch.daily.co/${roomName}`;
>>>>>>> parent of e0e6248 (new)

    const existingRoomRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    });

    // 2. Create room only if it doesn't exist
    if (existingRoomRes.status === 404) {
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
            exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours (more forgiving)
            eject_at_room_exp: true,
            enable_chat: true,
            enable_knocking: false,
            enable_prejoin_ui: false,        // ← Important for token-based joins
            enable_network_ui: false,
            enable_noise_cancellation: true,
            lang: 'en',
          },
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.text();
        console.error('Failed to create Daily room:', err);
        return res.status(500).json({ error: 'Failed to create room' });
      }
    }

    // 3. Always generate a fresh meeting token (this is perfect)
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
          exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24h token
          enable_knocking: false,
          enable_prejoin_ui: false,   // ← Doubly ensure no lobby
        },
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Failed to create meeting token:', err);
      return res.status(500).json({ error: 'Failed to generate token' });
    }

    const { token } = await tokenRes.json();

    // Success!
    return res.status(200).json({
      url: roomUrl,
      token,
      roomName,
    });
  } catch (error: any) {
    console.error('Unexpected error in create-daily-room:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}