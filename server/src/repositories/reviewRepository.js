import { MysqlRepository } from './mysqlRepository.js';
import { visibilityAfterSubmission } from '../domain/reviewPolicy.js';

export class ReviewRepository extends MysqlRepository {
  publicForUser(userId) {
    return this.query(`
      SELECT r.review_id AS reviewId, r.project_id AS projectId, r.writer_id AS writerId,
        r.target_user_id AS targetUserId, r.sincerity_score AS sincerityScore,
        r.comment, r.created_at AS createdAt, w.name AS writerName, p.course_name AS courseName
      FROM reviews r
      JOIN users w ON w.user_id = r.writer_id
      JOIN team_projects p ON p.project_id = r.project_id
      WHERE r.target_user_id = ? AND r.visibility = 'PUBLIC'
      ORDER BY r.created_at DESC
    `, [userId]);
  }

  publicWrittenBy(userId) {
    return this.query(`
      SELECT r.review_id AS reviewId, r.project_id AS projectId, r.writer_id AS writerId,
        r.target_user_id AS targetUserId, r.sincerity_score AS sincerityScore,
        r.comment, r.created_at AS createdAt, t.name AS targetName, p.course_name AS courseName
      FROM reviews r
      JOIN users t ON t.user_id = r.target_user_id
      JOIN team_projects p ON p.project_id = r.project_id
      WHERE r.writer_id = ? AND r.visibility = 'PUBLIC'
      ORDER BY r.created_at DESC
    `, [userId]);
  }

  async submit({ projectId, writerId, targetUserId, sincerityScore, comment }) {
    return this.transaction(async (tx) => {
      await tx.query('SELECT project_id FROM team_projects WHERE project_id = ? FOR UPDATE', [projectId]);
      const result = await tx.query(`
        INSERT INTO reviews
          (project_id, writer_id, target_user_id, sincerity_score, comment, visibility)
        VALUES (?, ?, ?, ?, ?, 'PRIVATE_PENDING')
      `, [projectId, writerId, targetUserId, sincerityScore, comment]);
      const reverse = await tx.query(`
        SELECT review_id FROM reviews
        WHERE project_id = ? AND writer_id = ? AND target_user_id = ?
        FOR UPDATE
      `, [projectId, targetUserId, writerId]);
      const visibility = visibilityAfterSubmission(reverse.length > 0);
      if (visibility === 'PUBLIC') {
        await tx.query(`
          UPDATE reviews SET visibility = 'PUBLIC'
          WHERE project_id = ? AND visibility = 'PRIVATE_PENDING'
            AND ((writer_id = ? AND target_user_id = ?) OR (writer_id = ? AND target_user_id = ?))
        `, [projectId, writerId, targetUserId, targetUserId, writerId]);
      }
      return { reviewId: result.insertId, visibility };
    });
  }
}
