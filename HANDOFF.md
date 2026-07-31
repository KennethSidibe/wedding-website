# HANDOFF — LegendeSheridan wedding site

**Last updated: 2026-07-30**

> Scope note: this document was written while implementing the post-registration
> "Merci" confirmation card and the site-wide dark theme. Those two are the
> verified parts. The rest of the project is described from a read of `app.js`,
> the views, and the stylesheets — the admin area and the mail/DB layers were
> **not** exercised in that session. No page was ever inspected in a real
> browser during that session; verification was HTTP-level only.

## 1. What this project is

An Express + EJS server-rendered wedding website for Légende & Sheridan
(ceremonies in Ouagadougou and Abidjan). It exists so guests can read the
programme and story, register their attendance ("Inscription des invités"), and
see how to send a gift. There is a PIN-protected admin page where the couple can
see everyone who registered. Guest data lives in MySQL.

## 2. Current state

**Verified working (this session):**

- Post-registration confirmation card on the home page. Registering on
  `/invitees` now redirects to `/?registered=1`; the home page renders a
  floating card ("Merci") that does **not** dim the background, counts down with
  a progress bar for 5 seconds, then fades out. It can also be closed early with
  the × in its top-right corner. Verified by starting the server and checking
  that the markup renders only with `?registered=1`, that
  `/js/register-toast.js` returns 200, and that the countdown CSS is served.
  The card is a white rounded panel with a filling indigo progress bar,
  modelled on a reference screenshot the owner supplied.

- Site-wide dark theme, driven by a `data-theme` attribute on `<html>`. An
  icon-only sun/moon toggle sits in the top-right corner of the navbar on every
  page. Verified that `/`, `/invitees` and `/give` all return 200 with the
  toggle, the inline theme script and `/styles/theme.css` present, and that
  `theme.css` and `/js/theme-toggle.js` serve. The **visual result of dark mode
  was never seen** — the colour choices are reasoned, not eyeballed.

**Pre-existing, uncommitted work in the tree (unverified):**

- `controllers/admin.controller.js`, `middlewares/adminAuth.js`,
  `models/admin.model.js`, `views/admin-login.ejs`, `views/admin-invitees.ejs`,
  `public/styles/admin.css` — the PIN-login admin area. Untracked in git.
- New photos `public/img/couple-7..10.JPG` and home-page style/copy changes.

**Known placeholders:**

- The Programme section in `views/index.ejs` still has `Lorem ipsum` body text
  for Église / Mairie / Réception.
- `views/index.ejs` line ~49 tells guests to click "S'enregistrer" to confirm
  their place, but both home-page buttons link to `/give`, not `/invitees`.
  Guests currently have no link to the registration form from the home page.
- The date copy is inconsistent: the hero shows `26.12.2026` while the Notre
  Mariage paragraph says the civil wedding is 8 August 2026.

**Never tested:** email sending (`nodemailer` / `node-mailjet` are dependencies
and `database/connection.js` reads mailer credentials), the admin lockout logic,
and the Jest suite (`npm test` was not run).

## 3. How to run it

```bash
npm install
node --env-file=.env app.js     # serves on http://localhost:8129
```

There is no `start` script in `package.json`; run `app.js` directly. `npm test`
runs Jest via `node --no-warnings --experimental-vm-modules`.

Required env vars (names only — **never** commit values, and there is currently
no `.env.example`; create one if you add a variable):

- `MYSQL_HOST`, `MYSQL_USR`, `MYSQL_PWD`, `MYSQL_WEDDING_DB`
- `NODEMAILER_USR`, `NODEMAILER_PWD`
- `ADMIN_PIN`

## 4. Architecture and conventions

- ESM throughout (`"type": "module"`); import paths include the `.js` extension.
- `app.js` holds every route inline — there is no router module. Routes are
  grouped by comment banners (Home / Register Invitees / Admin).
- `controllers/*.controller.js` own business logic; `models/*.model.js` own SQL;
  `database/connection.js` owns the pool and mailer credentials.
- `middlewares/` holds `cacheBusting`, `staticCache`, `lazyLoad`, `adminAuth`.
- Views are EJS in `views/`, with `header.ejs` / `navbar.ejs` / `footer.ejs`
  included by each page. `header.ejs` loads Google Fonts and Bootstrap 5.3.8.
