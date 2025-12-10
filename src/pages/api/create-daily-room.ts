// pages/api/create-daily-room.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const DAILY_API_KEY = process.env.DAILY_API_KEY?.trim();
const DAILY_DOMAIN = 'communitymatch.daily.co';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Log the request
  console.log('=== API CALLED: create-daily-room ===');
  console.log('Method:', req.method);
  console.log('Headers:', req.headers);
  
  // Set response headers
  res.setHeader('Content-Type', 'application/json');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ 
      error: 'Method Not Allowed',
      allowed: ['POST']
    });
  }

  try {
    // Parse request body
    let body;
    try {
      body = req.body;
      console.log('Request body raw:', body);
      
      // If body is a string, parse it
      if (typeof body === 'string') {
        body = JSON.parse(body);
      }
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return res.status(400).json({ 
        error: 'Invalid JSON in request body'
      });
    }

    const { userId, friendId, userName = 'User' } = body;
    
    console.log('Parsed request:', { userId, friendId, userName });

    // Validate required fields
    if (!userId || !friendId) {
      console.log('Missing required fields:', { userId, friendId });
      return res.status(400).json({ 
        error: 'userId and friendId are required',
        received: { userId, friendId }
      });
    }

    // Check API key
    if (!DAILY_API_KEY) {
      console.error('DAILY_API_KEY is not configured');
      console.log('Available env vars:', Object.keys(process.env).filter(k => k.includes('DAILY')));
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'Daily.co API key is not configured. Check your .env.local file.'
      });
    }

    console.log('DAILY_API_KEY exists, length:', DAILY_API_KEY.length);
    
    // Generate room name
    const roomName = [userId, friendId].sort().join('-') + '-private';
    const roomUrl = `https://${DAILY_DOMAIN}/${roomName}`;
    
    console.log('Generated room info:', { roomName, roomUrl });

    // For testing, return mock data if API key seems invalid
    if (DAILY_API_KEY.length < 20 || DAILY_API_KEY.includes('your_')) {
      console.log('Using mock response (API key appears to be placeholder)');
      
      // Return mock data for testing
      return res.status(200).json({
        success: true,
        url: roomUrl,
        token: `mock_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        roomName: roomName,
        message: 'MOCK RESPONSE - Replace DAILY_API_KEY in .env.local with real key',
        warning: 'Using mock token. Video will not actually connect without real Daily.co API key.'
      });
    }

    // REAL Daily.co API calls
    console.log('Making real Daily.co API calls...');

    let roomCreated = false;
    
    try {
      // 1. Check if room exists
      console.log(`Checking if room exists: ${roomName}`);
      const roomCheck = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
        headers: { 
          'Authorization': `Bearer ${DAILY_API_KEY}`,
          'Content-Type': 'application/json'
        },
      });

      console.log('Room check status:', roomCheck.status);

      if (roomCheck.status === 404) {
        // 2. Create room
        console.log('Creating new room...');
        const createRes = await fetch('https://api.daily.co/v1/rooms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DAILY_API_KEY}`,
          },
          body: JSON.stringify({
            name: roomName,
            privacy: 'private',
            properties: {
              exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
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

        if (!createRes.ok) {
          const errorText = await createRes.text();
          console.error('Failed to create room:', errorText);
          return res.status(500).json({ 
            error: 'Failed to create room on Daily.co',
            details: errorText.substring(0, 200)
          });
        }

        roomCreated = true;
        console.log('Room created successfully');
      } else if (roomCheck.ok) {
        console.log('Room already exists, reusing it');
      } else {
        const errorText = await roomCheck.text();
        console.error('Unexpected response checking room:', errorText);
      }
    } catch (roomError: any) {
      console.error('Room API error:', roomError.message);
      // Continue to token creation anyway
    }

    // 3. Create meeting token
    console.log('Creating meeting token...');
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
          exp: Math.floor(Date.now() / 1000) + 2 * 60 * 60,
          enable_knocking: true,
          enable_prejoin_ui: false,
        },
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error('Failed to create token:', errorText);
      return res.status(500).json({ 
        error: 'Failed to create meeting token',
        details: errorText.substring(0, 200)
      });
    }

    const tokenData = await tokenRes.json();
    console.log('Token created successfully');
    
    if (!tokenData.token) {
      console.error('Token missing from response:', tokenData);
      return res.status(500).json({ error: 'Invalid token response from Daily.co' });
    }

    // Success!
    return res.status(200).json({
      success: true,
      url: roomUrl,
      token: tokenData.token,
      roomName: roomName,
      roomCreated: roomCreated,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('=== UNEXPECTED ERROR ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}