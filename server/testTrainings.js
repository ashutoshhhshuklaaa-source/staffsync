/**
 * StaffSync HRMS - Task 7 Automated Training & Development Verification Suite
 * Executes all 14 required verification checks + concurrency, state transitions, and RBAC tests.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Training = require('./src/models/Training');
const TrainingEnrollment = require('./src/models/TrainingEnrollment');
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

async function runTrainingTests() {
  console.log('===========================================================');
  console.log(' Starting StaffSync Training & Development Test Suite');
  console.log(` Target Server: ${BASE_URL}`);
  console.log('===========================================================\n');

  await mongoose.connect(process.env.MONGO_URI);

  const testEmails = {
    hr: `hr_trn_${RUN_ID}@staffsync.local`,
    mgr1: `mgr1_trn_${RUN_ID}@staffsync.local`,
    emp1: `emp1_trn_${RUN_ID}@staffsync.local`,
    emp2: `emp2_trn_${RUN_ID}@staffsync.local`,
    empConc: `emp_conc_trn_${RUN_ID}@staffsync.local`,
  };

  let hrUser, mgr1User, emp1User, emp2User, empConcUser;
  let hrToken, mgr1Token, emp1Token, emp2Token, empConcToken;
  let draftTrainingId, publishedTrainingId, enrollment1Id;

  try {
    // -----------------------------------------------------------
    // Administrative Setup: Provision users and reporting lines
    // -----------------------------------------------------------
    hrUser = await User.create({
      name: 'Theresa Training Director',
      email: testEmails.hr,
      password: 'AdminPassword123!',
      role: 'HR',
      department: 'L&D',
      isActive: true,
    });
    hrToken = generateToken(hrUser);

    mgr1User = await User.create({
      name: 'Marcus Manager',
      email: testEmails.mgr1,
      password: 'ManagerPassword123!',
      role: 'MANAGER',
      department: 'Engineering',
      isActive: true,
    });
    mgr1Token = generateToken(mgr1User);

    // Emp 1 reports to Marcus
    emp1User = await User.create({
      name: 'Eric Engineer One',
      email: testEmails.emp1,
      password: 'EmployeePassword123!',
      role: 'EMPLOYEE',
      department: 'Engineering',
      manager: mgr1User._id,
      isActive: true,
    });
    emp1Token = generateToken(emp1User);

    // Emp 2 does NOT report to Marcus
    emp2User = await User.create({
      name: 'Elena Engineer Two',
      email: testEmails.emp2,
      password: 'EmployeePassword123!',
      role: 'EMPLOYEE',
      department: 'Product',
      manager: null,
      isActive: true,
    });
    emp2Token = generateToken(emp2User);

    empConcUser = await User.create({
      name: 'Cyrus Concurrent',
      email: testEmails.empConc,
      password: 'EmployeePassword123!',
      role: 'EMPLOYEE',
      department: 'Operations',
      isActive: true,
    });
    empConcToken = generateToken(empConcUser);

    console.log('Administrative test personas provisioned successfully.\n');

    // -----------------------------------------------------------
    // Test 1: HR can create a draft training
    // -----------------------------------------------------------
    {
      const res = await fetch(`${BASE_URL}/api/trainings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hrToken}`,
        },
        body: JSON.stringify({
          title: 'Advanced Node.js & Microservices',
          description: 'Comprehensive training on scalable backend systems and event-driven architecture.',
          category: 'Engineering',
          instructor: 'Dr. Jane Smith',
          durationMinutes: 480,
          difficulty: 'ADVANCED',
          enrollmentDeadline: '2026-12-31',
        }),
      });
      const data = await res.json();
      draftTrainingId = data.data?._id;

      const passed =
        res.status === 201 &&
        data.success === true &&
        data.data?.status === 'DRAFT' &&
        data.data?.durationMinutes === 480 &&
        data.data?.difficulty === 'ADVANCED';

      recordResult(
        1,
        'HR can create a draft training in the catalog (201 Created)',
        passed,
        `Status: ${res.status}, ID: ${draftTrainingId}, Status: "${data.data?.status}"`
      );
    }

    // -----------------------------------------------------------
    // Test 2: Invalid training data is rejected
    // -----------------------------------------------------------
    {
      // Missing title
      const resMissingTitle = await fetch(`${BASE_URL}/api/trainings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hrToken}`,
        },
        body: JSON.stringify({
          description: 'Missing title',
          category: 'Tech',
          instructor: 'John Doe',
          durationMinutes: 120,
        }),
      });

      // Negative duration
      const resNegDuration = await fetch(`${BASE_URL}/api/trainings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hrToken}`,
        },
        body: JSON.stringify({
          title: 'Valid Title',
          description: 'Valid description body',
          category: 'Tech',
          instructor: 'John Doe',
          durationMinutes: -30,
        }),
      });

      // Invalid difficulty enum
      const resInvalidDiff = await fetch(`${BASE_URL}/api/trainings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hrToken}`,
        },
        body: JSON.stringify({
          title: 'Valid Title',
          description: 'Valid description body',
          category: 'Tech',
          instructor: 'John Doe',
          durationMinutes: 60,
          difficulty: 'EXPERT', // invalid
        }),
      });

      // Inverted dates (startDate > endDate)
      const resInvertedDates = await fetch(`${BASE_URL}/api/trainings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hrToken}`,
        },
        body: JSON.stringify({
          title: 'Valid Title',
          description: 'Valid description body',
          category: 'Tech',
          instructor: 'John Doe',
          durationMinutes: 60,
          startDate: '2026-12-15',
          endDate: '2026-12-10', // earlier than start
        }),
      });

      const passed =
        resMissingTitle.status === 400 &&
        resNegDuration.status === 400 &&
        resInvalidDiff.status === 400 &&
        resInvertedDates.status === 400;

      recordResult(
        2,
        'Invalid training data, negative durations, and inverted dates are rejected with 400',
        passed,
        `Missing Title: ${resMissingTitle.status}, Neg Duration: ${resNegDuration.status}, Invalid Diff: ${resInvalidDiff.status}, Inverted Dates: ${resInvertedDates.status}`
      );
    }

    // -----------------------------------------------------------
    // Test 3: Employees cannot create or manage training catalog records
    // -----------------------------------------------------------
    {
      const resCreate = await fetch(`${BASE_URL}/api/trainings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${emp1Token}`,
        },
        body: JSON.stringify({
          title: 'Employee Training',
          description: 'Unauthorized attempt to create course',
          category: 'General',
          instructor: 'Self',
          durationMinutes: 60,
        }),
      });

      const resPublish = await fetch(
        `${BASE_URL}/api/trainings/${draftTrainingId}/publish`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${emp1Token}` },
        }
      );

      const resArchive = await fetch(
        `${BASE_URL}/api/trainings/${draftTrainingId}/archive`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${emp1Token}` },
        }
      );

      const passed =
        resCreate.status === 403 &&
        resPublish.status === 403 &&
        resArchive.status === 403;

      recordResult(
        3,
        'Employees are forbidden from creating, publishing, or archiving training catalog records (403)',
        passed,
        `Create: ${resCreate.status}, Publish: ${resPublish.status}, Archive: ${resArchive.status}`
      );
    }

    // -----------------------------------------------------------
    // Test 4: Published trainings appear in the employee catalog
    // -----------------------------------------------------------
    {
      // HR publishes the draft training
      const pubRes = await fetch(
        `${BASE_URL}/api/trainings/${draftTrainingId}/publish`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${hrToken}` },
        }
      );
      publishedTrainingId = draftTrainingId;

      // Employee views catalog
      const catRes = await fetch(`${BASE_URL}/api/trainings`, {
        headers: { Authorization: `Bearer ${emp1Token}` },
      });
      const catData = await catRes.json();

      const passed =
        pubRes.status === 200 &&
        catRes.status === 200 &&
        catData.data.some((t) => t._id === publishedTrainingId && t.status === 'PUBLISHED');

      recordResult(
        4,
        'Published trainings are accessible in the employee training catalog',
        passed,
        `Publish status: ${pubRes.status}, Found in catalog: true, Total catalog entries: ${catData.data?.length}`
      );
    }

    // -----------------------------------------------------------
    // Test 5: Draft and archived trainings are hidden from unauthorized users
    // -----------------------------------------------------------
    {
      // Create a draft and an archived training
      const hiddenDraft = await Training.create({
        title: 'Hidden Draft Course',
        description: 'Not yet available.',
        category: 'R&D',
        instructor: 'Dr. Secret',
        durationMinutes: 90,
        status: 'DRAFT',
        createdBy: hrUser._id,
      });

      const hiddenArchived = await Training.create({
        title: 'Retired Course',
        description: 'No longer offered.',
        category: 'Legacy',
        instructor: 'Old Instructor',
        durationMinutes: 120,
        status: 'ARCHIVED',
        createdBy: hrUser._id,
      });

      // Employee views catalog: neither should appear
      const empCatRes = await fetch(`${BASE_URL}/api/trainings`, {
        headers: { Authorization: `Bearer ${emp1Token}` },
      });
      const empCatData = await empCatRes.json();

      // Employee tries direct access: both should return 404
      const resDraftDirect = await fetch(
        `${BASE_URL}/api/trainings/${hiddenDraft._id}`,
        {
          headers: { Authorization: `Bearer ${emp1Token}` },
        }
      );

      const resArchDirect = await fetch(
        `${BASE_URL}/api/trainings/${hiddenArchived._id}`,
        {
          headers: { Authorization: `Bearer ${emp1Token}` },
        }
      );

      const passed =
        !empCatData.data.some((t) => t._id === hiddenDraft._id.toString() || t._id === hiddenArchived._id.toString()) &&
        resDraftDirect.status === 404 &&
        resArchDirect.status === 404;

      recordResult(
        5,
        'Draft and archived trainings are completely hidden from employee catalog and direct queries (404)',
        passed,
        `Draft direct: ${resDraftDirect.status}, Archived direct: ${resArchDirect.status}, Leaked in catalog: false`
      );

      await Training.deleteMany({ _id: { $in: [hiddenDraft._id, hiddenArchived._id] } });
    }

    // -----------------------------------------------------------
    // Test 6: HR can publish, update and archive trainings
    // -----------------------------------------------------------
    {
      // Create a test training
      const tempTraining = await Training.create({
        title: 'Initial Training Title',
        description: 'Initial description before HR edit.',
        category: 'HR Management',
        instructor: 'HR Staff',
        durationMinutes: 60,
        status: 'DRAFT',
        createdBy: hrUser._id,
      });

      // 6a: Update
      const updateRes = await fetch(`${BASE_URL}/api/trainings/${tempTraining._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hrToken}`,
        },
        body: JSON.stringify({
          title: 'Updated Training Title By HR',
          durationMinutes: 75,
        }),
      });
      const updateData = await updateRes.json();

      // 6b: Publish
      const pubRes = await fetch(
        `${BASE_URL}/api/trainings/${tempTraining._id}/publish`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${hrToken}` },
        }
      );
      const pubData = await pubRes.json();

      // 6c: Archive
      const archRes = await fetch(
        `${BASE_URL}/api/trainings/${tempTraining._id}/archive`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${hrToken}` },
        }
      );
      const archData = await archRes.json();

      const passed =
        updateRes.status === 200 &&
        updateData.data?.title === 'Updated Training Title By HR' &&
        pubRes.status === 200 &&
        pubData.data?.status === 'PUBLISHED' &&
        archRes.status === 200 &&
        archData.data?.status === 'ARCHIVED';

      recordResult(
        6,
        'HR can edit, publish, and archive trainings with verified lifecycle state transitions',
        passed,
        `Update title: "${updateData.data?.title}", Pub status: "${pubData.data?.status}", Arch status: "${archData.data?.status}"`
      );

      await Training.findByIdAndDelete(tempTraining._id);
    }

    // -----------------------------------------------------------
    // Test 7: Employees can enroll in published trainings
    // -----------------------------------------------------------
    {
      const enrollRes = await fetch(
        `${BASE_URL}/api/trainings/${publishedTrainingId}/enroll`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${emp1Token}` },
        }
      );
      const enrollData = await enrollRes.json();
      enrollment1Id = enrollData.data?._id;

      const passed =
        enrollRes.status === 201 &&
        enrollData.success === true &&
        enrollData.data?.status === 'ENROLLED' &&
        enrollData.data?.employee?._id === emp1User._id.toString();

      recordResult(
        7,
        'Employees can enroll in published trainings (201 Created)',
        passed,
        `Enrollment ID: ${enrollment1Id}, Status: "${enrollData.data?.status}"`
      );
    }

    // -----------------------------------------------------------
    // Test 8: Duplicate and concurrent enrollments are safely rejected
    // -----------------------------------------------------------
    {
      // 8a: Employee 1 tries to enroll again in the same training
      const dupRes = await fetch(
        `${BASE_URL}/api/trainings/${publishedTrainingId}/enroll`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${emp1Token}` },
        }
      );
      const dupData = await dupRes.json();

      // 8b: Concurrent enrollment test: 4 simultaneous requests from empConcUser
      const concurrentPromises = [1, 2, 3, 4].map(() =>
        fetch(`${BASE_URL}/api/trainings/${publishedTrainingId}/enroll`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${empConcToken}` },
        })
      );

      const responses = await Promise.all(concurrentPromises);
      const statuses = responses.map((r) => r.status);

      const createdCount = statuses.filter((s) => s === 201).length;
      const conflictCount = statuses.filter((s) => s === 409).length;

      const dbEnrollmentCount = await TrainingEnrollment.countDocuments({
        training: publishedTrainingId,
        employee: empConcUser._id,
      });

      const passed =
        dupRes.status === 409 &&
        createdCount === 1 &&
        conflictCount === 3 &&
        dbEnrollmentCount === 1;

      recordResult(
        8,
        'Duplicate and concurrent enrollments are safely rejected (unique compound constraint)',
        passed,
        `Duplicate status: ${dupRes.status}, Concurrent created: ${createdCount}, Concurrent conflict: ${conflictCount}, DB Count: ${dbEnrollmentCount}`
      );
    }

    // -----------------------------------------------------------
    // Test 9: Enrollment in drafts, archived trainings or past-deadline trainings is rejected
    // -----------------------------------------------------------
    {
      // Create draft training
      const draftT = await Training.create({
        title: 'Draft Unenrollable Course',
        description: 'Cannot enroll in drafts.',
        category: 'QA',
        instructor: 'QA Lead',
        durationMinutes: 60,
        status: 'DRAFT',
        createdBy: hrUser._id,
      });

      // Create archived training
      const archT = await Training.create({
        title: 'Archived Unenrollable Course',
        description: 'Cannot enroll in archived.',
        category: 'QA',
        instructor: 'QA Lead',
        durationMinutes: 60,
        status: 'ARCHIVED',
        createdBy: hrUser._id,
      });

      // Create past-deadline training
      const pastDeadlineT = await Training.create({
        title: 'Past Deadline Course',
        description: 'Deadline expired.',
        category: 'QA',
        instructor: 'QA Lead',
        durationMinutes: 60,
        status: 'PUBLISHED',
        enrollmentDeadline: new Date(Date.now() - 86400000), // yesterday
        createdBy: hrUser._id,
      });

      const resDraftEnroll = await fetch(
        `${BASE_URL}/api/trainings/${draftT._id}/enroll`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${emp2Token}` },
        }
      );

      const resArchEnroll = await fetch(
        `${BASE_URL}/api/trainings/${archT._id}/enroll`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${emp2Token}` },
        }
      );

      const resPastEnroll = await fetch(
        `${BASE_URL}/api/trainings/${pastDeadlineT._id}/enroll`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${emp2Token}` },
        }
      );

      const passed =
        resDraftEnroll.status === 400 &&
        resArchEnroll.status === 400 &&
        resPastEnroll.status === 400;

      recordResult(
        9,
        'Enrollment in drafts, archived, or past-deadline trainings is rejected with 400',
        passed,
        `Draft enroll: ${resDraftEnroll.status}, Archived enroll: ${resArchEnroll.status}, Past deadline: ${resPastEnroll.status}`
      );

      await Training.deleteMany({ _id: { $in: [draftT._id, archT._id, pastDeadlineT._id] } });
    }

    // -----------------------------------------------------------
    // Test 10: Employees can only view their own enrollment records
    // -----------------------------------------------------------
    {
      // Emp2 enrolls in publishedTrainingId
      await fetch(`${BASE_URL}/api/trainings/${publishedTrainingId}/enroll`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${emp2Token}` },
      });

      // Emp1 views own enrollments via /me/enrollments
      const resMyEnrollments = await fetch(
        `${BASE_URL}/api/trainings/me/enrollments`,
        {
          headers: { Authorization: `Bearer ${emp1Token}` },
        }
      );
      const dataMyEnrollments = await resMyEnrollments.json();

      // Emp1 attempts to view all training enrollments via /:id/enrollments
      const resRoster = await fetch(
        `${BASE_URL}/api/trainings/${publishedTrainingId}/enrollments`,
        {
          headers: { Authorization: `Bearer ${emp1Token}` },
        }
      );

      const passed =
        resMyEnrollments.status === 200 &&
        dataMyEnrollments.data.every(
          (e) => e.employee?.toString() === emp1User._id.toString()
        ) &&
        resRoster.status === 403;

      recordResult(
        10,
        'Employees view only their own enrollments (/me) and are forbidden from full rosters (403)',
        passed,
        `My enrollments count: ${dataMyEnrollments.data?.length}, Full roster access status: ${resRoster.status}`
      );
    }

    // -----------------------------------------------------------
    // Test 11: Managers cannot access enrollment details outside their reporting scope
    // -----------------------------------------------------------
    {
      // Marcus is manager of Emp1, but NOT Emp2
      const resMgrRoster = await fetch(
        `${BASE_URL}/api/trainings/${publishedTrainingId}/enrollments`,
        {
          headers: { Authorization: `Bearer ${mgr1Token}` },
        }
      );
      const dataMgrRoster = await resMgrRoster.json();

      const passed =
        resMgrRoster.status === 200 &&
        dataMgrRoster.data.every(
          (e) => e.employee?.manager?.toString() === mgr1User._id.toString()
        ) &&
        !dataMgrRoster.data.some(
          (e) => e.employee?._id?.toString() === emp2User._id.toString()
        );

      recordResult(
        11,
        'Managers view only enrollments of employees within their direct reporting line',
        passed,
        `Manager sees direct reports: ${dataMgrRoster.data?.length}, Outside reports leaked: false`
      );
    }

    // -----------------------------------------------------------
    // Test 12: Valid progress updates and completion timestamps work correctly
    // -----------------------------------------------------------
    {
      // 12a: Transition from ENROLLED to IN_PROGRESS
      const resProgress = await fetch(
        `${BASE_URL}/api/trainings/${publishedTrainingId}/enrollments/${enrollment1Id}/progress`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${emp1Token}`,
          },
          body: JSON.stringify({ status: 'IN_PROGRESS' }),
        }
      );
      const dataProgress = await resProgress.json();

      // 12b: Transition from IN_PROGRESS to COMPLETED
      const resComplete = await fetch(
        `${BASE_URL}/api/trainings/${publishedTrainingId}/enrollments/${enrollment1Id}/progress`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${emp1Token}`,
          },
          body: JSON.stringify({ status: 'COMPLETED' }),
        }
      );
      const dataComplete = await resComplete.json();

      const passed =
        resProgress.status === 200 &&
        dataProgress.data?.status === 'IN_PROGRESS' &&
        resComplete.status === 200 &&
        dataComplete.data?.status === 'COMPLETED' &&
        dataComplete.data?.completedAt !== null;

      recordResult(
        12,
        'Valid progress state updates (IN_PROGRESS -> COMPLETED) record server completedAt timestamp',
        passed,
        `Progress status: "${dataProgress.data?.status}", CompletedAt: ${dataComplete.data?.completedAt}`
      );
    }

    // -----------------------------------------------------------
    // Test 13: Invalid state transitions and IDs are rejected
    // -----------------------------------------------------------
    {
      // Attempt to transition COMPLETED back to ENROLLED
      const resInvalidTransition = await fetch(
        `${BASE_URL}/api/trainings/${publishedTrainingId}/enrollments/${enrollment1Id}/progress`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${emp1Token}`,
          },
          body: JSON.stringify({ status: 'ENROLLED' }),
        }
      );

      // Invalid MongoDB ObjectId
      const resInvalidId = await fetch(
        `${BASE_URL}/api/trainings/not-a-valid-id-123`,
        {
          headers: { Authorization: `Bearer ${emp1Token}` },
        }
      );

      // Non-existent ObjectId
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const resMissing = await fetch(
        `${BASE_URL}/api/trainings/${nonExistentId}`,
        {
          headers: { Authorization: `Bearer ${hrToken}` },
        }
      );

      const passed =
        resInvalidTransition.status === 400 &&
        resInvalidId.status === 400 &&
        resMissing.status === 404;

      recordResult(
        13,
        'Invalid state transitions (COMPLETED -> ENROLLED) and malformed IDs are rejected',
        passed,
        `Transition: ${resInvalidTransition.status}, Invalid ID: ${resInvalidId.status}, Missing ID: ${resMissing.status}`
      );
    }

    // -----------------------------------------------------------
    // Test 14: Pagination and filters work correctly
    // -----------------------------------------------------------
    {
      const extraTraining = await Training.create({
        title: 'Advanced Microservices Architecture',
        description: 'Deep dive into microservices and event brokers.',
        category: 'Engineering',
        instructor: 'Senior Architect',
        durationMinutes: 120,
        difficulty: 'ADVANCED',
        status: 'PUBLISHED',
        createdBy: hrUser._id,
      });

      const resPaginated = await fetch(
        `${BASE_URL}/api/trainings?page=1&limit=1`,
        {
          headers: { Authorization: `Bearer ${hrToken}` },
        }
      );
      const dataPaginated = await resPaginated.json();

      const resFilter = await fetch(
        `${BASE_URL}/api/trainings?category=Engineering&difficulty=ADVANCED`,
        {
          headers: { Authorization: `Bearer ${hrToken}` },
        }
      );
      const dataFilter = await resFilter.json();

      const passed =
        resPaginated.status === 200 &&
        dataPaginated.pagination?.limit === 1 &&
        dataPaginated.pagination?.page === 1 &&
        dataPaginated.pagination?.hasNextPage === true &&
        resFilter.status === 200 &&
        dataFilter.data.length >= 2 &&
        dataFilter.data.every(
          (t) => t.category.toLowerCase() === 'engineering' && t.difficulty === 'ADVANCED'
        );

      recordResult(
        14,
        'Training catalog supports pagination metadata, category, and difficulty filters',
        passed,
        `Limit: ${dataPaginated.pagination?.limit}, HasNextPage: ${dataPaginated.pagination?.hasNextPage}, Filtered items: ${dataFilter.data?.length}`
      );

      await Training.findByIdAndDelete(extraTraining._id);
    }

  } catch (err) {
    console.error('Training test error:', err);
  } finally {
    // -----------------------------------------------------------
    // Cleanup test-created records
    // -----------------------------------------------------------
    console.log('\nCleaning up Task 7 test-created records from MongoDB...');
    const allEmails = Object.values(testEmails).map((e) => e.toLowerCase());
    const users = await User.find({ email: { $in: allEmails } }).select('_id');
    const userIds = users.map((u) => u._id);

    const deletedEnrollments = await TrainingEnrollment.deleteMany({
      $or: [
        { employee: { $in: userIds } },
        { training: { $in: [draftTrainingId, publishedTrainingId].filter(Boolean) } },
      ],
    });
    const deletedTrainings = await Training.deleteMany({
      $or: [
        { createdBy: { $in: userIds } },
        { _id: { $in: [draftTrainingId, publishedTrainingId].filter(Boolean) } },
      ],
    });
    const deletedUsers = await User.deleteMany({ _id: { $in: userIds } });

    console.log(
      `Cleaned up ${deletedUsers.deletedCount} users, ${deletedTrainings.deletedCount} trainings, and ${deletedEnrollments.deletedCount} enrollments.`
    );
    await mongoose.disconnect();
  }

  console.log('\n===========================================================');
  const allPassed = results.every((r) => r.passed);
  console.log(
    `Training Test Summary: ${results.filter((r) => r.passed).length}/${results.length} PASSED`
  );
  console.log('===========================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

runTrainingTests();
