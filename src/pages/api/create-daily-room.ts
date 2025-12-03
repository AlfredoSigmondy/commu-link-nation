import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAILY_API_KEY = process.env.DAILY_API_KEY?.trim() || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("API called", req.method, req.body);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  if (!DAILY_API_KEY) {
    console.error("DAILY_API_KEY missing");
    return res.status(500).json({ error: "Daily API key missing" });
  }

  const { userId, friendId, userName, friendName } = req.body;

  if (!userId || !friendId) {
    return res.status(400).json({ error: "userId and friendId required" });
  }

  const roomName = `chat-${[userId, friendId].sort().join('-vs-')}`.toLowerCase();

  try {
    // Create room
    const createRoomRes = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DAILY_API_KEY}`
      },
      body: JSON.stringify({
        name: roomName,
        privacy: "private",
        properties: {
          exp: Math.floor(Date.now() / 1000) + 7200, // 2hrs
          enable_chat: true,
          enable_knocking: false,
        }
      })
    });

    let roomData;
    const rawRoomText = await createRoomRes.text();
    console.log("Daily Room Raw:", rawRoomText);

    if (createRoomRes.ok) {
      roomData = JSON.parse(rawRoomText);
    } else if (createRoomRes.status === 409) {
      // Room already exists → fetch it
      const existing = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
        headers: { Authorization: `Bearer ${DAILY_API_KEY}` }
      });
      roomData = await existing.json();
    } else {
      return res.status(createRoomRes.status).json({ error: rawRoomText });
    }

    // Generate meeting token
    const tokenRes = await fetch("https://api.daily.co/v1/meeting-tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DAILY_API_KEY}`
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: userName || "Guest",
        }
      })
    });

    const tokenData = await tokenRes.json();
    console.log("Token response:", tokenData);

    if (!tokenRes.ok) {
      return res.status(tokenRes.status).json({ error: tokenData });
    }

    return res.status(200).json({
      url: roomData.url,
      token: tokenData.token,
      roomName
    });

  } catch (err: any) {
    console.error("Server Error:", err);
    return res.status(500).json({ error: err.message || "Unknown server error" });
  }
}
