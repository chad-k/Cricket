import {access} from 'node:fs/promises';
for(const file of ['public/index.html','public/app.js','public/characters.js','public/style.css','game.js','server.js'])await access(file);
console.log('Static client and server ready. No frontend compilation required.');
