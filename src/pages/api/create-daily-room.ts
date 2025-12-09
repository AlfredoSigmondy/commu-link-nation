import type { NextApiRequest, NextApiResponse } from 'next';

const DAILY_API_KEY = process.env.DAILY_API_KEY?.trim();
const DAILY_DOMAIN = process.env.NEXT_PUBLIC_DAILY_DOMAIN || 'communitymatch.daily.co';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!DAILY_API_KEY) {
    console.error('Missing DAILY_API_KEY');
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

  // Create consistent room name
  const roomName = [userId, friendId].sort().join('-') + '-private';
  const roomUrl = `https://${DAILY_DOMAIN}/${roomName}`;

  try {
    console.log(`Creating/joining room: ${roomName} for user: ${userName}`);

    // 1. Check if room exists
    const roomCheck = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
      headers: { 
        'Authorization': `Bearer ${DAILY_API_KEY}`,
        'Content-Type': 'application/json'
      },
    });

    // 2. Create room if it doesn't exist
    if (roomCheck.status === 404) {
      console.log(`Room ${roomName} not found, creating...`);
      
      const createRoomRes = await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DAILY_API_KEY}`,
        },
        body: JSON.stringify({
          name: roomName,
          privacy: 'private',
          properties: {
            exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
            eject_at_room_exp: true,
            enable_chat: true,
            enable_knocking: true,
            enable_prejoin_ui: false,
            enable_network_ui: false,
            start_audio_off: false,
            start_video_off: false,
          },
        }),
      });

      if (!createRoomRes.ok) {
        const errorText = await createRoomRes.text();
        console.error('Failed to create Daily room:', errorText);
        return res.status(500).json({ error: `Failed to create room: ${errorText}` });
      }
      
      console.log(`Room ${roomName} created successfully`);
    } else if (!roomCheck.ok) {
      console.error('Failed to check room:', await roomCheck.text());
    } else {
      console.log(`Room ${roomName} already exists, reusing...`);
    }

    // 3. Create meeting token
    console.log(`Creating meeting token for ${userName}...`);
    const tokenRes = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: userName,
          user_id: userId,
          exp: Math.floor(Date.now() / 1000) + 2 * 60 * 60, // 2 hour token
          enable_knocking: true,
          enable_prejoin_ui: false,
        },
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error('Failed to create meeting token:', errorText);
      return res.status(500).json({ error: `Failed to generate token: ${errorText}` });
    }

    const { token } = await tokenRes.json();
    console.log(`Token created successfully for ${userName}`);

    // Success!
    return res.status(200).json({
      url: roomUrl,
      token,
      roomName,
    });
  } catch (error: any) {
    console.error('Unexpected error in create-daily-room:', error);
    return res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
}