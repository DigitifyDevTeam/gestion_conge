#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const envName = process.argv[2];
if (!['local', 'production'].includes(envName)) {
  console.error('Usage: node scripts/switch-env.js {local|production}');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const backend = path.join(root, 'backend');
const activeFile = path.join(backend, '.env.active');
const sourceFile = path.join(backend, `.env.${envName}`);
const exampleFile = path.join(backend, `.env.${envName}.example`);

if (!fs.existsSync(sourceFile)) {
  if (fs.existsSync(exampleFile)) {
    fs.copyFileSync(exampleFile, sourceFile);
    console.log(`Created backend/.env.${envName} from example — edit it with your values.`);
  } else {
    console.error(`Missing backend/.env.${envName}`);
    process.exit(1);
  }
}

fs.writeFileSync(activeFile, envName, 'utf8');
console.log(`Active environment: ${envName}`);
console.log(`Loaded from: backend/.env.${envName}`);
console.log('Restart Django (runserver / gunicorn) if already running.');
