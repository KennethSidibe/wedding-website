import bodyParser from "body-parser";
import { log } from "console";
import express from "express";
import path, {dirname } from "path";
import { fileURLToPath } from "url";
import { createNewInvitee, retrieveAllInvitees, retrieveInvitee} from "./controllers/invitees.controller.js";
import { attemptAdminLogin, isAdminLoginLocked, LOGIN_RESULT } from "./controllers/admin.controller.js";
import { createAdminSession, destroyAdminSession, isAdminAuthenticated, requireAdmin, requireAdminApi,
  openEditorSession, closeEditorSession, isEditorSessionOpen } from "./middlewares/adminAuth.js";
import { readFileSync } from 'fs';
import { unlink } from 'fs/promises';
import { cacheBusting } from "./middlewares/cacheBusting.js";
import { staticCache } from "./middlewares/staticCache.js";
import { lazyLoad } from "./middlewares/lazyLoad.js";
import { htmlCache } from "./middlewares/htmlCache.js";
import { securityHeaders } from "./middlewares/securityHeaders.js";
import { contentLocals } from "./middlewares/contentLocals.js";
import { uploadImage, UPLOAD_URL_PREFIX, MAX_UPLOAD_BYTES } from "./middlewares/uploadImage.js";
import { optimizeUpload } from "./middlewares/optimizeUpload.js";
import {
  initContentCache,
  saveContentUpdates,
  resetPageContent,
  resetContentKeys
} from "./controllers/content.controller.js";

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const version = pkg.version;

const __dirName = dirname(fileURLToPath(import.meta.url));

const app = express();
const port = 8129;

const publicPath = path.join(__dirName, "public");

// Middleware

// Before express.static on purpose: nosniff has to cover uploaded files too,
// which are served below and never reach htmlCache.
app.use(securityHeaders(app));

app.use(lazyLoad);
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.json());

app.use(staticCache(publicPath));

// After staticCache on purpose: files under public/ are served above and
// never reach this, so the headers set there stay intact. Everything that
// gets past it is a rendered page or an API response.
app.use(htmlCache);

app.use(cacheBusting);

// Must come after the body parsers (the write endpoints read req.body) and
// before any route that renders a page, since it supplies the content helpers
// every template now calls.
app.use(contentLocals);

// Warm the content cache before the first request. A failure here is not fatal
// — every slot falls back to the default compiled into the template, so the
// site stays up even if MySQL is down.
initContentCache().catch((error) => {
  console.error('Initial site content load failed:', error.message);
});


// Routes
app.listen(port, () => {
  console.log(`Server running on port ${port}.`);
});

//Home
app.get('/', (req, res) => {
  res.render('index.ejs', { registered: req.query.registered === '1' });
});

// Removed 2026-09-23: two leftover debug routes, GET /select and
// GET /selectAll. Neither was linked from anywhere, both were
// **unauthenticated**, and both read guest records — /selectAll read the
// entire guest list — only to dump them to the server log and redirect. Any
// anonymous request could therefore push every guest's name and email into
// the logs. Guest data is only reachable through /admin now.

// Register Invitees
app.get('/invitees', async(req, res) => {
  res.render('invites.ejs');
});

app.post('/invitee', async(req, res) => {

  try {

    const result = await createNewInvitee(req.body);

    res.redirect(303, '/?registered=1');
  }catch (error) {
    if(error.code === 'ER_DUP_ENTRY') {
      console.error(error);
      return res.redirect(303, '/invitees?error=emailExists');
    } else {
      console.error(error);
      res.redirect('/?error=error');
    }
  }
});

app.get(('/give'), (req, res) => {
  res.render('give.ejs');
});

// Admin
app.get('/admin', requireAdmin, async(req, res) => {

  // Reaching the dashboard with the editor still flagged open means the admin
  // walked out of it — almost always with the back button — instead of pressing
  // Quitter. Tell them, and close it: the editor must be re-entered through the
  // button below, which is the whole point of the flag.
  //
  // This renders only inside /admin, which is behind requireAdmin, so the
  // notice cannot be seen by anyone but the logged-in admin.
  const leftEditorOpen = isEditorSessionOpen(req);
  if (leftEditorOpen) {
    closeEditorSession(req);
  }

  try {
    const invitees = await retrieveAllInvitees();
    res.render('admin-invitees.ejs', { invitees, leftEditorOpen });
  } catch (error) {
    console.error(error);
    res.render('admin-invitees.ejs', {
      invitees: [],
      leftEditorOpen,
      errorMessage: "Impossible de charger la liste des invités. Veuillez réessayer plus tard."
    });
  }
});

app.get('/admin/login', async(req, res) => {

  if(isAdminAuthenticated(req)) {
    return res.redirect('/admin');
  }

  try {
    const locked = await isAdminLoginLocked();
    res.render('admin-login.ejs', { locked });
  } catch (error) {
    console.error(error);
    res.render('admin-login.ejs', {
      locked: false,
      errorMessage: "Une erreur est survenue. Veuillez réessayer plus tard."
    });
  }
});

