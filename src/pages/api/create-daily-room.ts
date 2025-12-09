// pages/api/create-daily-room.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const DAILY_API_KEY = process.env.DAILY_API_KEY?.trim();
const DAILY_DOMAIN = process.env.NEXT_PUBLIC_DAILY_DOMAIN || 'communitymatch.daily.co';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
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
  const roomUrl = `https://${DAILY_DOMAIN}/${roomName}`;

  try {
    // 1. Check if room exists or create it
    let roomExists = true;
    
    const existingRoomRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    });

    if (existingRoomRes.status === 404) {
      roomExists = false;
      // Create the room since it doesn't exist
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
            exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
            eject_at_room_exp: true,
            enable_chat: true,
            enable_knocking: true, // Enable knocking for private calls
            enable_prejoin_ui: false,
            enable_network_ui: false,
            enable_noise_cancellation: true,
            lang: 'en',
            start_audio_off: false,
            start_video_off: false,
          },
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.text();
        console.error('Failed to create Daily room:', err);
        return res.status(500).json({ error: 'Failed to create room' });
      }
    } else if (!existingRoomRes.ok) {
      // Handle other API errors
      const err = await existingRoomRes.text();
      console.error('Failed to check room:', err);
      return res.status(500).json({ error: 'Failed to check room existence' });
    }

    // 2. Generate meeting token for both users
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
          exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24h token
          enable_knocking: false,
          enable_prejoin_ui: false,
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
      roomExists: !roomExists ? 'created' : 'reused',
    });
  } catch (error: any) {
    console.error('Unexpected error in create-daily-room:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}