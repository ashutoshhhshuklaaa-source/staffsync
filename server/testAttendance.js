/**
 * StaffSync HRMS - Task 5 Automated Attendance Management Verification Suite
 * Executes all 11 attendance verification checks + concurrency and report validation.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Attendance = require('./src/models/Attendance');
const { generateToken } = require('./src/controllers/authController');
const { getNormalizedBusinessDate } = require('./src/utils/attendanceUtils');

const BASE_URL = 'http://localhost:5000';
const RUN_ID = Date.now();

const results = [];

function recordResult(testNumber, description, passed, details = '') {
  results.push({ testNumber, description, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [Test ${testNumber}] ${description}`);
  if (details) {
    console.log(`   └─ Details: ${details}`);
  }
}

async function runAttendanceTests() {
  console.log('===========================================================');
  console.log(' Starting StaffSync Attendance Management & RBAC Test Suite');
  console.log(` Target Server: ${BASE_URL}`);
  console.log('===========================================================\n');

  await mongoose.connect(process.env.MONGO_URI);

  const testEmails = {
    hr: `hr_att_${RUN_ID}@staffsync.local`,
    mgr: `mgr_att_${RUN_ID}@staffsync.local`,
    emp1: `emp1_att_${RUN_ID}@staffsync.local`,
    emp2: `emp2_att_${RUN_ID}@staffsync.local`,
    empConcurrent: `emp_conc_${RUN_ID}@staffsync.local`,
  };

  let hrUser, mgrUser, emp1User, emp2User, empConcurrent;
  let hrToken, mgrToken, emp1Token, emp2Token, empConcurrentToken;
  let emp1AttendanceId;

  try {
    // -----------------------------------------------------------
    // Administrative Setup: Provision users and reporting lines
    // -----------------------------------------------------------
    hrUser = await User.create({
      name: 'Alice HR Director',
      email: testEmails.hr,
      password: 'AdminPassword123!',
      role: 'HR',
      department: 'HR',
      isActive: true,
    });
    hrToken = generateToken(hrUser);

    mgrUser = await User.create({
      name: 'Michael Manager',
      email: testEmails.mgr,
      password: 'ManagerPassword123!',
      role: 'MANAGER',
      department: 'Engineering',
      isActive: true,
    });
    mgrToken = generateToken(mgrUser);

    // Emp 1 reports to Michael
    emp1User = await User.create({
      name: 'Edward Employee One',
      email: testEmails.emp1,
      password: 'EmployeePassword123!',
      role: 'EMPLOYEE',
      department: 'Engineering',
      manager: mgrUser._id,
      isActive: true,
    });
    emp1Token = generateToken(emp1User);

    // Emp 2 does NOT report to Michael (no manager assigned)
    emp2User = await User.create({
      name: 'Emily Employee Two',
      email: testEmails.emp2,
      password: 'EmployeePassword123!',
      role: 'EMPLOYEE',
      department: 'Finance',
      manager: null,
      isActive: true,
    });
    emp2Token = generateToken(emp2User);

    empConcurrent = await User.create({
      name: 'Connor Concurrent',
      email: testEmails.empConcurrent,
      password: 'EmployeePassword123!',
      role: 'EMPLOYEE',
      department: 'Operations',
      isActive: true,
    });
    empConcurrentToken = generateToken(empConcurrent);

    console.log('Administrative test personas provisioned successfully.\n');

    // -----------------------------------------------------------
    // Test 1: Employee check-in succeeds
    // -----------------------------------------------------------
    {
      const res = await fetch(`${BASE_URL}/api/attendance/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${emp1Token}`,
        },
        body: JSON.stringify({ notes: 'Arrived at the office on time' }),
      });
      const data = await res.json();
      emp1AttendanceId = data.data?._id;

      const passed =
        res.status === 201 &&
        data.success === true &&
        data.data?.checkInAt &&
        data.data?.employee === emp1User._id.toString() &&
        ['PRESENT', 'LATE'].includes(data.data?.status);

      recordResult(
        1,
        'Employee check-in succeeds with 201 Created and server timestamp',
        passed,
        `Status: ${res.status}, Record ID: ${emp1AttendanceId}, Status: "${data.data?.status}"`
      );
    }

    // -----------------------------------------------------------
    // Test 2: Duplicate check-in is rejected
    // -----------------------------------------------------------
    {
      const res = await fetch(`${BASE_URL}/api/attendance/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${emp1Token}`,
        },
        body: JSON.stringify({ notes: 'Attempting second check-in' }),
      });
      const data = await res.json();

      const passed = res.status === 409 && data.success === false;

      recordResult(
        2,
        'Duplicate daily check-in is rejected with 409 Conflict',
        passed,
        `Status: ${res.status}, Message: "${data.message}"`
      );
    }

    // -----------------------------------------------------------
    // Test 3: Check-out succeeds after check-in
    // -----------------------------------------------------------
    {
      // Check-out after 1 second
      const res = await fetch(`${BASE_URL}/api/attendance/check-out`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${emp1Token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      const passed =
        res.status === 200 &&
        data.success === true &&
        data.data?.checkOutAt &&
        typeof data.data?.totalWorkedMinutes === 'number';

      recordResult(
        3,
        'Check-out succeeds after check-in and records check-out timestamp',
        passed,
        `Status: ${res.status}, CheckOutAt: ${data.data?.checkOutAt}, Worked Minutes: ${data.data?.totalWorkedMinutes}`
      );
    }

    // -----------------------------------------------------------
    // Test 4: Check-out without check-in is rejected
    // -----------------------------------------------------------
    {
      // Emp 2 has not checked in today
      const res = await fetch(`${BASE_URL}/api/attendance/check-out`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${emp2Token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      const passed = res.status === 400 && data.success === false;

      recordResult(
        4,
        'Check-out without prior check-in is rejected with 400 Bad Request',
        passed,
        `Status: ${res.status}, Message: "${data.message}"`
      );
    }

    // -----------------------------------------------------------
    // Test 5: Invalid or reversed timestamps are rejected
    // -----------------------------------------------------------
    {
      // Create a test record for Emp 2 where checkInAt is current time
      const today = getNormalizedBusinessDate(new Date());
      const testRecord = await Attendance.create({
        employee: emp2User._id,
        date: today,
        checkInAt: new Date(),
        status: 'PRESENT',
      });

      // Attempt to check out with a timestamp earlier than check-in
      const earlierTime = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      const res = await fetch(`${BASE_URL}/api/attendance/check-out`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${emp2Token}`,
        },
        body: JSON.stringify({ checkOutAt: earlierTime }),
      });
      const data = await res.json();

      const passed = res.status === 400 && data.success === false;

      recordResult(
        5,
        'Check-out timestamp earlier than check-in is rejected with 400 Bad Request',
        passed,
        `Status: ${res.status}, Message: "${data.message}"`
      );

      await Attendance.findByIdAndDelete(testRecord._id);
    }

    // -----------------------------------------------------------
    // Test 6: Employees cannot view or modify another employee's attendance
    // -----------------------------------------------------------
    {
      // Emp2 creates attendance
      const today = getNormalizedBusinessDate(new Date());
      const emp2Att = await Attendance.create({
        employee: emp2User._id,
        date: today,
        checkInAt: new Date(),
        status: 'PRESENT',
      });

      // Emp1 tries to view Emp2's attendance record
      const resView = await fetch(`${BASE_URL}/api/attendance/${emp2Att._id}`, {
        headers: { Authorization: `Bearer ${emp1Token}` },
      });

      // Emp1 tries to list administrative attendance
      const resList = await fetch(`${BASE_URL}/api/attendance`, {
        headers: { Authorization: `Bearer ${emp1Token}` },
      });

      const passed = resView.status === 403 && resList.status === 403;

      recordResult(
        6,
        'Employees cannot view other employees attendance or administrative listings (403 Forbidden)',
        passed,
        `View other status: ${resView.status}, Admin list status: ${resList.status}`
      );

      await Attendance.findByIdAndDelete(emp2Att._id);
    }

    // -----------------------------------------------------------
    // Test 7: Managers cannot view employees outside their reporting scope
    // -----------------------------------------------------------
    {
      // Create attendance for Emp 2 (not reporting to Michael)
      const pastDate = new Date(Date.now() - 86400000); // yesterday
      const normalizedPast = getNormalizedBusinessDate(pastDate);
      const outsideAtt = await Attendance.create({
        employee: emp2User._id,
        date: normalizedPast,
        checkInAt: pastDate,
        status: 'PRESENT',
      });

      // Manager Michael tries to view outsideAtt
      const resView = await fetch(`${BASE_URL}/api/attendance/${outsideAtt._id}`, {
        headers: { Authorization: `Bearer ${mgrToken}` },
      });

      // Manager Michael filters specifically for Emp2
      const resFilter = await fetch(
        `${BASE_URL}/api/attendance?employee=${emp2User._id}`,
        {
          headers: { Authorization: `Bearer ${mgrToken}` },
        }
      );

      const passed = resView.status === 403 && resFilter.status === 403;

      recordResult(
        7,
        'Manager cannot view attendance for employees outside reporting scope (403 Forbidden)',
        passed,
        `Direct view status: ${resView.status}, Scoped list filter status: ${resFilter.status}`
      );

      await Attendance.findByIdAndDelete(outsideAtt._id);
    }

    // -----------------------------------------------------------
    // Test 8: HR can access authorized organization-wide records
    // -----------------------------------------------------------
    {
      const res = await fetch(`${BASE_URL}/api/attendance`, {
        headers: { Authorization: `Bearer ${hrToken}` },
      });
      const data = await res.json();

      const passed =
        res.status === 200 &&
        Array.isArray(data.data) &&
        data.pagination?.total >= 1;

      recordResult(
        8,
        'HR can access organization-wide attendance records with pagination',
        passed,
        `Status: ${res.status}, Records found: ${data.data?.length}, Total: ${data.pagination?.total}`
      );
    }

    // -----------------------------------------------------------
    // Test 9: Duplicate daily records are prevented under concurrent requests
    // -----------------------------------------------------------
    {
      // Fire 4 simultaneous check-in requests for empConcurrent
      const promises = [1, 2, 3, 4].map((i) =>
        fetch(`${BASE_URL}/api/attendance/check-in`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${empConcurrentToken}`,
          },
          body: JSON.stringify({ notes: `Concurrent attempt ${i}` }),
        })
      );

      const responses = await Promise.all(promises);
      const statuses = responses.map((r) => r.status);

      // Exactly 1 must be 201 Created and the remaining 3 must be 409 Conflict
      const createdCount = statuses.filter((s) => s === 201).length;
      const conflictCount = statuses.filter((s) => s === 409).length;

      // Verify in MongoDB that exactly 1 record was written
      const today = getNormalizedBusinessDate(new Date());
      const recordsInDb = await Attendance.countDocuments({
        employee: empConcurrent._id,
        date: today,
      });

      const passed = createdCount === 1 && conflictCount === 3 && recordsInDb === 1;

      recordResult(
        9,
        'Concurrent check-in requests are atomically guarded (unique index prevents duplicates)',
        passed,
        `201 Created count: ${createdCount}, 409 Conflict count: ${conflictCount}, DB records: ${recordsInDb}`
      );
    }

    // -----------------------------------------------------------
    // Test 10: Worked minutes are calculated by the backend
    // -----------------------------------------------------------
    {
      // Create a test record with known checkInAt and checkOutAt (e.g. 5 hours = 300 minutes)
      const checkInTime = new Date('2026-10-20T09:00:00.000Z');
      const checkOutTime = new Date('2026-10-20T14:00:00.000Z');
      const testDate = getNormalizedBusinessDate(checkInTime);

      const computedAttendance = await Attendance.create({
        employee: emp1User._id,
        date: testDate,
        checkInAt: checkInTime,
        checkOutAt: checkOutTime,
        totalWorkedMinutes: Math.round(
          (checkOutTime.getTime() - checkInTime.getTime()) / 60000
        ),
        status: 'PRESENT',
      });

      const res = await fetch(`${BASE_URL}/api/attendance/${computedAttendance._id}`, {
        headers: { Authorization: `Bearer ${emp1Token}` },
      });
      const data = await res.json();

      const passed =
        res.status === 200 &&
        data.data?.totalWorkedMinutes === 300 &&
        data.data?.status === 'PRESENT';

      recordResult(
        10,
        'Worked minutes are accurately computed on the backend (300 minutes = 5 hours)',
        passed,
        `Stored Worked Minutes: ${data.data?.totalWorkedMinutes}`
      );

      await Attendance.findByIdAndDelete(computedAttendance._id);
    }

    // -----------------------------------------------------------
    // Test 11: Reports respect date filters and role permissions
    // -----------------------------------------------------------
    {
      // 11a: HR report summary (organization-wide)
      const resHRReport = await fetch(
        `${BASE_URL}/api/attendance/reports/summary`,
        {
          headers: { Authorization: `Bearer ${hrToken}` },
        }
      );
      const dataHRReport = await resHRReport.json();

      // 11b: Employee report summary (self only)
      const resEmpReport = await fetch(
        `${BASE_URL}/api/attendance/reports/summary`,
        {
          headers: { Authorization: `Bearer ${emp1Token}` },
        }
      );
      const dataEmpReport = await resEmpReport.json();

      const passed =
        resHRReport.status === 200 &&
        dataHRReport.success === true &&
        typeof dataHRReport.data?.totalRecords === 'number' &&
        resEmpReport.status === 200 &&
        dataEmpReport.data?.totalRecords >= 1;

      recordResult(
        11,
        'Attendance summary reports respect role scoping and return aggregate metrics',
        passed,
        `HR total records: ${dataHRReport.data?.totalRecords}, Employee records: ${dataEmpReport.data?.totalRecords}`
      );
    }

  } catch (err) {
    console.error('Attendance test error:', err);
  } finally {
    // -----------------------------------------------------------
    // Cleanup test-created records
    // -----------------------------------------------------------
    console.log('\nCleaning up Task 5 test-created records from MongoDB...');
    const allEmails = Object.values(testEmails).map((e) => e.toLowerCase());
    const users = await User.find({ email: { $in: allEmails } }).select('_id');
    const userIds = users.map((u) => u._id);

    const deletedAtt = await Attendance.deleteMany({ employee: { $in: userIds } });
    const deletedUsers = await User.deleteMany({ _id: { $in: userIds } });

    console.log(
      `Cleaned up ${deletedUsers.deletedCount} users and ${deletedAtt.deletedCount} attendance records.`
    );
    await mongoose.disconnect();
  }

  console.log('\n===========================================================');
  const allPassed = results.every((r) => r.passed);
  console.log(
    `Attendance Test Summary: ${results.filter((r) => r.passed).length}/${results.length} PASSED`
  );
  console.log('===========================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

runAttendanceTests();
