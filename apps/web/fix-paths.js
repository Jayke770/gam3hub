import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const outDir = './out';
// Project root is 2 levels up from apps/web/
const projectRootZip = path.resolve('../../itch-tanks.zip');

function walk(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(dirPath);
  });
}


console.log('Aggressively fixing paths for Itch.io deployment...');

// Rename _next folder to next
const oldNextDir = path.join(outDir, '_next');
const newNextDir = path.join(outDir, 'next');
if (fs.existsSync(oldNextDir)) {
  if (fs.existsSync(newNextDir)) {
    execSync(`cp -R "${oldNextDir}/"* "${newNextDir}/"`);
    execSync(`rm -rf "${oldNextDir}"`);
  } else {
    fs.renameSync(oldNextDir, newNextDir);
  }
  console.log('Renamed _next to next');
}

walk(outDir, (filePath) => {
  if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.json') || filePath.endsWith('.txt')) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    let newContent = content
      .replace(/["']\/_next\//g, (match) => match[0] + 'next/')
      .replace(/["']_next\//g, (match) => match[0] + 'next/')
      .replace(/["']\/battle-of-tanks\//g, (match) => match[0] + './battle-of-tanks/')
      .replace(/["']\/assets\//g, (match) => match[0] + './assets/')
      .replace(/["']\/favicon\.ico/g, (match) => match[0] + './favicon.ico')
      .replace(/["']\/manifest\.json/g, (match) => match[0] + './manifest.json')
      .replace(/url\(\/_next\//g, 'url(next/')
      .replace(/url\(_next\//g, 'url(next/')
      .replace(/url\(\/battle-of-tanks\//g, 'url(./battle-of-tanks/')
      .replace(/url\(\/assets\//g, 'url(./assets/');
    
    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent);
    }
  }
});

console.log('Zipping files...');
try {
  if (fs.existsSync(projectRootZip)) {
    fs.unlinkSync(projectRootZip);
  }
  // Zip relative to the out directory
  execSync(`zip -r "${projectRootZip}" .`, { cwd: outDir });
  console.log(`Successfully created itch-tanks.zip at ${projectRootZip}`);
} catch (err) {
  console.error('Failed to zip files:', err.message);
}
