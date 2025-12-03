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

  // Room name format you want: user1-user2-private
  const sortedIds = [userId, friendId].sort();
  const roomName = `${sortedIds[0]}-${sortedIds[1]}-private`.toLowerCase();

  try {
    // Create room (Daily returns 409 if exists)
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
          exp: Math.floor(Date.now() / 1000) + 7200, // 2 hrs
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
      // Already exists → Fetch existing
      const existing = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
        headers: { Authorization: `Bearer ${DAILY_API_KEY}` }
      });
      roomData = await existing.json();
    } else {
      return res.status(createRoomRes.status).json({ error: rawRoomText });
    }

    // Create meeting token
    const tokenRes = await fetch("https://api.daily.co/v1/meeting-tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DAILY_API_KEY}`
      },
      // Add this in your token creation:
        body: JSON.stringify({
          properties: {
            room_name: roomName,
            user_name: userName || "User",
            user_id: userId,           // This locks the token to THIS user only
            is_owner: false,
            exp: Math.floor(Date.now() / 1000) + 7200,
            enable_screenshare: true,
            start_video_off: false,
            start_audio_off: false,
          }
        })
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      return res.status(tokenRes.status).json({ error: tokenData });
    }

    return res.status(200).json({
      roomName,
      url: `https://communitymatch.daily.co/${roomName}`,
      token: tokenData.token
    });

  } catch (err: any) {
    console.error("Server Error:", err);
    return res.status(500).json({ error: err.message || "Unknown server error" });
  }
}
