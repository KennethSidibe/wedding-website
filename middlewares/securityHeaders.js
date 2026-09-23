// Baseline response headers. Mounted BEFORE express.static, unlike
// htmlCache.js, because the header that matters most here matters most for
// uploaded files.
//
// Deliberately hand-rolled rather than pulling in helmet: three headers and a
// disable do not justify another dependency on a site with five pages, and an
// unpinned security middleware is itself a supply-chain surface.
export function securityHeaders(app) {
    // Express advertises itself on every response. It tells an attacker which
    // stack to look up CVEs for and does nothing for anyone else.
    app.disable('x-powered-by');

    return function (req, res, next) {
        // The important one for this site. The admin can upload images, they
        // are served from our own origin under /uploads, and the upload filter
        // trusts the browser-supplied MIME type. Without nosniff, a file that
        // passes as image/jpeg but contains markup can be re-interpreted as
        // HTML by the browser and run as script on our origin.
        res.setHeader('X-Content-Type-Options', 'nosniff');

        // The editor is a logged-in surface with destructive one-click actions
        // ("Rétablir le contenu d'origine"), which is exactly what clickjacking
        // is for. Nothing on this site is meant to be framed.
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');

        // Guest links out to Google Maps. Without this the full URL of the
        // page they came from travels with them; ?edit=1 and ?registered=1 are
        // not things to leak to a third party.
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

        next();
    };
}

// Deliberately NOT set here: Content-Security-Policy. The pages carry inline
// <style> and inline event wiring, so a useful policy needs either nonces
// threaded through every template or a refactor of those out — and a CSP added
// blind, without opening the site in a browser, is the kind of change that
// silently breaks the editor. It is the obvious next hardening step; do it
// with a browser open and test /?edit=1 first.
