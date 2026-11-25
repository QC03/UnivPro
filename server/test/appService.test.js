import test from 'node:test';
import assert from 'node:assert/strict';
import { AppService } from '../src/services/appService.js';

function createService(projectStatus, participants = [{ userId: 1 }, { userId: 2 }]) {
  const submitted = [];
  const service = new AppService({
    users: { findAll: async () => [{ userId: 1 }, { userId: 2 }] },
    projects: {
      findById: async () => ({ projectId: 7, status: projectStatus }),
      participants: async () => participants
    },
    reviews: {
      publicForUser: async () => [],
      publicWrittenBy: async () => [],
      submit: async (review) => {
        submitted.push(review);
        return { reviewId: submitted.length, visibility: 'PRIVATE_PENDING' };
      }
    }
  });
  return { service, submitted };
}

test('review submission is rejected until the project is completed', async () => {
  const { service, submitted } = createService('IN_PROGRESS');
  await assert.rejects(
    service.submitReview(7, { writerId: 1, targetUserId: 2, sincerityScore: 5, comment: '좋은 협업' }),
    /완료된 프로젝트/
  );
  assert.equal(submitted.length, 0);
});

test('completed project review is accepted only from a listed project participant', async () => {
  const { service, submitted } = createService('COMPLETED');
  await assert.rejects(
    service.submitReview(7, { writerId: 3, targetUserId: 2, sincerityScore: 5, comment: '좋은 협업' }),
    /프로젝트 참여자/
  );
  assert.equal(submitted.length, 0);
  await service.submitReview(7, { writerId: 1, targetUserId: 2, sincerityScore: 4, comment: '좋은 협업' });
  assert.equal(submitted.length, 1);
});
