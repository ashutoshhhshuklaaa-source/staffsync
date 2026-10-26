/**
 * StaffSync HRMS - Task 6 Automated Announcements Management Verification Suite
 * Executes all 11 required verification checks + role scoping, expiration, and audit tests.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Announcement = require('./src/models/Announcement');
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

async function runAnnouncementTests() {
  console.log('===========================================================');
  console.log(' Starting StaffSync Announcements Management Test Suite');
  console.log(` Target Server: ${BASE_URL}`);
  console.log('===========================================================\n');

  await mongoose.connect(process.env.MONGO_URI);

  const testEmails = {
    hr: `hr_ann_${RUN_ID}@staffsync.local`,
    mgr: `mgr_ann_${RUN_ID}@staffsync.local`,
    emp: `emp_ann_${RUN_ID}@staffsync.local`,
  };

  let hrUser, mgrUser, empUser;
  let hrToken, mgrToken, empToken;
  let draftId, publishedAllId, managerOnlyId, expiredId;

  try {
    // -----------------------------------------------------------
    // Administrative Setup: Provision users
    // -----------------------------------------------------------
    hrUser = await User.create({
      name: 'Helen HR Lead',
      email: testEmails.hr,
      password: 'AdminPassword123!',
      role: 'HR',
      department: 'HR',
      isActive: true,
    });
    hrToken = generateToken(hrUser);

    mgrUser = await User.create({
      name: 'Morgan Manager',
      email: testEmails.mgr,
      password: 'ManagerPassword123!',
      role: 'MANAGER',
      department: 'Engineering',
      isActive: true,
    });
    mgrToken = generateToken(mgrUser);

    empUser = await User.create({
      name: 'Eli Employee',
      email: testEmails.emp,
      password: 'EmployeePassword123!',
      role: 'EMPLOYEE',
      department: 'Engineering',
      isActive: true,
    });
    empToken = generateToken(empUser);

    console.log('Administrative test personas provisioned successfully.\n');

    // -----------------------------------------------------------
    // Test 1: HR can create a draft
    // -----------------------------------------------------------
    {
      const res = await fetch(`${BASE_URL}/api/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hrToken}`,
        },
        body: JSON.stringify({
          title: 'Annual Company Retreat 2026',
          content: 'We are thrilled to announce our upcoming annual company retreat in the mountains!',
          audience: 'ALL',
        }),
      });
      const data = await res.json();
      draftId = data.data?._id;

      const passed =
        res.status === 201 &&
        data.success === true &&
        data.data?.status === 'DRAFT' &&
        data.data?.publishedAt === null &&
        data.data?.audience === 'ALL';

      recordResult(
        1,
        'HR can create a draft announcement (201 Created)',
        passed,
        `Status: ${res.status}, ID: ${draftId}, Status: "${data.data?.status}"`
      );
    }

    // -----------------------------------------------------------
    // Test 2: Invalid or missing fields are rejected
    // -----------------------------------------------------------
    {
      // Missing title
      const resMissingTitle = await fetch(`${BASE_URL}/api/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hrToken}`,
        },
        body: JSON.stringify({
          content: 'Content with missing title',
        }),
      });

      // Short content (< 5 chars)
      const resShortContent = await fetch(`${BASE_URL}/api/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hrToken}`,
        },
        body: JSON.stringify({
          title: 'Valid Title Here',
          content: 'Hi',
        }),
      });

      // Invalid audience target
      const resInvalidAudience = await fetch(`${BASE_URL}/api/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hrToken}`,
        },
        body: JSON.stringify({
          title: 'Valid Title',
          content: 'Valid content body',
          audience: 'SUPERUSER',
        }),
      });

      // Past expiresAt date
      const resPastExpiry = await fetch(`${BASE_URL}/api/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hrToken}`,
        },
        body: JSON.stringify({
          title: 'Valid Title',
          content: 'Valid content body',
          expiresAt: '2026-01-01',
        }),
      });

      const passed =
        resMissingTitle.status === 400 &&
        resShortContent.status === 400 &&
        resInvalidAudience.status === 400 &&
        resPastExpiry.status === 400;

      recordResult(
        2,
        'Invalid or missing fields and past expiry dates are rejected with 400 Bad Request',
        passed,
        `Missing Title: ${resMissingTitle.status}, Short Content: ${resShortContent.status}, Invalid Audience: ${resInvalidAudience.status}, Past Expiry: ${resPastExpiry.status}`
      );
    }

    // -----------------------------------------------------------
    // Test 3: Employees cannot create announcements
    // -----------------------------------------------------------
    {
      const res = await fetch(`${BASE_URL}/api/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${empToken}`,
        },
        body: JSON.stringify({
          title: 'Employee Unauthorized Post',
          content: 'Employees should not be able to create announcements.',
          audience: 'ALL',
        }),
      });
      const data = await res.json();

      const passed = res.status === 403 && data.success === false;

      recordResult(
        3,
        'Employees are forbidden from creating announcements (403 Forbidden)',
        passed,
        `Status: ${res.status}, Message: "${data.message}"`
      );
    }

    // -----------------------------------------------------------
    // Test 4: Published announcements are visible to their intended audience
    // -----------------------------------------------------------
    {
      // HR publishes the draft
      await fetch(`${BASE_URL}/api/announcements/${draftId}/publish`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${hrToken}` },
      });
      publishedAllId = draftId;

      // Employee views their feed via /me
      const resFeed = await fetch(`${BASE_URL}/api/announcements/me`, {
        headers: { Authorization: `Bearer ${empToken}` },
      });
      const dataFeed = await resFeed.json();

      // Employee views by ID
      const resSingle = await fetch(`${BASE_URL}/api/announcements/${publishedAllId}`, {
        headers: { Authorization: `Bearer ${empToken}` },
      });
      const dataSingle = await resSingle.json();

      const passed =
        resFeed.status === 200 &&
        dataFeed.data.some((a) => a._id === publishedAllId) &&
        resSingle.status === 200 &&
        dataSingle.data?._id === publishedAllId &&
        dataSingle.data?.status === 'PUBLISHED';

      recordResult(
        4,
        'Published announcements are visible to intended audience via /me and /:id',
        passed,
        `Feed Status: ${resFeed.status}, Single Status: ${resSingle.status}, Status: "${dataSingle.data?.status}"`
      );
    }

    // -----------------------------------------------------------
    // Test 5: Drafts are not visible to employees or managers
    // -----------------------------------------------------------
    {
      // HR creates a new draft
      const createRes = await fetch(`${BASE_URL}/api/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hrToken}`,
        },
        body: JSON.stringify({
          title: 'Secret Draft Policy',
          content: 'Internal draft not yet approved for distribution.',
          audience: 'ALL',
        }),
      });
      const createData = await createRes.json();
      const newDraftId = createData.data?._id;

      // Employee checks list: draft must not be in list
      const resEmpList = await fetch(`${BASE_URL}/api/announcements`, {
        headers: { Authorization: `Bearer ${empToken}` },
      });
      const dataEmpList = await resEmpList.json();

      // Employee checks direct ID: must return 404
      const resEmpGet = await fetch(`${BASE_URL}/api/announcements/${newDraftId}`, {
        headers: { Authorization: `Bearer ${empToken}` },
      });

      // Manager checks direct ID: must return 404
      const resMgrGet = await fetch(`${BASE_URL}/api/announcements/${newDraftId}`, {
        headers: { Authorization: `Bearer ${mgrToken}` },
      });

      const passed =
        !dataEmpList.data.some((a) => a._id === newDraftId) &&
        resEmpGet.status === 404 &&
        resMgrGet.status === 404;

      recordResult(
        5,
        'Drafts are never visible in lists or single queries to employees or managers (404)',
        passed,
        `Emp direct access: ${resEmpGet.status}, Mgr direct access: ${resMgrGet.status}, Leaked in list: ${dataEmpList.data.some((a) => a._id === newDraftId)}`
      );

      await Announcement.findByIdAndDelete(newDraftId);
    }

    // -----------------------------------------------------------
    // Test 6: Role-specific announcements are not visible to other roles
    // -----------------------------------------------------------
    {
      // HR creates and publishes a MANAGER-only announcement
      const createRes = await fetch(`${BASE_URL}/api/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hrToken}`,
        },
        body: JSON.stringify({
          title: 'Q4 Management Strategy',
          content: 'Strategy meeting for all engineering and product managers.',
          audience: 'MANAGER',
        }),
      });
      const createData = await createRes.json();
      managerOnlyId = createData.data?._id;

      // Publish it
      await fetch(`${BASE_URL}/api/announcements/${managerOnlyId}/publish`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${hrToken}` },
      });

      // Manager views feed: should include managerOnlyId
      const resMgrFeed = await fetch(`${BASE_URL}/api/announcements/me`, {
        headers: { Authorization: `Bearer ${mgrToken}` },
      });
      const dataMgrFeed = await resMgrFeed.json();

      // Employee views feed: should NOT include managerOnlyId
      const resEmpFeed = await fetch(`${BASE_URL}/api/announcements/me`, {
        headers: { Authorization: `Bearer ${empToken}` },
      });
      const dataEmpFeed = await resEmpFeed.json();

      // Employee tries direct access: should return 404
      const resEmpDirect = await fetch(
        `${BASE_URL}/api/announcements/${managerOnlyId}`,
        {
          headers: { Authorization: `Bearer ${empToken}` },
        }
      );

      const passed =
        dataMgrFeed.data.some((a) => a._id === managerOnlyId) &&
        !dataEmpFeed.data.some((a) => a._id === managerOnlyId) &&
        resEmpDirect.status === 404;

      recordResult(
        6,
        'Role-specific announcements are visible only to target audience and blocked from other roles',
        passed,
        `Manager sees: ${dataMgrFeed.data.some((a) => a._id === managerOnlyId)}, Employee sees: ${dataEmpFeed.data.some((a) => a._id === managerOnlyId)}, Direct: ${resEmpDirect.status}`
      );
    }

    // -----------------------------------------------------------
    // Test 7: Employees cannot edit, publish, or archive announcements
    // -----------------------------------------------------------
    {
      // Employee attempts edit
      const resEdit = await fetch(`${BASE_URL}/api/announcements/${publishedAllId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${empToken}`,
        },
        body: JSON.stringify({ title: 'Hacked Title' }),
      });

      // Employee attempts publish
      const resPublish = await fetch(
        `${BASE_URL}/api/announcements/${publishedAllId}/publish`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${empToken}` },
        }
      );

      // Employee attempts archive
      const resArchive = await fetch(
        `${BASE_URL}/api/announcements/${publishedAllId}/archive`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${empToken}` },
        }
      );

      const passed =
        resEdit.status === 403 &&
        resPublish.status === 403 &&
        resArchive.status === 403;

      recordResult(
        7,
        'Employees are forbidden from editing, publishing, or archiving announcements (403)',
        passed,
        `Edit: ${resEdit.status}, Publish: ${resPublish.status}, Archive: ${resArchive.status}`
      );
    }

    // -----------------------------------------------------------
    // Test 8: HR can publish, edit, and archive announcements
    // -----------------------------------------------------------
    {
      // Create draft
      const draftRes = await fetch(`${BASE_URL}/api/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hrToken}`,
        },
        body: JSON.stringify({
          title: 'Initial Title',
          content: 'Initial content before editing.',
          audience: 'ALL',
        }),
      });
      const draftData = await draftRes.json();
      const testId = draftData.data?._id;

      // 8a: Edit
      const editRes = await fetch(`${BASE_URL}/api/announcements/${testId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hrToken}`,
        },
        body: JSON.stringify({
          title: 'Updated Policy Title',
          content: 'Updated content with additional details.',
        }),
      });
      const editData = await editRes.json();

      // 8b: Publish
      const pubRes = await fetch(`${BASE_URL}/api/announcements/${testId}/publish`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${hrToken}` },
      });
      const pubData = await pubRes.json();

      // 8c: Archive
      const archRes = await fetch(`${BASE_URL}/api/announcements/${testId}/archive`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${hrToken}` },
      });
      const archData = await archRes.json();

      const passed =
        editRes.status === 200 &&
        editData.data?.title === 'Updated Policy Title' &&
        pubRes.status === 200 &&
        pubData.data?.status === 'PUBLISHED' &&
        pubData.data?.publishedAt !== null &&
        archRes.status === 200 &&
        archData.data?.status === 'ARCHIVED';

      recordResult(
        8,
        'HR can edit, publish, and archive announcements with state lifecycle transitions',
        passed,
        `Edit title: "${editData.data?.title}", Pub status: "${pubData.data?.status}", Arch status: "${archData.data?.status}"`
      );

      await Announcement.findByIdAndDelete(testId);
    }

    // -----------------------------------------------------------
    // Test 9: Archived and expired announcements are excluded from the normal feed
    // -----------------------------------------------------------
    {
      // 9a: Archive publishedAllId
      await fetch(`${BASE_URL}/api/announcements/${publishedAllId}/archive`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${hrToken}` },
      });

      // Employee feed: archived must be excluded
      const resFeedArchived = await fetch(`${BASE_URL}/api/announcements/me`, {
        headers: { Authorization: `Bearer ${empToken}` },
      });
      const dataFeedArchived = await resFeedArchived.json();

      // 9b: Create an expired published announcement
      const expiredDoc = await Announcement.create({
        title: 'Expired Past Announcement',
        content: 'This announcement expired yesterday.',
        createdBy: hrUser._id,
        audience: 'ALL',
        status: 'PUBLISHED',
        publishedAt: new Date(Date.now() - 172800000), // 2 days ago
        expiresAt: new Date(Date.now() - 86400000),   // 1 day ago (expired)
      });
      expiredId = expiredDoc._id.toString();

      // Employee feed: expired must be excluded
      const resFeedExpired = await fetch(`${BASE_URL}/api/announcements/me`, {
        headers: { Authorization: `Bearer ${empToken}` },
      });
      const dataFeedExpired = await resFeedExpired.json();

      // Direct access to expired by employee: must return 404
      const resDirectExpired = await fetch(
        `${BASE_URL}/api/announcements/${expiredId}`,
        {
          headers: { Authorization: `Bearer ${empToken}` },
        }
      );

      const passed =
        !dataFeedArchived.data.some((a) => a._id === publishedAllId) &&
        !dataFeedExpired.data.some((a) => a._id === expiredId) &&
        resDirectExpired.status === 404;

      recordResult(
        9,
        'Archived and expired announcements are excluded from the active feed and single view (404)',
        passed,
        `Archived in feed: ${dataFeedArchived.data.some((a) => a._id === publishedAllId)}, Expired in feed: ${dataFeedExpired.data.some((a) => a._id === expiredId)}, Expired view: ${resDirectExpired.status}`
      );
    }

    // -----------------------------------------------------------
    // Test 10: Invalid IDs return 400 and missing records return 404
    // -----------------------------------------------------------
    {
      const resInvalid = await fetch(
        `${BASE_URL}/api/announcements/not-a-valid-mongo-id`,
        {
          headers: { Authorization: `Bearer ${hrToken}` },
        }
      );
      const dataInvalid = await resInvalid.json();

      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const resMissing = await fetch(
        `${BASE_URL}/api/announcements/${nonExistentId}`,
        {
          headers: { Authorization: `Bearer ${hrToken}` },
        }
      );
      const dataMissing = await resMissing.json();

      const passed =
        resInvalid.status === 400 &&
        dataInvalid.success === false &&
        resMissing.status === 404 &&
        dataMissing.success === false;

      recordResult(
        10,
        'Invalid ID returns 400 Bad Request and missing record returns 404 Not Found',
        passed,
        `Invalid status: ${resInvalid.status}, Missing status: ${resMissing.status}`
      );
    }

    // -----------------------------------------------------------
    // Test 11: Pagination and filters work correctly
    // -----------------------------------------------------------
    {
      // Create a few announcements to test pagination and filters
      const a1 = await Announcement.create({
        title: 'Filter Test One',
        content: 'Content for filter test one.',
        createdBy: hrUser._id,
        audience: 'ALL',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      });
      const a2 = await Announcement.create({
        title: 'Filter Test Two',
        content: 'Content for filter test two.',
        createdBy: hrUser._id,
        audience: 'ALL',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      });

      // Pagination test with limit=1
      const resPaginated = await fetch(
        `${BASE_URL}/api/announcements?limit=1&page=1`,
        {
          headers: { Authorization: `Bearer ${hrToken}` },
        }
      );
      const dataPaginated = await resPaginated.json();

      // Search test
      const resSearch = await fetch(
        `${BASE_URL}/api/announcements?search=Filter Test One`,
        {
          headers: { Authorization: `Bearer ${hrToken}` },
        }
      );
      const dataSearch = await resSearch.json();

      const passed =
        resPaginated.status === 200 &&
        dataPaginated.pagination?.limit === 1 &&
        dataPaginated.pagination?.page === 1 &&
        dataPaginated.pagination?.hasNextPage === true &&
        resSearch.status === 200 &&
        dataSearch.data.some((a) => a._id === a1._id.toString());

      recordResult(
        11,
        'Pagination and search filters work accurately with structured metadata',
        passed,
        `Page: ${dataPaginated.pagination?.page}, Limit: ${dataPaginated.pagination?.limit}, Total: ${dataPaginated.pagination?.total}, Search matched: ${dataSearch.data?.length}`
      );

      await Announcement.deleteMany({ _id: { $in: [a1._id, a2._id] } });
    }

  } catch (err) {
    console.error('Announcement test error:', err);
  } finally {
    // -----------------------------------------------------------
    // Cleanup test-created records
    // -----------------------------------------------------------
    console.log('\nCleaning up Task 6 test-created records from MongoDB...');
    const allEmails = Object.values(testEmails).map((e) => e.toLowerCase());
    const users = await User.find({ email: { $in: allEmails } }).select('_id');
    const userIds = users.map((u) => u._id);

    const deletedAnnouncements = await Announcement.deleteMany({
      $or: [
        { createdBy: { $in: userIds } },
        { _id: { $in: [draftId, publishedAllId, managerOnlyId, expiredId].filter(Boolean) } },
      ],
    });
    const deletedUsers = await User.deleteMany({ _id: { $in: userIds } });

    console.log(
      `Cleaned up ${deletedUsers.deletedCount} users and ${deletedAnnouncements.deletedCount} announcements.`
    );
    await mongoose.disconnect();
  }

  console.log('\n===========================================================');
  const allPassed = results.every((r) => r.passed);
  console.log(
    `Announcement Test Summary: ${results.filter((r) => r.passed).length}/${results.length} PASSED`
  );
  console.log('===========================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

runAnnouncementTests();
