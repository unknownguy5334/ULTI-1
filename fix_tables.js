import fs from 'fs';
let content = fs.readFileSync('src/AdminApp.tsx', 'utf-8');

// Table dividers and headers
content = content.replace(/divide-neutral-800\/60/g, 'divide-line');
content = content.replace(/bg-paper\/60/g, 'bg-mist');

// Buttons
// Approve Button
content = content.replace(/bg-emerald-600 hover:bg-emerald-500 text-ink/g, 'bg-emerald-600 hover:bg-emerald-700 text-white');

// Reject Button
content = content.replace(/bg-rose-600\/20 hover:bg-rose-600 text-rose-300 hover:text-ink border border-rose-500\/30/g, 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200');

// Modal headers/backgrounds
content = content.replace(/bg-neutral-100 text-neutral-900/g, 'bg-ink text-white');
content = content.replace(/text-rose-400/g, 'text-red-700');
content = content.replace(/bg-rose-500\/10/g, 'bg-red-50');
content = content.replace(/border-rose-500\/30/g, 'border-red-200');
content = content.replace(/text-rose-300/g, 'text-red-700');
content = content.replace(/bg-rose-500\/20/g, 'bg-red-100');
content = content.replace(/border-rose-500\/20/g, 'border-red-200');

// Status Badges
content = content.replace(/bg-rose-500\/10 text-rose-400 border border-rose-500\/20/g, 'bg-red-50 text-red-700 border border-red-200');
content = content.replace(/text-emerald-300/g, 'text-emerald-700');
content = content.replace(/bg-emerald-500\/20/g, 'bg-emerald-100');

// Other specific text colors
content = content.replace(/text-neutral-500/g, 'text-text-muted');

// Filter tabs
content = content.replace(/bg-neutral-100 text-neutral-900/g, 'bg-ink text-white');

fs.writeFileSync('src/AdminApp.tsx', content, 'utf-8');
console.log('Fixed tables and buttons');
