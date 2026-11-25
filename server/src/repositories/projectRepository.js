import { MysqlRepository } from './mysqlRepository.js';
import { projectStatusAfterApproval, projectStatusForAction } from '../domain/projectPolicy.js';

export class ProjectRepository extends MysqlRepository {
  list() {
    return this.query(`
      SELECT p.project_id AS projectId, p.course_name AS courseName,
        p.headcount, p.recruit_condition AS recruitCondition, p.status,
        p.created_at AS createdAt, p.recruiter_id AS recruiterId, u.name AS recruiterName,
        COUNT(CASE WHEN m.status = 'APPROVED' THEN 1 END) AS approvedCount,
        GROUP_CONCAT(CASE WHEN m.status = 'APPROVED' THEN m.user_id END) AS approvedUserIds
      FROM team_projects p
      JOIN users u ON u.user_id = p.recruiter_id
      LEFT JOIN team_memberships m ON m.project_id = p.project_id
      GROUP BY p.project_id, u.name
      ORDER BY p.created_at DESC
    `);
  }

  async findById(projectId) {
    const rows = await this.query(`
      SELECT p.project_id AS projectId, p.course_name AS courseName,
        p.headcount, p.recruit_condition AS recruitCondition, p.status,
        p.created_at AS createdAt, p.recruiter_id AS recruiterId, u.name AS recruiterName
      FROM team_projects p JOIN users u ON u.user_id = p.recruiter_id
      WHERE p.project_id = ?
    `, [projectId]);
    return rows[0] ?? null;
  }

  async create({ recruiterId, courseName, headcount, recruitCondition }) {
    const result = await this.query(
      'INSERT INTO team_projects (recruiter_id, course_name, headcount, recruit_condition) VALUES (?, ?, ?, ?)',
      [recruiterId, courseName, headcount, recruitCondition]
    );
    return this.findById(result.insertId);
  }

  memberships(projectId) {
    return this.query(`
      SELECT m.membership_id AS membershipId, m.user_id AS userId, u.name AS userName,
        m.assigned_role AS assignedRole, m.desired_role AS desiredRole,
        m.intro_memo AS introMemo, m.status
      FROM team_memberships m JOIN users u ON u.user_id = m.user_id
      WHERE m.project_id = ? ORDER BY m.membership_id
    `, [projectId]);
  }

  async createApplication({ projectId, userId, desiredRole, introMemo }) {
    const result = await this.query(
      'INSERT INTO team_memberships (project_id, user_id, desired_role, intro_memo) VALUES (?, ?, ?, ?)',
      [projectId, userId, desiredRole, introMemo]
    );
    return result.insertId;
  }

  async decideApplication({ projectId, membershipId, recruiterId, approve }) {
    return this.transaction(async (tx) => {
      const projects = await tx.query(
        'SELECT project_id, recruiter_id, headcount, status FROM team_projects WHERE project_id = ? FOR UPDATE',
        [projectId]
      );
      const project = projects[0];
      if (!project) return { error: '모집글을 찾을 수 없습니다.', statusCode: 404 };
      if (Number(project.recruiter_id) !== Number(recruiterId)) {
        return { error: '구인자만 지원자를 관리할 수 있습니다.', statusCode: 403 };
      }
      if (project.status !== 'RECRUITING') {
        return { error: '모집 중인 프로젝트에서만 지원을 처리할 수 있습니다.', statusCode: 409 };
      }
      const memberships = await tx.query(
        'SELECT membership_id, status, desired_role FROM team_memberships WHERE membership_id = ? AND project_id = ? FOR UPDATE',
        [membershipId, projectId]
      );
      const membership = memberships[0];
      if (!membership || membership.status !== 'APPLIED') {
        return { error: '처리할 수 있는 지원 내역이 없습니다.', statusCode: 409 };
      }
      if (approve) {
        const counts = await tx.query(
          "SELECT COUNT(*) AS approvedCount FROM team_memberships WHERE project_id = ? AND status = 'APPROVED'",
          [projectId]
        );
        let nextStatus;
        try {
          nextStatus = projectStatusAfterApproval(project.status, Number(counts[0].approvedCount), Number(project.headcount));
        } catch (error) {
          return { error: error.message, statusCode: error.statusCode };
        }
        await tx.query(
          "UPDATE team_memberships SET status = 'APPROVED', assigned_role = ? WHERE membership_id = ?",
          [membership.desired_role, membershipId]
        );
        if (nextStatus === 'IN_PROGRESS') {
          await tx.query("UPDATE team_projects SET status = ? WHERE project_id = ?", [nextStatus, projectId]);
        }
      } else {
        await tx.query(
          "UPDATE team_memberships SET status = 'REJECTED' WHERE membership_id = ?",
          [membershipId]
        );
      }
      return { result: true };
    });
  }

  async changeProjectStatus({ projectId, recruiterId, action }) {
    return this.transaction(async (tx) => {
      const rows = await tx.query(
        'SELECT recruiter_id, status FROM team_projects WHERE project_id = ? FOR UPDATE',
        [projectId]
      );
      const project = rows[0];
      if (!project) return { error: '모집글을 찾을 수 없습니다.', statusCode: 404 };
      if (Number(project.recruiter_id) !== Number(recruiterId)) {
        return { error: '구인자만 프로젝트 상태를 변경할 수 있습니다.', statusCode: 403 };
      }
      let nextStatus;
      try {
        nextStatus = projectStatusForAction(action, project.status);
      } catch (error) {
        return { error: error.message, statusCode: error.statusCode };
      }
      await tx.query('UPDATE team_projects SET status = ? WHERE project_id = ?', [nextStatus, projectId]);
      return { result: true, status: nextStatus };
    });
  }

  async participants(projectId) {
    const project = await this.findById(projectId);
    if (!project) return null;
    const members = await this.query(`
      SELECT u.user_id AS userId, u.name, 'RECRUITER' AS assignedRole
      FROM users u WHERE u.user_id = ?
      UNION ALL
      SELECT u.user_id AS userId, u.name, m.assigned_role AS assignedRole
      FROM team_memberships m JOIN users u ON u.user_id = m.user_id
      WHERE m.project_id = ? AND m.status = 'APPROVED'
    `, [project.recruiterId, projectId]);
    return members;
  }
}
