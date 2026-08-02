import { pool } from "../database/connection.js";

const CONTENT_TABLE_NAME = 'site_content';

// Editable page content, one row per slot. Follows the same
// CREATE TABLE IF NOT EXISTS pattern as admin.model.js — the schema is created
// on first use, so there is no migration step to run when deploying.
//
// Only slots the admin has actually changed get a row. An absent row means
// "still the template default", which is why deleting a row is how the editor
// implements "restore the original".
async function ensureContentTable() {
    const createQuery = `CREATE TABLE IF NOT EXISTS ${CONTENT_TABLE_NAME} (
        slot_key VARCHAR(100) NOT NULL PRIMARY KEY,
        slot_value TEXT,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

    await pool.query(createQuery);
}

async function getAllContent() {
    await ensureContentTable();

    const query = `SELECT slot_key, slot_value FROM ${CONTENT_TABLE_NAME}`;
    const [rows] = await pool.execute(query);

    const content = new Map();
    if (Array.isArray(rows)) {
        for (const row of rows) {
            content.set(row.slot_key, row.slot_value);
        }
    }
    return content;
}

// entries: array of [key, value]. Written in one statement so a save is either
// fully applied or not applied at all — a half-saved page is worse than a
// failed save the admin can retry.
async function upsertContent(entries) {
    if (entries.length === 0) return;

    await ensureContentTable();

    const placeholders = entries.map(() => '(?, ?)').join(', ');
    const values = entries.flat();

    const query = `INSERT INTO ${CONTENT_TABLE_NAME} (slot_key, slot_value)
        VALUES ${placeholders}
        ON DUPLICATE KEY UPDATE slot_value = VALUES(slot_value)`;

    await pool.execute(query, values);
}

// Removing the row is what restores the template default — see the note on
// ensureContentTable above.
async function deleteContent(keys) {
    if (keys.length === 0) return;

    await ensureContentTable();

    const placeholders = keys.map(() => '?').join(', ');
    const query = `DELETE FROM ${CONTENT_TABLE_NAME} WHERE slot_key IN (${placeholders})`;

    await pool.execute(query, keys);
}

export {
    CONTENT_TABLE_NAME,
    ensureContentTable,
    getAllContent,
    upsertContent,
    deleteContent
};
