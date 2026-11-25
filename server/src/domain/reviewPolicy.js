import { ReviewVisibility } from './constants.js';

export function visibilityAfterSubmission(hasReverseReview) {
  return hasReverseReview ? ReviewVisibility.PUBLIC : ReviewVisibility.PRIVATE_PENDING;
}
