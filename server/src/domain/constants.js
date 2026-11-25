export const ProjectStatus = Object.freeze({
  RECRUITING: 'RECRUITING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
});

export const MembershipStatus = Object.freeze({
  APPLIED: 'APPLIED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
});

export const ReviewVisibility = Object.freeze({
  PRIVATE_PENDING: 'PRIVATE_PENDING',
  PUBLIC: 'PUBLIC'
});

export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}
