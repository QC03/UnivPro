import { MysqlRepository } from './mysqlRepository.js';

export class UserRepository extends MysqlRepository {
  findAll() {
    return this.query(
      'SELECT user_id AS userId, name, dept_or_student_no AS deptOrStudentNo, role_type AS roleType FROM users ORDER BY user_id'
    );
  }
}
