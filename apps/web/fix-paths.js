import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const outDir = './out';

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(dirPath);
  });
}

console.log('Fixing paths for Itch.io deployment...');

walk(outDir, (filePath) => {
  if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace absolute paths with relative paths
    // This is a bit naive but works for most cases in Itch.io
    let newContent = content
      .replace(/src="\/_next\//g, 'src="_next/')
      .replace(/href="\/_next\//g, 'href="_next/')
      .replace(/"\/battle-of-tanks\//g, '"./battle-of-tanks/')
      .replace(/'\/battle-of-tanks\//g, "'./battle-of-tanks/");
    
    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent);
      console.log(`Updated: ${filePath}`);
    }
  }
});

console.log('Zipping files...');
try {
  // Try to use zip command (available on macOS/Linux)
  execSync('zip -r ../../itch-tanks.zip .', { cwd: outDir });
  console.log('Successfully created itch-tanks.zip in project root.');
} catch (err) {
  console.error('Failed to zip files:', err.message);
}
