# HANDOFF — LegendeSheridan wedding site

**Last updated: 2026-09-22**

> Scope note: the 2026-09-22 session also cut the **home page from 4065 KB to
> 683 KB** and added on-upload image optimisation (§15), and ran a **security
> review** (§14):
> `npm audit` went from 16 vulnerabilities to 0 (including a deliberate
> nodemailer 8 → 10 major bump), and baseline security headers were added. It
> replaced the two-city programme with **one
> timeline whose entries each carry a place and a Google Maps link** (§13), and
> migrated the couple's Ouagadougou entries onto it. **The migration has not
> been run against production yet — see §13.5; until it is, their Ouagadougou
> entries are in the database but not on the page.**
>
> (Revised later the same day: the map-link control was an icon and is now a
> labelled pill — §13.7.)
>
> The 2026-09-18 session fixed a **stale-content bug** — the couple
> edited the Programme, the rows were in the production database, and the site
> kept serving the template defaults. Two causes, both fixed and verified
> end-to-end: rendered pages sent no `Cache-Control` at all, and the server's
> content cache only reloaded at boot. See **§12**. It also added
> `scripts/content-audit.js`, which reports what the couple has actually
> changed. No feature work was done in that session.
>
> The 2026-08-03 session built the **admin page editor** (§8) and then revised
> it against the owner's feedback after they used it. Everything is exercised
> end-to-end over HTTP — login, the editor-session gate, save, upload, reset,
> and the rejection paths — but **no page was ever opened in a real browser by
> the agent**, so the editor's appearance and its in-place typing behaviour
> remain unverified from this side. See §8.6.
>
> Earlier sessions produced the "Merci" confirmation card and the dark theme;
> those are described below and were also verified HTTP-only.

## 1. What this project is

An Express + EJS server-rendered wedding website for Légende & Sheridan
(ceremonies in Ouagadougou and Abidjan). It exists so guests can read the
programme and story, register their attendance ("Inscription des invités"), and
see how to send a gift. There is a PIN-protected admin page where the couple can
see everyone who registered. Guest data lives in MySQL.

Since 2026-08-01 the couple can also **edit the site's text, photos and button
colours themselves**, from the site itself, without touching code. That is §8.

## 2. Current state

**Regression pass before the 2026-08-03 commit (over HTTP, one clean server):**

Everything in §9–§11 was re-checked against a running server before those
changes were committed:

- `/`, `/invitees`, `/give`, `/admin/login` → 200; `/admin` → 302 when logged
  out. Every changed asset serves 200 with a `?v=1.13.0` cache-buster.
- All nine `views/*.ejs` compile; all changed `.js` pass `node --check`.
- A visitor's `/` and a visitor's `/?edit=1` are **byte-identical**, and neither
  contains any `ls-slot`, edit-mode stylesheet, or programme hint text.
- Admin flow: PIN login → `/admin` → `/admin/edit` → `/?edit=1` renders the
  editor chrome (`#lsEditBar`, `#lsConfirm`, `#lsColorPicker`,
  `#lsButtonOverlay`), 89 text slots, 8 photo slots and 18 hidden programme
  rows. `/give?edit=1` gives 13 slots.
- Save/reject paths: valid batch → `{"ok":true,"saved":3}`; unknown key
  (`home.program.locC.*`) → 400; missing CSRF → 403; missing cookie → 401;
  over-limit title → 400; empty **required** title → 400; empty **optional**
  time → 200; `count: 999` clamps to 12 visible entries.
- Upload: an SVG is refused with 400 before it is written; a PNG lands in
  `public/uploads/` with a random name and serves 200. **Field name is `photo`,
  not `image`** — `image` returns a 500 (`LIMIT_UNEXPECTED_FILE`), which is a
  poor error for a plain field-name mistake but is not reachable from the real
  editor.
- Quitter → `/admin` and `/admin/edit` both 302 to the login and `/?edit=1`
  becomes byte-identical to the anonymous page.
- Reset (`page: "home"`, `includeSite: true`) restores all 100 keys.

The `site_content` table and `public/uploads/` were both left **empty**, exactly
as they were found: the post-reset visitor HTML was diffed against a capture
taken before the first write and is byte-identical.

**`npm test` fails, and it failed before these changes too.**
`dataCreateInviteeValid.test.js` asserts that `null@null.com` is invalid;
`deep-email-validator` now accepts it. `controllers/invitees.controller.js` is
untouched by this work, so this is not a regression — but it does mean the suite
is not currently a green baseline. See §7.

**Still not verified in a browser** — nothing in §8.6, §9.6, §10.4 or §11.6 has
been eyeballed. That gap is unchanged.

**Verified working (2026-08-01, over HTTP — never seen in a browser):**

- The admin page editor. See §8 for the full design, and §8.7 for the revision
  made after the owner used it. Exercised end to end: PIN login → `/admin` →
  the "Modifier les pages du site" card → `/admin/edit` → the home page renders
  22 editable text fields, 8 photo slots (including the two decorative strips)
  and 3 colour slots; a batch save of text, rich text, photos and colours was
  written and appeared on the live page; a photo upload landed in
  `public/uploads/` with a random name; and "rétablir cette page" removed all 33
  rows, colours included, and the site returned to its original copy. The
  database was left empty (every slot on its default) and the test upload
  deleted, so the repo is in its pre-editor state content-wise.
- The editor-session gate, checked in all five directions: `?edit=1` typed
  directly while logged in → no editor; through `/admin/edit` → editor; loading
  `/admin` with the editor still open → the "Mode édition fermé" card, the flag
  cleared, and the card *not* shown again on the next load; `POST
  /admin/edit/exit` → editor closed; `/admin/edit` while logged out → 302 to
  the login page.
- The rejection paths all behave: no CSRF header → 403, no cookie → 401,
  unknown slot key → 400, over the character limit → 400, an off-site image
  URL → 400, a malformed colour → 400, an SVG upload → refused before it is
  written to disk.
- `/invitees?edit=1` opened by a logged-in admin returns a response
  **byte-identical** to the anonymous one (verified with `diff`). The
  registration form is locked by construction — see §8.2.

**Verified working (earlier sessions):**

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

**Now committed** (this was listed as untracked in the 2026-07-30 handoff): the
PIN-login admin area — `controllers/admin.controller.js`,
`middlewares/adminAuth.js`, `models/admin.model.js`, `views/admin-login.ejs`,
`views/admin-invitees.ejs`, `public/styles/admin.css` — landed in commit
`398d7b4`. The login and lockout logic still has no automated test; only the
happy path was exercised, while testing the editor on 2026-08-01.

**Known placeholders:**

- The Programme section still has `Lorem ipsum` body text for Église / Mairie /
  Réception. These now live in `constants/content.slots.js` as the slot
  defaults, and the couple can replace them from the editor without a deploy —
  which is the intended fix, rather than editing the file.
- The date copy is inconsistent: the hero shows `26.12.2026` while the Notre
  Mariage paragraph says the civil wedding is 2 January 2027 in Ouagadougou.
  Both are now editable slots, so this is fixable without a deploy.

(The 2026-07-30 handoff listed the "S'enregistrer" button as pointing at
`/give`. It points at `/invitees` in the current tree — resolved.)

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
- `NODE_ENV` — set it to `production` on the server. It is what makes the admin
  session cookie `secure` (HTTPS-only). Leaving it unset is safe locally and
  is why plain-http development still works.

To exercise the admin area without reading the real PIN out of `config/.env`,
start the server with the variable already set:

```bash
ADMIN_PIN=some-test-pin node app.js
```

`dotenv` does not overwrite a variable that is already in `process.env`, so the
injected value wins and the real secret is never read. This is how the editor
was tested on 2026-08-01.

The editor also needs a writable `public/uploads/`. It is created automatically
at boot by `middlewares/uploadImage.js` and is gitignored.

## 4. Architecture and conventions

- ESM throughout (`"type": "module"`); import paths include the `.js` extension.
- `app.js` holds every route inline — there is no router module. Routes are
  grouped by comment banners (Home / Register Invitees / Admin).
- `controllers/*.controller.js` own business logic; `models/*.model.js` own SQL;
  `database/connection.js` owns the pool and mailer credentials.
- `middlewares/` holds `cacheBusting`, `staticCache`, `lazyLoad`, `adminAuth`,
  and — added for the editor — `contentLocals` and `uploadImage`.
- `constants/content.slots.js` is the registry of everything the admin may edit;
  it is the first file to read before touching the editor (§8).
- Views are EJS in `views/`, with `header.ejs` / `navbar.ejs` / `footer.ejs`
  included by each page. `header.ejs` loads Google Fonts and Bootstrap 5.3.8.
- One stylesheet per page in `public/styles/` (`home.css`, `invites.css`, …),
  linked by that page after the `header.ejs` include. Three are global, loaded
  from `header.ejs`: `theme.css` (dark-mode overrides and the theme toggle,
  nothing else), `toast.css` (the floating confirmation card, shared by the home
  and admin pages), and `edit-mode.css` (loaded only in edit mode).
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

1. **Open the editor in a real browser** and walk it: `/admin` → the edit card →
   type in a paragraph, hit a character limit, upload a photo, change a colour,
   save, exit. This is the single biggest gap — every line of
   `public/js/edit-mode.js` and `public/styles/edit-mode.css` is unexercised by
   a human. Blocking: nothing. Details of what to watch for are in §8.6.
2. Walk every page in dark mode in a real browser (`/`, `/invitees`, `/give`,
   `/admin/login`, `/admin`) and fix contrast. The likely trouble spots are the
   photo-backed sections — the hero, the `/invitees` form panel and the footer
   all put white text on an image and were left untouched. Blocking: nothing.
3. Replace the **remaining** `Lorem ipsum` programme entries. The couple began
   this themselves on 2026-09-13 (Abidjan item 1 is "Cérémonie de Dot",
   Ouagadougou item 1 is "Mariage traditionnel"), but `home.program.locA.item3`
   is still literally `Titre 3` / `Lorem ipsum`. Run
   `node scripts/content-audit.js --env=config/.prod.env` to see exactly where
   they stopped. Blocking: the rest of the couple's schedule.
4. Reconcile the conflicting wedding dates between the hero and the Notre
   Mariage paragraph. Blocking: which date is correct.
5. Add a `.env.example` listing the variable names in §3, including `NODE_ENV`.
6. Consider Tier 3 of the editor plan — a catalogue of reusable blocks the admin
   can add, reorder by drag-and-drop, and assemble into brand-new pages. It was
   deliberately deferred; §8.5 records why and what it would take.

## 7. Traps

- **Content the couple saved can silently stop appearing, and the page gives no
  hint that anything is wrong** — it renders the template defaults as if they
  had never edited anything. Two separate caches cause this; both are now
  mitigated, and **§12 is the whole story**. The fast checks:
  `node scripts/content-audit.js --env=config/.prod.env` to confirm the rows
  exist, then `curl -sD - -o /dev/null https://<site>/ | grep -i cache-control`
  to confirm nothing in front of Node is holding the page.
- **Do not move `app.use(htmlCache)` above `app.use(staticCache(publicPath))`**
  in `app.js`. It would drop every static asset to `no-cache`. See §12.2.
- **`public/css/` is empty — the stylesheets live in `public/styles/`.** A
  request for `/css/style.css` 404s and returns `no-cache, private`, which
  looks exactly like a caching bug and is not one. See §12.2.
