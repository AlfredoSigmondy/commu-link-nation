// api/create-daily-room.ts
import { VercelRequest, VercelResponse } from '@vercel/node';

interface RequestBody {
  userId: string;
  friendId: string;
  userName?: string;
}

interface DailyRoomResponse {
  success: boolean;
  url: string;
  token: string;
  roomName: string;
  roomCreated?: boolean;
  timestamp: string;
  message?: string;
  warning?: string;
}

interface DailyApiError {
  error: string;
  message?: string;
  details?: string;
  stack?: string;
  allowed?: string[];
  received?: { userId?: string; friendId?: string };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('🎬 API called:', req.method, req.url);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    const errorResponse: DailyApiError = {
      error: 'Method Not Allowed',
      allowed: ['POST']
    };
    return res.status(405).json(errorResponse);
  }

  try {
    // Parse request body
    let body: RequestBody;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      console.log('Request body:', body);
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      const errorResponse: DailyApiError = {
        error: 'Invalid JSON in request body'
      };
      return res.status(400).json(errorResponse);
    }

    const { userId, friendId, userName = 'User' } = body;
    
    console.log('Parsed request:', { userId, friendId, userName });

    // Validate required fields
    if (!userId || !friendId) {
      console.log('Missing required fields:', { userId, friendId });
      const errorResponse: DailyApiError = {
        error: 'userId and friendId are required',
        received: { userId, friendId }
      };
      return res.status(400).json(errorResponse);
    }

    // Check API key
    const DAILY_API_KEY = process.env.DAILY_API_KEY;
    const DAILY_DOMAIN = 'communitymatch.daily.co';
    
    if (!DAILY_API_KEY) {
      console.error('DAILY_API_KEY is not configured');
      const errorResponse: DailyApiError = {
        error: 'Server configuration error',
        message: 'Daily.co API key is not configured. Check your Vercel environment variables.'
      };
      return res.status(500).json(errorResponse);
    }

    console.log('DAILY_API_KEY exists, length:', DAILY_API_KEY.length);
    
    // Generate room name
    const roomName = [userId, friendId].sort().join('-') + '-private';
    const roomUrl = `https://${DAILY_DOMAIN}/${roomName}`;
    
    console.log('Generated room info:', { roomName, roomUrl });

    // For testing, return mock data if API key seems invalid
    if (DAILY_API_KEY.length < 20 || DAILY_API_KEY.includes('your_')) {
      console.log('Using mock response (API key appears to be placeholder)');
      
      const mockResponse: DailyRoomResponse = {
        success: true,
        url: roomUrl,
        token: `mock_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        roomName: roomName,
        message: 'MOCK RESPONSE - Replace DAILY_API_KEY in Vercel env vars with real key',
        warning: 'Using mock token. Video will not actually connect without real Daily.co API key.',
        timestamp: new Date().toISOString()
      };
      
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json(mockResponse);
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
          
          const errorResponse: DailyApiError = {
            error: 'Failed to create room on Daily.co',
            details: errorText.substring(0, 200)
          };
          
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', 'application/json');
          return res.status(500).json(errorResponse);
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
      
      const errorResponse: DailyApiError = {
        error: 'Failed to create meeting token',
        details: errorText.substring(0, 200)
      };
      
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json(errorResponse);
    }

    const tokenData = await tokenRes.json();
    console.log('Token created successfully');
    
    if (!tokenData.token) {
      console.error('Token missing from response:', tokenData);
      const errorResponse: DailyApiError = {
        error: 'Invalid token response from Daily.co'
      };
      
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json(errorResponse);
    }

    // Success!
    const successResponse: DailyRoomResponse = {
      success: true,
      url: roomUrl,
      token: tokenData.token,
      roomName: roomName,
      roomCreated: roomCreated,
      timestamp: new Date().toISOString()
    };

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(successResponse);

  } catch (error: any) {
    console.error('=== UNEXPECTED ERROR ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    
    const errorResponse: DailyApiError = {
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json(errorResponse);
  }
}