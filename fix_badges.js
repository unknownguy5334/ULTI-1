import fs from 'fs';
let content = fs.readFileSync('src/AdminApp.tsx', 'utf-8');

content = content.replace(/bg-white\/20 text-ink/g, 'bg-white/20 text-white');

fs.writeFileSync('src/AdminApp.tsx', content, 'utf-8');
console.log('Fixed badges');
