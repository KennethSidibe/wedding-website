// Shrinks the images committed under public/img.
//
// The site shipped with camera originals: couple-1.JPG is 4096x5120 — 21
// megapixels — and is referenced six times, including as the hero background.
// A guest on a phone was downloading roughly twenty times more image than
// their screen could use. public/img totalled 21 MB.
//
// Some of the hand-made WebP files were also *larger* than the JPEGs they
// replaced (couple-6.webp 4.4 MB vs couple-6.JPG 3.5 MB), which is what
// encoding at quality 100 does.
//
// Rewrites IN PLACE, keeping every filename, so nothing referencing these
// paths has to change — templates, stylesheets and the couple's saved image
// slots all keep working. The originals stay recoverable from git history:
//
//   git checkout <commit-before-this> -- public/img
//
//   node scripts/optimize-images.js            # dry run, changes nothing
//   node scripts/optimize-images.js --apply
//
// Idempotent: a file already within the size cap and already efficiently
// encoded is skipped, so a second run is a no-op.
import sharp from "sharp";
import { readdir, stat, rename, unlink } from "fs/promises";
import path from "path";

const ROOT = 'public/img';
const MAX_EDGE = 2000;
const JPEG_QUALITY = 82;
const WEBP_QUALITY = 80;
const PNG_EFFORT = 8;

const apply = process.argv.includes('--apply');

async function walk(dir) {
    const out = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...await walk(full));
        else out.push(full);
    }
    return out;
}

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

let before = 0, after = 0, changed = 0, skipped = 0;

const files = (await walk(ROOT)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
console.log(`${files.length} images under ${ROOT}/  (${apply ? 'APPLY' : 'dry run — pass --apply to write'})\n`);

for (const file of files) {
    const original = (await stat(file)).size;
    before += original;

    const ext = path.extname(file).toLowerCase();
    const temp = file + '.opt.tmp';

    let pipeline = sharp(file, { failOn: 'error' })
        // Applies EXIF orientation before the metadata is dropped, or portrait
        // photos come out on their side.
        .rotate()
        .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true });

    if (ext === '.png') {
        // PNG stays PNG: the two here are a logo-ish graphic and a cut-out,
        // and converting either to JPEG would introduce artefacts on flat
        // colour or lose transparency.
        pipeline = pipeline.png({ effort: PNG_EFFORT, compressionLevel: 9, palette: true });
    } else if (ext === '.webp') {
        pipeline = pipeline.webp({ quality: WEBP_QUALITY, effort: 5, smartSubsample: true });
    } else {
        pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true, progressive: true });
    }

    try {
        await pipeline.toFile(temp);
    } catch (error) {
        console.log(`  skip   ${file} — ${error.message}`);
        await unlink(temp).catch(() => {});
        after += original; skipped += 1;
        continue;
    }

    const optimized = (await stat(temp)).size;

    // Never make a file bigger. Anything under a 5% saving is not worth the
    // churn in a tracked binary either.
    if (optimized >= original * 0.95) {
        await unlink(temp);
        after += original; skipped += 1;
        continue;
    }

    const pct = Math.round((1 - optimized / original) * 100);
    console.log(`  ${String(pct).padStart(3)}%   ${file.replace(ROOT + '/', '').padEnd(30)} ${kb(original).padStart(9)} -> ${kb(optimized)}`);

    if (apply) await rename(temp, file);
    else await unlink(temp);

    after += optimized; changed += 1;
}

console.log(`\n${changed} rewritten, ${skipped} left alone`);
console.log(`total: ${kb(before)} -> ${kb(after)}  (-${Math.round((1 - after / before) * 100)}%)`);
if (!apply) console.log('\nDry run — nothing written.');
