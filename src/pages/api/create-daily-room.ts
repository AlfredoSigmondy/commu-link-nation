// src/pages/api/create-daily-room.ts   ← (pages router)
// OR app/api/create-daily-room/route.ts ← (app router — see note below)

import type { NextApiRequest, NextApiResponse } from 'next';

const DAILY_API_KEY = process.env.DAILY_API_KEY;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!DAILY_API_KEY) {
    return res.status(500).json({ error: 'Daily.co API key not configured' });
  }

  const { userId, friendId, userName, friendName } = req.body;

  if (!userId || !friendId) {
    return res.status(400).json({ error: 'userId and friendId required' });
  }

  const roomName = `chat-${[userId, friendId].sort().join('-vs-')}`;

  try {
    // 1. Create or get room
    let room;
    try {
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
            exp: Math.round(Date.now() / 1000) + 60 * 60 * 2, // 2 hours
            enable_chat: true,
            enable_knocking: false,
            enable_screenshare: true,
          },
        }),
      });

      if (createRes.ok) {
        room = await createRes.json();
      } else if (createRes.status === 409) {
        // Room already exists → fetch it
        const getRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
          headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
        });
        room = await getRes.json();
      } else {
        throw new Error('Failed to create room');
      }
    } catch (err) {
      throw new Error('Room creation failed');
    }

    // 2. Generate meeting token (for current user)
    const tokenRes = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          is_owner: false,
          user_name: userName || 'User',
          exp: Math.round(Date.now() / 1000) + 60 * 60 * 2,
        },
      }),
    });

    const tokenData = await tokenRes.json();

    res.status(200).json({
      url: room.url,
      token: tokenData.token,
      roomName,
    });
  } catch (error: any) {
    console.error('Daily.co error:', error);
    res.status(500).json({ error: error.message || 'Failed to create call' });
  }
}