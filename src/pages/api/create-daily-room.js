// api/create-daily-room.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const DAILY_API_KEY = process.env.DAILY_API_KEY;
  if (!DAILY_API_KEY) return res.status(500).json({ error: 'No API key' });

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
        properties: { exp: Math.round(Date.now() / 1000) + 7200 },
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

    res.status(200).json({ url: roomData.url, token: tokenData.token });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
}