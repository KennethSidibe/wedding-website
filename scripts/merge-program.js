// One-time migration for the 2026-09-22 change from two programme timelines
// to one.
//
// The programme used to be two lists behind a tab bar, `home.program.locA.*`
// (Abidjan) and `home.program.locB.*` (Ouagadougou). It is now a single list
// under `locA`, because each entry carries its own place and map link. The
// locA rows keep working untouched — that is why the prefix was left alone —
// but the locB rows are no longer read by anything. This appends them to the
// end of the locA timeline so the couple's Ouagadougou entries stay on the
// site, then removes the dead locB rows.
//
//   node scripts/merge-program.js                       # dry run, changes nothing
//   node scripts/merge-program.js --apply               # writes
//   node scripts/merge-program.js --env=config/.prod.env --apply
//
// Safe to run twice: once the locB rows are gone there is nothing left to
// move, and it says so instead of appending anything a second time.
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import {
    MAX_PROGRAM_ITEMS,
    MIN_PROGRAM_ITEMS
} from "../constants/content.slots.js";

const args = process.argv.slice(2);
const envArg = args.find((a) => a.startsWith('--env='));
const envPath = envArg ? envArg.slice('--env='.length) : './config/.env';
const apply = args.includes('--apply');

dotenv.config({ path: envPath, quiet: true });

// The three entries the site shipped with, as they were BEFORE this migration.
// They are reproduced here rather than imported because the registry no longer
// describes locB at all — and because what has to be preserved is what the
// page actually showed a guest, which for a slot with no row was its default.
// Without this, an entry the couple never retyped would migrate as empty.
const LEGACY_PRESETS = [
    { title: 'Église', text: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Alias odio,' },
    { title: 'Mairie', text: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Alias odio,' },
    { title: 'Réception', text: 'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Alias odio, lore' }
];

const FIELDS = ['title', 'time', 'text', 'place', 'map'];

function legacyDefault(index, field) {
    const preset = LEGACY_PRESETS[index - 1] ?? null;
    if (preset === null) return '';
    if (field === 'title') return preset.title;
    if (field === 'text') return preset.text;
    return '';
}

function readCount(rows, locationId) {
    const raw = rows.get(`home.program.${locationId}.count`);
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return LEGACY_PRESETS.length;
    return Math.min(Math.max(parsed, MIN_PROGRAM_ITEMS), MAX_PROGRAM_ITEMS);
}

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USR,
    password: process.env.MYSQL_PWD,
    database: process.env.MYSQL_WEDDING_DB
});

try {
    let raw;
    try {
        [raw] = await pool.execute('SELECT slot_key, slot_value FROM site_content');
    } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE') {
            console.log('Table `site_content` does not exist — nothing was ever edited.');
            process.exit(0);
        }
        throw error;
    }

    const rows = new Map(raw.map((r) => [r.slot_key, r.slot_value]));

    console.log(`env: ${envPath}   db: ${process.env.MYSQL_WEDDING_DB}@${process.env.MYSQL_HOST}`);
    console.log(apply ? 'mode: APPLY\n' : 'mode: dry run (pass --apply to write)\n');

    const locBKeys = [...rows.keys()].filter((k) => k.startsWith('home.program.locB.'));
    if (locBKeys.length === 0) {
        console.log('No `home.program.locB.*` rows. Nothing to migrate.');
        process.exit(0);
    }

    const locACount = readCount(rows, 'locA');
    const locBCount = readCount(rows, 'locB');
    const total = locACount + locBCount;

    console.log(`Abidjan timeline:      ${locACount} entries (kept as entries 1-${locACount})`);
    console.log(`Ouagadougou timeline:  ${locBCount} entries (becoming entries ${locACount + 1}-${total})`);

    if (total > MAX_PROGRAM_ITEMS) {
        console.error(
            `\nRefusing: ${total} entries exceeds MAX_PROGRAM_ITEMS (${MAX_PROGRAM_ITEMS}).`
            + '\nRaise it in constants/content.slots.js, or delete some entries first.'
        );
        process.exit(1);
    }

    const writes = [];
    for (let i = 1; i <= locBCount; i += 1) {
        const target = locACount + i;
        console.log(`\n  Ouagadougou entry ${i}  ->  entry ${target}`);

        for (const field of FIELDS) {
            const fromKey = `home.program.locB.item${i}.${field}`;
            const toKey = `home.program.locA.item${target}.${field}`;

            // What the page actually rendered: the saved row if there is one,
            // otherwise the default that slot used to carry.
            const stored = rows.get(fromKey);
            const value = (stored == null || stored === '')
                ? legacyDefault(i, field)
                : stored;

            if (value === '') continue;

            const shown = value.length > 54 ? value.slice(0, 51) + '…' : value;
            console.log(`      ${field.padEnd(6)} ${shown}`);
            writes.push([toKey, value]);
        }
    }

    writes.push(['home.program.locA.count', String(total)]);
    console.log(`\n  home.program.locA.count -> ${total}`);
    console.log(`\n${writes.length} row(s) to write, ${locBKeys.length} locB row(s) to delete.`);

    if (!apply) {
        console.log('\nDry run — nothing written. Re-run with --apply to commit.');
        process.exit(0);
    }

    // One transaction: a half-applied merge would leave the timeline claiming
    // more entries than it has content for.
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        for (const [key, value] of writes) {
            await connection.execute(
                `INSERT INTO site_content (slot_key, slot_value) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE slot_value = VALUES(slot_value)`,
                [key, value]
            );
        }

        const placeholders = locBKeys.map(() => '?').join(', ');
        await connection.execute(
            `DELETE FROM site_content WHERE slot_key IN (${placeholders})`,
            locBKeys
        );

        await connection.commit();
        console.log('\nDone. Restart the app (or wait 60s) for the change to appear.');
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
} finally {
    await pool.end();
}
