import { AppError, ProjectStatus } from '../domain/constants.js';

export class AppService {
  constructor({ users, projects, reviews }) {
    this.users = users;
    this.projects = projects;
    this.reviews = reviews;
  }

  listUsers() {
    return this.users.findAll();
  }

  listProjects() {
    return this.projects.list();
  }

  async projectDetail(projectId) {
    const project = await this.projects.findById(projectId);
    if (!project) throw new AppError('모집글을 찾을 수 없습니다.', 404);
    return { ...project, memberships: await this.projects.memberships(projectId) };
  }

  async publicReviews(userId) {
    const user = (await this.users.findAll()).find((item) => Number(item.userId) === Number(userId));
    if (!user) throw new AppError('사용자를 찾을 수 없습니다.', 404);
    return this.reviews.publicForUser(userId);
  }

  publicWrittenReviews(userId) {
    return this.reviews.publicWrittenBy(userId);
  }

  async createProject(input) {
    const { recruiterId, courseName, headcount, recruitCondition } = input;
    if (!recruiterId || !courseName?.trim() || !Number.isInteger(Number(headcount)) || Number(headcount) < 1 || !recruitCondition?.trim()) {
      throw new AppError('구인자, 과목명, 1명 이상의 모집인원, 모집조건을 입력해 주세요.');
    }
    return this.projects.create({ recruiterId, courseName: courseName.trim(), headcount: Number(headcount), recruitCondition: recruitCondition.trim() });
  }

  async apply(projectId, input) {
    const project = await this.projects.findById(projectId);
    if (!project) throw new AppError('모집글을 찾을 수 없습니다.', 404);
    if (project.status !== ProjectStatus.RECRUITING) throw new AppError('모집 중인 프로젝트에만 지원할 수 있습니다.', 409);
    if (!input.userId || !input.desiredRole?.trim() || !input.introMemo?.trim()) {
      throw new AppError('지원자, 희망 역할, 자기소개 메모를 입력해 주세요.');
    }
    return { membershipId: await this.projects.createApplication({
      projectId, userId: input.userId, desiredRole: input.desiredRole.trim(), introMemo: input.introMemo.trim()
    }) };
  }

  async decideApplication(projectId, membershipId, input, approve) {
    if (!input.recruiterId) throw new AppError('구인자 식별자가 필요합니다.');
    const result = await this.projects.decideApplication({ projectId, membershipId, recruiterId: input.recruiterId, approve });
    if (result.error) throw new AppError(result.error, result.statusCode);
    return { ok: true };
  }

  async changeProjectStatus(projectId, action, input) {
    if (!input.recruiterId) throw new AppError('구인자 식별자가 필요합니다.');
    const result = await this.projects.changeProjectStatus({ projectId, recruiterId: input.recruiterId, action });
    if (result.error) throw new AppError(result.error, result.statusCode);
    return { ok: true, status: result.status };
  }

  async participants(projectId) {
    const participants = await this.projects.participants(projectId);
    if (!participants) throw new AppError('모집글을 찾을 수 없습니다.', 404);
    return participants;
  }

  async submitReview(projectId, input) {
    const project = await this.projects.findById(projectId);
    if (!project) throw new AppError('모집글을 찾을 수 없습니다.', 404);
    if (project.status !== ProjectStatus.COMPLETED) throw new AppError('완료된 프로젝트에서만 리뷰를 작성할 수 있습니다.', 409);
    if (!input.writerId || !input.targetUserId || !Number.isInteger(Number(input.sincerityScore)) || Number(input.sincerityScore) < 1 || Number(input.sincerityScore) > 5 || !input.comment?.trim()) {
      throw new AppError('작성자, 대상자, 1~5점 점수와 리뷰 내용을 입력해 주세요.');
    }
    const participants = await this.projects.participants(projectId);
    const participantIds = new Set(participants.map((member) => Number(member.userId)));
    if (!participantIds.has(Number(input.writerId)) || !participantIds.has(Number(input.targetUserId))) {
      throw new AppError('해당 프로젝트 참여자만 서로 리뷰할 수 있습니다.', 403);
    }
    return this.reviews.submit({
      projectId, writerId: input.writerId, targetUserId: input.targetUserId,
      sincerityScore: Number(input.sincerityScore), comment: input.comment.trim()
    });
  }
}
