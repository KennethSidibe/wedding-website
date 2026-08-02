import multer from "multer";
import crypto from "crypto";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

const __dirName = dirname(fileURLToPath(import.meta.url));

// Photos the admin uploads. This sits inside public/ so express.static already
// serves it, and it is gitignored — deployment here is `git pull`, which never
// deletes untracked files, so uploads survive every deploy.
const UPLOAD_DIR = path.join(__dirName, '..', 'public', 'uploads');
const UPLOAD_URL_PREFIX = '/uploads';

const MAX_UPLOAD_BYTES = 6 * 1024 * 1024; // 6 MB

// SVG is deliberately absent: it is an XML document that can carry script, and
// it would be served from our own origin.
const ALLOWED_MIME_TYPES = new Map([
    ['image/jpeg', '.jpg'],
    ['image/png', '.png'],
    ['image/webp', '.webp'],
    ['image/gif', '.gif']
]);

mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),

    // A random name, not the uploaded one. Two reasons: the original name is
    // attacker-controlled (path traversal, overwriting an existing photo), and
    // a fresh URL for every upload sidesteps the 1-day image cache in
    // staticCache.js — swapping a photo would otherwise show stale for a day.
    filename: (req, file, cb) => {
        const extension = ALLOWED_MIME_TYPES.get(file.mimetype) ?? '.jpg';
        cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`);
    }
});

const uploadImage = multer({
    storage,
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    fileFilter: (req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            return cb(new Error('UNSUPPORTED_IMAGE_TYPE'));
        }
        cb(null, true);
    }
});

export {
    uploadImage,
    UPLOAD_DIR,
    UPLOAD_URL_PREFIX,
    MAX_UPLOAD_BYTES,
    ALLOWED_MIME_TYPES
};
