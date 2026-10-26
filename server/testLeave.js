/**
 * StaffSync HRMS - Task 4 Automated Leave Management Verification Suite
 * Executes all 12 required verification checks + concurrency and balance validation.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Leave = require('./src/models/Leave');
const LeaveBalance = require('./src/models/LeaveBalance');
const { generateToken } = require('./src/controllers/authController');

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

async function runLeaveTests() {
  console.log('===========================================================');
  console.log(' Starting StaffSync Leave Management & RBAC Test Suite');
  console.log(` Target Server: ${BASE_URL}`);
  console.log('===========================================================\n');

  await mongoose.connect(process.env.MONGO_URI);

  const testEmails = {
    hr: `hr_leave_${RUN_ID}@staffsync.local`,
    mgr1: `mgr1_leave_${RUN_ID}@staffsync.local`,
    mgr2: `mgr2_leave_${RUN_ID}@staffsync.local`,
    emp1: `emp1_leave_${RUN_ID}@staffsync.local`,
    emp2: `emp2_leave_${RUN_ID}@staffsync.local`,
  };

  let hrUser, mgr1User, mgr2User, emp1User, emp2User;
  let hrToken, mgr1Token, mgr2Token, emp1Token, emp2Token;
  let leave1Id, leave2Id, hrSelfLeaveId;

  try {
    // -----------------------------------------------------------
    // Administrative Setup: Provision users & reporting lines
    // -----------------------------------------------------------
    hrUser = await User.create({
      name: 'Hannah HR Lead',
      email: testEmails.hr,
      password: 'AdminPassword123!',
      role: 'HR',
      department: 'HR',
      isActive: true,
    });
    hrToken = generateToken(hrUser);

    mgr1User = await User.create({
      name: 'Mark Manager One',
      email: testEmails.mgr1,
      password: 'ManagerPassword123!',
      role: 'MANAGER',
      department: 'Engineering',
      isActive: true,
    });
    mgr1Token = generateToken(mgr1User);

    mgr2User = await User.create({
      name: 'Mona Manager Two',
      email: testEmails.mgr2,
      password: 'ManagerPassword123!',
      role: 'MANAGER',
      department: 'Product',
      isActive: true,
    });
    mgr2Token = generateToken(mgr2User);

    // Emp 1 reports to Mgr 1
    emp1User = await User.create({
      name: 'Evan Employee One',
      email: testEmails.emp1,
      password: 'EmployeePassword123!',
      role: 'EMPLOYEE',
      department: 'Engineering',
      manager: mgr1User._id,
      isActive: true,
    });
    emp1Token = generateToken(emp1User);

    // Emp 2 reports to Mgr 2
    emp2User = await User.create({
      name: 'Emma Employee Two',
      email: testEmails.emp2,
      password: 'EmployeePassword123!',
      role: 'EMPLOYEE',
      department: 'Product',
      manager: mgr2User._id,
      isActive: true,
    });
    emp2Token = generateToken(emp2User);

    console.log('Administrative test personas provisioned successfully.\n');

    // -----------------------------------------------------------
    // Test 1: Employee can submit a valid leave request
    // -----------------------------------------------------------
    {
      const res = await fetch(`${BASE_URL}/api/leaves`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${emp1Token}`,
        },
        body: JSON.stringify({
          leaveType: 'CASUAL',
          startDate: '2026-11-02', // Monday
          endDate: '2026-11-04',   // Wednesday (3 working days)
          reason: 'Family event and personal work',
        }),
      });
      const data = await res.json();
      leave1Id = data.data?._id;

      const passed =
        res.status === 201 &&
        data.success === true &&
        data.data?.status === 'PENDING' &&
        data.data?.days === 3 &&
        data.data?.leaveType === 'CASUAL';

      recordResult(
        1,
        'Employee can submit a valid leave request (201 Created)',
        passed,
        `Status: ${res.status}, Leave ID: ${leave1Id}, Working Days: ${data.data?.days}`
      );
    }

    // -----------------------------------------------------------
    // Test 2: Invalid dates and leave types are rejected
    // -----------------------------------------------------------
    {
      // 2a: Invalid leave type
      const resInvalidType = await fetch(`${BASE_URL}/api/leaves`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${emp1Token}`,
        },
        body: JSON.stringify({
          leaveType: 'VACATION', // invalid
          startDate: '2026-11-10',
          endDate: '2026-11-12',
          reason: 'Holiday vacation',
        }),
      });

      // 2b: Inverted dates (startDate > endDate)
      const resInvertedDates = await fetch(`${BASE_URL}/api/leaves`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${emp1Token}`,
        },
        body: JSON.stringify({
          leaveType: 'SICK',
          startDate: '2026-11-15',
          endDate: '2026-11-10', // earlier than start
          reason: 'Doctor checkup',
        }),
      });

      // 2c: Past date
      const resPastDate = await fetch(`${BASE_URL}/api/leaves`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${emp1Token}`,
        },
        body: JSON.stringify({
          leaveType: 'CASUAL',
          startDate: '2026-01-05', // past date
          endDate: '2026-01-08',
          reason: 'Past trip',
        }),
      });

      const passed =
        resInvalidType.status === 400 &&
        resInvertedDates.status === 400 &&
        resPastDate.status === 400;

      recordResult(
        2,
        'Invalid dates and leave types are rejected with 400 Bad Request',
        passed,
        `Invalid Type Status: ${resInvalidType.status}, Inverted Dates Status: ${resInvertedDates.status}, Past Date Status: ${resPastDate.status}`
      );
    }

    // -----------------------------------------------------------
    // Test 3: Overlapping requests are rejected
    // -----------------------------------------------------------
    {
      // Emp1 already has 2026-11-02 to 2026-11-04 pending
      // Trying 2026-11-03 to 2026-11-05
      const resOverlap = await fetch(`${BASE_URL}/api/leaves`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${emp1Token}`,
        },
        body: JSON.stringify({
          leaveType: 'CASUAL',
          startDate: '2026-11-03',
          endDate: '2026-11-05',
          reason: 'Overlapping request',
        }),
      });
      const dataOverlap = await resOverlap.json();

      const passed = resOverlap.status === 409 && dataOverlap.success === false;

      recordResult(
        3,
        'Overlapping active leave request is rejected with 409 Conflict',
        passed,
        `Status: ${resOverlap.status}, Message: "${dataOverlap.message}"`
      );
    }

    // -----------------------------------------------------------
    // Test 4: Employee can only access their own leave records
    // -----------------------------------------------------------
    {
      // Emp2 creates a leave request
      const createEmp2 = await fetch(`${BASE_URL}/api/leaves`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${emp2Token}`,
        },
        body: JSON.stringify({
          leaveType: 'SICK',
          startDate: '2026-11-16',
          endDate: '2026-11-17',
          reason: 'Dental appointment',
        }),
      });
      const dataEmp2 = await createEmp2.json();
      leave2Id = dataEmp2.data?._id;

      // Emp1 tries to view Emp2's leave record by ID
      const resUnauthorizedView = await fetch(`${BASE_URL}/api/leaves/${leave2Id}`, {
        headers: { Authorization: `Bearer ${emp1Token}` },
      });

      // Emp1 views their own leave history via /me
      const resMe = await fetch(`${BASE_URL}/api/leaves/me`, {
        headers: { Authorization: `Bearer ${emp1Token}` },
      });
      const dataMe = await resMe.json();

      const passed =
        resUnauthorizedView.status === 403 &&
        resMe.status === 200 &&
        dataMe.data.every((l) => l.employee?._id?.toString() === emp1User._id.toString() || l.employee === emp1User._id.toString());

      recordResult(
        4,
        'Employee can only access their own leave records (/me and /:id restricted with 403)',
        passed,
        `Unauthorized view status: ${resUnauthorizedView.status}, /api/leaves/me count: ${dataMe.data.length}`
      );
    }

    // -----------------------------------------------------------
    // Test 5: Employee cannot approve or reject leave
    // -----------------------------------------------------------
    {
      const res = await fetch(`${BASE_URL}/api/leaves/${leave1Id}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${emp1Token}`,
        },
        body: JSON.stringify({ status: 'APPROVED', comment: 'Self approving' }),
      });
      const data = await res.json();

      const passed = res.status === 403 && data.success === false;

      recordResult(
        5,
        'Employees are forbidden from approving or rejecting leave requests (403 Forbidden)',
        passed,
        `Status: ${res.status}, Message: "${data.message}"`
      );
    }

    // -----------------------------------------------------------
    // Test 6: Manager cannot review requests outside their reporting scope
    // -----------------------------------------------------------
    {
      // Mgr1 tries to review Emp2's leave (Emp2 reports to Mgr2)
      const res = await fetch(`${BASE_URL}/api/leaves/${leave2Id}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mgr1Token}`,
        },
        body: JSON.stringify({ status: 'APPROVED', comment: 'Cross-team approval' }),
      });
      const data = await res.json();

      const passed = res.status === 403 && data.success === false;

      recordResult(
        6,
        'Manager cannot review requests outside their reporting line (403 Forbidden)',
        passed,
        `Status: ${res.status}, Message: "${data.message}"`
      );
    }

    // -----------------------------------------------------------
    // Test 7: HR can review authorized requests across the organization
    // -----------------------------------------------------------
    {
      // Mgr1 approves Emp1's leave
      const resMgr = await fetch(`${BASE_URL}/api/leaves/${leave1Id}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mgr1Token}`,
        },
        body: JSON.stringify({ status: 'APPROVED', comment: 'Approved by lead' }),
      });
      const dataMgr = await resMgr.json();

      // HR approves Emp2's leave
      const resHR = await fetch(`${BASE_URL}/api/leaves/${leave2Id}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hrToken}`,
        },
        body: JSON.stringify({ status: 'APPROVED', comment: 'Approved by HR Director' }),
      });
      const dataHR = await resHR.json();

      const passed =
        resMgr.status === 200 &&
        dataMgr.data?.status === 'APPROVED' &&
        resHR.status === 200 &&
        dataHR.data?.status === 'APPROVED';

      recordResult(
        7,
        'Manager can review direct report and HR can review organization-wide requests',
        passed,
        `Mgr review status: ${resMgr.status}, HR review status: ${resHR.status}`
      );
    }

    // -----------------------------------------------------------
    // Test 8: Users cannot approve their own leave
    // -----------------------------------------------------------
    {
      // HR submits leave for themselves
      const resHRApply = await fetch(`${BASE_URL}/api/leaves`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hrToken}`,
        },
        body: JSON.stringify({
          leaveType: 'CASUAL',
          startDate: '2026-11-23',
          endDate: '2026-11-24',
          reason: 'Personal time off',
        }),
      });
      const dataHRApply = await resHRApply.json();
      hrSelfLeaveId = dataHRApply.data?._id;

      // HR tries to approve their own request
      const resHRSelfApprove = await fetch(
        `${BASE_URL}/api/leaves/${hrSelfLeaveId}/review`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${hrToken}`,
          },
          body: JSON.stringify({ status: 'APPROVED', comment: 'Approving my own leave' }),
        }
      );
      const dataHRSelfApprove = await resHRSelfApprove.json();

      const passed =
        resHRSelfApprove.status === 403 &&
        dataHRSelfApprove.success === false &&
        dataHRSelfApprove.message.includes('Self-approval');

      recordResult(
        8,
        'Users are strictly forbidden from approving their own leave requests (403 Forbidden)',
        passed,
        `Status: ${resHRSelfApprove.status}, Message: "${dataHRSelfApprove.message}"`
      );
    }

    // -----------------------------------------------------------
    // Test 9: Duplicate reviews are rejected
    // -----------------------------------------------------------
    {
      // leave1Id is already APPROVED. Attempting to review it again:
      const res = await fetch(`${BASE_URL}/api/leaves/${leave1Id}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mgr1Token}`,
        },
        body: JSON.stringify({ status: 'REJECTED', comment: 'Second review attempt' }),
      });
      const data = await res.json();

      const passed = res.status === 409 && data.success === false;

      recordResult(
        9,
        'Duplicate reviews on non-pending requests are rejected with 409 Conflict',
        passed,
        `Status: ${res.status}, Message: "${data.message}"`
      );
    }

    // -----------------------------------------------------------
    // Test 10: Approved, rejected and cancelled requests affect balances correctly
    // -----------------------------------------------------------
    {
      // 10a: Emp1's balance after leave1Id (3 days CASUAL approved)
      const resBal1 = await fetch(`${BASE_URL}/api/leaves/balance/me`, {
        headers: { Authorization: `Bearer ${emp1Token}` },
      });
      const dataBal1 = await resBal1.json();
      const usedAfterApproval = dataBal1.data?.balances?.CASUAL?.used;

      // 10b: Cancel the approved leave
      const resCancel = await fetch(`${BASE_URL}/api/leaves/${leave1Id}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${emp1Token}` },
      });
      const dataCancel = await resCancel.json();

      // 10c: Emp1's balance after cancellation (should be refunded)
      const resBal2 = await fetch(`${BASE_URL}/api/leaves/balance/me`, {
        headers: { Authorization: `Bearer ${emp1Token}` },
      });
      const dataBal2 = await resBal2.json();
      const usedAfterCancel = dataBal2.data?.balances?.CASUAL?.used;

      // 10d: Submit another request and reject it; verify no balance is consumed
      const resNew = await fetch(`${BASE_URL}/api/leaves`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${emp1Token}`,
        },
        body: JSON.stringify({
          leaveType: 'CASUAL',
          startDate: '2026-11-30',
          endDate: '2026-12-01',
          reason: 'Short trip',
        }),
      });
      const dataNew = await resNew.json();
      const newLeaveId = dataNew.data?._id;

      // Reject it
      await fetch(`${BASE_URL}/api/leaves/${newLeaveId}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mgr1Token}`,
        },
        body: JSON.stringify({ status: 'REJECTED', comment: 'Staffing shortage' }),
      });

      const resBal3 = await fetch(`${BASE_URL}/api/leaves/balance/me`, {
        headers: { Authorization: `Bearer ${emp1Token}` },
      });
      const dataBal3 = await resBal3.json();
      const usedAfterReject = dataBal3.data?.balances?.CASUAL?.used;

      const passed =
        usedAfterApproval === 3 &&
        dataCancel.data?.status === 'CANCELLED' &&
        usedAfterCancel === 0 &&
        usedAfterReject === 0;

      recordResult(
        10,
        'Balances correctly updated on approval, refunded on cancellation, and unaffected by rejection',
        passed,
        `Used on Approval: ${usedAfterApproval}, Used on Cancel: ${usedAfterCancel}, Used on Reject: ${usedAfterReject}`
      );
    }

    // -----------------------------------------------------------
    // Test 11: Insufficient balance prevents approval
    // -----------------------------------------------------------
    {
      // Artificially set Emp1's SICK balance to 1 remaining day
      const currentYear = new Date().getFullYear();
      await LeaveBalance.updateOne(
        { employee: emp1User._id, year: currentYear },
        { $set: { 'SICK.used': 9, 'SICK.allowance': 10 } } // 1 day remaining
      );

      // Emp1 applies for 2 days SICK leave (direct DB insert to test approval-time validation)
      const excessiveLeave = await Leave.create({
        employee: emp1User._id,
        leaveType: 'SICK',
        startDate: new Date('2026-12-07'),
        endDate: new Date('2026-12-08'), // 2 working days
        days: 2,
        reason: 'Severe illness',
        status: 'PENDING',
      });

      // Manager tries to approve the excessive leave
      const resApproveExcess = await fetch(
        `${BASE_URL}/api/leaves/${excessiveLeave._id}/review`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mgr1Token}`,
          },
          body: JSON.stringify({ status: 'APPROVED', comment: 'Approved' }),
        }
      );
      const dataApproveExcess = await resApproveExcess.json();

      const passed =
        resApproveExcess.status === 409 &&
        dataApproveExcess.success === false &&
        dataApproveExcess.message.includes('Insufficient leave balance');

      recordResult(
        11,
        'Insufficient balance blocks approval with 409 Conflict',
        passed,
        `Status: ${resApproveExcess.status}, Message: "${dataApproveExcess.message}"`
      );

      await Leave.findByIdAndDelete(excessiveLeave._id);
    }

    // -----------------------------------------------------------
    // Test 12: Concurrent requests cannot overspend the balance
    // -----------------------------------------------------------
    {
      const currentYear = new Date().getFullYear();
      // Set CASUAL allowance to 4, used to 0 (4 days available)
      await LeaveBalance.updateOne(
        { employee: emp1User._id, year: currentYear },
        { $set: { 'CASUAL.used': 0, 'CASUAL.allowance': 4 } }
      );

      // Create two competing pending requests of 3 days each (3 + 3 = 6 > 4)
      const leaveA = await Leave.create({
        employee: emp1User._id,
        leaveType: 'CASUAL',
        startDate: new Date('2026-12-14'),
        endDate: new Date('2026-12-16'), // 3 working days
        days: 3,
        reason: 'Event A',
        status: 'PENDING',
      });

      const leaveB = await Leave.create({
        employee: emp1User._id,
        leaveType: 'CASUAL',
        startDate: new Date('2026-12-21'),
        endDate: new Date('2026-12-23'), // 3 working days
        days: 3,
        reason: 'Event B',
        status: 'PENDING',
      });

      // Send concurrent approval requests
      const [resA, resB] = await Promise.all([
        fetch(`${BASE_URL}/api/leaves/${leaveA._id}/review`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mgr1Token}`,
          },
          body: JSON.stringify({ status: 'APPROVED', comment: 'Concurrent review A' }),
        }),
        fetch(`${BASE_URL}/api/leaves/${leaveB._id}/review`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mgr1Token}`,
          },
          body: JSON.stringify({ status: 'APPROVED', comment: 'Concurrent review B' }),
        }),
      ]);

      const [dataA, dataB] = await Promise.all([resA.json(), resB.json()]);

      // Exactly one must succeed (200) and one must be rejected (409)
      const oneSucceeded = (resA.status === 200 && resB.status === 409) || (resA.status === 409 && resB.status === 200);

      // Check balance: used must equal 3, never 6
      const finalBalance = await LeaveBalance.findOne({
        employee: emp1User._id,
        year: currentYear,
      });

      const passed = oneSucceeded && finalBalance.CASUAL.used === 3;

      recordResult(
        12,
        'Concurrent requests cannot overspend balance (atomic single-document condition)',
        passed,
        `Req A Status: ${resA.status}, Req B Status: ${resB.status}, Final Used Balance: ${finalBalance.CASUAL.used}/4`
      );

      await Leave.deleteMany({ _id: { $in: [leaveA._id, leaveB._id] } });
    }

  } catch (err) {
    console.error('Leave test error:', err);
  } finally {
    // -----------------------------------------------------------
    // Cleanup test-created records
    // -----------------------------------------------------------
    console.log('\nCleaning up Task 4 test-created records from MongoDB...');
    const allEmails = Object.values(testEmails).map((e) => e.toLowerCase());
    const users = await User.find({ email: { $in: allEmails } }).select('_id');
    const userIds = users.map((u) => u._id);

    const deletedLeaves = await Leave.deleteMany({ employee: { $in: userIds } });
    const deletedBalances = await LeaveBalance.deleteMany({ employee: { $in: userIds } });
    const deletedUsers = await User.deleteMany({ _id: { $in: userIds } });

    console.log(
      `Cleaned up ${deletedUsers.deletedCount} users, ${deletedLeaves.deletedCount} leaves, and ${deletedBalances.deletedCount} balances.`
    );
    await mongoose.disconnect();
  }

  console.log('\n===========================================================');
  const allPassed = results.every((r) => r.passed);
  console.log(
    `Leave Test Summary: ${results.filter((r) => r.passed).length}/${results.length} PASSED`
  );
  console.log('===========================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

runLeaveTests();
