# HANDOFF — LegendeSheridan wedding site

**Last updated: 2026-08-03**

> Scope note: the most recent session built the **admin page editor** (§8) and
> then revised it against the owner's feedback after they used it. Everything is
> exercised end-to-end over HTTP — login, the editor-session gate, save, upload,
> reset, and the rejection paths — but **no page was ever opened in a real
> browser by the agent**, so the editor's appearance and its in-place typing
> behaviour remain unverified from this side. See §8.6.
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
3. Replace the `Lorem ipsum` programme entries — now doable from the editor
   rather than in code. Blocking: the couple's actual schedule.
4. Reconcile the conflicting wedding dates between the hero and the Notre
   Mariage paragraph. Blocking: which date is correct.
5. Add a `.env.example` listing the variable names in §3, including `NODE_ENV`.
6. Consider Tier 3 of the editor plan — a catalogue of reusable blocks the admin
   can add, reorder by drag-and-drop, and assemble into brand-new pages. It was
   deliberately deferred; §8.5 records why and what it would take.

## 7. Traps

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
