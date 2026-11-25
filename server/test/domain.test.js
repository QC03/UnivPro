import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError, ProjectStatus, ReviewVisibility } from '../src/domain/constants.js';
import { projectStatusAfterApproval, projectStatusForAction } from '../src/domain/projectPolicy.js';
import { visibilityAfterSubmission } from '../src/domain/reviewPolicy.js';

test('approval leaves recruitment open until the last seat and starts when full', () => {
  assert.equal(projectStatusAfterApproval(ProjectStatus.RECRUITING, 0, 2), ProjectStatus.RECRUITING);
  assert.equal(projectStatusAfterApproval(ProjectStatus.RECRUITING, 1, 2), ProjectStatus.IN_PROGRESS);
});

test('approval cannot exceed capacity or run after recruitment closes', () => {
  assert.throws(
    () => projectStatusAfterApproval(ProjectStatus.RECRUITING, 2, 2),
    (error) => error instanceof AppError && error.statusCode === 409
  );
  assert.throws(
    () => projectStatusAfterApproval(ProjectStatus.IN_PROGRESS, 0, 2),
    (error) => error instanceof AppError && error.statusCode === 409
  );
});

test('recruiter actions enforce early close, cancellation and completion transitions', () => {
  assert.equal(projectStatusForAction('closeRecruitment', ProjectStatus.RECRUITING), ProjectStatus.IN_PROGRESS);
  assert.equal(projectStatusForAction('cancelProject', ProjectStatus.RECRUITING), ProjectStatus.CANCELLED);
  assert.equal(projectStatusForAction('completeProject', ProjectStatus.IN_PROGRESS), ProjectStatus.COMPLETED);
  assert.throws(() => projectStatusForAction('completeProject', ProjectStatus.RECRUITING), AppError);
});

test('reviews remain private until a reverse-direction review exists', () => {
  assert.equal(visibilityAfterSubmission(false), ReviewVisibility.PRIVATE_PENDING);
  assert.equal(visibilityAfterSubmission(true), ReviewVisibility.PUBLIC);
});
