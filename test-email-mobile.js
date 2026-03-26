// Test script for mobile app email service
// Run with: node test-email-mobile.js

const axios = require('axios');

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ||
                     process.env.EXPO_PUBLIC_WEB1_API_URL ||
                     'http://localhost:3000';

console.log('🔧 Testing CobyPicks Mobile App Email Service');
console.log('=====================================\n');
console.log('📧 API Base URL:', API_BASE_URL);
console.log('📧 Test Email: test@example.com\n');

// Test data
const testData = {
  sendVerification: {
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User'
  },
  verifyCode: {
    email: 'test@example.com',
    code: '123456'
  }
};

async function testEndpoint(name, url, method = 'GET', data = null) {
  try {
    console.log(`🧪 Testing ${name}...`);

    const config = {
      method,
      url: `${API_BASE_URL}${url}`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);

    console.log(`✅ ${name}: SUCCESS`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, JSON.stringify(response.data, null, 2));
    return { success: true, data: response.data };

  } catch (error) {
    console.log(`❌ ${name}: FAILED`);
    console.log(`   Error: ${error.message}`);

    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Response:`, JSON.stringify(error.response.data, null, 2));
    } else if (error.code) {
      console.log(`   Error Code: ${error.code}`);
    }

    return { success: false, error: error.message };
  }
}

async function runMobileAppTests() {
  console.log('🚀 Starting Mobile App Email Service Tests...\n');

  // Test 1: Health Check
  console.log('Test 1: API Health Check');
  console.log('------------------------');
  const health = await testEndpoint('Health Check', '/api/health');
  console.log('');

  if (!health.success) {
    console.log('❌ CRITICAL: Cannot connect to web1 backend API');
    console.log('💡 Make sure the web1 Next.js server is running:');
    console.log('   cd web1 && npm run dev');
    console.log('');
    return;
  }

  // Test 2: Send Signup Verification
  console.log('Test 2: Send Signup Verification Email');
  console.log('--------------------------------------');
  const sendVerification = await testEndpoint(
    'Send Signup Verification',
    '/api/auth/send-signup-verification',
    'POST',
    testData.sendVerification
  );
  console.log('');

  // Test 3: Verify Signup Code
  console.log('Test 3: Verify Signup Code');
  console.log('--------------------------');
  const verifyCode = await testEndpoint(
    'Verify Signup Code',
    '/api/auth/verify-signup-code',
    'POST',
    testData.verifyCode
  );
  console.log('');

  // Summary
  console.log('📋 Test Results Summary:');
  console.log('========================');
  console.log(`✅ Health Check: ${health.success ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Send Verification: ${sendVerification.success ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Verify Code: ${verifyCode.success ? 'PASS' : 'FAIL'}`);

  const passedTests = [health, sendVerification, verifyCode].filter(test => test.success).length;
  const totalTests = 3;

  console.log(`\n📊 Overall: ${passedTests}/${totalTests} tests passed`);

  if (passedTests === totalTests) {
    console.log('🎉 SUCCESS: Mobile app email service is working perfectly!');
    console.log('📧 Emails will be sent successfully from your React Native app.');
  } else {
    console.log('⚠️  PARTIAL: Some tests failed. Check the web1 server logs for details.');
    console.log('💡 Make sure Gmail credentials are properly configured in web1/.env.local');
  }

  console.log('\n🔧 Next Steps for Mobile App:');
  console.log('==============================');
  console.log('1. Import the EmailService in your React Native components:');
  console.log('   import { emailService } from \'../services/EmailService\';');
  console.log('');
  console.log('2. Use the service to send verification emails:');
  console.log('   const result = await emailService.sendSignupVerification({');
  console.log('     email: \'user@example.com\',');
  console.log('     firstName: \'John\',');
  console.log('     lastName: \'Doe\'');
  console.log('   });');
  console.log('');
  console.log('3. Handle the response:');
  console.log('   if (result.success) {');
  console.log('     // Email sent successfully');
  console.log('   } else {');
  console.log('     // Handle error: result.error');
  console.log('   }');
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Run the tests
if (require.main === module) {
  runMobileAppTests().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testEndpoint,
  runMobileAppTests
};