- **`npm test` is red on `main` and has nothing to do with the editor.**
  `dataCreateInviteeValid.test.js:16` expects `null@null.com` to be rejected;
  `deep-email-validator` performs a live MX/SMTP lookup and now accepts it. The
  assertion is network-dependent by construction. Do not "fix" unrelated code
  chasing it — either stub the validator or drop that one assertion.
- **Kill the old server before starting a new one.** `app.js` hardcodes port
  8129 and a second instance does *not* fail loudly — the first one keeps the
  port and answers every request, so you end up testing stale code with stale
  env vars. An hour was lost on 2026-08-03 to an `ADMIN_PIN=…` override that
  appeared to be ignored; it was simply going to a process that no longer had
  the socket. Check with `lsof -nP -iTCP:8129 -sTCP:LISTEN` before trusting a
  result, and `pkill -f "node app.js"` between runs.
- **`POST /admin/upload` reads the file field `photo`.** Sending it as `image`
  produces a multer `LIMIT_UNEXPECTED_FILE`, which the route funnels into a
  **500** rather than a 400 — so a field-name typo looks like a server crash.
- **`resetPageContent` reports `reset: keys.length`, not rows deleted.** A
  reset of the home page always answers `100` whether or not anything was
  stored. Do not read it as "100 rows were removed".
- **`res.redirect('/')` after a POST defaults to 302**, which lets some clients
  re-issue the POST. The registration redirect is explicitly `303`. Keep it that
  way for any new POST-then-redirect route.
- **`res.render('index.ejs')` with no locals throws** if the template reads an
  undefined variable — EJS does not treat missing locals as `undefined` unless
  you guard with `typeof`. This is why the card block is wrapped in
  `typeof registered !== 'undefined'`.
- **The hero's mismatched heading tags are fixed** (they were `<h2 …>…</h1>`
  and `<h4 …>…</h2>`). The block was rewritten on 2026-08-03 when the dates
  moved to the corner of the photo, and the tags were closed properly at the
  same time. Nothing changed structurally: `.dates-row h2` / `.dates-row h4` in
  `home.css` target the elements the browser was already creating.
- **`public/styles/admin.css` references `./fonts/cherolina/Cherolina.otf`**
  (relative) where every other stylesheet uses `/fonts/...` (absolute). The
  relative path resolves against `/styles/`, so that font almost certainly 404s
  on the admin pages.
- **Editing a template's copy no longer changes the live site once the admin has
  edited that slot.** The saved value wins over the template default. If a text
  change "does nothing", check `site_content` for a row with that slot key —
  the fix is to reset the slot from the editor, not to keep editing the file.
  Editing the default in `constants/content.slots.js` only affects slots the
  admin has never touched.
- **`public/uploads/` is gitignored and lives only on the server.** It is safe
  under `git pull` deployment, which does not delete untracked files. Any move
  to a clean-checkout or directory-replacing deploy destroys the couple's
  uploaded photos — see §8.4 before changing how this deploys.
- **Do not add a third `res.render` wrapper.** `contentLocals` uses `res.locals`
  specifically to avoid joining `lazyLoad` and `cacheBusting` on that stack;
  the failure mode is silent (see the entry below).
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

## 8. The admin page editor (built 2026-08-01)

### 8.1 What it is

The couple can change the site's **text, photos and button colours themselves**,
from the site itself. There is no separate CMS screen: they log in at
`/admin/login`, click the photo-backed card at the top of `/admin`, and land on
the real home page with `?edit=1`. A blue circle and a large rounded white panel
across the top say "Mode édition"; the editable text is dashed-outlined, photos
grow a "Changer la photo" button on hover, and nothing is published until
**Enregistrer** is pressed.

Scope was capped deliberately at editing existing content. The admin cannot add
sections, move anything, change fonts or sizes, or create pages. See §8.5.

### 8.2 How the design is protected

This is the part to understand before changing anything, because it is what
keeps a non-technical edit from breaking the layout:

- **`constants/content.slots.js` is the whole contract.** A slot that is not in
  that file cannot be written — the save endpoint rejects unknown keys. Locking
  the registration form therefore took no code: `views/invites.ejs` has no
  slots, and `/invitees` is absent from `EDITABLE_PAGES` in
  `middlewares/contentLocals.js`, so `?edit=1` there is inert. Verified: an
  admin's `/invitees?edit=1` is byte-identical to a visitor's `/invitees`.
- **Every slot carries its own default**, copied from the template it replaced.
  A missing row, an empty value or a dead database all fall back to it, so the
  site renders exactly as it did before this feature existed. **A MySQL outage
  must never blank the wedding site**, and this is why it cannot.
- **`max` on each slot is the layout guard**, counted in visible characters and
  enforced three times: the editor refuses the keystroke, the paste handler
  truncates, the server rejects. The values are tuned per position — 16 for a
  hero date, 30 for a location (`.location-title` is `white-space: nowrap`
  inside a `flex-wrap: nowrap` row and genuinely cannot grow), 900 for a body
  paragraph.
- **Rich text is a five-tag whitelist** (`b/strong/i/em/u/br`). The sanitiser
  escapes *everything* first and then selectively un-escapes the whitelist,
  rather than stripping bad tags — so attributes, event handlers and unknown
  elements are already inert text before the whitelist runs, and there is no
  bypass to find. A paste from Word arrives as plain text, which is the single
  most likely way an admin could have wrecked the design.
- **The editor never alters the page's geometry.** Editable fields, photos and
  buttons are marked with `outline` (painted outside the box, no reflow) and
  never `border`; the hover controls are fixed-position elements that are never
  inserted into the page's DOM; the top bar is `position: fixed` with a matching
  `body { padding-top }` measured from the bar's real height.
- **`overflow-wrap: break-word` on every text block** (`home.css`, `give.css`).
  A long unbroken string — a URL, or someone simply typing without spaces — has
  no break opportunity and ran straight out of its column and over the
  neighbouring content. This was a pre-existing flaw in the site, not something
  the editor introduced; the editor just made it easy to hit.
- **Colours are published as CSS custom properties** in `views/header.ejs`
  (`--ls-btn-bg`, `--ls-btn-text`, `--ls-hero-text`, `--ls-hero-image`). The
  stylesheets stay the only thing that decides *how* anything looks; the admin
  supplies a value, never a rule.

### 8.3 The files

| File | Owns |
| --- | --- |
| `constants/content.slots.js` | Every editable slot: key, type, label, `max`, default. **Start here.** |
| `models/content.model.js` | The `site_content` table (`CREATE TABLE IF NOT EXISTS`, as `admin.model.js` does). |
| `controllers/content.controller.js` | The in-memory cache, validation, and the sanitiser. |
| `middlewares/contentLocals.js` | `res.locals.slot()` / `imgSrc()`, and `EDITABLE_PAGES`. |
| `middlewares/uploadImage.js` | Multer config: 6 MB cap, mime whitelist, random filenames. |
| `views/edit-bar.ejs` | The editor chrome. Only ever included inside an `if (editMode)`. |
| `public/js/edit-mode.js` | All editor behaviour. |
| `public/styles/edit-mode.css` | All editor styling. |

Routes added to `app.js`: `GET /admin/edit`, `POST /admin/content`,
`POST /admin/content/reset`, `POST /admin/upload`.

### 8.4 Decisions, with reasoning

- **Content is read from an in-memory cache, not from MySQL per render.** The
  EJS helpers are synchronous — templates cannot `await`. The cache is loaded at
  boot and refreshed after every write, and there is exactly one server process,
  so it cannot go stale. An empty cache is a valid state, not an error.
- **`contentLocals` does not wrap `res.render`.** Two wrappers are already
  stacked (`lazyLoad`, then `cacheBusting`) and a third would have to forward
  its callback correctly or silently swallow the others — a bug that already
  happened here once and is invisible when it does (see §7). `res.locals`
  achieves the same thing with none of that risk. **Do not add a third render
  wrapper.**
- **Deleting a row is how "restore the original" works.** Only slots the admin
  actually changed have rows, so absent means "still the default". This is why
  reset is a `DELETE` and not a write-back of defaults.
- **Uploads get random filenames**, never the uploaded one. The original name is
  attacker-controlled (traversal, overwriting an existing photo), and a fresh
  URL per upload sidesteps the 1-day image cache in `staticCache.js` — swapping
  a photo at a stable URL would otherwise show stale for a day.
- **Uploads live in `public/uploads/` and are gitignored.** Deployment here is
  `git pull`, which never deletes untracked files, so they survive every deploy.
  If deployment ever changes to a clean checkout or a directory replacement,
  **this breaks and the couple's photos are lost** — move the directory outside
  the repo and serve it with `express.static` before making that change.
- **SVG uploads are refused.** It is an XML document that can carry script, and
  it would be served from our own origin.
- **CSRF tokens on the write endpoints.** `sameSite: 'lax'` already stops the
  cookie riding along on a cross-site POST, so this is a second lock on the same
  door — worth having now that these endpoints overwrite the live site and
  accept file uploads, rather than only reading a guest list.
- **The admin's colour choice wins in dark mode too.** `theme.css` falls back to
  the dark accent only when the admin has never touched the colour; otherwise
  the picker would look broken at night. Button hover is `brightness()` on the
  chosen colour rather than a second hardcoded value, for the same reason.
- **Colours reset separately from pages.** They are `site.*` slots, shared by
  both pages, so "rétablir cette page" cannot restore them without a surprising
  side effect on the other page. The colour panel has its own reset.
- **The editor chrome stays light in dark mode**, deliberately: it is a tool,
  not part of the site, and a constant appearance makes it obvious which pixels
  belong to the wedding and which belong to the editor.

### 8.5 What was deliberately NOT built

A true drag-and-drop page builder (free canvas, arbitrary elements, new pages).
It was scoped out with the owner on 2026-08-01: it is weeks of work, and
free positioning is precisely the thing that breaks a design on mobile — it
would have fought the stated goal that "the original design stays".

The agreed path if it is ever wanted ("Tier 3") is **not** a free canvas: a
fixed catalogue of block types built from the existing design language (text
left / photo right, timeline entry, centred paragraph, button), each an EJS
partial styled by the existing CSS, so a new block cannot look off-brand.
Drag-and-drop would then mean reordering blocks vertically in a list, never
dropping them at coordinates. A new page becomes a row in a `pages` table plus
its blocks, served by one `/p/:slug` route. Roughly as much work again as
everything in §8 combined.

### 8.6 What is NOT verified

**No page was opened in a browser.** All verification was HTTP-level. Unknown
in particular:

- How the editor actually *looks*: the blue circle overlapping the white panel,
  whether the panel is too tall on a laptop, whether the dashed outlines on the
  hero dates are legible over the photo.
- **In-place typing.** `contenteditable` behaviour is the least portable thing
  in the browser. The `beforeinput` length guard, `execCommand("insertLineBreak")`
  for Enter in paragraphs (with an `insertHTML` fallback), and
  `execCommand("insertText")` for paste are all deprecated-but-universal APIs
  that were never run. Test in Safari as well as Chrome — the couple are likely
  on iPhones and Macs.
