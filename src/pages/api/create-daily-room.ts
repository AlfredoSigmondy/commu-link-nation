// pages/api/create-daily-room.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const DAILY_API_KEY = process.env.DAILY_API_KEY?.trim();
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!DAILY_API_KEY) {
    console.error('DAILY_API_KEY is missing');
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

  // Create deterministic room name so same users always get same room
  const roomName = [userId, friendId].sort().join('-');
  const roomUrl = `https://communitymatch.daily.co/${roomName}`;

  try {
    // Check for existing active call
    const { data: existingCall } = await supabase
      .from('calls')
      .select('*')
      .eq('room_name', roomName)
      .in('status', ['ringing', 'accepted'])
      .single();

    // Check if room exists on Daily
    const existingRoomRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    });

    // Create room if it doesn't exist
    if (existingRoomRes.status === 404) {
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
            enable_knocking: false,
            enable_prejoin_ui: false,
            enable_network_ui: true,
            enable_noise_cancellation: true,
            enable_screenshare: true,
            lang: 'en',
            max_participants: 2, // Only 2 participants for 1:1 calls
          },
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.text();
        console.error('Failed to create Daily room:', err);
        return res.status(500).json({ error: 'Failed to create room' });
      }
    }

    // Generate meeting token for this user
    // Generate meeting token for this user
const tokenRes = await fetch('https://api.daily.co/v1/meeting-tokens', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${DAILY_API_KEY}`,
  },
  body: JSON.stringify({
    // ← Flat object, no "properties" wrapper!
    room_name: roomName,
    user_name: userName,
    user_id: userId,
    is_owner: false,
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    enable_knocking: false,
    enable_prejoin_ui: false,
  }),
});

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Failed to create meeting token:', err);
      return res.status(500).json({ error: 'Failed to generate token' });
    }

    const { token } = await tokenRes.json();

    // Insert call notification in Supabase (only if no active call exists)
    if (!existingCall) {
      const { error: insertError } = await supabase.from('calls').insert({
        caller_id: userId,
        receiver_id: friendId,
        room_name: roomName,
        room_url: roomUrl,
        status: 'ringing',
      });

      if (insertError) {
        console.error('Failed to insert call record:', insertError);
        // Don't fail the request, just log it
      }
    }

    return res.status(200).json({
      url: roomUrl,
      token,
      roomName,
      callId: existingCall?.id,
    });
  } catch (error: any) {
    console.error('Unexpected error in create-daily-room:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}