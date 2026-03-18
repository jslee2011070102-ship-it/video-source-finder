require('dotenv').config();
const express = require('express');
const path    = require('path');

const productRoute  = require('./routes/product');
const searchRoute   = require('./routes/search');
const analyzeRoute  = require('./routes/analyze');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/product', productRoute);
app.use('/api/search',  searchRoute);
app.use('/api/analyze', analyzeRoute);

app.listen(PORT, () => {
  console.log(`\n🚀 Video Source Finder 실행 중`);
  console.log(`   http://localhost:${PORT}\n`);
});
