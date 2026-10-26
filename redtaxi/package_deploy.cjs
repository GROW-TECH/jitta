const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const deployDir = path.join(rootDir, 'jittadrivers_deploy');
const zipPath = path.join(rootDir, 'jittadrivers_cpanel_upload.zip');

function removeDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('1. Preparing deployment directory...');
removeDir(deployDir);
fs.mkdirSync(deployDir, { recursive: true });
fs.mkdirSync(path.join(deployDir, 'admin'), { recursive: true });
fs.mkdirSync(path.join(deployDir, 'api'), { recursive: true });
fs.mkdirSync(path.join(deployDir, 'database'), { recursive: true });

console.log('2. Copying Customer/Driver build (jittadrives/dist)...');
copyDir(path.join(rootDir, 'jittadrives', 'dist'), deployDir);

console.log('3. Copying Admin build (dist)...');
copyDir(path.join(rootDir, 'dist'), path.join(deployDir, 'admin'));

console.log('4. Copying PHP Backend (backend)...');
const backendSrc = path.join(rootDir, 'backend');
const backendEntries = fs.readdirSync(backendSrc, { withFileTypes: true });
for (const entry of backendEntries) {
  if (entry.name.endsWith('.log') || entry.name.startsWith('test_') || entry.name === 'scratch' || entry.name.startsWith('.')) {
    continue;
  }
  const srcPath = path.join(backendSrc, entry.name);
  const destPath = path.join(deployDir, 'api', entry.name);
  if (entry.isDirectory()) {
    copyDir(srcPath, destPath);
  } else {
    fs.copyFileSync(srcPath, destPath);
  }
}

console.log('5. Copying database dump...');
fs.copyFileSync(
  path.join(rootDir, 'database', 'redtaxi_complete_production.sql'),
  path.join(deployDir, 'database', 'redtaxi_complete_production.sql')
);

console.log('6. Writing universal .htaccess files...');
const rootHtaccess = `<IfModule mod_rewrite.c>
  RewriteEngine On

  # Pass Authorization Header to PHP in Apache / FastCGI / cPanel
  RewriteCond %{HTTP:Authorization} .
  RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]

  # Allow existing files and directories to be served directly
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # Pass /api/ requests to the backend API directory
  RewriteCond %{REQUEST_URI} api/ [NC]
  RewriteRule ^ - [L]

  # Pass /admin/ requests to the admin directory
  RewriteCond %{REQUEST_URI} admin/ [NC]
  RewriteRule ^ - [L]

  # Route all other URLs to index.html for React SPA
  RewriteRule ^ index.html [L]
</IfModule>

# Performance: Enable Gzip Compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json image/svg+xml
</IfModule>

# Performance: Cache static assets
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/svg+xml "access plus 1 month"
  ExpiresByType image/png "access plus 1 month"
  ExpiresByType image/jpeg "access plus 1 month"
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
</IfModule>
`;
fs.writeFileSync(path.join(deployDir, '.htaccess'), rootHtaccess, 'utf8');

const adminHtaccess = `<IfModule mod_rewrite.c>
  RewriteEngine On

  # Allow existing files and folders
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # Route all admin subpages to index.html
  RewriteRule ^ index.html [L]
</IfModule>
`;
fs.writeFileSync(path.join(deployDir, 'admin', '.htaccess'), adminHtaccess, 'utf8');

const apiHtaccess = `<IfModule mod_rewrite.c>
    RewriteEngine On

    # Pass Authorization Header to PHP in Apache / FastCGI / cPanel
    RewriteCond %{HTTP:Authorization} .
    RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]

    # Send all non-file, non-directory requests to Front Controller (index.php)
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^(.*)$ index.php [QSA,L]
</IfModule>
`;
fs.writeFileSync(path.join(deployDir, 'api', '.htaccess'), apiHtaccess, 'utf8');

console.log('7. Deployment folder prepared successfully at:', deployDir);

// Explicitly ensure NO .env files exist in deployment package
function purgeEnvFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      purgeEnvFiles(fullPath);
    } else if (entry.name === '.env' || entry.name.startsWith('.env.') || entry.name.endsWith('.env')) {
      fs.unlinkSync(fullPath);
      console.log('Removed env file:', fullPath);
    }
  }
}
purgeEnvFiles(deployDir);

const { execSync } = require('child_process');
console.log('8. Creating jittadrivers_cpanel_upload.zip (without any .env)...');
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}
execSync(`powershell -Command "Compress-Archive -Path '${deployDir}\\*' -DestinationPath '${zipPath}' -Force"`);
console.log('9. Deployment ZIP created successfully at:', zipPath);