- One stylesheet per page in `public/styles/` (`home.css`, `invites.css`, …),
  linked by that page after the `header.ejs` include. The one exception is
  `public/styles/theme.css`, which is global (loaded from `header.ejs`) and
  holds *only* dark-mode overrides plus the theme-toggle button.
- Browser JS lives in `public/js/`. Registration validation uses jQuery; the new
  confirmation card is plain DOM (no jQuery on the home page).
- Fonts: `WilliamNarasi` for `h1`, `Pinyon Script` for `h2` section titles,
  `EB Garamond` for body copy. Local faces are `@font-face`'d from
  `/public/fonts/`; the rest come from Google Fonts.
- User-facing copy is French.

## 5. Decisions already made, with reasoning

- **The confirmation card is server-flagged, not client-guessed.** `POST
  /invitee` redirects to `/?registered=1` with a 303, and `GET /` passes
  `registered: req.query.registered === '1'` into the template. The card markup
  is therefore absent from the DOM for ordinary visits, rather than rendered and
  hidden with CSS.
- **The `?registered=1` param is stripped client-side** via
  `history.replaceState` in `public/js/register-toast.js`, so a refresh does not
  replay the card.
- **The template guards with `typeof registered !== 'undefined'`.** `index.ejs`
  is only rendered from `GET /` today, but the guard means a future route can
  render it without passing the local and without throwing.
- **The 5-second countdown lives in CSS** (`register-toast-countdown`, a
  `scaleX` animation), while the dismissal is a 5000 ms `setTimeout`. Two timers
  for one duration is deliberate: the bar animates on the compositor and the JS
  owns removal. **If you change the duration, change both** —
  `DISPLAY_DURATION` in `public/js/register-toast.js` and the `5s` in
  `public/styles/home.css`.
- **No backdrop/overlay.** Explicitly requested: the card floats over the page
  without dimming it, so it is `position: fixed` at `z-index: 1050` (above the
  sticky navbar's `z-index: 10`) and never blocks the rest of the page.
- **Dark mode is triggered by the visitor's own clock, not by geolocation.**
  `new Date().getHours()` in `views/header.ejs` — dark from 19h to 07h. The
  browser clock needs **no permission prompt**; `navigator.geolocation` is the
  API that prompts, and it is deliberately not used. IP-based geolocation was
  also rejected: it needs a third-party lookup service, adds a network
  round-trip before paint, and is wrong behind a VPN — all to obtain a local
  time the browser already knows.
- **`prefers-color-scheme` is deliberately ignored.** The owner asked for
  clock-driven switching, so an OS set to dark at noon still gets the light
  site. If that ever feels wrong, `header.ejs` is the single place to change it.
- **The theme is applied by a blocking inline script in `<head>`**, not by the
  deferred `theme-toggle.js`. It must stay inline and un-deferred, otherwise the
  page paints light and then flips — the flash this avoids is the whole reason
  it is not in an external file.
- **Both `data-theme` and `data-bs-theme` are set** on `<html>`. The second is
  Bootstrap 5.3's own dark-mode hook, so form controls, tables and buttons
  restyle themselves and `theme.css` only has to cover the site's own hardcoded
  colours.
- **A manual toggle expires; it is not permanent.** Clicking the icon stores
  `{theme, auto}` under `ls-theme`, where `auto` is what the clock said at the
  moment of the click. On load the override applies only while the clock still
  agrees with `auto`; once the clock crosses the 19h/7h boundary the key is
  **deleted** and automatic behaviour resumes. An earlier build stored a bare
  `"dark"`/`"light"` string that won forever, which silently disabled the
  automatic switch — those legacy values are detected and removed on read.
  Deleting the expired key matters: without that, the old override would come
  back to life the next time the clock returned to `auto`.
- **`theme.css` overrides by specificity, not by source order.** It loads from
  `header.ejs` *before* the per-page stylesheet, so every rule is prefixed with
  `html[data-theme="dark"]` to outrank `home.css` et al. Keep that prefix on
  anything added there or it will silently lose.
- **The card title uses `Pinyon Script` at `font-weight: 700`.** Pinyon Script
  ships only a 400 weight, so the browser synthesises the bold. This was chosen
  over switching fonts to keep the card visually part of the site. If the faux
  bold reads badly, the fix is a different font — not adding `700` to the
  Google Fonts URL, which will not help.

## 6. Next steps

1. Point the home page's "S'enregistrer" button at `/invitees` (it currently
   goes to `/give`), otherwise the confirmation card is unreachable from the
   home page. Blocking: nothing.
