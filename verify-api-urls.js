#!/usr/bin/env node

// Script to verify API connectivity and configuration
import https from 'https';
import http from 'http';

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'https://cloud.voipappz.io';

console.log('🔍 Verifying API Configuration...');
console.log(`📡 API Base URL: ${API_BASE_URL}`);

// Test basic connectivity to the API
function testApiConnectivity(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const request = protocol.get(url, (response) => {
      console.log(`✅ API Status: ${response.statusCode} ${response.statusMessage}`);
      console.log(`📋 Headers: ${JSON.stringify(response.headers, null, 2)}`);
      resolve({
        statusCode: response.statusCode,
        statusMessage: response.statusMessage,
        headers: response.headers
      });
    });

    request.on('error', (error) => {
      console.error(`❌ API Connection Error: ${error.message}`);
      reject(error);
    });

    request.setTimeout(10000, () => {
      console.error('❌ API Request Timeout');
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Test CORS headers
function testCorsHeaders(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const options = {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:4200',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type,Authorization'
      }
    };

    const request = protocol.request(url, options, (response) => {
      const corsHeaders = {
        'access-control-allow-origin': response.headers['access-control-allow-origin'],
        'access-control-allow-methods': response.headers['access-control-allow-methods'],
        'access-control-allow-headers': response.headers['access-control-allow-headers']
      };
      
      console.log('🔒 CORS Headers:', corsHeaders);
      resolve(corsHeaders);
    });

    request.on('error', (error) => {
      console.error(`❌ CORS Test Error: ${error.message}`);
      reject(error);
    });

    request.end();
  });
}

async function main() {
  try {
    // Test base API connectivity
    await testApiConnectivity(API_BASE_URL);
    
    // Test API health endpoint if available
    try {
      await testApiConnectivity(`${API_BASE_URL}/api/health`);
    } catch {
      console.log('ℹ️  Health endpoint not available, trying auth endpoint...');
      try {
        await testApiConnectivity(`${API_BASE_URL}/auth/login`);
      } catch {
        console.log('ℹ️  Auth endpoint test completed');
      }
    }

    // Test CORS configuration
    await testCorsHeaders(API_BASE_URL);

    console.log('\n🎉 API Configuration verification complete!');
    console.log('📝 Environment variables:');
    console.log(`   VITE_API_BASE_URL=${process.env.VITE_API_BASE_URL}`);
    console.log(`   CYPRESS_TEST_EMAIL=${process.env.CYPRESS_TEST_EMAIL ? '***SET***' : 'NOT SET'}`);
    console.log(`   CYPRESS_TEST_PASSWORD=${process.env.CYPRESS_TEST_PASSWORD ? '***SET***' : 'NOT SET'}`);
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  }
}

main();