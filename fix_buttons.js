import fs from 'fs';
let content = fs.readFileSync('src/AdminApp.tsx', 'utf-8');

// The active tab color
content = content.replace(/'bg-emerald-600 text-white shadow-md shadow-emerald-900\/30'/g, "'bg-ink text-white shadow-md'");
// The inactive tab hover color
content = content.replace(/hover:text-white hover:bg-mist/g, "hover:bg-mist text-text-secondary hover:text-ink");
content = content.replace(/hover:text-white/g, 'hover:text-ink');

// The hero metrics text-white
content = content.replace(/<p className="mt-1 text-lg font-black text-white">{value}<\/p>/g, '<p className="mt-1 text-lg font-black text-ink">{value}</p>');

// Some other text-whites
content = content.replace(/text-white text-lg tracking-tight/g, 'text-ink text-lg tracking-tight');
content = content.replace(/text-white/g, 'text-ink');

// For the bg-ink text-ink, change it to bg-ink text-white!
content = content.replace(/'bg-ink text-ink shadow-md'/g, "'bg-ink text-white shadow-md'");

fs.writeFileSync('src/AdminApp.tsx', content, 'utf-8');
console.log('Fixed');
