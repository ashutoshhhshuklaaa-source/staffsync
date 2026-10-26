/**
 * StaffSync HRMS - Task 8 Automated Security Audit & Deployment Readiness Test Suite
 * Validates security headers, rate limiting, payload protection, CORS policies,
 * IDOR boundaries, password hashing, and error response sanitization.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./src/models/User');

const BASE_URL = 'http://localhost:5000';
const TEST_TIMESTAMP = Date.now();

const results = [];

function recordResult(testNumber, description, passed, details = '') {
  results.push({ testNumber, description, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [Security Test ${testNumber}] ${description}`);
  if (details) {
    console.log(`   └─ Details: ${details}`);
  }
}

async function runSecurityAudit() {
  console.log('===========================================================');
  console.log(' Starting StaffSync Security Audit & Hardening Test Suite');
  console.log(` Target Server: ${BASE_URL}`);
  console.log('===========================================================\n');

  let hrUser, mgrUser, empUser;
  let hrToken, mgrToken, empToken;

  const testEmails = {
    hr: `sec_hr_${TEST_TIMESTAMP}@staffsync.local`,
    mgr: `sec_mgr_${TEST_TIMESTAMP}@staffsync.local`,
    emp: `sec_emp_${TEST_TIMESTAMP}@staffsync.local`,
  };

  try {
    await mongoose.connect(process.env.MONGO_URI);

    // 1. Provision Test Personas
    hrUser = await User.create({
      name: 'Security HR Auditor',
      email: testEmails.hr,
      password: 'AuditPassword123!',
      role: 'HR',
      department: 'HR',
      designation: 'Security Officer',
      isActive: true,
    });

    mgrUser = await User.create({
      name: 'Security Manager',
      email: testEmails.mgr,
      password: 'AuditPassword123!',
      role: 'MANAGER',
      department: 'Security',
      designation: 'SecOps Lead',
      isActive: true,
    });

    empUser = await User.create({
      name: 'Security Employee',
      email: testEmails.emp,
      password: 'AuditPassword123!',
      role: 'EMPLOYEE',
      department: 'Security',
      designation: 'Sec Analyst',
      manager: mgrUser._id,
      isActive: true,
    });

    // Obtain JWT tokens
    const loginResHR = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmails.hr, password: 'AuditPassword123!' }),
    });
    hrToken = (await loginResHR.json()).token;

    const loginResMgr = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmails.mgr, password: 'AuditPassword123!' }),
    });
    mgrToken = (await loginResMgr.json()).token;

    const loginResEmp = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmails.emp, password: 'AuditPassword123!' }),
    });
    empToken = (await loginResEmp.json()).token;

    // -----------------------------------------------------------
    // Security Test 1: Helmet security headers are present
    // -----------------------------------------------------------
    {
      const res = await fetch(`${BASE_URL}/api/health`);
      const csp = res.headers.get('content-security-policy');
      const nosniff = res.headers.get('x-content-type-options');
      const frameOptions = res.headers.get('x-frame-options');

      const passed =
        res.status === 200 &&
        !!csp &&
        nosniff === 'nosniff' &&
        (frameOptions === 'SAMEORIGIN' || frameOptions === 'DENY');

      recordResult(
        1,
        'Helmet security headers (CSP, nosniff, frame-options) are enforced on all API responses',
        passed,
        `nosniff: "${nosniff}", x-frame-options: "${frameOptions}", CSP length: ${csp?.length || 0}`
      );
    }

    // -----------------------------------------------------------
    // Security Test 2: Rate limit headers on sensitive auth endpoints
    // -----------------------------------------------------------
    {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'fake@example.com', password: 'wrong' }),
      });

      const limit = res.headers.get('ratelimit-limit');
      const remaining = res.headers.get('ratelimit-remaining');

      const passed = !!limit && typeof remaining !== 'undefined';

      recordResult(
        2,
        'Authentication endpoints enforce rate limiting to defend against brute force credential stuffing',
        passed,
        `RateLimit-Limit: ${limit}, RateLimit-Remaining: ${remaining}`
      );
    }

    // -----------------------------------------------------------
    // Security Test 3: Malformed JSON payloads return 400 Bad Request safely
    // -----------------------------------------------------------
    {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ "invalidJson": broken...',
      });
      const data = await res.json();

      const passed =
        res.status === 400 &&
        data.success === false &&
        data.message.includes('Malformed JSON');

      recordResult(
        3,
        'Malformed JSON request bodies are handled safely with 400 Bad Request without leaking internal stack traces',
        passed,
        `Status: ${res.status}, Message: "${data.message}"`
      );
    }

    // -----------------------------------------------------------
    // Security Test 4: Response payloads never leak password hashes or internal __v
    // -----------------------------------------------------------
    {
      const resMe = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${empToken}` },
      });
      const dataMe = await resMe.json();

      const rawUserString = JSON.stringify(dataMe);
      const hasPassword = rawUserString.includes('"password"');
      const hasHash = rawUserString.includes('$2a$') || rawUserString.includes('$2b$');
      const hasVersion = rawUserString.includes('"__v"');

      const passed = resMe.status === 200 && !hasPassword && !hasHash && !hasVersion;

      recordResult(
        4,
        'API responses strictly exclude password fields, bcrypt hashes, and internal Mongoose __v tags',
        passed,
        `Contains password: ${hasPassword}, Contains bcrypt hash: ${hasHash}, Contains __v: ${hasVersion}`
      );
    }

    // -----------------------------------------------------------
    // Security Test 5: IDOR protection on employee endpoints
    // -----------------------------------------------------------
    {
      // Emp tries to read HR's profile directly
      const resIdor = await fetch(`${BASE_URL}/api/employees/${hrUser._id}`, {
        headers: { Authorization: `Bearer ${empToken}` },
      });
      const dataIdor = await resIdor.json();

      const passed = resIdor.status === 403 && dataIdor.success === false;

      recordResult(
        5,
        'IDOR Protection: Standard employees cannot query another user profile by ID (403 Forbidden)',
        passed,
        `Status: ${resIdor.status}, Message: "${dataIdor.message}"`
      );
    }

    // -----------------------------------------------------------
    // Security Test 6: Role escalation prevented on public registration
    // -----------------------------------------------------------
    {
      const hackerEmail = `hacker_${TEST_TIMESTAMP}@staffsync.local`;
      const resHacker = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Hacker Joe',
          email: hackerEmail,
          password: 'Password123!',
          role: 'HR', // Attempt privilege escalation
        }),
      });
      const dataHacker = await resHacker.json();

      const passed =
        resHacker.status === 201 &&
        dataHacker.user?.role === 'EMPLOYEE';

      recordResult(
        6,
        'Privilege Escalation Prevention: Client-supplied roles on public registration are strictly overridden to EMPLOYEE',
        passed,
        `Requested Role: "HR", Assigned Role: "${dataHacker.user?.role}"`
      );

      await User.deleteOne({ email: hackerEmail });
    }

    // -----------------------------------------------------------
    // Security Test 7: Non-HR users blocked from HR administrative routes
    // -----------------------------------------------------------
    {
      const resHrOnly = await fetch(`${BASE_URL}/api/auth/hr-only`, {
        headers: { Authorization: `Bearer ${empToken}` },
      });
      const resHrAnnounce = await fetch(`${BASE_URL}/api/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${empToken}`,
        },
        body: JSON.stringify({
          title: 'Fake Title',
          content: 'Fake Content',
        }),
      });

      const passed = resHrOnly.status === 403 && resHrAnnounce.status === 403;

      recordResult(
        7,
        'Strict RBAC: Employees attempting HR-restricted administrative operations are rejected (403 Forbidden)',
        passed,
        `HR-only status: ${resHrOnly.status}, Announcement create status: ${resHrAnnounce.status}`
      );
    }

    // -----------------------------------------------------------
    // Security Test 8: Large payloads exceeding 1MB are rejected
    // -----------------------------------------------------------
    {
      const oversizedPayload = {
        name: 'Huge Name',
        email: 'oversized@test.com',
        password: 'Password123!',
        data: 'A'.repeat(1.5 * 1024 * 1024), // 1.5MB
      };

      const resOversized = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(oversizedPayload),
      });

      const passed = resOversized.status === 413;

      recordResult(
        8,
        'DoS Protection: Payloads exceeding body parser limits (1MB) are rejected with 413 Payload Too Large',
        passed,
        `Status: ${resOversized.status}`
      );
    }

  } catch (err) {
    console.error('Security audit test error:', err);
  } finally {
    console.log('\nCleaning up Task 8 security audit test records from MongoDB...');
    const allEmails = Object.values(testEmails).map((e) => e.toLowerCase());
    const deleted = await User.deleteMany({ email: { $in: allEmails } });
    console.log(`Cleaned up ${deleted.deletedCount} audit test users.`);
    await mongoose.disconnect();
  }

  console.log('\n===========================================================');
  const allPassed = results.every((r) => r.passed);
  console.log(
    `Security Audit Test Summary: ${results.filter((r) => r.passed).length}/${results.length} PASSED`
  );
  console.log('===========================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

runSecurityAudit();
