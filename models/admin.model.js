import { pool } from "../database/connection.js";

const ADMIN_TABLE_NAME = 'admin_access';

// Single-row table holding the login attempt counter and the lock flag.
// To unlock a locked admin login, the dev runs:
//   UPDATE admin_access SET locked = 0 WHERE id = 1;
async function ensureAdminAccessTable() {
    const createQuery = `CREATE TABLE IF NOT EXISTS ${ADMIN_TABLE_NAME} (
        id INT PRIMARY KEY,
        attempts INT NOT NULL DEFAULT 0,
        locked TINYINT(1) NOT NULL DEFAULT 0
    )`;
    const seedQuery = `INSERT IGNORE INTO ${ADMIN_TABLE_NAME} (id, attempts, locked) VALUES (1, 0, 0)`;

    try {
        await pool.query(createQuery);
        await pool.execute(seedQuery);
    } catch (error) {
        throw error;
    }
}

async function getAdminAccess() {
    try {
        await ensureAdminAccessTable();

        const query = `SELECT attempts, locked FROM ${ADMIN_TABLE_NAME} WHERE id = 1`;
        const [rows] = await pool.execute(query);

        if (Array.isArray(rows) && rows.length > 0) {
            return rows[0];
        }
        throw new Error('Cannot get admin access row');
    } catch (error) {
        throw error;
    }
}

async function incrementAdminAttempts() {
    try {
        const query = `UPDATE ${ADMIN_TABLE_NAME} SET attempts = attempts + 1 WHERE id = 1`;
        await pool.execute(query);
    } catch (error) {
        throw error;
    }
}

async function resetAdminAttempts() {
    try {
        const query = `UPDATE ${ADMIN_TABLE_NAME} SET attempts = 0 WHERE id = 1`;
        await pool.execute(query);
    } catch (error) {
        throw error;
    }
}

async function lockAdminAccess() {
    try {
        const query = `UPDATE ${ADMIN_TABLE_NAME} SET locked = 1 WHERE id = 1`;
        await pool.execute(query);
    } catch (error) {
        throw error;
    }
}

export {
    ADMIN_TABLE_NAME,
    getAdminAccess,
    incrementAdminAttempts,
    resetAdminAttempts,
    lockAdminAccess
}
