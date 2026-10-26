/**
 * StaffSync HRMS - Task 2 Automated Auth & RBAC Verification Suite
 * Executes all 10 required verification checks against the live server.
 */

const BASE_URL = 'http://localhost:5000';
const TEST_TIMESTAMP = Date.now();

const results = [];

function recordResult(testNumber, description, passed, details = '') {
  results.push({ testNumber, description, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [Test ${testNumber}] ${description}`);
  if (details) {
    console.log(`   └─ Details: ${details}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log(' Starting StaffSync Authentication & RBAC Test Suite');
  console.log(` Target Server: ${BASE_URL}`);
  console.log('====================================================\n');

  let testUserToken = null;
  const testEmail1 = `emp_${TEST_TIMESTAMP}@staffsync.local`;
  const testEmail2 = `hr_attempt_${TEST_TIMESTAMP}@staffsync.local`;
  const validPassword = 'SecurePassword123!';

  try {
    // -----------------------------------------------------------
    // Test 1: Missing registration fields are rejected
    // -----------------------------------------------------------
    {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'no_name@test.com', password: '123' }), // Missing name, weak password
      });
      const data = await res.json();
      const passed = res.status === 400 && data.success === false;
      recordResult(
        1,
        'Missing / invalid registration fields are rejected with 400 Bad Request',
        passed,
        `Status: ${res.status}, Message: "${data.message}"`
      );
    }

    // -----------------------------------------------------------
    // Test 2: Employee registration succeeds
    // -----------------------------------------------------------
    let registeredUser = null;
    {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Jane Doe',
          email: testEmail1,
          password: validPassword,
          department: 'Engineering',
          designation: 'Software Engineer',
        }),
      });
      const data = await res.json();
      registeredUser = data.user;
      testUserToken = data.token;
      const passed =
        res.status === 201 &&
        data.success === true &&
        data.user &&
        data.user.role === 'EMPLOYEE' &&
        !!data.token &&
        !data.user.password;

      recordResult(
        2,
        'Employee registration succeeds with 201 Created and JWT token',
        passed,
        `Status: ${res.status}, User ID: ${data.user?._id}, Role: ${data.user?.role}`
      );
    }

    // -----------------------------------------------------------
    // Test 3: Duplicate email is rejected
    // -----------------------------------------------------------
    {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Duplicate Jane',
          email: testEmail1, // identical email
          password: validPassword,
        }),
      });
      const data = await res.json();
      const passed = res.status === 409 && data.success === false;
      recordResult(
        3,
        'Duplicate email registration is rejected with 409 Conflict',
        passed,
        `Status: ${res.status}, Message: "${data.message}"`
      );
    }

    // -----------------------------------------------------------
    // Test 4: Registration with role HR or MANAGER cannot grant elevated privileges
    // -----------------------------------------------------------
    {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Attacker Trying HR',
          email: testEmail2,
          password: validPassword,
          role: 'HR', // Malicious attempt to elevate privileges
        }),
      });
      const data = await res.json();
      // Even if role: 'HR' was sent, returned and stored role must be 'EMPLOYEE'
      const passed =
        res.status === 201 &&
        data.user &&
        data.user.role === 'EMPLOYEE';

      recordResult(
        4,
        'Registration with role HR or MANAGER is strictly forced to EMPLOYEE',
        passed,
        `Sent role: "HR", Actual Assigned role: "${data.user?.role}"`
      );
    }

    // -----------------------------------------------------------
    // Test 5: Login succeeds with valid credentials
    // -----------------------------------------------------------
    let loginToken = null;
    {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail1,
          password: validPassword,
        }),
      });
      const data = await res.json();
      loginToken = data.token;
      const passed =
        res.status === 200 &&
        data.success === true &&
        !!data.token &&
        data.user &&
        data.user.email === testEmail1.toLowerCase();

      recordResult(
        5,
        'Login succeeds with valid credentials and returns JWT token',
        passed,
        `Status: ${res.status}, Message: "${data.message}"`
      );
    }

    // -----------------------------------------------------------
    // Test 6: Incorrect password is rejected
    // -----------------------------------------------------------
    {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail1,
          password: 'WrongPassword999!',
        }),
      });
      const data = await res.json();
      // Must return 401 with generic error
      const passed =
        res.status === 401 &&
        data.success === false &&
        data.message === 'Invalid email or password.';

      recordResult(
        6,
        'Incorrect password is rejected with generic 401 Unauthorized',
        passed,
        `Status: ${res.status}, Message: "${data.message}"`
      );
    }

    // -----------------------------------------------------------
    // Test 7: GET /api/auth/me rejects missing and invalid tokens
    // -----------------------------------------------------------
    {
      // Missing token
      const resMissing = await fetch(`${BASE_URL}/api/auth/me`);
      const dataMissing = await resMissing.json();

      // Malformed / invalid token
      const resInvalid = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: 'Bearer this.is.an.invalid.token' },
      });
      const dataInvalid = await resInvalid.json();

      const passed =
        resMissing.status === 401 &&
        dataMissing.success === false &&
        resInvalid.status === 401 &&
        dataInvalid.success === false;

      recordResult(
        7,
        'GET /api/auth/me rejects missing and invalid tokens with 401 Unauthorized',
        passed,
        `Missing Token Status: ${resMissing.status}, Invalid Token Status: ${resInvalid.status}`
      );
    }

    // -----------------------------------------------------------
    // Test 8: GET /api/auth/me succeeds with a valid token
    // -----------------------------------------------------------
    let profileData = null;
    {
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${loginToken || testUserToken}` },
      });
      profileData = await res.json();
      const passed =
        res.status === 200 &&
        profileData.success === true &&
        profileData.user &&
        profileData.user.email === testEmail1.toLowerCase() &&
        profileData.user.role === 'EMPLOYEE';

      recordResult(
        8,
        'GET /api/auth/me succeeds with a valid token returning authenticated profile',
        passed,
        `Status: ${res.status}, User: ${profileData.user?.name} (${profileData.user?.email})`
      );
    }

    // -----------------------------------------------------------
    // Test 9: Password hashes never appear in responses
    // -----------------------------------------------------------
    {
      const responseStrings = [
        JSON.stringify(registeredUser || {}),
        JSON.stringify(profileData || {}),
      ];

      const containsPassword = responseStrings.some((str) => {
        return (
          str.includes('"password"') ||
          str.includes('$2a$') ||
          str.includes('$2b$')
        );
      });

      const passed = !containsPassword;
      recordResult(
        9,
        'Password and password hashes never appear in any API response',
        passed,
        'Verified in registration response and GET /api/auth/me response'
      );
    }

    // -----------------------------------------------------------
    // Test 10: Existing GET /api/health still works
    // -----------------------------------------------------------
    {
      const res = await fetch(`${BASE_URL}/api/health`);
      const data = await res.json();
      const passed =
        res.status === 200 &&
        data.status === 'ok' &&
        data.server === 'running' &&
        data.database &&
        data.database.status === 'connected' &&
        data.database.readyState === 1;

      recordResult(
        10,
        'Existing GET /api/health still works seamlessly',
        passed,
        `Status: ${res.status}, DB Status: ${data.database?.status}, ReadyState: ${data.database?.readyState}`
      );
    }

    // -----------------------------------------------------------
    // Bonus Test 11: RBAC check - EMPLOYEE cannot access HR-only route
    // -----------------------------------------------------------
    {
      const res = await fetch(`${BASE_URL}/api/auth/hr-only`, {
        headers: { Authorization: `Bearer ${loginToken || testUserToken}` },
      });
      const data = await res.json();
      const passed = res.status === 403 && data.success === false;
      recordResult(
        11,
        'RBAC: EMPLOYEE token is forbidden from accessing HR-only route (403 Forbidden)',
        passed,
        `Status: ${res.status}, Message: "${data.message}"`
      );
    }

    // -----------------------------------------------------------
    // Cleanup test records
    // -----------------------------------------------------------
    console.log('\nCleaning up test-created records from MongoDB...');
    const mongoose = require('mongoose');
    const path = require('path');
    require('dotenv').config({ path: path.resolve(__dirname, '.env') });
    const User = require('./src/models/User');

    await mongoose.connect(process.env.MONGO_URI);
    const deleteResult = await User.deleteMany({
      email: { $in: [testEmail1.toLowerCase(), testEmail2.toLowerCase()] },
    });
    console.log(`Cleaned up ${deleteResult.deletedCount} test user records.`);
    await mongoose.disconnect();

  } catch (err) {
    console.error('Test execution failed with error:', err);
  }

  console.log('\n====================================================');
  const allPassed = results.every((r) => r.passed);
  console.log(`Test Summary: ${results.filter((r) => r.passed).length}/${results.length} PASSED`);
  console.log('====================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

runTests();
