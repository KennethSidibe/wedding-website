// Cache policy for the server-rendered pages.
//
// Why this exists: express.static (staticCache.js) gives every file under
// public/ an explicit Cache-Control, but a rendered page got **none** — only
// the weak ETag that res.send adds by default. A response with no freshness
// directive has no defined lifetime, so every cache along the way is free to
// invent one (RFC 9111 §4.2.2 "heuristic freshness"). Browsers mostly
// revalidate, but an intermediary — the host's page cache, a CDN, a mobile
// carrier proxy — may hold the page for minutes or hours. That is how a guest
// who had already opened the site kept seeing the old programme after the
// couple edited it.
//
// `no-cache` does not mean "do not cache": it means "you may store this, but
// you must revalidate before reusing it". Paired with the ETag that is already
// there, a returning visitor sends If-None-Match and gets a 304 with an empty
// body when nothing changed — measured at 0 bytes — and the full fresh page
// the moment the couple changes any slot. Correctness at nearly no cost.
//
// Deliberately NOT a res.render wrapper. Two are already stacked (lazyLoad,
// then cacheBusting) and a third that forgot to forward its callback would
// silently disable the ones above it — a bug this codebase has already had.
// Mounting this *after* staticCache means static files are served and never
// reach it, so it cannot clobber the headers set there.

// Pages behind the PIN, and the editor, must never be stored at all: a shared
// cache holding /admin or /?edit=1 would serve editor chrome — or the invitee
// list — to somebody else.
function isPrivatePage(req) {
    return req.path.startsWith('/admin') || req.query.edit === '1';
}

export function htmlCache(req, res, next) {
    if (isPrivatePage(req)) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
    } else {
        res.setHeader('Cache-Control', 'no-cache, private');
    }

    // The page varies with the admin cookie (edit chrome) even though a
    // visitor's copy is byte-identical. `private` already bars shared caches
    // from storing it; this is the belt-and-braces for one that ignores that.
    res.setHeader('Vary', 'Cookie');

    next();
}
