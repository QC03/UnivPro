import { Router } from 'express';
import { AppError } from '../domain/constants.js';

export function createApp(service) {
  const router = Router();

  const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);

  router.get('/users', asyncRoute(async (_req, res) => res.json(await service.listUsers())));
  router.get('/projects', asyncRoute(async (_req, res) => res.json(await service.listProjects())));
  router.post('/projects', asyncRoute(async (req, res) => res.status(201).json(await service.createProject(req.body))));
  router.get('/projects/:projectId', asyncRoute(async (req, res) => res.json(await service.projectDetail(req.params.projectId))));
  router.get('/projects/:projectId/participants', asyncRoute(async (req, res) => res.json(await service.participants(req.params.projectId))));
  router.post('/projects/:projectId/applications', asyncRoute(async (req, res) => res.status(201).json(await service.apply(req.params.projectId, req.body))));
  router.post('/projects/:projectId/applications/:membershipId/approve', asyncRoute(async (req, res) => {
    res.json(await service.decideApplication(req.params.projectId, req.params.membershipId, req.body, true));
  }));
  router.post('/projects/:projectId/applications/:membershipId/reject', asyncRoute(async (req, res) => {
    res.json(await service.decideApplication(req.params.projectId, req.params.membershipId, req.body, false));
  }));
  for (const action of ['closeRecruitment', 'cancelProject', 'completeProject']) {
    router.post(`/projects/:projectId/${action}`, asyncRoute(async (req, res) => {
      res.json(await service.changeProjectStatus(req.params.projectId, action, req.body));
    }));
  }
  router.get('/users/:userId/reviews', asyncRoute(async (req, res) => res.json(await service.publicReviews(req.params.userId))));
  router.get('/users/:userId/written-reviews', asyncRoute(async (req, res) => res.json(await service.publicWrittenReviews(req.params.userId))));
  router.post('/projects/:projectId/reviews', asyncRoute(async (req, res) => res.status(201).json(await service.submitReview(req.params.projectId, req.body))));
  router.use((error, _req, res, _next) => {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_NO_REFERENCED_ROW') {
      return res.status(400).json({ error: '존재하지 않는 사용자를 지정했습니다.' });
    }
    if (['ER_NO_SUCH_TABLE', 'ER_BAD_DB_ERROR', 'ER_ACCESS_DENIED_ERROR', 'ECONNREFUSED'].includes(error.code)) {
      return res.status(503).json({ error: '데이터베이스에 연결할 수 없습니다. MySQL 및 schema.sql 설정을 확인해 주세요.' });
    }
    console.error(error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  });

  return router;
}
