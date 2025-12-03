// pages/api/create-daily-room.ts  ← MUST BE THIS EXACT PATH
import type { NextApiRequest, NextApiResponse } from 'next';

const DAILY_API_KEY = process.env.DAILY_API_KEY?.trim();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!DAILY_API_KEY) {
    return res.status(500).json({ error: 'Missing Daily.co API key' });
  }

  const { userId, friendId, userName = 'User' } = req.body;
  if (!userId || !friendId) {
    return res.status(400).json({ error: 'userId and friendId required' });
  }

  const roomName = [userId, friendId].sort().join('-') + '-private';

  try {
    // 1. Try to get existing room
    const roomRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    });

    // If not exists (404), create it
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
            exp: Math.floor(Date.now() / 1000) + 7200,
            eject_at_room_exp: true,
          },
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.text();
        console.error('Room creation failed:', err);
        return res.status(500).json({ error: 'Failed to create room' });
      }
    }

    // 2. Create meeting token
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
      console.error('Token creation failed:', err);
      return res.status(500).json({ error: 'Failed to create token' });
    }

    const { token } = await tokenRes.json();

    // SUCCESS
    return res.status(200).json({
      url: `https://communitymatch.daily.co/${roomName}`,
      token,
      roomName,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}