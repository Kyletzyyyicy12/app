// Test script for Firebase Functions email service
// Run with: node test-firebase-email.js

const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB-C_IjY-ywRfZJWd015As_hGnpV_pfyuw",
  authDomain: "cobypicksswu.firebaseapp.com",
  databaseURL: "https://cobypicksswu-default-rtdb.firebaseio.com",
  projectId: "cobypicksswu",
  storageBucket: "cobypicksswu.firebasestorage.app",
  messagingSenderId: "469611837919",
  appId: "1:469611837919:web:088c372029035bfe0b2c6a",
  measurementId: "G-SQ8C2YNEJ3"
};

console.log('🔧 Testing Firebase Functions Email Service');
console.log('=========================================\n');

async function testFirebaseEmailService() {
  try {
    // Initialize Firebase
    console.log('📱 Initializing Firebase...');
    const app = initializeApp(firebaseConfig);
    const functions = getFunctions(app);

    console.log('✅ Firebase initialized successfully\n');

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

    // Test 1: Health Check
    console.log('Test 1: Health Check');
    console.log('-------------------');
    try {
      const healthCheck = httpsCallable(functions, 'healthCheck');
      const healthResult = await healthCheck();
      console.log('✅ Health Check: SUCCESS');
      console.log('   Response:', JSON.stringify(healthResult.data, null, 2));
    } catch (error) {
      console.log('❌ Health Check: FAILED');
      console.log('   Error:', error.message);
    }
    console.log('');

    // Test 2: Send Signup Verification
    console.log('Test 2: Send Signup Verification Email');
    console.log('-------------------------------------');
    try {
      const sendVerification = httpsCallable(functions, 'sendSignupVerification');
      const sendResult = await sendVerification(testData.sendVerification);
      console.log('✅ Send Verification: SUCCESS');
      console.log('   Response:', JSON.stringify(sendResult.data, null, 2));
    } catch (error) {
      console.log('❌ Send Verification: FAILED');
      console.log('   Error:', error.message);
    }
    console.log('');

    // Test 3: Verify Signup Code
    console.log('Test 3: Verify Signup Code');
    console.log('-------------------------');
    try {
      const verifyCode = httpsCallable(functions, 'verifySignupCode');
      const verifyResult = await verifyCode(testData.verifyCode);
      console.log('✅ Verify Code: SUCCESS');
      console.log('   Response:', JSON.stringify(verifyResult.data, null, 2));
    } catch (error) {
      console.log('❌ Verify Code: FAILED');
      console.log('   Error:', error.message);
    }
    console.log('');

    console.log('📋 Test Results Summary:');
    console.log('=======================');

  } catch (error) {
    console.error('💥 Failed to initialize Firebase:', error.message);
    console.log('\n🔧 Setup Instructions:');
    console.log('======================');
    console.log('1. Make sure Firebase is properly configured in your app');
    console.log('2. Copy your Firebase config from firebaseConfig.ts');
    console.log('3. Update the firebaseConfig object in this script');
    console.log('4. Deploy Firebase Functions: firebase deploy --only functions');
    console.log('5. Test locally: firebase serve --only functions');
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Run the tests
if (require.main === module) {
  testFirebaseEmailService().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testFirebaseEmailService
};