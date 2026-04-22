const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// This serves your index.html and app.js
app.use(express.static(path.join(__dirname, '/')));

app.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on port ${port}`);
});