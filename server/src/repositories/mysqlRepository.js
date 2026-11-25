import { pool } from '../config/database.js';

export class MysqlRepository {
  async query(sql, values = []) {
    const [rows] = await pool.execute(sql, values);
    return rows;
  }

  async transaction(work) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await work({
        query: async (sql, values = []) => {
          const [rows] = await connection.execute(sql, values);
          return rows;
        }
      });
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
