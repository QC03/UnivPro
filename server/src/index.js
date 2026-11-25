import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './config/database.js';
import { UserRepository } from './repositories/userRepository.js';
import { ProjectRepository } from './repositories/projectRepository.js';
import { ReviewRepository } from './repositories/reviewRepository.js';
import { AppService } from './services/appService.js';
import { createApp } from './controllers/createApp.js';

const app = express();
const port = Number(process.env.PORT ?? 3001);
const service = new AppService({
  users: new UserRepository(),
  projects: new ProjectRepository(),
  reviews: new ReviewRepository()
});

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json());
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api', createApp(service));
app.use((error, _req, res, _next) => {
  if (error.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ error: '존재하지 않는 사용자를 지정했습니다.' });
  }
  if (['ER_NO_SUCH_TABLE', 'ER_BAD_DB_ERROR', 'ER_ACCESS_DENIED_ERROR', 'ECONNREFUSED'].includes(error.code)) {
    return res.status(503).json({ error: '데이터베이스에 연결할 수 없습니다. MySQL 및 schema.sql 설정을 확인해 주세요.' });
  }
  console.error(error);
  return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

const server = app.listen(port, () => console.log(`UnivPro API listening on http://localhost:${port}`));

async function shutdown() {
  server.close();
  await pool.end();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
