import bodyParser from "body-parser";
import express from "express";
const app = express();
const port = 3000;
import {dirname } from "path";
import { fileURLToPath } from "url";


const __dirName = dirname(fileURLToPath(import.meta.url));


// Middleware
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static(__dirName + "/public"));


// Routes
app.listen(port, () => {
  console.log(`Server running on port ${port}.`);
});


//Home
app.get('/', (req, res) => {
  res.render('index.ejs');
});

// Register Invitees
app.get('/invites', (req, res) => {
  res.render('invites.ejs');
});

app.post('/invitees', (req, res) => {
  console.log(req.body);
  
  res.send('<h1>Thank you for registering</h1>');
});