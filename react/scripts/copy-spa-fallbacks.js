import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const indexFile = path.join(dist, 'index.html');

if (!fs.existsSync(indexFile)) {
  console.error('Missing dist/index.html — run vite build first.');
  process.exit(1);
}

const html = fs.readFileSync(indexFile);

const routes = [
  'activate',
  'calendar',
  'requests',
  'history',
  'team',
  'public-holidays',
  'settings',
  'notifications',
  'users',
  'balances',
  'reports',
  'login',
  'admin',
  'approvals',
];

for (const route of routes) {
  const dir = path.join(dist, route);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}

console.log(`SPA fallbacks written for ${routes.length} routes.`);
