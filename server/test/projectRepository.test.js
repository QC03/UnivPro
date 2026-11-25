import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectRepository } from '../src/repositories/projectRepository.js';

function createRepository({ status = 'RECRUITING', headcount = 2, approvedCount = 0, membershipStatus = 'APPLIED' } = {}) {
  const state = {
    status,
    headcount,
    approvedCount,
    membershipStatus,
    assignedRole: null
  };
  const repository = new ProjectRepository();
  repository.transaction = (work) => work({
    query: async (sql, values = []) => {
      if (sql.includes('SELECT project_id, recruiter_id, headcount, status')) {
        return [{ project_id: 8, recruiter_id: 3, headcount: state.headcount, status: state.status }];
      }
      if (sql.includes('SELECT membership_id, status, desired_role')) {
        return state.membershipStatus
          ? [{ membership_id: 12, status: state.membershipStatus, desired_role: '디자인' }]
          : [];
      }
      if (sql.includes('SELECT COUNT(*) AS approvedCount')) {
        return [{ approvedCount: state.approvedCount }];
      }
      if (sql.includes("UPDATE team_memberships SET status = 'APPROVED'")) {
        state.membershipStatus = 'APPROVED';
        state.assignedRole = values[0];
        state.approvedCount += 1;
      } else if (sql.includes("UPDATE team_memberships SET status = 'REJECTED'")) {
        state.membershipStatus = 'REJECTED';
      } else if (sql.includes('UPDATE team_projects SET status = ?')) {
        state.status = values[0];
      } else if (sql.includes('SELECT recruiter_id, status FROM team_projects')) {
        return [{ recruiter_id: 3, status: state.status }];
      }
      return [];
    }
  });
  return { repository, state };
}

test('repository approves a member and starts the project exactly at capacity', async () => {
  const { repository, state } = createRepository({ headcount: 2, approvedCount: 1 });
  const result = await repository.decideApplication({
    projectId: 8, membershipId: 12, recruiterId: 3, approve: true
  });
  assert.deepEqual(result, { result: true });
  assert.equal(state.membershipStatus, 'APPROVED');
  assert.equal(state.assignedRole, '디자인');
  assert.equal(state.status, 'IN_PROGRESS');
});

test('repository keeps project recruiting when approved membership is below capacity', async () => {
  const { repository, state } = createRepository({ headcount: 3, approvedCount: 1 });
  await repository.decideApplication({
    projectId: 8, membershipId: 12, recruiterId: 3, approve: true
  });
  assert.equal(state.status, 'RECRUITING');
  assert.equal(state.approvedCount, 2);
});

test('repository rejects over-capacity approval and supports rejection', async () => {
  const full = createRepository({ headcount: 1, approvedCount: 1 });
  const fullResult = await full.repository.decideApplication({
    projectId: 8, membershipId: 12, recruiterId: 3, approve: true
  });
  assert.equal(fullResult.statusCode, 409);
  assert.equal(full.state.membershipStatus, 'APPLIED');

  const rejected = createRepository();
  await rejected.repository.decideApplication({
    projectId: 8, membershipId: 12, recruiterId: 3, approve: false
  });
  assert.equal(rejected.state.membershipStatus, 'REJECTED');
  assert.equal(rejected.state.status, 'RECRUITING');
});

test('repository supports recruiter early close, cancellation and completion', async () => {
  const close = createRepository({ headcount: 3, approvedCount: 1 });
  assert.equal((await close.repository.changeProjectStatus({
    projectId: 8, recruiterId: 3, action: 'closeRecruitment'
  })).status, 'IN_PROGRESS');
  assert.equal(close.state.status, 'IN_PROGRESS');

  const cancel = createRepository();
  assert.equal((await cancel.repository.changeProjectStatus({
    projectId: 8, recruiterId: 3, action: 'cancelProject'
  })).status, 'CANCELLED');

  const complete = createRepository({ status: 'IN_PROGRESS' });
  assert.equal((await complete.repository.changeProjectStatus({
    projectId: 8, recruiterId: 3, action: 'completeProject'
  })).status, 'COMPLETED');
});
