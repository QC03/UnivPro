import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, jsonRequest } from './api.js';

const screens = [
  ['projects', '모집글 찾기'],
  ['detail', '모집글 상세'],
  ['manage', '지원자 관리'],
  ['progress', '프로젝트 진행'],
  ['reviews', '상호 리뷰']
];

const statusNames = {
  RECRUITING: '모집 중',
  IN_PROGRESS: '진행 중',
  COMPLETED: '완료',
  CANCELLED: '취소됨',
  APPLIED: '지원 검토 중',
  APPROVED: '팀원 확정',
  REJECTED: '지원 거절'
};

function Status({ value }) {
  return <span className={`status status-${value?.toLowerCase()}`}>{statusNames[value] ?? value}</span>;
}

function App() {
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [userId, setUserId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [screen, setScreen] = useState('projects');
  const [detail, setDetail] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [writtenReviews, setWrittenReviews] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const currentUser = users.find((user) => String(user.userId) === String(userId));
  const selectedProject = projects.find((project) => String(project.projectId) === String(projectId));
  const isRecruiter = selectedProject && currentUser
    && Number(selectedProject.recruiterId) === Number(currentUser.userId);

  const refreshProjects = useCallback(async () => {
    const data = await api('/projects');
    setProjects(data);
    if (!projectId && data.length) setProjectId(String(data[0].projectId));
  }, [projectId]);

  const loadUsers = useCallback(async () => {
    const data = await api('/users');
    setUsers(data);
    if (!userId && data.length) setUserId(String(data[0].userId));
  }, [userId]);

  const loadProjectData = useCallback(async () => {
    if (!projectId) {
      setDetail(null);
      setParticipants([]);
      return;
    }
    const [project, members] = await Promise.all([
      api(`/projects/${projectId}`),
      api(`/projects/${projectId}/participants`)
    ]);
    setDetail(project);
    setParticipants(members);
  }, [projectId]);

  const loadReviews = useCallback(async (targetUserId) => {
    if (!targetUserId) {
      setReviews([]);
      return;
    }
    setReviews(await api(`/users/${targetUserId}/reviews`));
  }, []);

  const loadWrittenReviews = useCallback(async () => {
    if (!userId) return;
    setWrittenReviews(await api(`/users/${userId}/written-reviews`));
  }, [userId]);

  useEffect(() => {
    Promise.all([loadUsers(), refreshProjects()]).catch((e) => setError(e.message));
  }, [loadUsers, refreshProjects]);

  useEffect(() => {
    loadProjectData().catch((e) => setError(e.message));
  }, [loadProjectData, refreshProjects]);

  useEffect(() => {
    loadWrittenReviews().catch((e) => setError(e.message));
  }, [loadWrittenReviews]);

  const run = async (operation, successMessage) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await operation();
      if (successMessage) setMessage(successMessage);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const post = (path, body) => api(path, jsonRequest('POST', body));
  const refreshAll = async () => {
    await refreshProjects();
    await loadProjectData();
  };

  const [projectDraft, setProjectDraft] = useState({ courseName: '', headcount: 2, recruitCondition: '' });
  const [application, setApplication] = useState({ desiredRole: '', introMemo: '' });
  const [reviewDraft, setReviewDraft] = useState({ targetUserId: '', sincerityScore: 5, comment: '' });

  const apply = () => run(async () => {
    await post(`/projects/${projectId}/applications`, { userId: Number(userId), ...application });
    setApplication({ desiredRole: '', introMemo: '' });
    await refreshAll();
  }, '지원서를 제출했습니다.');

  const createProject = (event) => {
    event.preventDefault();
    run(async () => {
      const created = await post('/projects', { recruiterId: Number(userId), ...projectDraft });
      setProjectDraft({ courseName: '', headcount: 2, recruitCondition: '' });
      setProjectId(String(created.projectId));
      await refreshProjects();
    }, '모집글을 등록했습니다.');
  };

  const decide = (membershipId, action) => run(async () => {
    await post(`/projects/${projectId}/applications/${membershipId}/${action}`, { recruiterId: Number(userId) });
    await refreshAll();
  }, action === 'approve' ? '지원자를 팀원으로 확정했습니다.' : '지원을 거절했습니다.');

  const changeProject = (action) => run(async () => {
    await post(`/projects/${projectId}/${action}`, { recruiterId: Number(userId) });
    await refreshAll();
  }, ({
    closeRecruitment: '모집을 마감했습니다.',
    cancelProject: '모집글을 취소했습니다.',
    completeProject: '프로젝트를 완료 처리했습니다.'
  })[action]);

  const showReviews = (targetUserId) => run(async () => {
    await loadReviews(targetUserId);
  });

  const submitReview = (event) => {
    event.preventDefault();
    run(async () => {
      const result = await post(`/projects/${projectId}/reviews`, {
        writerId: Number(userId),
        ...reviewDraft,
        targetUserId: Number(reviewDraft.targetUserId)
      });
      setMessage(result.visibility === 'PUBLIC'
        ? '상호 리뷰가 확인되어 양측 리뷰가 공개되었습니다.'
        : '리뷰를 비공개로 저장했습니다. 상대방도 리뷰를 작성하면 공개됩니다.');
      setReviewDraft({ targetUserId: '', sincerityScore: 5, comment: '' });
      await loadWrittenReviews();
    });
  };

  const myProjects = useMemo(
    () => projects.filter((project) => Number(project.recruiterId) === Number(userId)
      || (project.approvedUserIds ?? '').split(',').some((id) => Number(id) === Number(userId))),
    [projects, userId]
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={() => setScreen('projects')}>
          <span className="brand-mark">M</span><span>모아팀<small>UNIVERSITY PROJECTS</small></span>
        </a>
        <div className="user-switch">
          <span className="user-avatar">{currentUser?.name?.slice(0, 1) ?? 'U'}</span>
          <label htmlFor="active-user">체험 사용자</label>
          <select id="active-user" value={userId} onChange={(event) => setUserId(event.target.value)}>
            {users.map((user) => <option key={user.userId} value={user.userId}>{user.name} · {user.deptOrStudentNo}</option>)}
          </select>
        </div>
      </header>

      <div className="hero">
        <div className="hero-copy">
          <span className="eyebrow">FIND YOUR PEOPLE, BUILD SOMETHING</span>
          <h1>좋은 팀은,<br /><em>좋은 연결</em>에서 시작돼요.</h1>
          <p>함께할 팀원을 찾고, 서로의 경험을 리뷰로 남겨보세요.</p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <span className="art-card card-a">TEAM<span>✳</span></span>
          <span className="art-card card-b">IDEA<span>↗</span></span>
          <span className="art-dot dot-one" /><span className="art-dot dot-two" />
        </div>
      </div>

      <main className="main-content">
        <nav className="tabs" aria-label="프로젝트 기능">
          {screens.map(([id, label], index) => (
            <button key={id} className={screen === id ? 'tab active' : 'tab'} onClick={() => setScreen(id)}>
              <span className="tab-number">0{index + 1}</span>{label}
            </button>
          ))}
        </nav>

        {(error || message) && (
          <div className={error ? 'notice error-notice' : 'notice success-notice'} role="status">
            <span>{error ? '!' : '✓'}</span>{error || message}
            <button onClick={() => { setError(''); setMessage(''); }} aria-label="메시지 닫기">×</button>
          </div>
        )}

        {screen === 'projects' && (
          <section className="screen-grid">
            <div className="section-heading">
              <div><span className="eyebrow">OPEN CALLS</span><h2>지금 모집 중인 팀</h2></div>
              <span className="count-pill">{projects.length}개의 프로젝트</span>
            </div>
            <div className="project-list">
              {projects.map((project) => (
                <article className="project-card" key={project.projectId}>
                  <div className="card-topline"><span className="course-tag">{project.courseName}</span><Status value={project.status} /></div>
                  <h3>{project.courseName} 팀 프로젝트</h3>
                  <p>{project.recruitCondition}</p>
                  <div className="project-meta">
                    <span><b>{project.approvedCount}</b> / {project.headcount}명 확정</span>
                    <span>구인자 {project.recruiterName}</span>
                  </div>
                  <button className="text-button" onClick={() => { setProjectId(String(project.projectId)); setScreen('detail'); }}>
                    자세히 보기 <span>↗</span>
                  </button>
                </article>
              ))}
              {projects.length === 0 && <div className="empty-state">아직 등록된 모집글이 없어요. 첫 번째 팀을 만들어보세요.</div>}
            </div>
            <form className="panel create-panel" onSubmit={createProject}>
              <div className="panel-heading"><div><span className="eyebrow">START A TEAM</span><h2>모집글 작성</h2></div><span className="panel-icon">＋</span></div>
              <div className="form-grid">
                <label>과목명<input required value={projectDraft.courseName} onChange={(e) => setProjectDraft({ ...projectDraft, courseName: e.target.value })} placeholder="예: 서비스디자인 스튜디오" /></label>
                <label>모집 인원<input required type="number" min="1" value={projectDraft.headcount} onChange={(e) => setProjectDraft({ ...projectDraft, headcount: Number(e.target.value) })} /></label>
                <label className="full-field">모집 조건<textarea required rows="3" value={projectDraft.recruitCondition} onChange={(e) => setProjectDraft({ ...projectDraft, recruitCondition: e.target.value })} placeholder="찾고 있는 팀원과 함께하고 싶은 방식을 적어주세요." /></label>
              </div>
              <button className="primary-button" disabled={busy || !userId}>모집글 등록 <span>→</span></button>
            </form>
          </section>
        )}

        {screen === 'detail' && (
          <section className="screen-grid detail-grid">
            <div className="panel detail-panel">
              {detail ? <>
                <div className="card-topline"><span className="course-tag">{detail.courseName}</span><Status value={detail.status} /></div>
                <h2>{detail.courseName} 팀원을 찾습니다</h2>
                <p className="detail-description">{detail.recruitCondition}</p>
                <div className="detail-facts"><span>모집 인원 <b>{detail.headcount}명</b></span><span>구인자 <b>{detail.recruiterName}</b></span><span>확정 인원 <b>{projects.find((item) => Number(item.projectId) === Number(projectId))?.approvedCount ?? 0}명</b></span></div>
                <div className="subsection-title"><h3>구인자의 공개 리뷰</h3><button className="text-button" onClick={() => showReviews(detail.recruiterId)}>리뷰 불러오기 ↗</button></div>
                <ReviewList items={reviews} empty="공개된 리뷰가 없거나 아직 불러오지 않았어요." />
              </> : <EmptySelection />}
            </div>
            <form className="panel apply-panel" onSubmit={(e) => { e.preventDefault(); apply(); }}>
              <div className="panel-heading"><div><span className="eyebrow">SAY HELLO</span><h2>이 팀에 지원하기</h2></div><span className="panel-icon">↗</span></div>
              <label>희망 역할<input required value={application.desiredRole} onChange={(e) => setApplication({ ...application, desiredRole: e.target.value })} placeholder="예: 프론트엔드 개발" /></label>
              <label>자기소개 메모<textarea required rows="5" value={application.introMemo} onChange={(e) => setApplication({ ...application, introMemo: e.target.value })} placeholder="팀에 기여할 수 있는 점을 소개해주세요." /></label>
              <button className="primary-button" disabled={busy || !projectId || detail?.status !== 'RECRUITING'}>지원서 보내기 <span>→</span></button>
            </form>
          </section>
        )}

        {screen === 'manage' && (
          <section className="panel">
            <div className="section-heading"><div><span className="eyebrow">TEAM BUILDER</span><h2>지원자 관리</h2></div><ProjectPicker projects={projects} projectId={projectId} onChange={setProjectId} /></div>
            {!isRecruiter && <div className="notice info-notice">선택한 프로젝트의 구인자 계정으로 전환하면 지원자를 관리할 수 있어요.</div>}
            {detail && <div className="manage-toolbar"><div><h3>{detail.courseName}</h3><Status value={detail.status} /></div>
              <div className="button-row">
                {detail.status === 'RECRUITING' && <>
                  <button className="secondary-button" disabled={busy || !isRecruiter} onClick={() => changeProject('closeRecruitment')}>조기 마감</button>
                  <button className="danger-button" disabled={busy || !isRecruiter} onClick={() => changeProject('cancelProject')}>모집 취소</button>
                </>}
              </div>
            </div>}
            <div className="applicant-list">
              {(detail?.memberships ?? []).filter((membership) => membership.status === 'APPLIED').map((membership) => (
                <article className="applicant-card" key={membership.membershipId}>
                  <div className="applicant-avatar">{membership.userName.slice(0, 1)}</div>
                  <div className="applicant-info"><div className="applicant-name">{membership.userName}<Status value={membership.status} /></div><p><b>희망 역할</b> {membership.desiredRole}</p><p>{membership.introMemo}</p>
                    <button className="text-button" onClick={() => showReviews(membership.userId)}>지원자 공개 리뷰 보기 ↗</button>
                  </div>
                  <div className="applicant-actions">
                    <button className="primary-button compact" disabled={busy || !isRecruiter || detail.status !== 'RECRUITING'} onClick={() => decide(membership.membershipId, 'approve')}>승인</button>
                    <button className="secondary-button compact" disabled={busy || !isRecruiter || detail.status !== 'RECRUITING'} onClick={() => decide(membership.membershipId, 'reject')}>거절</button>
                  </div>
                </article>
              ))}
              {!detail?.memberships?.some((membership) => membership.status === 'APPLIED') && <div className="empty-state">검토할 지원자가 없습니다.</div>}
            </div>
            <div className="subsection-title"><h3>공개 리뷰</h3></div><ReviewList items={reviews} empty="지원자를 선택해 공개 리뷰를 확인하세요." />
          </section>
        )}

        {screen === 'progress' && (
          <section className="panel">
            <div className="section-heading"><div><span className="eyebrow">PROJECT SPACE</span><h2>프로젝트 진행</h2></div><ProjectPicker projects={myProjects} projectId={projectId} onChange={setProjectId} /></div>
            <div className="project-list compact-list">
              {myProjects.map((project) => <button key={project.projectId} className={`project-row ${String(project.projectId) === String(projectId) ? 'selected' : ''}`} onClick={() => setProjectId(String(project.projectId))}>
                <span><b>{project.courseName}</b><small>구인자 {project.recruiterName} · {project.approvedCount}/{project.headcount}명</small></span><Status value={project.status} />
              </button>)}
              {myProjects.length === 0 && <div className="empty-state">참여 중인 프로젝트가 없습니다.</div>}
            </div>
            {detail && <div className="progress-card">
              <div className="progress-top"><div><span className="eyebrow">CURRENT STATUS</span><h3>{detail.courseName}</h3></div><Status value={detail.status} /></div>
              <div className="timeline">
                <div className={`timeline-step done`}><span>01</span><div><b>모집</b><small>팀을 만들고 동료를 찾습니다</small></div></div>
                <div className={`timeline-line ${detail.status !== 'RECRUITING' ? 'line-done' : ''}`} />
                <div className={`timeline-step ${['IN_PROGRESS', 'COMPLETED'].includes(detail.status) ? 'done' : ''}`}><span>02</span><div><b>진행</b><small>팀 프로젝트를 함께합니다</small></div></div>
                <div className={`timeline-line ${detail.status === 'COMPLETED' ? 'line-done' : ''}`} />
                <div className={`timeline-step ${detail.status === 'COMPLETED' ? 'done' : ''}`}><span>03</span><div><b>완료</b><small>서로의 경험을 리뷰로 남깁니다</small></div></div>
              </div>
              {detail.status === 'IN_PROGRESS' && <button className="primary-button" disabled={busy || !isRecruiter} onClick={() => changeProject('completeProject')}>프로젝트 완료 처리 <span>→</span></button>}
              {detail.status === 'COMPLETED' && <div className="notice success-notice">프로젝트가 완료되었습니다. 상호 리뷰를 작성해 주세요.</div>}
              {detail.status === 'CANCELLED' && <div className="notice error-notice">모집이 취소된 프로젝트입니다.</div>}
              {detail.status === 'RECRUITING' && <p className="hint">팀원을 확정하거나 조기 마감하면 프로젝트 진행 단계로 전환됩니다.</p>}
            </div>}
          </section>
        )}

        {screen === 'reviews' && (
          <section className="screen-grid detail-grid">
            <div className="panel review-compose">
              <div className="panel-heading"><div><span className="eyebrow">A THOUGHTFUL THANK YOU</span><h2>팀원에게 리뷰 남기기</h2></div><span className="panel-icon">✳</span></div>
              <label>완료된 프로젝트
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">프로젝트 선택</option>
                  {projects.filter((project) => project.status === 'COMPLETED').map((project) => <option key={project.projectId} value={project.projectId}>{project.courseName}</option>)}
                </select>
              </label>
              <form onSubmit={submitReview}>
                <label>리뷰 대상
                  <select required value={reviewDraft.targetUserId} onChange={(e) => setReviewDraft({ ...reviewDraft, targetUserId: e.target.value })}>
                    <option value="">팀원 선택</option>
                    {participants.map((participant) => <option key={participant.userId} value={participant.userId}>{participant.name} · {participant.assignedRole}</option>)}
                  </select>
                </label>
                <label>함께한 경험 점수
                  <select value={reviewDraft.sincerityScore} onChange={(e) => setReviewDraft({ ...reviewDraft, sincerityScore: Number(e.target.value) })}>
                    {[5, 4, 3, 2, 1].map((score) => <option key={score} value={score}>{'★'.repeat(score)} ({score}점)</option>)}
                  </select>
                </label>
                <label>리뷰 내용<textarea required rows="5" value={reviewDraft.comment} onChange={(e) => setReviewDraft({ ...reviewDraft, comment: e.target.value })} placeholder="함께한 팀원에게 전하고 싶은 말을 적어주세요." /></label>
                <div className="private-note"><span>◉</span><p>리뷰는 처음에 비공개로 저장돼요. 상대방도 작성하면 양쪽 리뷰가 함께 공개됩니다.</p></div>
                <button className="primary-button" disabled={busy || !projectId || detail?.status !== 'COMPLETED'}>리뷰 제출 <span>→</span></button>
              </form>
            </div>
            <div className="panel own-reviews">
              <div className="panel-heading"><div><span className="eyebrow">YOUR PUBLIC NOTES</span><h2>내 공개 리뷰</h2></div><span className="count-pill">{writtenReviews.length}</span></div>
              <p className="hint">상대방도 리뷰를 작성해 공개된 리뷰만 보여요.</p>
              <ReviewList items={writtenReviews} authored empty="아직 공개된 리뷰가 없습니다." />
            </div>
          </section>
        )}
      </main>
      <footer><span>모아팀</span><span>좋은 팀 경험은 오래 남으니까.</span><span>UNIVPRO · MVP</span></footer>
    </div>
  );
}

function ProjectPicker({ projects, projectId, onChange }) {
  return <select className="project-picker" value={projectId} onChange={(e) => onChange(e.target.value)}>
    <option value="">프로젝트 선택</option>
    {projects.map((project) => <option key={project.projectId} value={project.projectId}>{project.courseName} · {statusNames[project.status]}</option>)}
  </select>;
}

function ReviewList({ items, authored = false, empty }) {
  if (!items.length) return <div className="empty-inline">{empty}</div>;
  return <div className="review-list">{items.map((review) => <article className="review-card" key={review.reviewId}>
    <div className="review-card-top"><div className="review-avatar">{(authored ? review.targetName : review.writerName)?.slice(0, 1)}</div>
      <span><b>{authored ? `${review.targetName}에게` : review.writerName}</b><small>{review.courseName}</small></span>
      <span className="rating">{'★'.repeat(review.sincerityScore)}<i>{'★'.repeat(5 - review.sincerityScore)}</i></span>
    </div>
    <p>{review.comment}</p>
  </article>)}</div>;
}

function EmptySelection() {
  return <div className="empty-state">모집글을 선택하거나 먼저 등록해주세요.</div>;
}

export default App;
