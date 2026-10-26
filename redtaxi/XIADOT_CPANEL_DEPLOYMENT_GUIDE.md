# JittaDrives - Live Deployment Guide for xiadot.com Server

This guide contains the exact step-by-step instructions to take the **JittaDrives** project live on `xiadot.com` (cPanel / Apache / MySQL).

---

## 📦 Deployment File

- **Zip File to Upload**: `jittadrivers_cpanel_upload.zip` (located in your project root `c:\Users\VISHALNI\jittadrives\redtaxi\jittadrivers_cpanel_upload.zip`)
- **Package Size**: ~18.0 MB
- **Package Structure inside ZIP**:
  ```text
  ├── index.html                (Customer & Driver Web App Frontend)
  ├── assets/                   (Compiled React JS/CSS Bundles)
  ├── logo.png, favicon.svg     (Brand Assets & Icons)
  ├── vehicles/                 (Vehicle category graphics)
  ├── .htaccess                 (SPA Routing & Apache Compression)
  ├── admin/                    (Admin Operations Dashboard SPA)
  │   ├── index.html
  │   ├── assets/
  │   └── .htaccess
  ├── api/                      (PHP 8.x REST API Backend)
  │   ├── index.php
  │   ├── .htaccess
  │   ├── .env.example
  │   ├── config/
  │   ├── controllers/
  │   ├── models/
  │   ├── routes/
  │   └── utils/
  └── database/
      └── redtaxi_complete_production.sql  (Complete MySQL Database Dump)
  ```

---

## 🚀 Step-by-Step Live Server Setup (cPanel on xiadot.com)

### 1. Database Setup (phpMyAdmin)
1. Log in to your **cPanel** on `xiadot.com`.
2. Go to **MySQL® Databases**:
   - Create a new database (e.g., `xiadot_jittadrives`).
   - Create a new MySQL User with a strong password (e.g., `xiadot_dbuser`).
   - Assign the user to the database with **ALL PRIVILEGES**.
3. Open **phpMyAdmin**:
   - Select your new database `xiadot_jittadrives`.
   - Click the **Import** tab.
   - Choose the file `database/redtaxi_complete_production.sql` (found inside the zip).
   - Click **Import / Go**. All 14+ tables, vehicles, drivers, and settings will be created automatically.

---

### 2. Upload & Extract ZIP in cPanel File Manager
1. In cPanel, open **File Manager**.
2. Navigate to your desired public directory:
   - If deploying to `https://xiadot.com/jittadrives/`: Go to `public_html/jittadrives/` (create folder if needed).
   - If deploying directly to the root `https://xiadot.com/`: Go to `public_html/`.
3. Click **Upload** and upload `jittadrivers_cpanel_upload.zip`.
4. Right-click the uploaded zip and click **Extract**.

---

### 3. Configure Database Credentials in `api/.env`
1. Inside the extracted files, navigate to the `api/` folder.
2. If `.env` is not visible, rename `.env.example` to `.env` (or edit `.env`).
3. Set your live database credentials:
   ```ini
   APP_NAME="JittaDrives API"
   APP_ENV=production
   APP_DEBUG=false
   APP_URL=https://xiadot.com
   API_PREFIX=/api/v1

   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=xiadot_jittadrives
   DB_USER=xiadot_dbuser
   DB_PASS=your_cpanel_dbpassword
   DB_CHARSET=utf8mb4
   ```
4. Save the file.

---

### 4. Verify Live Endpoints in Browser
Once uploaded, open your browser and verify:

1. **Backend Health Check**:
   - URL: `https://xiadot.com/api/v1/health` (or `https://xiadot.com/jittadrives/api/v1/health`)
   - Expected Response: `{"success":true,"statusCode":200,"message":"All systems functional"}`

2. **Customer & Driver Web App**:
   - URL: `https://xiadot.com/` (or `https://xiadot.com/jittadrives/`)

3. **Admin Operations Dashboard**:
   - URL: `https://xiadot.com/admin/` (or `https://xiadot.com/jittadrives/admin/`)

---

## 🔑 Default Production Login Credentials

| Role | Username / Email / Phone | Password |
|---|---|---|
| **System Administrator** | `admin@redtaxi.in` | `admin123` |
| **Driver Partner (Vishalu)** | `9645370028` | (Instant OTP / Demo Login) |
| **Customer (Test Account)** | `9876543210` | (Instant OTP / Demo Login) |
