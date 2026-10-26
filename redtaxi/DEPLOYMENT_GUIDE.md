# Red Taxi – Production Server Deployment Guide

This guide walks you through deploying the complete **Red Taxi** application (React Frontend, PHP REST API Backend, and MySQL Database) to a live production server.

---

## 📦 Package Contents Overview

You have three deployment options provided in your ZIP archives:

1. **`redtaxi-complete-live-package.zip`**: All-in-one bundle containing everything:
   - `frontend-dist/`: Pre-compiled production build ready to serve immediately (No Node.js needed on server).
   - `frontend-source/`: Complete React 19 + TypeScript + Vite source code (for developers to edit or rebuild).
   - `backend/`: Production PHP 8.x REST API with MVC architecture, routes, controllers, and `.htaccess`.
   - `database/`: Full MySQL database schemas and complete seed data (`redtaxi_complete_production.sql`).
   - `DEPLOYMENT_GUIDE.md`: This deployment reference manual.

2. **`redtaxi-frontend-production.zip`**:
   - Contains the compiled `dist/` production assets (`index.html`, `assets/`, `.htaccess`, icons).
   - Instant drag-and-drop into `public_html` or webroot.

3. **`redtaxi-backend-production.zip`**:
   - Contains the PHP API backend files and the MySQL SQL database dumps.

---

## 🖥️ Server Prerequisites

- **Web Server**: Apache 2.4+ (with `mod_rewrite` enabled) OR Nginx 1.18+
- **PHP**: PHP 8.0, 8.1, 8.2, or 8.3 with extensions:
  - `pdo_mysql`
  - `openssl`
  - `json`
  - `mbstring`
  - `curl`
- **Database**: MySQL 5.7+ / 8.0+ OR MariaDB 10.4+
- **SSL Certificate**: HTTPS enabled (Let's Encrypt / Cloudflare / cPanel AutoSSL recommended).

---

## 🚀 Step-by-Step Deployment Instructions

### Step 1: Database Setup

1. Open **phpMyAdmin** (or MySQL CLI) on your live server.
2. Create a new database:
   ```sql
   CREATE DATABASE redtaxi_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. Import the database dump file:
   - Upload and import `database/redtaxi_complete_production.sql`.
   - *(Alternatively, for clean schema without seed rows, use `database/redtaxi_schema.sql`)*.
4. Verify the database contains the required tables:
   - `admins`, `customers`, `drivers`, `driver_vehicles`, `bookings`, `vehicle_categories`, `fare_rules`, `driver_wallets`, `wallet_transactions`, `payments`, `ratings_reviews`, `sos_alerts`, `coupons`, `banners`.

---

### Step 2: Backend PHP API Deployment

1. Upload the `backend/` folder to your server (e.g. `/var/www/redtaxi/backend` or `public_html/api` or a subdomain `api.yourdomain.com`).
2. Copy `.env.example` to `.env`:
   ```bash
   cp backend/.env.example backend/.env
   ```
3. Edit `backend/.env` with your live production credentials:
   ```ini
   APP_NAME="RedTaxi API"
   APP_ENV=production
   APP_DEBUG=false
   APP_URL=https://yourdomain.com
   API_PREFIX=/api/v1

   # MySQL Database Connection
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=redtaxi_db
   DB_USER=your_db_username
   DB_PASS=your_db_password
   DB_CHARSET=utf8mb4

   # CORS Allowed Origins
   CORS_ALLOWED_ORIGINS="https://yourdomain.com,https://admin.yourdomain.com"
   CORS_ALLOWED_METHODS="GET, POST, PUT, PATCH, DELETE, OPTIONS"
   CORS_ALLOWED_HEADERS="Content-Type, Authorization, X-Requested-With"
   CORS_ALLOW_CREDENTIALS=true
   ```
4. Ensure Apache `mod_rewrite` is enabled. If using Nginx, configure rewrite rules (see Section below).
5. Test the backend health endpoint in your browser or curl:
   ```
   GET https://yourdomain.com/api/v1/health
   ```
   **Expected Response:**
   ```json
   {
     "success": true,
     "statusCode": 200,
     "message": "All systems functional",
     "data": { "status": "HEALTHY", "api": "ONLINE" }
   }
   ```

---

### Step 3: Frontend Deployment (Instant / No Node Required)

The `frontend-dist/` folder contains the already-compiled, optimized production build.

1. Upload the contents of `frontend-dist/` directly into your web root (e.g. `public_html/` or `/var/www/html/`).
2. The included `.htaccess` file automatically configures:
   - Client-side SPA routing (routing `/admin`, `/driver`, `/customer` to `index.html`).
   - Static asset compression (Gzip/Brotli).
   - Browser caching headers for CSS/JS/images.
   - Transparent forwarding of `/api` requests to the backend.

---

## 🌐 Web Server Configuration Guides

### Option A: Apache (cPanel / Standard LAMP)

Place backend files in `public_html/api` (or keep in root with rewrite) and frontend files in `public_html/`.

The included `.htaccess` inside `frontend-dist/` automatically manages routing:
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Allow real files and directories
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # Pass /api/ calls through to backend
  RewriteCond %{REQUEST_URI} ^/api [NC]
  RewriteRule ^ - [L]

  # Route SPA requests to index.html
  RewriteRule ^ index.html [L]
</IfModule>
```

### Option B: Nginx (LEMP Server)

Here is a production-ready Nginx server block:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    root /var/www/redtaxi/frontend-dist;
    index index.html;

    # Static Assets & React SPA Routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # PHP REST API Backend Routing
    location /api {
        alias /var/www/redtaxi/backend;
        try_files $uri $uri/ @backend_rewrite;

        location ~ \.php$ {
            include fastcgi_params;
            fastcgi_param SCRIPT_FILENAME /var/www/redtaxi/backend/index.php;
            fastcgi_pass unix:/var/run/php/php8.2-fpm.sock; # Adjust PHP version
            fastcgi_intercept_errors on;
        }
    }

    location @backend_rewrite {
        rewrite ^/api/(.*)$ /api/index.php?$query_string last;
    }

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
}
```

---

## 🔑 Default Production Seed Credentials

The production database dump includes working accounts for instant testing:

| Role | Portal URL | Login Email / Phone | Password |
|---|---|---|---|
| **Administrator** | `/admin` | `admin@redtaxi.in` | `admin123` |
| **Driver Partner** | `/driver` | `driver@redtaxi.in` *(or 9876543211)* | `driver123` |
| **Demo Customer** | `/` | `customer@redtaxi.in` *(or 9876543210)* | `customer123` |

> ⚠️ **Security Recommendation**: Once deployed, log in to the Admin Console and update the administrator credentials.

---

## 🛠️ Rebuilding Frontend From Source (Optional)

If you modify the frontend code in `frontend-source/`:

1. Install dependencies:
   ```bash
   cd frontend-source
   npm install
   ```
2. Set your production API URL in `.env` if using a separate domain:
   ```ini
   VITE_API_BASE_URL=https://api.yourdomain.com
   ```
3. Build for production:
   ```bash
   npm run build
   ```
4. The output in `dist/` is ready to be uploaded to your server.
