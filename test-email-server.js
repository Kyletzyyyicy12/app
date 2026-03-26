const axios = require('axios');

// Test email server
async function testEmailServer() {
  try {
    console.log('🔍 Testing email server...');

    // Test health check
    console.log('1. Testing health check...');
    const healthResponse = await axios.get('http://localhost:3001/health');
    console.log('✅ Health check:', healthResponse.data);

    // Test sending email
    console.log('2. Testing email sending...');
    const emailData = {
      email: 'kyse.quimada.swu@phinmaed.com', // Using your Gmail for testing
      firstName: 'Test',
      lastName: 'User'
    };

    const emailResponse = await axios.post(
      'http://localhost:3001/api/auth/send-signup-verification',
      emailData,
      { headers: { 'Content-Type': 'application/json' } }
    );

    console.log('✅ Email sent:', emailResponse.data);

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testEmailServer();