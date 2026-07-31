import bodyParser from "body-parser";
import { log } from "console";
import express from "express";
import path, {dirname } from "path";
import { fileURLToPath } from "url";
import { createNewInvitee, retrieveAllInvitees, retrieveInvitee} from "./controllers/invitees.controller.js";
import { attemptAdminLogin, isAdminLoginLocked, LOGIN_RESULT } from "./controllers/admin.controller.js";
import { createAdminSession, destroyAdminSession, isAdminAuthenticated, requireAdmin } from "./middlewares/adminAuth.js";
import { readFileSync } from 'fs';
import { cacheBusting } from "./middlewares/cacheBusting.js";
import { staticCache } from "./middlewares/staticCache.js";
import { lazyLoad } from "./middlewares/lazyLoad.js";

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const version = pkg.version;

const __dirName = dirname(fileURLToPath(import.meta.url));

const app = express();
const port = 8129;

const publicPath = path.join(__dirName, "public");

// Middleware
app.use(lazyLoad);
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.json());

app.use(staticCache(publicPath));
app.use(cacheBusting);




// Routes
app.listen(port, () => {
  console.log(`Server running on port ${port}.`);
});

//Home
app.get('/', (req, res) => {
  res.render('index.ejs', { registered: req.query.registered === '1' });
});

app.get('/select', async(req, res) => {

  try {
    const invitee = await retrieveInvitee({id:15});
    if(invitee != null) {
      console.log(invitee);
      res.redirect('/');
    }
    else {
      res.redirect('/?error=nF');
    }
  } catch (error) {
    console.error(error);
    res.redirect('/?error=nF');
  }

});

app.get('/selectAll', async(req, res) => {

  try {
    const invitees = await retrieveAllInvitees();
    if(invitees != null) {
      console.log(invitees);
      res.redirect('/');
    } else {
      res.redirect('/?error=nF');
    }
  } catch (error) {
    console.error(error);
    res.redirect('/')
  }
});

// Register Invitees
app.get('/invitees', async(req, res) => {
  res.render('invites.ejs');
});

app.post('/', async(req, res) => {
  res.send('Post route / HIT');
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

  try {
    const invitees = await retrieveAllInvitees();
    res.render('admin-invitees.ejs', { invitees });
  } catch (error) {
    console.error(error);
    res.render('admin-invitees.ejs', {
      invitees: [],
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
  destroyAdminSession(req, res);
  res.redirect('/admin/login');
});