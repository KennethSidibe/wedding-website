import bodyParser from "body-parser";
import express from "express";
import bodyParser from "body-parser";
const app = express();
const port = 3000;
import {dirname } from "path";
import { fileURLToPath } from "url";
const __dirName = dirname(fileURLToPath(import.meta.url));


// Middleware
app.use(bodyParser.urlencoded({extended:true}));

app.listen(port, () => {
  console.log(`Server running on port ${port}.`);
});

app.get('/', (req, res) => {
  console.log(`dirname : ${__dirName}`)
});