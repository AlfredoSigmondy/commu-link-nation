// pages/api/create-daily-room.ts   ← MUST be this exact path
import type { NextApiRequest, NextApiResponse } from 'next';

const DAILY_API_KEY = process.env.DAILY_API_KEY?.trim();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!DAILY_API_KEY) {
    console.error('DAILY_API_KEY missing');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { userId, friendId, userName = 'User', friendName } = req.body;

  if (!userId || !friendId) {
    return res.status(400).json({ error: 'userId and friendId required' });
  }

  const sorted = [userId, friendId].sort();
  const roomName = `${sorted[0]}-${sorted[1]}-private`;

  try {
    // 1. Create or get room
    let roomData;
    const createRes = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        name: roomName,
        privacy: 'private',
        properties: { exp: Math.floor(Date.now() / 1000) + 7200 },
      }),
    });

    if (createRes.ok) {
      roomData = await createRes.json();
    } else if (createRes.status === 409) {
      const getRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
        headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
      });
      roomData = await getRes.json();
    } else {
      const text = await createRes.text();
      console.error('Daily room error:', text);
      return res.status(500).json({ error: 'Failed to create room' });
    }

    // 2. Create meeting token (locked to userId!)
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
          user_id: userId,           // ← THIS locks it to the caller
          is_owner: false,
          exp: Math.floor(Date.now() / 1000) + 7200,
        },
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Token error:', err);
      return res.status(500).json({ error: 'Failed to create token' });
    }

    const { token } = await tokenRes.json();

    return res.status(200).json({
      url: `https://communitymatch.daily.co/${roomName}`,
      token,
      roomName,
    });
  } catch (err: any) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
