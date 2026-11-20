import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME ?? 'application_tracker',
  user: process.env.DB_USER ?? 'tracker',
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
});

export async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(30) NOT NULL UNIQUE,
      email VARCHAR(254) NOT NULL UNIQUE,
      password_hash VARCHAR(60) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stages (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(50) NOT NULL,
      position INT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_stage_name (user_id, name),
      INDEX stages_user_position (user_id, position),
      CONSTRAINT stages_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    INSERT INTO stages (user_id, name, position)
    SELECT users.id, default_stages.name, default_stages.position
    FROM users
    CROSS JOIN (
      SELECT 'Saved' AS name, 0 AS position
      UNION ALL SELECT 'Applied', 1
      UNION ALL SELECT 'Interview', 2
      UNION ALL SELECT 'Offer', 3
      UNION ALL SELECT 'Rejected', 4
    ) AS default_stages
    WHERE NOT EXISTS (SELECT 1 FROM stages WHERE stages.user_id = users.id)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS applications (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      stage_id BIGINT UNSIGNED NULL,
      company_name VARCHAR(150) NOT NULL,
      role_title VARCHAR(150) NOT NULL,
      job_link VARCHAR(2048) NULL,
      deadline DATE NULL,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX applications_user_updated (user_id, updated_at),
      INDEX applications_stage (stage_id),
      CONSTRAINT applications_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT applications_stage_fk FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE SET NULL
    ) ENGINE=InnoDB
  `);
}
