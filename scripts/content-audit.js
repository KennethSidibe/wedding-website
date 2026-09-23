// Reports which editable slots the admin has actually changed.
//
// Strictly read-only: it runs a single SELECT and never creates the table.
// content.model.js would CREATE TABLE IF NOT EXISTS on import, which is a write
// — harmless, but a tool meant to inspect production should not write to it. A
// missing table is therefore a valid answer here ("nothing has ever been
// edited"), not an error.
//
//   node scripts/content-audit.js                     # uses config/.env
//   node scripts/content-audit.js --env=config/.prod.env
//   node scripts/content-audit.js --full              # do not truncate values
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { CONTENT_SLOTS } from "../constants/content.slots.js";

const args = process.argv.slice(2);
const envArg = args.find((a) => a.startsWith('--env='));
const envPath = envArg ? envArg.slice('--env='.length) : './config/.env';
const full = args.includes('--full');

dotenv.config({ path: envPath, quiet: true });

const TABLE = 'site_content';

function short(value) {
    if (value == null) return '(vide)';
    const oneLine = String(value).replace(/\s+/g, ' ').trim();
    if (oneLine === '') return '(vide)';
    if (full || oneLine.length <= 70) return oneLine;
    return oneLine.slice(0, 67) + '…';
}

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USR,
    password: process.env.MYSQL_PWD,
    database: process.env.MYSQL_WEDDING_DB
});

try {
    let rows;
    try {
        [rows] = await pool.execute(
            `SELECT slot_key, slot_value, updated_at FROM ${TABLE} ORDER BY updated_at DESC`
        );
    } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE') {
            console.log(`Table \`${TABLE}\` does not exist.`);
            console.log('=> The editor has never saved anything on this database.');
            process.exit(0);
        }
        throw error;
    }

    const defaults = new Map(CONTENT_SLOTS.map((s) => [s.key, s]));

    console.log(`env: ${envPath}   db: ${process.env.MYSQL_WEDDING_DB}@${process.env.MYSQL_HOST}`);
    console.log(`${rows.length} of ${CONTENT_SLOTS.length} slots overridden\n`);

    if (rows.length === 0) {
        console.log('=> Every slot is still the template default. No content edits.');
        process.exit(0);
    }

    const orphans = [];
    for (const row of rows) {
        const slot = defaults.get(row.slot_key);
        if (slot == null) {
            orphans.push(row);
            continue;
        }
        const when = new Date(row.updated_at).toISOString().replace('T', ' ').slice(0, 16);
        console.log(`${when}  [${slot.type}]  ${slot.label}`);
        console.log(`  key:     ${row.slot_key}`);
        console.log(`  default: ${short(slot.default)}`);
        console.log(`  now:     ${short(row.slot_value)}`);
        console.log('');
    }

    if (orphans.length > 0) {
        console.log(`WARNING — ${orphans.length} row(s) whose slot_key is no longer in`);
        console.log('constants/content.slots.js. These edits are saved but never rendered:');
        for (const row of orphans) {
            console.log(`  ${row.slot_key} = ${short(row.slot_value)}`);
        }
    }
} finally {
    await pool.end();
}
