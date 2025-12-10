// app/api/create-daily-room/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { userId, friendId, userName } = await request.json();
    
    console.log('Creating Daily.co room for:', { userId, friendId, userName });
    
    const DAILY_API_KEY = process.env.DAILY_API_KEY;
    
    if (!DAILY_API_KEY) {
      console.error('DAILY_API_KEY is not set in environment variables');
      return NextResponse.json(
        { 
          error: 'Server configuration error',
          url: null,
          token: null
        },
        { status: 500 }
      );
    }
    
    // Generate a unique room name
    const roomName = `room_${Date.now()}_${userId.slice(0, 8)}_${friendId.slice(0, 8)}`;
    
    // Create room on Daily.co
    const response = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DAILY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: roomName,
        privacy: 'public',
        properties: {
          exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours expiry
          enable_chat: true,
          enable_screenshare: true,
          start_video_off: false,
          start_audio_off: false,
          enable_recording: 'cloud',
        }
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Daily.co API error:', errorText);
      throw new Error(`Daily API error: ${response.status}`);
    }
    
    const roomData = await response.json();
    console.log('Room created:', roomData);
    
    // Generate a meeting token (optional but recommended)
    const tokenResponse = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DAILY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          room_name: roomData.name,
          user_id: userId,
          user_name: userName,
          is_owner: true,
          exp: Math.floor(Date.now() / 1000) + (60 * 60 * 2), // 2 hour expiry
        }
      }),
    });
    
    let token = '';
    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      token = tokenData.token;
    } else {
      // Fallback: create token manually if API fails
      console.warn('Meeting token creation failed, using room URL only');
      token = roomData.url.split('/').pop(); // Use room name as token
    }
    
    // Return the EXACT format your frontend expects
    return NextResponse.json({
      success: true,
      url: roomData.url, // This is what your frontend expects
      token: token,      // This is what your frontend expects
      roomName: roomData.name,
      expiry: roomData.properties?.exp,
      userId,
      friendId,
    });
    
  } catch (error) {
    console.error('Error creating Daily room:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to create video room',
        url: null,
        token: null
      },
      { status: 500 }
    );
  }
}

// Handle preflight OPTIONS request for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });  
}
