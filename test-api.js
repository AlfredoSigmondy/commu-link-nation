// Test script for Daily.co API endpoint
// Run with: node test-api.js

const API_URL = 'https://communitymatch.vercel.app/api/create-daily-room';

async function testCreateDailyRoom() {
  console.log('🧪 Testing Daily.co Room Creation API...\n');
  console.log(`📍 API URL: ${API_URL}\n`);

  const testPayload = {
    userId: 'test-user-001',
    friendId: 'test-user-002',
    userName: 'Test User',
  };

  try {
    console.log('📤 Sending request with payload:');
    console.log(JSON.stringify(testPayload, null, 2));
    console.log('\n---\n');

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    console.log(`📨 Response Status: ${response.status} ${response.statusText}`);
    console.log('📋 Response Headers:');
    response.headers.forEach((value, name) => {
      console.log(`  ${name}: ${value}`);
    });

    const data = await response.json();

    console.log('\n✅ Response Data:');
    console.log(JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✨ Success! Token created:');
      console.log(`  • Room Name: ${data.roomName}`);
      console.log(`  • Has URL: ${!!data.url}`);
      console.log(`  • Has Token: ${!!data.token}`);
      console.log(`  • Token Length: ${data.token?.length || 0} characters`);

      if (data.token) {
        const parts = data.token.split('.');
        console.log(`  • JWT Parts: ${parts.length} (valid JWT has 3 parts)`);
      }
    } else {
      console.log('\n❌ Error creating token');
      console.log('Error details:', data);
    }
  } catch (error) {
    console.error('\n🔥 Request failed:');
    console.error(`  Error: ${error instanceof Error ? error.message : String(error)}`);
    console.log('\n💡 Make sure:');
    console.log('  1. Your Vercel deployment has the API route');
    console.log('  2. DAILY_API_KEY is set in Vercel environment variables');
    console.log('  3. You have internet connection');
    console.log('  4. API URL is correct: ' + API_URL);
  }
}

testCreateDailyRoom();
