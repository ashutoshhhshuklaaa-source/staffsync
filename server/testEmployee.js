/**
 * StaffSync HRMS - Task 3 Automated Employee Management Verification Suite
 * Verifies all 7 required core checks + RBAC manager scoping and safety constraints.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./src/models/User');
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

async function runEmployeeTests() {
  console.log('===========================================================');
  console.log(' Starting StaffSync Employee Management & RBAC Test Suite');
  console.log(` Target Server: ${BASE_URL}`);
  console.log('===========================================================\n');

  // Connect to DB for trusted administrative test setup & cleanup
  await mongoose.connect(process.env.MONGO_URI);

  const testEmails = {
    hr: `hr_admin_${RUN_ID}@staffsync.local`,
    manager: `manager_${RUN_ID}@staffsync.local`,
    employee: `emp_${RUN_ID}@staffsync.local`,
    newEmployee: `new_emp_${RUN_ID}@staffsync.local`,
  };

  let hrToken, managerToken, employeeToken;
  let hrUser, managerUser, employeeUser, createdEmployeeId;

  try {
    // -----------------------------------------------------------
    // Administrative Setup: Create trusted HR and Manager accounts
    // (As required: HR/Manager accounts are created via administrative process, not public registration)
    // -----------------------------------------------------------
    hrUser = await User.create({
      name: 'Alice HR Director',
      email: testEmails.hr,
      password: 'AdminPassword123!',
      role: 'HR',
      department: 'Human Resources',
      designation: 'HR Director',
      isActive: true,
    });
    hrToken = generateToken(hrUser);

    managerUser = await User.create({
      name: 'Bob Engineering Manager',
      email: testEmails.manager,
      password: 'ManagerPassword123!',
      role: 'MANAGER',
      department: 'Engineering',
      designation: 'Engineering Lead',
      isActive: true,
    });
    managerToken = generateToken(managerUser);

    employeeUser = await User.create({
      name: 'Charlie Staff Developer',
      email: testEmails.employee,
      password: 'EmployeePassword123!',
      role: 'EMPLOYEE',
      department: 'Engineering',
      designation: 'Junior Developer',
      manager: managerUser._id, // Charlie reports to Bob
      isActive: true,
    });
    employeeToken = generateToken(employeeUser);

    console.log('Administrative test personas provisioned successfully.\n');

    // -----------------------------------------------------------
    // Test 1: HR can list and create employees
    // -----------------------------------------------------------
    {
      // 1a: Create employee
      const createRes = await fetch(`${BASE_URL}/api/employees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hrToken}`,
        },
        body: JSON.stringify({
          name: 'Diana Prince',
          email: testEmails.newEmployee,
          department: 'Design',
          designation: 'UI/UX Designer',
          joiningDate: '2026-01-15',
          phone: '+1-555-0199',
          role: 'EMPLOYEE',
          manager: managerUser._id.toString(),
        }),
      });
      const createData = await createRes.json();
      createdEmployeeId = createData.data?._id;

      // 1b: List employees as HR
      const listRes = await fetch(`${BASE_URL}/api/employees`, {
        headers: { Authorization: `Bearer ${hrToken}` },
      });
      const listData = await listRes.json();

      const passed =
        createRes.status === 201 &&
        createData.success === true &&
        createData.data?.name === 'Diana Prince' &&
        listRes.status === 200 &&
        Array.isArray(listData.data) &&
        listData.data.length > 0;

      recordResult(
        1,
        'HR can create (201) and list (200) employees',
        passed,
        `Created ID: ${createdEmployeeId}, Total listed: ${listData.pagination?.total}`
      );
    }

    // -----------------------------------------------------------
    // Test 2: HR can update employee details and deactivate an employee
    // -----------------------------------------------------------
    {
      // 2a: Update details
      const updateRes = await fetch(`${BASE_URL}/api/employees/${createdEmployeeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hrToken}`,
        },
        body: JSON.stringify({
          designation: 'Senior Product Designer',
          phone: '+1-555-0999',
        }),
      });
      const updateData = await updateRes.json();

      // 2b: Deactivate employee status
      const statusRes = await fetch(
        `${BASE_URL}/api/employees/${createdEmployeeId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${hrToken}`,
          },
          body: JSON.stringify({ isActive: false }),
        }
      );
      const statusData = await statusRes.json();

      const passed =
        updateRes.status === 200 &&
        updateData.data?.designation === 'Senior Product Designer' &&
        updateData.data?.phone === '+1-555-0999' &&
        statusRes.status === 200 &&
        statusData.data?.isActive === false;

      recordResult(
        2,
        'HR can update employee details and deactivate employee status',
        passed,
        `Updated Designation: "${updateData.data?.designation}", Active Status: ${statusData.data?.isActive}`
      );
    }

    // -----------------------------------------------------------
    // Test 3: Employee listing supports pagination and search
    // -----------------------------------------------------------
    {
      // Search by name
      const searchRes = await fetch(
        `${BASE_URL}/api/employees?search=Diana&limit=5&page=1`,
        {
          headers: { Authorization: `Bearer ${hrToken}` },
        }
      );
      const searchData = await searchRes.json();

      // Filter by department
      const deptRes = await fetch(
        `${BASE_URL}/api/employees?department=Design`,
        {
          headers: { Authorization: `Bearer ${hrToken}` },
        }
      );
      const deptData = await deptRes.json();

      const passed =
        searchRes.status === 200 &&
        searchData.pagination?.limit === 5 &&
        searchData.pagination?.page === 1 &&
        searchData.data.some((e) => e.email === testEmails.newEmployee.toLowerCase()) &&
        deptRes.status === 200 &&
        deptData.data.every((e) => e.department.toLowerCase() === 'design');

      recordResult(
        3,
        'Employee listing supports pagination metadata and search/filter queries',
        passed,
        `Search matched: ${searchData.data.length}, Pagination metadata present: ${!!searchData.pagination}`
      );
    }

    // -----------------------------------------------------------
    // Test 4: Invalid employee IDs return 400
    // -----------------------------------------------------------
    {
      const invalidIdRes = await fetch(
        `${BASE_URL}/api/employees/invalid-mongo-id-123`,
        {
          headers: { Authorization: `Bearer ${hrToken}` },
        }
      );
      const invalidIdData = await invalidIdRes.json();

      const invalidStatusRes = await fetch(
        `${BASE_URL}/api/employees/123456/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${hrToken}`,
          },
          body: JSON.stringify({ isActive: true }),
        }
      );
      const invalidStatusData = await invalidStatusRes.json();

      const passed =
        invalidIdRes.status === 400 &&
        invalidIdData.success === false &&
        invalidStatusRes.status === 400 &&
        invalidStatusData.success === false;

      recordResult(
        4,
        'Invalid employee ID format returns 400 Bad Request before DB query',
        passed,
        `GET invalid ID status: ${invalidIdRes.status}, PATCH status with invalid ID: ${invalidStatusRes.status}`
      );
    }

    // -----------------------------------------------------------
    // Test 5: Missing employees return 404
    // -----------------------------------------------------------
    {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const notFoundRes = await fetch(
        `${BASE_URL}/api/employees/${nonExistentId}`,
        {
          headers: { Authorization: `Bearer ${hrToken}` },
        }
      );
      const notFoundData = await notFoundRes.json();

      const passed = notFoundRes.status === 404 && notFoundData.success === false;

      recordResult(
        5,
        'Non-existent employee ID returns 404 Not Found',
        passed,
        `Status: ${notFoundRes.status}, Message: "${notFoundData.message}"`
      );
    }

    // -----------------------------------------------------------
    // Test 6: Duplicate email addresses are rejected
    // -----------------------------------------------------------
    {
      const dupRes = await fetch(`${BASE_URL}/api/employees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hrToken}`,
        },
        body: JSON.stringify({
          name: 'Imposter Diana',
          email: testEmails.newEmployee, // Duplicate email
          department: 'Design',
        }),
      });
      const dupData = await dupRes.json();

      const passed = dupRes.status === 409 && dupData.success === false;

      recordResult(
        6,
        'Duplicate email address creation is rejected with 409 Conflict',
        passed,
        `Status: ${dupRes.status}, Message: "${dupData.message}"`
      );
    }

    // -----------------------------------------------------------
    // Test 7: Employees cannot access HR-only operations
    // -----------------------------------------------------------
    {
      // 7a: Employee attempting to create an employee
      const empCreateRes = await fetch(`${BASE_URL}/api/employees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${employeeToken}`,
        },
        body: JSON.stringify({
          name: 'Unauthorized Create',
          email: 'unauth@staffsync.local',
        }),
      });

      // 7b: Employee attempting to list all employees
      const empListRes = await fetch(`${BASE_URL}/api/employees`, {
        headers: { Authorization: `Bearer ${employeeToken}` },
      });

      // 7c: Employee attempting to deactivate another employee
      const empStatusRes = await fetch(
        `${BASE_URL}/api/employees/${createdEmployeeId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${employeeToken}`,
          },
          body: JSON.stringify({ isActive: false }),
        }
      );

      // 7d: Employee attempting to modify restricted fields on their own profile
      const empEscalateRes = await fetch(
        `${BASE_URL}/api/employees/${employeeUser._id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${employeeToken}`,
          },
          body: JSON.stringify({ role: 'HR', department: 'Executive' }),
        }
      );

      const passed =
        empCreateRes.status === 403 &&
        empListRes.status === 403 &&
        empStatusRes.status === 403 &&
        empEscalateRes.status === 403;

      recordResult(
        7,
        'Employees are forbidden from HR operations & restricted field modifications (403)',
        passed,
        `Create: ${empCreateRes.status}, List: ${empListRes.status}, Status Update: ${empStatusRes.status}, Role Escalation: ${empEscalateRes.status}`
      );
    }

    // -----------------------------------------------------------
    // Test 8: Manager reporting-scope restriction
    // -----------------------------------------------------------
    {
      // Manager lists employees -> should only see employees reporting to them
      const mgrListRes = await fetch(`${BASE_URL}/api/employees`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      const mgrListData = await mgrListRes.json();

      // Manager tries to view an employee outside their reporting scope
      const unmanagedUser = await User.create({
        name: 'Outside Scope Employee',
        email: `outside_${RUN_ID}@staffsync.local`,
        password: 'Password123!',
        role: 'EMPLOYEE',
        manager: null, // Not managed by Bob
      });

      const outsideRes = await fetch(
        `${BASE_URL}/api/employees/${unmanagedUser._id}`,
        {
          headers: { Authorization: `Bearer ${managerToken}` },
        }
      );

      const passed =
        mgrListRes.status === 200 &&
        mgrListData.data.every(
          (e) => e.manager && e.manager._id.toString() === managerUser._id.toString()
        ) &&
        outsideRes.status === 403;

      recordResult(
        8,
        'Manager can only view employees in their authorized reporting scope',
        passed,
        `Manager sees only their reports: ${mgrListData.data.length} employees, Outside scope status: ${outsideRes.status}`
      );

      await User.findByIdAndDelete(unmanagedUser._id);
    }

    // -----------------------------------------------------------
    // Test 9: Employee self-service via /api/employees/me
    // -----------------------------------------------------------
    {
      const meRes = await fetch(`${BASE_URL}/api/employees/me`, {
        headers: { Authorization: `Bearer ${employeeToken}` },
      });
      const meData = await meRes.json();

      const passed =
        meRes.status === 200 &&
        meData.success === true &&
        meData.data?._id === employeeUser._id.toString() &&
        meData.data?.email === employeeUser.email &&
        !meData.data?.password;

      recordResult(
        9,
        'GET /api/employees/me returns authenticated employee profile securely',
        passed,
        `Retrieved: ${meData.data?.name} (${meData.data?.email}), Password hidden: ${!meData.data?.password}`
      );
    }

  } catch (err) {
    console.error('Test execution failed with error:', err);
  } finally {
    // -----------------------------------------------------------
    // Clean up test records
    // -----------------------------------------------------------
    console.log('\nCleaning up Task 3 test-created records from MongoDB...');
    const allTestEmails = Object.values(testEmails).map((e) => e.toLowerCase());
    const deleteResult = await User.deleteMany({
      email: { $in: allTestEmails },
    });
    console.log(`Cleaned up ${deleteResult.deletedCount} test employee records.`);
    await mongoose.disconnect();
  }

  console.log('\n===========================================================');
  const allPassed = results.every((r) => r.passed);
  console.log(`Employee Test Summary: ${results.filter((r) => r.passed).length}/${results.length} PASSED`);
  console.log('===========================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

runEmployeeTests();
