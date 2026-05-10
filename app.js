import bodyParser from "body-parser";
import { log } from "console";
import express from "express";
import path, {dirname } from "path";
import { fileURLToPath } from "url";
import { createNewInvitee, retrieveAllInvitees, retrieveInvitee} from "./controllers/invitees.controller.js";
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const version = pkg.version;

const __dirName = dirname(fileURLToPath(import.meta.url));

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static(__dirName + "/public"));
app.use(express.json());

// Automatically append ?v= to all .css and .js links in every response
app.use((req, res, next) => {
  const originalRender = res.render.bind(res);

  res.render = (view, options, callback) => {
    originalRender(view, options, (err, html) => {
      if (err) return next(err);

      // Inject version into all static asset URLs
      const busted = html
        .replace(/(href|src)="(\/[^"]+\.(css|js))"/g, `$1="$2?v=${version}"`);

      res.send(busted);
    });
  };

  next();
});



// Routes
app.listen(port, () => {
  console.log(`Server running on port ${port}.`);
});

//Home
app.get('/', (req, res) => {
  res.render('index.ejs');
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

    res.redirect('/');
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