app.post('/admin/login', async(req, res) => {

  try {
    const { result, remainingTries } = await attemptAdminLogin(req.body.pin);

    if(result === LOGIN_RESULT.SUCCESS) {
      createAdminSession(res);
      return res.redirect('/admin');
    }

    if(result === LOGIN_RESULT.LOCKED) {
      return res.render('admin-login.ejs', { locked: true });
    }

    if(result === LOGIN_RESULT.WRONG_PIN) {
      return res.render('admin-login.ejs', {
        locked: false,
        errorMessage: `Code PIN incorrect. Il vous reste ${remainingTries} essai${remainingTries > 1 ? 's' : ''}.`
      });
    }

    res.render('admin-login.ejs', {
      locked: false,
      errorMessage: "Une erreur est survenue. Veuillez réessayer plus tard."
    });
  } catch (error) {
    console.error(error);
    res.render('admin-login.ejs', {
      locked: false,
      errorMessage: "Une erreur est survenue. Veuillez réessayer plus tard."
    });
  }
});

app.post('/admin/logout', (req, res) => {
  closeEditorSession(req);
  destroyAdminSession(req, res);
  res.redirect('/admin/login');
});

// Admin — page editor
//
// The editor is the real site rendered with ?edit=1; there is no separate
// preview. contentLocals only honours the flag for an authenticated admin, so
// a visitor who types the query string sees the ordinary page.
// This is the only door into the editor. It flags the session as "editor open";
// without that flag `?edit=1` renders the ordinary public page, so a bookmark
// or the back button cannot walk back into an editing session.
app.get('/admin/edit', requireAdmin, (req, res) => {
  openEditorSession(req);
  res.redirect('/?edit=1');
});

// "Quitter" — ends the admin session outright rather than only closing the
// editor. Destroying the token is what makes the back button safe: returning to
// /?edit=1 afterwards finds no session at all, so it renders the ordinary
// public page. Re-entering costs one PIN entry, which is a fair price for not
// leaving an unattended browser one Back press away from an editor that can
// rewrite the site.
app.post('/admin/edit/exit', requireAdminApi, (req, res) => {
  destroyAdminSession(req, res);
  res.json({ ok: true });
});

// Saves a batch of slot changes. { updates: { "home.gift.title": "..." } }
app.post('/admin/content', requireAdminApi, async(req, res) => {

  try {
    const result = await saveContentUpdates(req.body?.updates);

    if (!result.ok) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      error: "Impossible d'enregistrer les modifications. Veuillez réessayer."
    });
  }
});

// Restores the original text and photos, either for a whole page
// ({ page: 'home' }) or for individual slots ({ keys: [...] }).
app.post('/admin/content/reset', requireAdminApi, async(req, res) => {

  try {
    const result = req.body?.page != null
      ? await resetPageContent(req.body.page, req.body.includeSite === true)
      : await resetContentKeys(req.body?.keys);

    if (!result.ok) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      error: "Impossible de rétablir le contenu d'origine. Veuillez réessayer."
    });
  }
});

// Receives one photo and returns its URL. The URL is not attached to any slot
// here — the editor puts it in the pending changes, and it only reaches the
// live site when the admin presses Enregistrer.
app.post('/admin/upload', requireAdminApi, (req, res) => {

  uploadImage.single('photo')(req, res, async (error) => {

    if (error != null) {
      if (error.message === 'UNSUPPORTED_IMAGE_TYPE') {
        return res.status(400).json({
          ok: false,
          error: 'Format non pris en charge. Utilisez une image JPG, PNG, WEBP ou GIF.'
        });
      }
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          ok: false,
          error: `Image trop lourde. La taille maximale est de ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} Mo.`
        });
      }
      console.error(error);
      return res.status(500).json({ ok: false, error: "Échec de l'envoi de l'image." });
    }

    if (req.file == null) {
      return res.status(400).json({ ok: false, error: 'Aucune image reçue.' });
    }

    // Shrink it before it is ever served. Done here rather than in multer's
    // storage engine because it is async and multer's filename callback is
    // not, and because a failure has to leave a usable upload rather than a
    // failed one — see the catch.
    let filename = req.file.filename;
    try {
      const result = await optimizeUpload(req.file.path);
      filename = result.filename;

      const saved = result.bytesBefore - result.bytesAfter;
      if (saved > 0) {
        console.log(
          `Image optimised: ${Math.round(result.bytesBefore / 1024)} KB -> `
          + `${Math.round(result.bytesAfter / 1024)} KB `
          + `(-${Math.round((saved / result.bytesBefore) * 100)}%)`
        );
      }
    } catch (optimizeError) {
      // The bytes are not a picture, whatever the browser called them. Delete
      // it rather than serve it: multer's filter trusts the declared MIME
      // type, so this is the check that actually knows.
      if (optimizeError.code === 'NOT_AN_IMAGE') {
        await unlink(req.file.path).catch(() => {});
        return res.status(400).json({
          ok: false,
          error: "Ce fichier n'est pas une image valide."
        });
      }

      // A real photo that could not be re-encoded for some other reason is
      // still a photo the admin just chose. Serving the original is worse for
      // bandwidth but better than telling them their upload failed, so this
      // degrades rather than throws.
      console.error('Image optimisation failed, serving the original:', optimizeError.message);
    }

    res.json({ ok: true, url: `${UPLOAD_URL_PREFIX}/${filename}` });
  });
});