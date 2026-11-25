CREATE DATABASE IF NOT EXISTS univpro
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE univpro;

CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  dept_or_student_no VARCHAR(100) NOT NULL,
  role_type ENUM('STUDENT', 'RECRUITER') NOT NULL DEFAULT 'STUDENT'
);

CREATE TABLE IF NOT EXISTS team_projects (
  project_id INT AUTO_INCREMENT PRIMARY KEY,
  recruiter_id INT NOT NULL,
  course_name VARCHAR(150) NOT NULL,
  headcount INT NOT NULL,
  recruit_condition TEXT NOT NULL,
  status ENUM('RECRUITING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'RECRUITING',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_team_projects_headcount CHECK (headcount > 0),
  CONSTRAINT fk_team_projects_recruiter FOREIGN KEY (recruiter_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS team_memberships (
  membership_id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  user_id INT NOT NULL,
  assigned_role VARCHAR(100),
  desired_role VARCHAR(100) NOT NULL,
  intro_memo TEXT NOT NULL,
  status ENUM('APPLIED', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPLIED',
  CONSTRAINT fk_team_memberships_project FOREIGN KEY (project_id) REFERENCES team_projects(project_id),
  CONSTRAINT fk_team_memberships_user FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  review_id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  writer_id INT NOT NULL,
  target_user_id INT NOT NULL,
  sincerity_score TINYINT NOT NULL,
  comment TEXT NOT NULL,
  visibility ENUM('PRIVATE_PENDING', 'PUBLIC') NOT NULL DEFAULT 'PRIVATE_PENDING',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_reviews_sincerity_score CHECK (sincerity_score BETWEEN 1 AND 5),
  CONSTRAINT fk_reviews_project FOREIGN KEY (project_id) REFERENCES team_projects(project_id),
  CONSTRAINT fk_reviews_writer FOREIGN KEY (writer_id) REFERENCES users(user_id),
  CONSTRAINT fk_reviews_target FOREIGN KEY (target_user_id) REFERENCES users(user_id),
  INDEX idx_reviews_target_visibility (target_user_id, visibility),
  INDEX idx_reviews_mutual_pair (project_id, writer_id, target_user_id, visibility)
);

INSERT INTO users (name, dept_or_student_no, role_type)
SELECT '김민준', '컴퓨터공학과', 'RECRUITER'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE dept_or_student_no = '컴퓨터공학과');
INSERT INTO users (name, dept_or_student_no, role_type)
SELECT '이서연', '경영학과', 'STUDENT'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE dept_or_student_no = '경영학과');
INSERT INTO users (name, dept_or_student_no, role_type)
SELECT '박지호', '산업공학과', 'STUDENT'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE dept_or_student_no = '산업공학과');
