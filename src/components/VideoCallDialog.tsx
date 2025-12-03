// pages/api/create-daily-room.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const DAILY_API_KEY = process.env.DAILY_API_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!DAILY_API_KEY) {
    return res.status(500).json({ error: 'DAILY_API_KEY missing' });
  }

  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { roomName, userName = 'User' } = req.body;

  try {
    // Create room
    const roomRes = await fetch('https://api.daily.co/v1/rooms', {
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
    const roomData = await roomRes.json();

    // Create token
    const tokenRes = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: { room_name: roomName, is_owner: true, user_name: userName },
      }),
    });
    const tokenData = await tokenRes.json();

    res.status(200).json({
      url: roomData.url,
      token: tokenData.token,
    });
  } catch (error: any) {
    console.error('Daily.co error:', error);
    res.status(500).json({ error: error.message || 'Failed' });
  }
}