- **The editor on a phone.** The bar's buttons wrap at ≤720px and the hint text
  is hidden, but the resulting height was never seen. `--ls-edit-offset` is
  measured by JS so the offset should follow, but that path is untested.
- The photo overlay's hover/scroll tracking, which uses `mousemove` and has no
  touch equivalent — **changing a photo on a touch device may not work at all**.
  That is the most likely real defect in the feature.

### 8.7 Revision of 2026-08-01 (after the owner used the editor)

Everything below changed in response to using the first build. Read this before
"fixing" any of it back.

- **The editor is now entered only through the dashboard.** `GET /admin/edit`
  sets `session.editorOpen`; `contentLocals` requires that flag *as well as*
  `?edit=1` and the admin cookie. A bookmarked `/?edit=1`, or the back button
  after leaving, renders the ordinary public page. **Do not "simplify" this back
  to a query-string check** — the flag is the whole protection. It is cleared by logging out and by loading `/admin`; Quitter goes further and
  destroys the session outright (§8.8).
- **Leaving with the back button is caught.** Loading `/admin` with the flag
  still set renders a "Mode édition fermé" card and clears the flag. The card is
  the *same* component as the post-registration "Merci" card, and it lives
  inside `/admin`, which is behind `requireAdmin` — so it is only ever seen by
  the logged-in admin and leaks nothing to a visitor.
- **`.register-toast` moved out of `home.css` into `public/styles/toast.css`**,
  loaded globally from `header.ejs`, because the admin page needed the same card
  and a second copy would have drifted. `register-toast.js` was generalised to
  drive both (it now matches `.register-toast-close` by class, not by id). The
  dark-mode overrides stayed in `theme.css`.
- **Buttons are edited in place, not from a panel.** The old "Couleurs" button
  and its panel in the bar are gone. Hovering a `.give-btn` floats a control
  **above** it (`#lsButtonOverlay`) with one chip per colour it owns. Above,
  not centred: the button's label is itself editable text and a centred control
  would cover the thing being edited.
- **Links wrapping editable content are neutralised.** Clicking the button text
  to edit it used to follow the `<a>` and navigate away. The click handler only
  cancels links that *contain* a `.ls-slot` or `[data-color-slots]`, so the
  navbar and footer still navigate — the editor must not trap the admin on one
  page.
- **A hand-rolled colour picker** (`#lsColorPicker`): saturation/value square
  built from two stacked CSS gradients, a hue strip, twelve swatches and a hex
  field, applying live to the page as it is dragged. Written by hand rather than
  pulled from a CDN — the site has no build step and no bundler, and a fourth
  external stylesheet for one widget was not worth it. `trackPointer()` uses
  pointer events, so it works with touch as well as a mouse.
- **Photos carry a permanent dashed outline** like the text does, plus a glow on
  hover; the "Changer la photo" button still only appears on hover. Before this,
  a photo gave no sign it was editable until the mouse happened to cross it.
- **The two decorative strips are editable.** `.border-f::after` became a real
  `.border-strip` div (a pseudo-element cannot be hovered or given a data
  attribute), driven by an inline `--ls-strip-image` custom property. It carries
  the same declarations in the same position, so it renders identically. It is
  `display: none` below 1000px, exactly as the old `content: ""` inside the
  media query was.
- **Background image slots stamp `data-img-value` server-side.** Reading the
  value back out of `getComputedStyle` was unreliable — a strip is
  `display: none` below 1000px and reports no background at all.
- **`z-index` is now a documented scale** (`--ls-z-hover` … `--ls-z-toast` in
  `edit-mode.css`), near the top of the range so nothing added to the site later
  can outrank the editor chrome. The site's own layers are the sticky navbar
  (10) and the confirmation card (1050).
- **The bar is 60vw**, the title is centred and large with the page name to its
  right, and Enregistrer / Annuler / Quitter sit on their own well-separated
  row. "Rétablir cette page" now also clears the site-wide `site.*` colours
  (`includeSite: true`), since colours are edited from within a page.

### 8.8 Second revision of 2026-08-01 (after the owner used the revised editor)

- **The navbar is not sticky in edit mode.** `body.ls-edit-mode .m-nav` becomes
  `position: relative`. Two pinned bars competing for the top of the viewport
  was why the navbar appeared to scroll *through* the edit card; offsetting its
  `top` only moved the collision. **It must be `relative`, not `static`** — the
  theme toggle is `position: absolute` inside `.m-nav` and needs it to stay a
  positioned ancestor, or the toggle lands on top of the edit bar. Sticky
  behaviour returns by itself on the live site, because the rule only exists in
  `edit-mode.css`, which only loads with `?edit=1`.
- **Text columns can shrink again.** The Offrir intro widened its whole column
  when it got longer, pushing the photo out of the row. The text side of that
  layout is a flex item with an automatic basis, so its width was decided by its
  own content, and `min-width: auto` (the flex default) pinned it to the width
  of its longest line. Fixed with `min-width: 0` on **`.give-text-col` only**.
  This is a **site** fix, not an editor fix: the same overflow was always
  reachable by editing the template.

  **A blanket `.row > .col, .row > [class*="col-"] { min-width: 0 }` was tried
  and reverted the same day — do not reintroduce it.** At (0,2,0) it outranks
  `.main-img { min-width: 300px }` at (0,1,0), so the photo column on `/give`
  collapsed to a sliver and the whole flex row overflowed the container, pushing
  the text off the left edge of the screen. The inner Bootstrap columns need no
  such rule anyway: they are sized in percentages, so once the flex wrapper is
  bounded they wrap on their own.
- **"Rétablir cette page" stays in the editor.** It now navigates explicitly to
  `pathname + "?edit=1"` instead of `location.reload()`, and clears `pending`
  first. An action taken inside the editor should not throw the admin out of it.
