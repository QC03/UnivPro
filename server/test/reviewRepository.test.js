import test from 'node:test';
import assert from 'node:assert/strict';
import { ReviewRepository } from '../src/repositories/reviewRepository.js';

function createRepository(hasReverseReview) {
  const state = { published: false, inserted: false };
  const repository = new ReviewRepository();
  repository.transaction = (work) => work({
    query: async (sql) => {
      if (sql.includes('SELECT project_id FROM team_projects')) return [{ project_id: 8 }];
      if (sql.includes('INSERT INTO reviews')) {
        state.inserted = true;
        return { insertId: 21 };
      }
      if (sql.includes('SELECT review_id FROM reviews')) {
        assert.equal(state.inserted, true);
        return hasReverseReview ? [{ review_id: 19 }] : [];
      }
      if (sql.includes('UPDATE reviews SET visibility')) state.published = true;
      return [];
    }
  });
  return { repository, state };
}

const review = {
  projectId: 8,
  writerId: 3,
  targetUserId: 4,
  sincerityScore: 5,
  comment: '함께 잘 마무리했습니다.'
};

test('review repository stores one-sided submission as private', async () => {
  const { repository, state } = createRepository(false);
  const result = await repository.submit(review);
  assert.deepEqual(result, { reviewId: 21, visibility: 'PRIVATE_PENDING' });
  assert.equal(state.published, false);
});

test('review repository publishes both directions after a reverse review exists', async () => {
  const { repository, state } = createRepository(true);
  const result = await repository.submit(review);
  assert.deepEqual(result, { reviewId: 21, visibility: 'PUBLIC' });
  assert.equal(state.published, true);
});
