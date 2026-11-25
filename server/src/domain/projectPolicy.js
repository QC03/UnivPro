import { AppError, ProjectStatus } from './constants.js';

const transitions = Object.freeze({
  closeRecruitment: [ProjectStatus.RECRUITING, ProjectStatus.IN_PROGRESS],
  cancelProject: [ProjectStatus.RECRUITING, ProjectStatus.CANCELLED],
  completeProject: [ProjectStatus.IN_PROGRESS, ProjectStatus.COMPLETED]
});

export function projectStatusAfterApproval(status, approvedCount, headcount) {
  if (status !== ProjectStatus.RECRUITING) {
    throw new AppError('모집 중인 프로젝트에서만 지원을 처리할 수 있습니다.', 409);
  }
  if (approvedCount >= headcount) throw new AppError('모집 정원이 이미 찼습니다.', 409);
  return approvedCount + 1 >= headcount ? ProjectStatus.IN_PROGRESS : ProjectStatus.RECRUITING;
}

export function projectStatusForAction(action, currentStatus) {
  const transition = transitions[action];
  if (!transition) throw new AppError('지원하지 않는 프로젝트 작업입니다.');
  if (currentStatus !== transition[0]) {
    throw new AppError(`현재 상태(${currentStatus})에서는 이 작업을 할 수 없습니다.`, 409);
  }
  return transition[1];
}