2. Walk every page in dark mode in a real browser (`/`, `/invitees`, `/give`,
   `/admin/login`, `/admin`) and fix contrast. The likely trouble spots are the
   photo-backed sections — the hero, the `/invitees` form panel and the footer
   all put white text on an image and were left untouched. Blocking: nothing.
3. Replace the `Lorem ipsum` programme entries with real times and venues.
   Blocking: the couple's actual schedule.
4. Reconcile the conflicting wedding dates between the hero and the Notre
   Mariage paragraph. Blocking: which date is correct.
5. Commit the admin area — it is a complete-looking feature sitting untracked.
   Review `middlewares/adminAuth.js` for session/cookie handling before
   deploying it. Blocking: a review pass; it has not been tested.
6. Add a `.env.example` listing the variable names in §3.

## 7. Traps

- **`res.redirect('/')` after a POST defaults to 302**, which lets some clients
  re-issue the POST. The registration redirect is explicitly `303`. Keep it that
  way for any new POST-then-redirect route.
- **`res.render('index.ejs')` with no locals throws** if the template reads an
  undefined variable — EJS does not treat missing locals as `undefined` unless
  you guard with `typeof`. This is why the card block is wrapped in
  `typeof registered !== 'undefined'`.
- **`views/index.ejs` has mismatched heading tags** (`<h2 …>…</h1>` on the date
  rows, `<h4 …>…</h2>` on the locations). The browser recovers, but editing near
  those lines is confusing — do not "fix" them incidentally without checking the
  styling that hangs off `.dates-row h2` / `.dates-row h4` in `home.css`.
- **`public/styles/admin.css` references `./fonts/cherolina/Cherolina.otf`**
  (relative) where every other stylesheet uses `/fonts/...` (absolute). The
  relative path resolves against `/styles/`, so that font almost certainly 404s
  on the admin pages.
- **Bump `version` in `package.json` whenever you change a CSS or JS file.**
  `staticCache` serves `.css`/`.js` with `max-age=604800` (7 days) and
  `cacheBusting` appends `?v=<package version>` as the only invalidation
  mechanism. Ship a stylesheet edit without bumping and returning visitors keep
  the old file for a week. Bumped to `1.1.3` on 2026-07-30 for this reason.
- **`res.render` is wrapped twice — a wrapper must forward its callback.**
  `lazyLoad` (registered first, so innermost) and `cacheBusting` both replace
  `res.render`. `lazyLoad` originally ignored the `callback` argument and
  called `res.send` itself, which silently swallowed `cacheBusting` — no `?v=`
  was ever emitted, so the 7-day cache above had no way to be invalidated at
  all. Fixed 2026-07-30 by having `lazyLoad` call the callback when it is
  given one. Any third render wrapper must do the same, and the symptom is
  invisible: the page renders fine, the outer wrapper just never runs.
- **`mix-blend-mode: darken` erases the programme timeline in dark mode.**
  `.vertical-line` and `.circle-dash` in `home.css` blend with `darken`, which
  keeps whichever colour is darker — a light dash over a near-black page
  disappears completely. `theme.css` resets those to `mix-blend-mode: normal`.
  Any new decorative element using a blend mode needs the same treatment.
- **The theme toggle is `position: absolute` inside `.m-nav`.** That works only
  because `navbar.css` makes `.m-nav` sticky (a positioned ancestor). Note that
  `give.css` also declares `.m-nav` *without* a `position`; if `navbar.css` ever
  stops being loaded on a page, the button will fly to the top of the viewport.
- **The toggle may overlap the `Légende + Sheridan` title on narrow screens.**
  The `h1` is `display-1` at `5rem` and the button is pinned to the top-right
  corner. It is shrunk under 576px, but this was never checked on a real phone.
- **Duplicate `@font-face` blocks** for WilliamNarasi and Cherolina exist in
  `home.css`, `footer.css`, and `admin.css`. Changing a font path means changing
  it in all three.