- **"Quitter" destroys the admin session**, it no longer merely closes the
  editor. `POST /admin/edit/exit` calls `destroyAdminSession`. Pressing Back
  afterwards finds no session at all, so `/?edit=1` renders the ordinary public
  page and `/admin` redirects to the login. Resuming costs one PIN entry, which
  is the point. `closeEditorSession` is still used by `/admin` (the "you left it
  open" path) and by logout.
- **Hover controls linger for 3 s** (`HOVER_HIDE_DELAY` in `edit-mode.js`). The
  controls float clear of the element they belong to, so the pointer necessarily
  leaves both on its way to the buttons — hiding on the first stray `mousemove`
  made them literally impossible to click. Moving onto a control, or back onto
  its element, cancels the pending hide; moving to a *different* editable
  element switches immediately.

**Verified over HTTP after this revision:** Quitter → back button gives no
editor, `/admin` and `/admin/edit` both 302 to the login, and writes are
rejected with "Session expirée"; Rétablir → content restored *and* the editor
still available; a full upload + save + reset cycle on both pages; `/invitees`
still byte-identical for admin and visitor; anonymous `?edit=1` still inert. The
database was left empty and the test upload deleted.

**Still unverified:** everything visual, and the 3 s hover timing in a real
browser — whether it feels right rather than merely works.

### 8.9 Third revision of 2026-08-01

- **Colour editing is buttons only.** The `home.hero.textColor` slot was
  removed outright — registry entry, the `data-color-slots` attribute on
  `.dates-row`, and the `var(--ls-hero-text, white)` in `home.css` (back to a
  plain `color: white`). The owner does not want paragraph or heading colours
  editable; the design owns those. Only `site.button.bg` and
  `site.button.text` remain, so the only element with a colour control is
  `.give-btn`. **Do not add a text-colour slot back without asking** — the note
  is repeated at the top of `constants/content.slots.js`.
- **`/give` gets its own narrowed container** (`.give-container`:
  `max-width: 1080px`, `padding-inline: clamp(1rem, 5vw, 3.5rem)`). Bootstrap's
  `.container` goes up to 1320px, which pushed the photo hard against its right
  edge — and on a ~1000px viewport past it, where `overflow-x: clip` on `body`
  cropped the photo down the middle. Narrowing pulls both columns toward the
  centre. The padding is fluid so narrow screens do not lose room.

**Verified over HTTP:** the editor now offers exactly two colour controls
("Fond", "Texte") on `.give-btn` and none on the hero; a write to
`home.hero.textColor` is refused with "Champ non modifiable"; `--ls-hero-text`
is no longer emitted anywhere; button colours still save and reset; the 22 text
slots and 8 photo slots are unchanged. Database left empty.

**Still unverified:** whether 1080px is the right container width — it was
reasoned from the screenshots, not measured in a browser. If the photo still
sits too close to the edge, that one number in `give.css` is the only thing to
change.

### 8.10 Fourth revision of 2026-08-01

- **The Offrir photo is editable** (`give.image`). It is a CSS background on
  `.main-img`, so it works like the hero and the strips: `--ls-give-image`, with
  the literal in `give.css` kept as the fallback.
- **Background slots now name their own CSS variable** via `data-img-var`.
  `applyImageValue()` used to infer it from class names, which meant every new
  background slot had to be added to a chain of `if`s in `edit-mode.js` — and
  forgetting to is exactly how the Offrir photo ended up the only uneditable
  image on the site. Adding a background slot is now: registry entry, `var()` in
  the stylesheet, and `data-img-slot` / `data-img-var` / `data-img-value` in the
  template. No JavaScript change.
- **`window.confirm()` is gone from the editor**, replaced by `askConfirm()` and
  the `#lsConfirm` dialog: a titled card with the consequences as a bulleted
  list, a Cancel button that always takes focus (a stray Enter must never
  confirm a destructive action), Escape and backdrop-click to dismiss, and a
  red treatment when work would be lost. Used by Quitter, Annuler, Rétablir and
  the page switcher.

  It resolves a **promise**, so it cannot cancel an event the way a synchronous
  `confirm()` could. The page-switch handler therefore calls `preventDefault()`
  first and re-issues the navigation itself. Any future caller attached to a
  link or a form must do the same.

  `beforeunload` still shows the browser's own dialog — that one cannot be
  styled or replaced, by design.

**Verified over HTTP:** dialog markup renders on both editable pages and on
neither for a visitor; no `window.confirm` call remains in the served
JavaScript; upload → save → reset → exit still works end to end; the editor
survives a reset and is gone after Quitter; `/invitees` still byte-identical.

**Note on the database:** one real row was left in `site_content` —
`home.story.text2`, an edit made from the browser during the owner's own
testing (it ends in `asdjlhsjfbskfdshjf…`). It is live on the site. It was
deliberately not deleted; clear it with "Rétablir cette page" on Accueil or by
editing that paragraph.

- **The admin page has one content width, `.admin-width`** (`max-width: 60rem`
  above 1200px), applied to both the "Modifier les pages du site" card and the
  guest list so their edges line up. The card previously ran the full width of a
  Bootstrap container while the list stopped at 60rem. The number lives in one
  place deliberately — the rule was moved off `.invitees-list`, which no longer
  has a CSS rule at all (the class is kept in the markup as a harmless hook).

**Still unverified:** the dialog's appearance and focus behaviour in a browser,
and the admin page's alignment at widths other than the one screenshotted.

### 8.11 Touch support (2026-08-01)

The editor was built hover-first. It is not hover-*dependent*, because the
visual state is a JS-added class (`.ls-img-hover`, `.ls-color-hover`) rather
than CSS `:hover`, and it is driven by a `mousemove` listener — which a tap
still fires, as part of the synthetic `mouseover → mousemove → mousedown →
mouseup → click` sequence every mobile browser emits. So on a phone the
controls appear on tap and the flow is simply two taps: reveal, then act.

Four things were fixed to make that usable rather than merely possible:

- **`touch-action: none` on the colour picker's square and hue strip.** They use
  pointer events, so a finger drag started correctly — but without this the
  browser claimed the gesture as a scroll and fired `pointercancel`, so dragging
  scrolled the page instead of picking a colour. The swatches and hex field
  still worked, so this degraded rather than broke. **Any future drag surface
  needs the same declaration.**
- **Button labels are not editable until their controls are showing**, on
  no-hover devices only. Tapping a button's label used to reveal the colour
  chips *and* focus the contenteditable, throwing the keyboard up over the
  controls that had just appeared. `initDeferredLabels()` sets
  `contenteditable="false"` on `[data-color-slots] .ls-slot`, and
  `setLabelEditable()` flips it as the controls show and hide.
- **`pointercancel` ends a drag.** Previously only `pointerup` did, so a gesture
  the browser took over (a system swipe, a second finger) leaked its listeners
  and left the square live after the finger was gone. Pointer capture is now
  released too.
- **The soft keyboard is a resize event.** Opening it fired `resize`, which hid
  the hover controls, which set `contenteditable="false"` on the field that had
  just been focused — blurring it and closing the keyboard, making the label
  uneditable on a phone. Two guards: `setLabelEditable()` refuses to disable an
  element containing `document.activeElement`, and the resize handler returns
  early when a `.ls-slot` has focus. **Do not "simplify" either away** — the
  symptom is a keyboard that opens and instantly closes.

Capability is detected with `matchMedia("(hover: none)")`, deliberately not
`maxTouchPoints`: a touchscreen laptop has a mouse and should keep the desktop
behaviour.

**Verified over HTTP only** — the four fixes are reasoned from the code and from
documented browser behaviour, and **none of them has been exercised on a real
phone**. Touch remains the least-tested surface of this feature. The things most
worth checking on a device: dragging the colour square, the two-tap button flow,
and whether the keyboard covers the controls on a small screen.

## 9. Editable Programme timeline (2026-08-03)

The Programme is the one section whose **length** the admin controls: entries can
be added and removed, not just re-worded.

### 9.1 How it is modelled

A **fixed pool of slots plus a count**, not a list:
`home.program.count` (a `count`-type slot, 1–12) decides how many of
`home.program.item1..12.{title,text}` are shown. `MAX_PROGRAM_ITEMS` in
`constants/content.slots.js` is the ceiling; raising it is a one-line change.

This was chosen over a single slot holding a JSON array so that the registry
stays the security boundary — every writable key is still declared up front —
and so the existing per-slot character limits, sanitiser, validation and reset
logic all keep working untouched. A JSON slot would have needed its own copy of
each.

### 9.2 Why sides are decided by position

Entry 1 is left, 2 is right, 3 is left, and so on, computed from the loop index.
Nothing stores which side an entry is on. **This is what makes removal simple:**
deleting an entry means shifting the later values up one slot, and the zig-zag
then re-forms correctly on its own. Verified: removing the first of five leaves
`L:Mairie R:Réception L:Brunch R:Départ`.

### 9.3 Why the whole pool is rendered in edit mode

In edit mode `views/index.ejs` renders all 12 entries and hides the ones past
the count with `.ls-program-hidden` (`display: none`). Adding an entry is then
*revealing markup the server already produced* — the editor never builds
timeline HTML in JavaScript, which is the only way the editor's copy of the
design could drift from the template's. Hidden rows take no space, so the add
button always sits directly under the last visible entry.

**Visitors receive only the entries actually shown.** The visitor's Programme
markup was diffed against the previous hand-written version and is
**byte-identical** — same margins, same `.vertical-line-v2`, `.circle-line` and
`.circle-dash` placement, same `col-5` columns.

### 9.4 The editor controls

- A `+` in a dashed circle, centred on the timeline, carrying its own
  `.vertical-line-v2` so the dashes run into it. Muted helper text underneath
  ("Cliquez pour ajouter une étape"), styled like an input's description.
- A small red `×` above each entry's heading, on the same side as its text.
- Everything is absolutely positioned inside rows that were **already**
  `position: relative`, so none of it can move the design.
- A new entry starts as "Ajouter un titre" / "Ajouter une description" and the
  caret is placed in the title automatically.

### 9.5 The last-entry refusal

Removing the only remaining entry is refused: the heading and description shake
and a red message appears above them, like a rejected form field.

Two things to keep:
- The shake targets the `h4` and `p`, **not** the `.ls-slot` spans inside them.
  `transform` is ignored on an inline box, so shaking the spans does nothing at
  all. The selector deliberately excludes `.ls-program-error`.
- The count is **clamped, not rejected**, server-side (`validateSlotValue`).
  A tampered or buggy request can never produce zero entries or an unbounded
  page; the client's refusal is UX, the clamp is the guarantee.

### 9.6 Traps

- `home.program.count` has no `.ls-slot` element, so `initTextSlots()` never
  records it. Its baseline is seeded by hand in `edit-mode.js` — without that,
  merely opening the editor would register as an unsaved change.
- After a removal the freed trailing entry is reset to the placeholder, so a
  later add starts blank instead of resurrecting text the admin deleted.
- The conditional `data-program-row` attribute is written inline
  (`...relative"<% if (editMode) { %> data-...<% } %>>`) rather than on its own
  line, so the visitor's HTML has no stray whitespace. That is what makes the
  byte-identical comparison in §9.3 hold; keep it on one line.

**Verified over HTTP:** add, remove-first, remove-middle and reset all produce
the right entries and sides; count 0 clamps to 1 and 999 clamps to 12;
`home.program.item13.*` is rejected as unknown. **Not verified in a browser:**
the shake, the add button's position on the line, and the caret landing in the
new title.

## 10. Programme: two ceremonies, times, placeholders (2026-08-03)

### 10.1 Two timelines, one at a time

The Programme now exists **once per ceremony**. `PROGRAM_LOCATIONS` in
`constants/content.slots.js` defines them (`locA` = Abidjan, `locB` =
Ouagadougou); every programme slot is scoped by that id:

```
home.program.<loc>.label            the tab's text (editable)
home.program.<loc>.count            1..MAX_PROGRAM_ITEMS
home.program.<loc>.item{1..12}.title / .time / .text
```

`id` appears in slot keys and in the DOM, so it must stay stable. **`label` is
not editable** — the owner removed that on 2026-08-03: the two cities are fixed,
and an editable label was one more thing to get wrong for no benefit. Renaming a
ceremony is a one-word edit in `PROGRAM_LOCATIONS`.

**Both panels are always rendered and switching is a class swap**, driven by
`public/js/program-tabs.js`, which is loaded for **everyone**, not just the
admin: comparing the two ceremonies is a feature of the site and should not cost
a page load. It also means the editor can edit the hidden ceremony by bringing
it to the front — there is no second rendering path to keep in step.
`window.lsSelectProgramLocation(id)` is exposed for that.

The tabs are `role="tablist"` with arrow-key navigation. They read as a control
through weight and colour rather than a button box: muted when inactive, and a
centre-out underline (`transform: scaleX`, so nothing reflows) on the active one.

**There is deliberately no divider between the two names.** One was tried and
removed on 2026-08-03: it sits at the boundary between the two buttons, which is
not the centre of the pair — "Abidjan" and "Ouagadougou" are different widths —
so it never lined up with the timeline's vertical line at 50%. Making it line up
would mean forcing both tabs to equal width, which breaks the moment a label is
renamed, and the labels are editable. The space between the names is each tab's
own horizontal padding, held in `--tab-pad` on `.program-tabs` so the underline
can inset from it and stay tied to the label's width; the mobile override
changes that one variable rather than the padding and the insets separately.

**Migration note:** this renamed every `home.program.item*` key. Rows written
under the old names are orphans — harmless, since `getContentValue` only ever
asks for keys in the registry — but the content they held is not carried over.
The table was empty when this shipped.

### 10.2 The per-entry time is optional

`home.program.<loc>.item{n}.time` is the first slot with `optional: true`:

- its default is `''`, and **an empty value is simply not rendered**, so adding
  the field changed nothing on the live page — verified: a visitor's HTML
  contained no `.program-time` element at all until a time was set;
- `validateSlotValue` accepts empty for an optional slot instead of rejecting it
  as "ne peut pas être vide";
- `emptySlotExists()` skips optional slots, or a cleared time would block Save;
- clearing one and saving really does remove it from the page again.

It renders inside the heading's own `col-5`, so it inherits the row's
left/right alignment and needs no per-side variants.

### 10.3 Placeholders behave like placeholders

A slot may declare `placeholder`. When its value is empty or still equal to that
placeholder, the editor:

- adds `.is-placeholder` (greyed and italic), so it reads as a hint, not as copy;
- **selects the whole hint on focus**, so the first keystroke replaces it — this
  is what the owner asked for: having to clear "Ajouter un titre" by hand before
  typing was the complaint;
- drops the styling on the first `input`;
- for an *optional* slot, restores the placeholder on blur if left empty;
- stores `''` rather than the placeholder text in `syncSlot`, so an untouched
  hint is never published as if it were content.

The selection is deferred with `setTimeout(…, 0)`: doing it inside the `focus`
handler fights the browser's own caret placement, and on touch it fights the
keyboard opening. **Only placeholder values are selected** — selecting real copy
on focus would make a one-word correction dangerous.

### 10.4 Traps

- Each location's count is seeded into `baseline` by hand in
  `edit-mode.js` (`initProgramControls`), as before — the count has no
  `.ls-slot`, so nothing else records it, and without the seed merely opening
  the editor registers as an unsaved change.
- `programSlots()` identifies a row's three fields by matching the **end of the
  slot key** (`/\.title$/`, `/\.time$/`, `/\.text$/`), not by DOM order. Adding
  a fourth field per entry means adding it there too.
- The tab click handler ignores clicks that land on a `.ls-slot`, so editing a
  tab's label does not also switch ceremony.

**Verified over HTTP:** two independent timelines with independent counts; times
appear only when set and disappear when cleared; a renamed tab label; add and
remove on one ceremony leaving the other untouched; `locC` rejected as unknown;
count clamped; reset restoring all 102 keys; `/invitees` still byte-identical;
anonymous `?edit=1` still inert; all navbar anchors intact.

**Not verified in a browser:** the tab animation, the time's typography, the
placeholder select-on-focus, and how the tabs look on a phone.

### 10.5 The hero dates moved to the corner (2026-08-03)

The two dates used to sit side by side, centred at the bottom of the hero photo,
at Bootstrap's default heading sizes — small enough that they were easy to miss
against the picture. They are now **stacked in the bottom-right, right-aligned,
inset from the corner** rather than flush against it.

- The wrapper is a plain `div`, **not a Bootstrap `.row`**. `.row` carries
  negative horizontal margins that pull the block back out past the very inset
  this layout depends on. The `col`/`row` classes were dropped with it.
- The inset is `clamp()` on `padding-right` / `padding-bottom`, so it stays
  proportional from a phone to a large monitor.
- Both headings are sized explicitly with `clamp()` rather than left to
  Bootstrap. `.location-title` is set nearly as large as the date because
  **Pinyon Script is a script face and reads much smaller than its point size**;
  at the old size it disappeared into the photograph.
- The old `@media (width < 500px)` rules re-sized these headings in `em`, which
  would fight the clamps — they now only tone down the drop-shadow, which is
  what keeps the text legible over the image.

### 10.6 Frosted panel behind the hero dates (2026-08-03)

The dates now sit on a blurred patch of the photograph instead of carrying a
hard offset shadow. Three things about it are load-bearing:

- **The blur and its mask live on `.dates-row::before`, not on `.dates-row`.**
  `mask-image` clips everything an element paints, so masking `.dates-row`
  itself fades out the dates along with the blur — which is exactly what the
  owner's mock-up accidentally showed. Keeping the effect on a layer of its own
  leaves the text untouched.
- **`.dates-row-item` is `position: relative` so the text paints above the
  panel.** A positioned pseudo-element sits in the positioned-descendants layer,
  which is *above* in-flow block content; without this the blur covers the
  dates. If a new element is added inside `.dates-row`, it needs the same.
- **The gradient background is the fallback, not decoration.** Where
  `backdrop-filter` is unsupported it still darkens the corner enough to keep
  the text readable, so nothing depends on the blur landing.

The mask is a single radial gradient anchored at `100% 100%`, so the blur is
solid under the text and dissolves into the photo in both directions at once —
one gradient rather than two composited ones, which avoids `mask-composite`
(patchy in Safari). `-webkit-` prefixes are present for both `backdrop-filter`
and `mask-image`.

`pointer-events: none` on the panel matters: the hero photo is an editable image
slot, and the layer would otherwise swallow the hover that reveals its "Changer
la photo" control.

The old `filter: drop-shadow(8px 6px 0px black)` on the headings is gone — the
panel does that job now, and the two together read as competing effects. A soft
`text-shadow` remains as insurance over a bright patch of photo.

On a phone the vertical padding is overridden in `rem` below 576px. This is a
**units** problem, not a values one: the padding is in `vh`, measured against
the viewport, but `.img-container` is `40vh` on mobile against `80vh` on
desktop — so the same declaration takes about double the share of the photo.
Measured, the block was 62% of the image on a 390x844 screen versus 38% on a
laptop; the override brings it to 45%. The **left** padding stays generous
(`2.75rem`) because that is the room the blur needs to fade out horizontally.

**The same crowding exists on tablets and small laptops** and is not yet fixed:
`.img-container` drops to `40vh` for everything under 1025px, so at 1024x768 the
block works out at roughly 68% of the image. Extending the override up to
`1025px` would be the consistent fix; it was left at 576px because only mobile
was asked for.

**Not verified in a browser.** Blur radius (`14px`), the mask's stops (`42%` /
`80%`) and the tint opacity are the three numbers to tune if it reads too strong
or too weak.

