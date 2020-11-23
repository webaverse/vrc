const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');

const app = express();
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  next();
});
const appStatic = express.static(__dirname);
app.use(appStatic);
app.use(appStatic);

http.createServer(app)
  .listen(3000);