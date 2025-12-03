// pages/api/create-daily-room.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const DAILY_API_KEY = process.env.DAILY_API_KEY?.trim();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!DAILY_API_KEY) return res.status(500).json({ error: 'No API key' });

  const { userId, friendId, userName = 'User' } = req.body;
  if (!userId || !friendId) return res.status(400).json({ error: 'Missing ids' });

  const roomName = [userId, friendId].sort().join('-') + '-private';

  try {
    // Create or get room
    let room = await fetch('https://api.daily.co/v1/rooms/' + roomName, {
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    }).then(r => r.json()).catch(() => null);

    if (!room || room.error) {
      await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DAILY_API_KEY}` },
        body: JSON.stringify({ name: roomName, privacy: 'private' }),
      });
    }

    // Create token
    const tokenRes = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DAILY_API_KEY}` },
      body: JSON.stringify({
        properties: { room_name: roomName, user_name: userName, user_id: userId },
      }),
    });

    const { token } = await tokenRes.json();

    res.status(200).json({
      url: `https://communitymatch.daily.co/${roomName}`,
      token,
      roomName,
    });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
}