## 11. Programme fields: click-to-replace and CSS hints (2026-08-03)

### 11.1 Hints are drawn, not stored

A programme field with no value is now **genuinely empty**. The hint ("Entrer un
titre", "Entrer une description", "Entrer l'heure") is drawn by
`.ls-slot[data-slot-placeholder]:empty::before` from an attribute, and is never
a value.

This replaced an earlier design where the hint was real text the editor selected
on focus. Three things got better:

- typing starts from a clean field instead of inside the hint;
- the hint can never be saved as if it were content — there is no code path for
  it, rather than a check that could be forgotten;
- a visitor never sees it, because the server renders the slot empty.

`default` for an unfilled entry is `''`, not the hint. `PROGRAM_PLACEHOLDER_*`
are hint strings only.

### 11.2 The disappearing box, fixed

Deleting a title made its edit box vanish: an **empty inline span has zero width
and height**, so the dashed outline collapsed to a point and there was nothing
left to click. `.ls-slot:empty` is now `display: inline-block` with a
`min-width` and `min-height`. Only *empty* fields get this, so nothing else in
the page reflows.

`normalizeIfBlank()` is the other half of it: contenteditable leaves a stray
`<br>` behind when a field is emptied, which stops it matching `:empty` — and
`:empty` is what draws the hint and holds the box open. Every path that can
empty a field calls it.

### 11.3 There is deliberately no clear-on-focus

An earlier build of this feature emptied a field when it was focused, so the
admin typed a replacement rather than editing in place. **It was removed the
same day.** Two reasons, and both are worth keeping in mind before anything
like it is tried again:

- Clicking the whitespace *beside* a heading wiped it. The click lands on the
  block's line box, and the browser maps that to the nearest editable position
  — inside the field. A click that was never meant to touch the text destroyed
  it. Restricting the hit area would have meant fighting normal caret placement.
- These fields hold copy that gets **tweaked**, not values that get replaced.
  Clearing on click is right for a disposable value; it is wrong when clicking
  to fix a typo makes the sentence vanish.

Clicking a field now simply puts the caret in it. The hint and the box-holding
fixes in §11.1 and §11.2 are unaffected — they were the parts that mattered.

### 11.4 The per-entry controls

`×` and `↺` sit as a pair above each entry's heading. `↺` puts that entry's
three fields back to their last **saved** values and is disabled when the entry
has no unsaved change, so it never looks available when it would do nothing.
`setPending()` keeps that state current.

### 11.5 Save was permanently disabled — fixed

`emptySlotExists()` walked **every** `.ls-slot` on the page, including the
entries past each ceremony's count. Those are rendered but hidden, and since
§11.1 they are empty by design — so the check found 36 empty required fields
(18 hidden entries x 2), and Save stayed greyed out no matter how completely
the visible programme was filled in.

The check now skips anything inside `.ls-program-hidden`. A visible empty
required field still blocks Save, which is correct, and the server still
refuses an empty title independently.

**This is the shape of bug to watch for**: rendering the whole pool is what
makes adding an entry cheap (§9.3), but every piece of code that walks the DOM
has to know that hidden entries are not part of the page.

### 11.6 Two undos on the bar

The footer now offers both, spelled out rather than both called "rétablir":

- **Revenir à la dernière version enregistrée** — discards unsaved changes and
  returns to what is published. Implemented as a reload, which is the honest
  implementation: unsaved changes live only in the browser. Disabled when there
  is nothing pending.
- **Rétablir le contenu d'origine** — back to the content the site shipped
  with, via `POST /admin/content/reset`. Immediate and irreversible.

**Verified over HTTP:** hints never reach a visitor; empty fields render as
truly empty elements so `:empty` matches; an empty title is refused by the
server while an empty time is accepted; a filled new entry publishes correctly;
body copy carries no `data-slot-clearable`.

**Not verified in a browser** — and this section is almost entirely browser
behaviour. Worth checking first: that clicking a title really clears it, that
clicking away restores it, that the hint shows with the dashed box intact, and
that `↺` enables only once something changes.

## 12. Content went stale on the live site (2026-09-18)

### 12.1 The symptom, and why it was so confusing

The couple edited the Programme on 2026-09-13. The rows were plainly there in
the production database (`u793064228_wedding_db.site_content` — `Cérémonie de
Dot`, `Mariage traditionnel`, times, addresses). The live page showed
`Église / Mairie / Réception` with `Lorem ipsum…` instead.

What made it hard to read: the page was rendering **the template defaults,
byte for byte**. `PROGRAM_PRESETS` in `constants/content.slots.js` is exactly
those three titles, and both ceremonies start from the same outline — so the
Abidjan and Ouagadougou tabs were *identical*, and no time was rendered
anywhere (the `.time` default is `''`). That combination is the signature of
"zero overrides applied", not of "wrong override applied". If you ever see it
again, do not go looking at the rendering code: `getContentValue()` is fine, the
cache it reads is empty.

**Diagnostic, in order:**

1. `node scripts/content-audit.js --env=config/.prod.env` — does the database
   actually hold the rows? (It also flags orphaned `slot_key`s, see §12.4.)
2. `curl -sD - -o /dev/null https://<site>/ | grep -i cache-control` — is the
   page being cached by something in front of Node?
3. Restart the app. If the content appears, it was the server-side cache.

### 12.2 Cause 1 — rendered pages had no cache policy at all

`middlewares/staticCache.js` gives every file under `public/` an explicit
`Cache-Control`. **Rendered pages got none.** A response from `res.render` had
only the weak ETag that `res.send` adds by default:

```
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
ETag: W/"5b54-+c1WLmWC4dsqd24jC/AmMvPg2FY"
          <- no Cache-Control
```

A response with no freshness directive has no defined lifetime, so any cache in
the path may assign it one of its own invention (RFC 9111 §4.2.2, "heuristic
freshness"). Browsers usually revalidate, which is why the page eventually
corrected itself and why this was intermittent — but an intermediary (the
host's page cache, a CDN, a mobile carrier proxy) is entitled to hold it for
minutes or hours. A guest who had already opened the site was the worst case,
which is exactly who a wedding site's audience is.

**Fix: `middlewares/htmlCache.js` (new).**

| Page | `Cache-Control` |
| --- | --- |
| `/`, `/give`, API routes | `no-cache, private` |
| `/admin/*` and any `?edit=1` | `no-store, no-cache, must-revalidate, private` (+ `Pragma`) |

Plus `Vary: Cookie` on both.

`no-cache` does **not** mean "do not store" — it means "store it, but
revalidate before reuse". Paired with the ETag that was already there, a
returning visitor sends `If-None-Match` and gets a **304 with an empty body**
when nothing changed (measured: `status=304 bytes=0`), or the full fresh page
the instant a slot changes. Correctness at essentially no bandwidth cost. Do
not "optimise" this to `max-age=<n>`: that reintroduces exactly this bug, and
the 304 already makes revisits cheap.

Two things about it that are deliberate and easy to undo by accident:

- **It is not a `res.render` wrapper.** Two are already stacked (`lazyLoad`,
  then `cacheBusting`) and a third that forgot to forward its callback would
  silently disable the ones above it — see the trap in §7. A plain middleware
  setting a header needs none of that.
- **It is mounted *after* `staticCache(publicPath)`** in `app.js`. Files under
  `public/` are served above it and never reach it, so the long `max-age`s in
  `staticCache.js` survive. Move this line above `staticCache` and you will
  quietly drop every asset to `no-cache`. Verified after the change:
  `/styles/theme.css` → `max-age=604800`, `/img/main-img.jpg` → `max-age=86400`.
  (Careful when spot-checking: `public/css/` is **empty** — the stylesheets are
  in `public/styles/`. A request for `/css/style.css` 404s, falls through to
  `htmlCache`, and comes back `no-cache, private`, which looks exactly like the
  bug you are checking for. It is not.)

### 12.3 Cause 2 — the content cache only ever loaded at boot

`contentCache` in `controllers/content.controller.js` carried this comment:

> *"It is refreshed at boot and after every write, and there is exactly one
> server process, so it cannot go stale."*

`initContentCache()` was called in exactly two places: `app.js` at boot, and
after a save/reset made **through the app**. No TTL, no polling. Both of that
comment's assumptions break silently:

- a row edited straight in **phpMyAdmin** is invisible until someone restarts
  the server — and editing rows by hand is the obvious thing to do when the
  site looks wrong, which makes this self-reinforcing;
- under **PM2/cluster with more than one worker**, a save refreshes only the
  worker that handled the request; the others keep serving the old text
  indefinitely, so the site appears to flip between old and new depending on
  which worker answers.

**Fix:** `refreshContentCacheIfStale()`, called from `contentLocals` on every
page render. If the cache is older than `CACHE_TTL_MS` (60s) it starts a reload
and **returns without awaiting it**.

Fire-and-forget is the design, not a shortcut. `getContentValue()` is called
from inside the templates and cannot `await`, and renders are deliberately
DB-free so that an unreachable MySQL costs nothing at render time and never
blanks the site. The request that finds the cache stale still renders what is in
memory; the next one gets the fresh values. `refreshInFlight` is a single-flight
guard — without it, a burst of traffic onto a stale cache fires one `SELECT`
per request. `cacheLoadedAt` is stamped on failure too, so a database that is
down is retried once per window rather than on every request.

**Worst-case delay is the full 60s window, and only for edits that did not come
through the app.** Edits made in the editor are still instant, because the save
path calls `initContentCache()` directly. That asymmetry is intentional; do not
"simplify" it away by deleting the refresh on write.

**Verified on a running server, no restart, local DB:** an `INSERT` straight
into `site_content` bypassing the app appeared on the page in ~24s; the matching
`DELETE` (the editor's "restore default") reverted it in ~60s. The test left the
table at 0 rows.

### 12.4 `scripts/content-audit.js` — what has the couple actually changed?

```bash
node scripts/content-audit.js                        # local dev DB
node scripts/content-audit.js --env=config/.prod.env # production
node scripts/content-audit.js --full                 # do not truncate values
```

Prints, newest first, every slot with a row: label, key, the template default,
the current value, and `updated_at`. It also warns about **orphaned rows** —
`slot_key`s in the database that no longer exist in `constants/content.slots.js`.
That is the one thing a code change can silently destroy: rename or delete a
key and the couple's saved text is still in the table but is never read again,
so the page reverts to the default with no error anywhere. Run it before and
after any refactor of the slot registry.

It is **strictly read-only**: a single `SELECT`, and it deliberately does *not*
import `content.model.js`, because that would run `CREATE TABLE IF NOT EXISTS`
on import — harmless, but a tool for inspecting production should not write to
it. `ER_NO_SUCH_TABLE` is therefore reported as a valid answer ("the editor has
never saved anything"), not an error.

Note it reads `config/.env` by default, so on a dev machine it reports **0 of
113 slots overridden** — the local database is empty and has always been. That
is not a bug and not evidence of data loss; pass `--env=config/.prod.env` to
see the couple's real edits.

### 12.5 What the couple's content does *not* depend on

Worth knowing before worrying about losing their work:

- **It is not in git.** The editor writes to MySQL; `git log`/`git diff` will
  never show a content change no matter how much they have edited. Code changes
  cannot clobber it.
- **A row exists only for a slot they actually changed**; an absent row means
  "still the template default", which is how "rétablir" is implemented
  (`deleteContent`). Nothing in the codebase drops or truncates the table.
- **Uploaded photos were already safe.** `uploadImage.js` names every upload
  `<timestamp>-<random>.<ext>`, so swapping a photo produces a new URL and the
  1-day image `max-age` in `staticCache.js` cannot serve the old one.
- **There is no service worker** — checked. One would be a third cache layer on
  top of these two; do not add one without revisiting this section.

The real backup is therefore the database, not the repo:

```bash
mysqldump <db> site_content > site_content-<date>.sql
tar czf uploads-<date>.tar.gz public/uploads/
```

### 12.6 What is NOT verified

- **Nothing here was checked against production.** Reading
  `config/.prod.env` was blocked in that session's sandbox, so every
  measurement above is from a local server against the local database. The
  header change is environment-independent, but **whether an intermediary in
  front of the production Node process now honours `no-cache` is unconfirmed.**
  After deploying, run
  `curl -sD - -o /dev/null https://<site>/ | grep -i cache-control` and check
  the header actually arrives at the browser rather than being rewritten by the
  host's proxy. If the host injects its own caching, this fix is not sufficient
  on its own and the host's page cache has to be disabled for the Node app.
- **No page was opened in a real browser**, consistent with the rest of this
  document.
- `npm test` is still red on the one pre-existing, network-dependent assertion
  described in §7 — confirmed identical on a clean `d7b6702`, so it is not
  related to these changes.

## 13. One programme, with a place and a map link per entry (2026-09-22)

### 13.1 What changed and why

The programme was two timelines — Abidjan and Ouagadougou — behind a tab bar.
It is now **one timeline**, and every entry carries two new optional fields:

- `…place` — where that step happens (text, max 70, optional)
- `…map` — a Google Maps link for that place (url, optional)

The two changes are one idea. Once an entry says where it is, splitting the
programme by city stops earning its keep: the guest no longer has to pick a
city before they can find out where anything is.

It also matches what the couple were already doing. They had been typing
addresses into the entry's **description** for want of anywhere better —
`home.program.locA.item1.text` was "Résidence des GBALA-GNATO, Cité Génie 2000,
Cocody", and `locB.item2.text` was "Mairie centrale de Ouaga 2000". The place
field is the home those values wanted.

### 13.2 The key prefix is still `locA`, and that is deliberate

`PROGRAM_LOCATIONS` now holds one entry, and its `id` is **still `locA`** even
though there is no longer an A and a B. It looks like a leftover. It is not:
every one of the couple's saved entries is stored under `home.program.locA.*`,
and renaming the prefix would orphan all of them — the rows would still be in
the table and never read again, and the page would fall back to the template
defaults with no error anywhere (this is exactly the failure mode of §12.1).
**Do not "tidy" this into `home.program.item1.*` without writing a migration.**

`PROGRAM_LOCATIONS` is also still an *array*, and the tab bar is rendered only
when `programLocations.length > 1`. Going back to per-city timelines is
therefore a matter of pushing a second object into that array — the panel
markup, the CSS and `program-tabs.js` all still work. `role="tabpanel"` is
likewise conditional, because a lone tabpanel with no tab controlling it is a
screen-reader dead end.

### 13.3 Where the place sits, and in which order

The place line lives in the **title/time block, under the time** — not under
the description, where it started. The title, the time and the place are the
three facts a guest scans a timeline for; the description is the prose that
follows them, so the place belongs above it.

In edit mode the line holds two things, and their order is **mirrored** by
side:

| Side | Order |
| --- | --- |
| Left entries | place, then the map-link pill |
| Right entries | the map-link pill, then place |

Left entries read outward from the timeline spine, so the right-hand ones have
to be reversed or the pill ends up furthest from the spine and the eye meets
the control before the thing it controls.

This is done **in the markup, not with `flex-direction: row-reverse`**, so the
DOM order matches the reading order for a screen reader. That is why the pill
is a partial (`views/program-map-btn.ejs`): it is rendered from two places and
two copies would drift apart.

Two icons, deliberately different: the place carries a **pin**
(`views/program-pin.ejs`), the pill carries a **folded map**. They sit side by
side, so the same glyph twice would read as one repeated thing.

### 13.4 Why the place renders three different ways

`views/index.ejs` has three branches for one line of text, which looks
excessive until you try to merge them:

| Who | Rendering |
| --- | --- |
| Visitor, link set | `<a class="program-place program-place-link" target="_blank" rel="noopener noreferrer">` |
| Visitor, no link | `<span class="program-place">` |
| Admin in edit mode | `<span class="program-place">` + the 🔗 button |

The admin never gets the `<a>`. A `contenteditable` inside an anchor is a trap:
the first click navigates instead of placing the caret. (`edit-mode.js` already
carries a global click handler that calls `preventDefault()` on any `<a>`
containing a `.ls-slot`, which is the same problem solved elsewhere — but not
rendering the anchor at all is better than fighting it.)

The pin icon is `views/program-pin.ejs`, a partial precisely because it is
rendered in all three branches and they must not drift apart.

### 13.5 The map URL is validated harder than anything else

This value ends up in an `href`, which makes it the only place in this codebase
where admin input becomes something the browser will **act** on rather than
display. `validateMapUrl()` in `controllers/content.controller.js`:

- **`https:` only.** This is the part that matters. Escaping alone would not
  stop `javascript:…`, which executes on click with the page's own origin.
- **A host allowlist** — `maps.app.goo.gl`, `goo.gl`, and `google.<tld>` with
  an optional `www.`/`maps.` prefix. Same reasoning as `IMAGE_PATH_PATTERN`: a
  slot must not become a link to a third-party site. Country domains are
  covered because `google.ci` and `google.bf` are the ones that matter here.

It parses with `new URL()` rather than matching one big regex, because a regex
over a whole URL has to get userinfo, ports and backslashes right to be safe,
and `https://google.com@evil.example/` is exactly what it gets wrong. **Both
halves are required**: validation on write stops `javascript:` getting in,
`slotUrl()` escaping on render stops a quote breaking out of the attribute.
Never render a `url` slot with `<%= %>` straight from the cache.

Verified against 16 cases including `javascript:`, `JaVaScRiPt:`, `data:`,
plain `http:`, `//maps.google.com/`, `https://google.com.evil.example/` and
`https://google.com@evil.example/` — all refused; six legitimate Google Maps
forms accepted.

`public/js/edit-mode.js` carries a **deliberate duplicate** of these rules
(`isMapUrl`) so a typo is caught while the admin is looking at the field rather
than failing the whole save. The server remains the authority. **If you change
the rules in one place, change them in the other.**

### 13.6 The migration — NOT YET RUN ON PRODUCTION

`scripts/merge-program.js` appends the old Ouagadougou entries to the end of the
single timeline and deletes the dead `locB` rows.

```bash
node scripts/merge-program.js                          # dry run, changes nothing
node scripts/merge-program.js --env=config/.prod.env   # dry run against prod
node scripts/merge-program.js --env=config/.prod.env --apply
```

**Until this is run on production, the couple's Ouagadougou entries are in the
database but not rendered.** They are not lost — `locB` rows are untouched by
the code change — but the page shows only the three Abidjan entries.

Two things it does that are easy to miss:

- It migrates the value **the page was actually showing**, not just the saved
  row. `locB.item2.title` and `locB.item3.title` had no rows at all, so they
  were rendering the old presets "Mairie" and "Réception". Migrating only
  stored rows would have moved those entries across with empty titles — and
  the title is not optional, so they would have been unsaveable. `LEGACY_PRESETS`
  in that script is a verbatim copy of the pre-change `PROGRAM_PRESETS` for
  this reason; it is a one-time fossil and should not be kept in sync.
- It writes in **one transaction** and is **safe to run twice** — once the
  `locB` rows are gone it reports "nothing to migrate" rather than appending a
  second copy.

Rehearsed locally against a seeded copy of the production rows (taken from the
phpMyAdmin screenshot): 3 + 3 entries merged to 6, count updated, 6 `locB` rows
deleted, re-run was a no-op, and `content-audit.js` reported no orphans after.

### 13.7 `package.json` version was bumped to 1.14.3

`cacheBusting.js` appends `?v=<package version>` to every `.css` and `.js` URL,
and `staticCache.js` serves those with `max-age=604800` — **seven days**. This
change touched `edit-mode.js`, `home.css`, `theme.css` and `edit-mode.css`, so
without the bump a returning visitor would have had the new markup and the old
stylesheet for a week. **Bump the version in `package.json` whenever you change
a file under `public/`.** (Note this is a different mechanism from §12 — that
one is about the HTML, this one about the assets it references.)

### 13.8 The link control is a labelled pill, not an icon (revised 2026-09-22)

The first version was a 22px circular icon button. That was wrong twice over:
too small to notice sitting next to body copy, and unable to say which of its
two states it was in without the admin hovering it for a tooltip — on a control
whose entire job is to report a value that is invisible everywhere else.

It is now a labelled pill that states its condition three ways, because any one
of them alone fails somebody:

| | No link | Link set |
| --- | --- | --- |
| Words | "Ajouter le lien Maps" | "Lien Maps ajouté" |
| Tick | hidden | shown |
| Fill | dashed blue outline | solid green |

Dashed-versus-solid is not decoration: dashed means "empty slot" everywhere
else in this editor, so it had to stop reading that way once a link exists.
Green rather than blue because the filled state reports a result rather than
offering an action.

The dialog also gained live feedback (`refreshLinkFeedback`): a valid paste
shows a green confirmation plus an **"Ouvrir pour vérifier"** anchor that opens
the link in a new tab. A Maps share link is opaque — `maps.app.goo.gl/X7f2…`
tells nobody where it points — so "it parses" is not "it is correct", and the
only real check is opening it. The anchor calls `stopPropagation()`, or the
global anchor handler in `edit-mode.js` would swallow the click.

The invalid-link message stays quiet until more than 12 characters have been
typed, so it does not flash on every keystroke of a URL being entered.

### 13.9 Traps in this area

- **Never put `margin-left: auto` on the map pill to right-align it.** This was
  a real bug, fixed the same day: `.program-place-line` is a flex container
  already set to `justify-content: flex-end` for right-hand entries, and an
  auto margin on the last item absorbs *all* the free space instead of
  aligning it — which pinned the place text to the far left of the row and the
  pill to the far right, splitting the pair. `justify-content` alone keeps them
  together, and `flex-wrap` still drops the pill onto its own right-aligned
  line when it does not fit. **The visitor view hides this class of bug**: it
  renders no pill, so there is no last item to carry the margin and the line
  looks perfect. Right-hand entries have to be checked in edit mode.

- **Anything that moves an entry must handle all five fields.** `programSlots()`
  in `edit-mode.js` returns `title`, `time`, `text`, `place` **and** the map
  button; `copyProgramEntry`, `resetProgramEntry`, `revertProgramEntry` and
  `updateRevertState` each touch all of them. Removing an entry shifts every
  later one up a row — miss a field there and a place stays behind on the wrong
  entry, which looks like data corruption and is very hard to trace.
- **The map button is not a `.ls-slot`**, so `initTextSlots()` does not record
  its baseline. `initLinkEditor()` seeds it by hand, the same way
  `initProgramControls()` seeds the count. Without that, clearing a link would
  not register as a change.
- **`.program-place-line` is a flex container**, so the `.text-end` class that
  right-aligns every other element in this section does nothing to it —
  `justify-content: flex-end` is what moves the right-hand entries' place line.
- `PROGRAM_PLACEHOLDERS` was removed from `edit-mode.js`; it had been dead since
  the fields started rendering genuinely empty (§11.1).

### 13.10 Content-preservation proof (rehearsed 2026-09-22)

The whole change was rehearsed against a verbatim copy of the 15 production
rows, checking after every step that each stored value was still both in the
database and on the page:

| Step | Result |
| --- | --- |
| New code deployed, migration **not** run | All 15 rows still in the table; the 6 `locB` rows untouched; every Abidjan value still rendering |
| `merge-program.js --apply` | All 15 values still stored; count 3 → 6; `locB` rows removed only after their values were written to `locA` |
| Page after restart | **All 15 production values present**, across 6 timeline entries |
| An admin saves the two new fields | Every pre-existing row **byte-identical**; exactly 2 rows added, 0 changed, 0 deleted |

Two things that proof establishes, both worth keeping in mind:

- **The code change alone cannot lose anything.** Removing `locB` from the
  registry makes those rows unreadable, not deleted — and `saveContentUpdates`
  rejects them as unknown keys rather than touching them. The migration is the
  only thing that moves them, and it writes the new rows before deleting the
  old ones, in one transaction.
- **A save writes only what changed.** The editor posts its `pending` map, so
  slots the admin never touched are never written — which is why adding two
  fields to every entry adds no rows until they are filled in.

The first run of this rehearsal reported the Ouagadougou values missing from
the page at step 3, which looked like data loss and was not: the migration
writes straight to the database, so the running server served its 60-second
cache (§12.3) until it was restarted. That is why `merge-program.js` ends by
telling you to restart — **do not read a post-migration page without doing so
and conclude the migration failed.**

### 13.11 What is NOT verified

- **No browser.** Same gap as every other session: the page was driven over
  HTTP, and 17 editor assertions pass (login → editor session → markup → save
  → the rejection paths), but **nobody has clicked the 🔗 button**. Worth
  checking first: that the dialog opens anchored sensibly, that Enter commits
  and Escape closes, that the pill turns solid green once a link is set, that
  "Ouvrir pour vérifier" opens the right place, and that the place line and the
  pill look right on a phone and in dark mode.
- **Production is untouched** — see §13.5.
- The local development database now holds a **copy of the production rows**
  plus a test place and map link on entry 1, left there by the rehearsal in
  §13.9. It is test data, not a source of truth; production is untouched.

## 14. Security review (2026-09-22)

### 14.1 Dependencies: 16 vulnerabilities → 0

`npm audit` reported **16 (11 high, 3 moderate, 2 low)**. All are now fixed and
`npm audit` reports **0**.

- **15 fixed by `npm audit fix`** — transitive, no API change. The notable ones
  were `path-to-regexp` (ReDoS, reachable through Express routing),
  `picomatch`/`brace-expansion` (ReDoS), `qs` (DoS in body parsing) and
  `form-data`/`axios` (pulled in by `deep-email-validator`, which runs on every
  guest registration).
- **`nodemailer` 8 → 10**, the only breaking bump, done deliberately. Five
  advisories, the worst being *"Message-level raw option bypasses
  disableFileAccess/disableUrlAccess, enabling arbitrary file read and full
  SSRF in the delivered message"*. This project's usage is a plain
  `createTransport` + `sendMail` with from/to/subject/html/attachments — an API
  that did not change across those majors. Verified the transport still builds
  and exposes `sendMail`/`verify`.

Only `nodemailer` moved in `package.json`; everything else was resolved in
`package-lock.json`. **The mail path was not sent a real email** — that needs
live SMTP credentials. Watch the first registration after deploying.

### 14.2 Headers: `middlewares/securityHeaders.js` (new)

The site sent **no security headers at all**, and advertised `X-Powered-By:
Express`. Now set on every response:

| Header | Why it matters *here* |
| --- | --- |
| `X-Content-Type-Options: nosniff` | The admin uploads images, they are served from our own origin under `/uploads`, and the upload filter trusts the browser-supplied MIME type. Without this, a file passing as `image/jpeg` that contains markup can be re-interpreted as HTML and run as script on our origin. |
| `X-Frame-Options: SAMEORIGIN` | The editor is a logged-in surface with destructive one-click actions ("Rétablir le contenu d'origine") — exactly what clickjacking is for. |
| `Referrer-Policy: strict-origin-when-cross-origin` | Guests now click out to Google Maps; `?edit=1` and `?registered=1` should not travel to a third party. |
| `x-powered-by` **disabled** | Stops advertising the stack to fingerprinters. |

It is mounted **before `express.static`** — unlike `htmlCache` — because
`nosniff` has to reach uploaded files, which are served above `htmlCache` and
never reach it. Hand-rolled rather than adding `helmet`: three headers and a
disable do not justify another dependency, and an unpinned security middleware
is itself a supply-chain surface.

**`Content-Security-Policy` is deliberately NOT set.** The pages carry inline
`<style>` and inline wiring, so a useful policy needs nonces threaded through
every template or those refactored out — and a CSP added blind, without a
browser, silently breaks the editor. **It is the obvious next hardening step;
do it with a browser open and test `/?edit=1` first.**

### 14.3 What was probed and held

Run against a live server with a real admin session:

- **XSS through the new `place` field** — `<script>alert(1)</script>` and an
  attribute break-out (`x" onmouseover="alert(1)`) both neutralised. `place` is
  a TEXT slot, so it is stripped of tags on write and escaped on render.
- **The `map` href sink** — `javascript:`, `JaVaScRiPt:`, `vbscript:`, `data:`,
  leading-whitespace `javascript:`, plain `http:`, `https://google.com@evil.example/`
  and `https://google.com.evil.example/` all refused. See §13.5.
- **CSRF** — a save with no token and a save with a wrong token both refused.
- **Auth** — a save with no session refused; `/admin` redirects when logged out.
  Every admin write route (`/admin/content`, `/admin/content/reset`,
  `/admin/upload`, `/admin/edit/exit`) is behind `requireAdminApi`.
- **Registry boundary** — unknown keys, the removed `locB` keys, and a
  `__proto__.polluted` key all refused, with no prototype pollution.
- **Secrets** — `config/.env` and `config/.prod.env` are ignored, untracked,
  and were **never committed in any branch's history**; `public/uploads/` is
  ignored; no credential-shaped literals or connection strings in tracked files.

`scripts/content-audit.js` and `scripts/merge-program.js` print the database
**name and host** (never the user or password) before acting. That is a
deliberate "which database am I about to write to" confirmation for a script
that can touch production; keep it.

### 14.4 Not addressed

- **CSP** — see §14.2.
- **No rate limit on `/admin/content`.** Login is limited (10 attempts, then a
  DB lock) but the write endpoints are not. They need a valid session and CSRF
  token, so this is only reachable by an authenticated admin; worth adding if
  the admin surface ever widens.
- **The mail path is untested against live SMTP** after the nodemailer major.

## 15. Performance: images (2026-09-22)

### 15.1 The problem

The site shipped camera originals. `couple-1.JPG` was **4096x5120 — 21
megapixels — 1023 KB**, and `couple-3.png` was a *photograph stored as PNG* at
1364 KB. `public/img` totalled **21 MB**. Some hand-made WebP files were
*larger* than the JPEGs they replaced (`couple-6.webp` 4.4 MB vs
`couple-6.JPG` 3.5 MB), which is what encoding at quality 100 does.

A guest on mobile data was downloading roughly twenty times more image than
their screen could use.

**The home page went from 4065 KB to 683 KB — 83% less.** `public/img` went
from 21 MB to 4.1 MB.

> Those figures were corrected on 2026-09-23 (they were first reported as
> "2590 KB to 423 KB"). The script that measured them used a case-sensitive
> regex, so it silently skipped every `.JPG` file — under-counting both sides.
> The percentage barely moved; the absolute numbers were wrong. **When
> measuring page weight, count what the browser actually requests**: assets
> referenced from the HTML (including inline `style` `url()`), plus
> `@font-face` files whose family is applied somewhere — and *not*
> background-images whose selector matches no element on the page, which the
> browser never fetches.

### 15.2 `scripts/optimize-images.js`

Rewrites everything under `public/img` **in place, keeping every filename**, so
nothing referencing those paths has to change — templates, stylesheets and any
image slot the couple has saved all keep working.

```bash
node scripts/optimize-images.js            # dry run
node scripts/optimize-images.js --apply
```

Caps the long edge at 2000px, re-encodes (mozjpeg q82 / WebP q80 / PNG palette),
and **never writes a file that would get bigger** — anything under a 5% saving
is left alone, so a second run is close to a no-op.

`.rotate()` runs before metadata is dropped. Without it, stripping EXIF turns
every portrait phone photo on its side — the classic version of this bug.

**The originals are recoverable from git history**, which is the only backup:

```bash
git checkout <commit-before-this> -- public/img
```

### 15.3 Image slot defaults now point at WebP

`couple-3.png` was **82% of the home page's weight on its own** — 1061 KB even
after optimisation, against 143 KB for the identical pixels as WebP. PNG cannot
compress a photograph; the WebP was already sitting in `public/img/webp/`.

Four defaults in `constants/content.slots.js` now point at their WebP twin
(hero, mariage image, gift image, gift strip). Each twin was checked to have
**identical dimensions** to the file it replaced. `give.image` already pointed
at a WebP, so the pattern was established.

This only changes what a slot falls back to **when the couple has not chosen
their own photo**. Their overrides are untouched, and the JPEG/PNG originals
are still in the repo and still reachable.

### 15.4 Uploads are optimised on the way in

`middlewares/optimizeUpload.js`, called from `POST /admin/upload`. A 3000x4000
phone photo becomes a 2000px-capped WebP. Order matters:

1. **Decode the header first.** A failure means "not an image", not
   "optimisation failed" — see §15.5.
2. `.rotate()` applies EXIF orientation, *then* the metadata is dropped.
3. Resize to 2000px long edge, `withoutEnlargement` so a small image is never
   blown up and made worse.
4. WebP q80 with `smartSubsample`.
5. Output carries **no metadata at all**. Partly size, mostly privacy: phone
   photos carry GPS coordinates, and this is a public website that already
   lists the couple's addresses on the programme.

`limitInputPixels` is capped at 50MP as a decompression-bomb guard. If the
re-encode comes out *bigger* than the source, the original is kept.

A failure other than a decode failure **degrades rather than throws** — the
original is served. Losing bandwidth beats telling the admin their upload
failed.

### 15.5 A bug this session's own test hid

The first version fell back to the original file on **any** error. A test
asserted a fake JPEG (`<html><script>alert(1)</script>` sent as `image/jpeg`)
was rejected — and passed, because it checked for the string "evil" in the
filename, and uploads get random names. **The file was in fact stored and
served.**

It was not exploitable: `express.static` set `Content-Type: image/jpeg` from
the extension and the `nosniff` header (§14.2) stops the browser re-reading it
as HTML. But the whole defence rested on one header.

Now the decode is a **validation step**: multer's filter trusts the
browser-declared MIME type, so a file of HTML named `.jpg` reaches the
optimiser; sharp decodes every format that filter admits, so a decode failure
means the bytes are not a picture. Such an upload is **deleted and refused with
a 400**. Verified with both a fake JPEG and a fake GIF.

**The lesson for the next session: an assertion that passes is not evidence
until you have seen it fail.** That test would have passed against no
implementation at all.

### 15.6 Loading

- **The hero is preloaded.** It is the LCP element but it is a CSS
  `background-image` on `--ls-hero-image`, so the browser cannot discover it
  until the stylesheet is fetched and parsed. `contentLocals.heroPreload` feeds
  a `<link rel="preload" as="image" fetchpriority="high">` in the head, **only
  on the home page** — the other pages have no hero and would download an image
  they never show.
- **`lazyLoad` now adds `decoding="async"` as well as `loading="lazy"`.** Lazy
  decides when bytes are fetched; async decides whether decoding blocks the
  main thread. On a page of large photos the second is what stops scrolling
  stuttering. Both are skipped for an `<img>` that already declares `loading`,
  so a future above-the-fold image can opt out with `loading="eager"` —
  **lazy-loading the LCP element delays it**, which is the opposite of the point.
- **`/uploads/*` is now `max-age=31536000, immutable`.** Filenames are unique
  per upload, so the bytes at a given upload URL can never change — replacing a
  photo produces a new URL. Repo images keep the shorter 1-day life because
  their filenames are stable and a redeploy has to be able to take effect.

### 15.7 Dead weight still in the repo

`home.css` declares six background-image rules — `.photographer`,
`.videographe`, `.piece`, `.champagne`, `.buffet`, `.planner` — whose class
names appear in **no template at all**. The browser never requests them, so
they cost a visitor nothing, but the six image files (~530 KB, `piece.jpg`
alone is 278 KB) are carried in the repo and in every deploy for nothing.

Left in place deliberately: they look like a services section that was planned
or removed, and deleting someone's assets on a guess is worse than 530 KB of
repo. Delete both the rules and the files if that section is not coming back.

### 15.8 What is NOT done

- **No responsive `srcset`/multiple widths.** Every viewport gets the 2000px
  version. The next real win, and it needs the templates to emit `<picture>`.
- **No AVIF.** ~20% smaller again than WebP, but it needs a `<picture>`
  fallback chain to be safe.
- **Visual quality was never eyed.** q80/q82 at 2000px are standard
  high-quality web settings and the dimensions were checked, but **nobody has
  looked at the re-encoded photos**. Check the hero and the gift photo before
  deploying; the originals are one `git checkout` away.
- `sharp` is a **native dependency**. It ships prebuilt binaries per platform;
  if the production host's Node or libc differs, `npm install` there must be
  able to fetch or build them. Watch the first deploy.

## 16. Verification pass (2026-09-23)

A sweep for anything still broken. Three real findings, all pre-existing rather
than introduced by the recent work.

### 16.1 Two unauthenticated routes that leaked guest data to the log — removed

`GET /select` and `GET /selectAll` were leftover debug routes. Neither was
linked from anywhere. **Neither required authentication.** Both read guest
records — `/selectAll` read the *entire* guest list — logged them with
`console.log`, and redirected to `/`.

They did not return data to the caller, so this was not a direct disclosure.
But any anonymous request to `/selectAll` pushed every guest's name and email
into the server log, where they are retained by the host and visible to anyone
with log access. Both routes are gone; guest data is now reachable only through
`/admin`. A `POST /` stub that replied `Post route / HIT` was removed with them
(nothing posts to `/`; the registration form posts to `/invitee`).

### 16.2 Guest personal data was being logged on every registration — removed

Independently of those routes, the normal registration path logged:

- the full `createInvitee` result and field metadata (`invitees.model.js`),
- the inserted id and the update parameters, including first and last name,
- the `deep-email-validator` result object, which contains the address, and
  the full mail-send response (`mail.controller.js`).

All removed. Error logging is kept (`console.log(error)` became
`console.error`). A commented-out test call containing a personal email address
was deleted too.

**Rule for anything added later: guest names and addresses do not go to
stdout.** The host keeps those logs.

### 16.3 `program-tabs.js` was still being shipped

With one timeline the script finds no tabs and returns immediately, so every
visitor downloaded it for nothing. Its `<script>` tag is now behind the same
`programLocations.length > 1` condition as the tab bar, so restoring a second
location restores the script with it. Nothing calls
`window.lsSelectProgramLocation` — checked — so not defining it breaks nothing.

### 16.4 Two test failures that were the tests' fault, not the code's

Worth recording, because both looked alarming:

- **"editor chrome missing on `/?edit=1`"** — the crawl fetched `/admin` before
  `/?edit=1`, and visiting the dashboard **deliberately closes the editor
  session** (`app.js`: an admin who walked out of the editor with the back
  button must re-enter through the button). Working as designed.
- **"pre-existing rows not byte-identical"** — the assertion compared *every*
  row including the one the test had just written. Excluding that key, nothing
  else moves.

Together with §15.5, that is three assertions in two days that were wrong
rather than the code. **An assertion that passes is not evidence until you have
seen it fail**, and one that fails deserves the same scepticism.

### 16.5 Verified green

Routes (including 404s for the removed ones), every referenced asset resolves
across all seven pages, visitor/editor isolation on each, the couple's content
renders across 6 entries, mirrored place/link ordering 6/6 both sides, security
headers, `javascript:`/off-host/XSS/CSRF all refused, uploads optimised and
fakes rejected, and no row disturbed by a save. `npm audit`: 0.

`npm test` is still red on the single pre-existing network-dependent assertion
described in §7.

### 16.6 TWO FINDINGS LEFT UNFIXED — they need the owner's decision

Both are live on `main`. Neither was touched, because fixing either changes
guest-facing behaviour or guest data, and guessing wrong is worse than leaving
them documented.

#### A. The app reads and writes the TEST invitee table

`models/invitees.model.js:5`

```js
const TABLE_NAME = TEST_TABLE_NAME;   // 'test_invitees'
```

Commit `9ed3a12 "Set database to test table"` flipped this from
`PROD_TABLE_NAME` and it was never flipped back. **Every guest registration in
production is being written to `test_invitees`, and `/admin` reads the same
table.**

It is self-consistent — registrations go in and the admin list shows them — so
nothing looks broken from the outside. But the real `invitees` table is
orphaned. On the development database: `invitees` holds 87 rows (highest id
174), `test_invitees` holds 59 (highest id 62).

**Do not simply flip it.** If production has been collecting real registrations
in `test_invitees` since that commit, switching to `PROD_TABLE_NAME` makes the
couple's actual guest list vanish from `/admin`. Decide with the data in front
of you:

```sql
SELECT 'invitees' t, COUNT(*) n, MAX(id) FROM invitees
UNION ALL
SELECT 'test_invitees', COUNT(*), MAX(id) FROM test_invitees;
```

If the real registrations are in `test_invitees`, the fix is to migrate them
into `invitees` and *then* flip the constant — not to flip it alone.

#### B. Registration validation never runs

`controllers/invitees.controller.js`

```js
if(dataCreateInviteeValid(formBody)) {     // <- missing await
```

`dataCreateInviteeValid` is `async`, so it returns a Promise, and a Promise is
always truthy. **The guard can never fail.** Verified: a POST to `/invitee`
with an empty last name and empty email returns `303 /?registered=1`.

Adding `await` is a one-word fix, and it is deliberately not applied here,
because that function ends with:

```js
const emailValid = await validate(data.email);   // deep-email-validator
```

which performs a live MX/SMTP lookup. Turning validation on therefore puts a
network round-trip in front of every registration and can **reject real guests
when the lookup misbehaves** — and we know it misbehaves: that is the
pre-existing red test in §7, where `null@null.com` is now accepted. Enabling
this a few weeks before a wedding, untested against live DNS, is the riskier
option.

Two further problems inside that function, which matter if it is ever enabled:

```js
if(!typeof data.firstName === 'string' || ...)    // always false
if(!data.firstName.length > 0 || ...)             // always false
```

`!typeof x` is a boolean, never `'string'`; `!x.length > 0` is `false > 0`.
**Both guards are no-ops.** Only the null / empty-object / `hasOwnProperty`
checks and the email lookup actually do anything.

**Recommended order:** fix the two broken comparisons, add `await`, and make
the `deep-email-validator` call non-fatal (accept the registration if the
lookup errors or times out, rather than rejecting a real guest). Then the
server has real validation without a DNS outage costing the couple an RSVP.
