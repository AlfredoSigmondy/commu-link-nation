import type { NextApiRequest, NextApiResponse } from 'next';  // For Pages Router

const DAILY_API_KEY = process.env.DAILY_API_KEY;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Log for Vercel Function Logs
  console.log('API Called with method:', req.method);
  console.log('Body:', req.body);

  if (req.method !== 'POST') {
    console.log('Method not POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!DAILY_API_KEY) {
    console.error('DAILY_API_KEY missing!');
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
    let createRes;
    try {
      createRes = await fetch('https://api.daily.co/v1/rooms', {
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

      // NEW: Log Daily response
      console.log('Daily Create Room Status:', createRes.status);
      const rawDaily = await createRes.text();
      console.log('Daily Raw Response:', rawDaily.substring(0, 300));  // Log first 300 chars

      if (createRes.ok) {
        room = JSON.parse(rawDaily);
      } else if (createRes.status === 409) {
        // Room exists → fetch it
        const getRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
          headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
        });
        if (!getRes.ok) throw new Error(`Fetch existing room failed: ${getRes.status}`);
        room = await getRes.json();
      } else {
        throw new Error(`Daily API error: ${createRes.status} - ${rawDaily}`);
      }
    } catch (roomErr) {
      console.error('Room creation error:', roomErr);
      throw new Error('Room creation failed: ' + roomErr.message);
    }

    // 2. Generate meeting token
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

    if (!tokenRes.ok) {
      const tokenErrBody = await tokenRes.text();
      console.error('Token API error:', tokenRes.status, tokenErrBody);
      throw new Error(`Token creation failed: ${tokenRes.status}`);
    }

    const tokenData = await tokenRes.json();

    console.log('Success: Room URL', room.url);  // Log success

    res.status(200).json({
      url: room.url,
      token: tokenData.token,
      roomName,
    });
  } catch (error: any) {
    console.error('Full API error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to create call',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined  // Stack trace only in dev
    });
  }
}