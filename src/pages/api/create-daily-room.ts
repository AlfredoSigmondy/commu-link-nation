// pages/myapi/create-daily-room.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const DAILY_API_KEY = process.env.DAILY_API_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!DAILY_API_KEY) {
    return res.status(500).json({ error: 'DAILY_API_KEY not set' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const { roomName, userName = 'User', isOwner = true } = req.body;

  try {
    // Create private room
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
    if (roomData.error) throw roomData;

    // Create token
    const tokenRes = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          is_owner: isOwner,
          user_name: userName,
        },
      }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw tokenData;

    res.status(200).json({
      url: roomData.url,
      token: tokenData.token,
      roomName,
    });
  } catch (error: any) {
    console.error('Daily.co error:', error);
    res.status(500).json({ error: error.message || 'Failed' });
  }
}