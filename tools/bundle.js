#!/usr/bin/env node
// Builds dist/operational-command.html: the whole game in one file (CSS and JS inlined),
// handy for sharing or hosting anywhere that only takes a single page.
// Usage: node tools/bundle.js
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
// Keep "</script>" or "</style>" inside the sources from closing the inline tag early.
const safe = (src, tag) => src.replace(new RegExp(`</${tag}`, 'gi'), `<\\/${tag}`);

let html = read('index.html');
html = html.replace('<link rel="stylesheet" href="css/style.css">', () => `<style>\n${safe(read('css/style.css'), 'style')}</style>`);
html = html.replace('<script src="js/game.js"></script>', () => `<script>\n${safe(read('js/game.js'), 'script')}</script>`);
html = html.replace('<script src="js/app.js"></script>', () => `<script>\n${safe(read('js/app.js'), 'script')}</script>`);
if (/href="css\/|src="js\//.test(html)) throw new Error('bundle: a local file reference was left behind');

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'operational-command.html');
fs.writeFileSync(out, html);
console.log(`Wrote ${path.relative(root, out)} (${Math.round(html.length / 1024)} KB)`);
