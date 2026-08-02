import crypto from "crypto";

// In-memory admin sessions: token -> { expiry, csrf }.
// Sessions do not survive a server restart, which is fine for this admin area
// — but note that a restart while the editor is open loses unsaved edits, which
// is why /js/edit-mode.js saves per action rather than at the end of a session.
const sessions = new Map();

const SESSION_COOKIE = 'adminToken';
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function createAdminSession(res) {
    const token = crypto.randomBytes(32).toString('hex');
    const csrf = crypto.randomBytes(32).toString('hex');

    sessions.set(token, { expiry: Date.now() + SESSION_TTL_MS, csrf });

    res.cookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        // Set NODE_ENV=production on the server so the cookie is HTTPS-only
        // there, while local development over plain http still works.
        secure: process.env.NODE_ENV === 'production',
        maxAge: SESSION_TTL_MS
    });
}

function destroyAdminSession(req, res) {
    const token = getTokenFromRequest(req);
    if (token != null) {
        sessions.delete(token);
    }
    res.clearCookie(SESSION_COOKIE);
}

function getTokenFromRequest(req) {
    const cookieHeader = req.headers.cookie;
    if (cookieHeader == null) return null;

    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === SESSION_COOKIE) {
            return value;
        }
    }
    return null;
}

function getSession(req) {
    const token = getTokenFromRequest(req);
    if (token == null) return null;

    const session = sessions.get(token);
    if (session == null) return null;

    if (Date.now() > session.expiry) {
        sessions.delete(token);
        return null;
    }
    return session;
}

function isAdminAuthenticated(req) {
    return getSession(req) != null;
}

function getCsrfToken(req) {
    const session = getSession(req);
    return session == null ? '' : session.csrf;
}

// The editor is gated on a per-session flag, not only on `?edit=1`.
//
// The flag is set by GET /admin/edit — the dashboard button — and cleared when
// the admin presses Quitter, or when the dashboard notices they walked away
// without doing so. The effect is that the editor can only ever be entered
// through the dashboard: a bookmarked `/?edit=1`, or the browser's back button
// after leaving, lands on the ordinary public page rather than on an open
// editor. It costs one extra click and closes the window where an unattended
// laptop still has a live editor one Back press away.
function openEditorSession(req) {
    const session = getSession(req);
    if (session != null) session.editorOpen = true;
}

function closeEditorSession(req) {
    const session = getSession(req);
    if (session != null) session.editorOpen = false;
}

function isEditorSessionOpen(req) {
    const session = getSession(req);
    return session != null && session.editorOpen === true;
}

function requireAdmin(req, res, next) {
    if (isAdminAuthenticated(req)) {
        return next();
    }
    res.redirect('/admin/login');
}

// For the JSON write endpoints. `sameSite: 'lax'` already stops the cookie
// riding along on a cross-site POST, so this is a second lock on the same door
// — worth having now that these endpoints overwrite the live site and accept
// file uploads, rather than only reading a guest list.
function requireAdminApi(req, res, next) {
    const session = getSession(req);

    if (session == null) {
        return res.status(401).json({ ok: false, error: 'Session expirée. Reconnectez-vous.' });
    }

    const submitted = req.get('x-csrf-token') ?? req.body?.csrfToken;

    if (typeof submitted !== 'string' || submitted !== session.csrf) {
        return res.status(403).json({ ok: false, error: 'Jeton de sécurité invalide. Rechargez la page.' });
    }

    next();
}

export {
    createAdminSession,
    destroyAdminSession,
    isAdminAuthenticated,
    getCsrfToken,
    openEditorSession,
    closeEditorSession,
    isEditorSessionOpen,
    requireAdmin,
    requireAdminApi
}
