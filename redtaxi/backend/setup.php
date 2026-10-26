<?php
/**
 * RedTaxi - Interactive Database Setup & Diagnostics Wizard
 * Compatible with PHP 5.6+ and all cPanel / Apache / Nginx environments.
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

$envPath = __DIR__ . '/.env';
$sampleSqlPath = dirname(__DIR__) . '/database/redtaxi_complete_production.sql';
if (!file_exists($sampleSqlPath)) {
    $sampleSqlPath = __DIR__ . '/../database/redtaxi_complete_production.sql';
}

// Function to read .env
function readEnvConfig($filePath) {
    $config = array(
        'DB_HOST' => 'localhost',
        'DB_PORT' => '3306',
        'DB_NAME' => 'redtaxi_db',
        'DB_USER' => 'root',
        'DB_PASS' => '',
        'APP_URL' => 'http://localhost/redtaxi'
    );

    if (file_exists($filePath)) {
        $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || strpos($line, '#') === 0 || strpos($line, '=') === false) continue;
            list($k, $v) = explode('=', $line, 2);
            $k = trim($k);
            $v = trim($v, " \t\n\r\0\x0B\"'");
            if (array_key_exists($k, $config)) {
                $config[$k] = $v;
            }
        }
    }
    return $config;
}

// Function to save .env
function writeEnvConfig($filePath, $newValues) {
    $existing = array();
    if (file_exists($filePath)) {
        $lines = file($filePath, FILE_IGNORE_NEW_LINES);
        foreach ($lines as $line) {
            $trimmed = trim($line);
            if ($trimmed !== '' && strpos($trimmed, '#') !== 0 && strpos($trimmed, '=') !== false) {
                list($k, $v) = explode('=', $trimmed, 2);
                $existing[trim($k)] = trim($v, " \t\n\r\0\x0B\"'");
            }
        }
    }

    $merged = array_merge($existing, $newValues);
    
    // Build new .env content
    $content = "# RedTaxi Production Configuration\n";
    $content .= "APP_NAME=\"RedTaxi API\"\n";
    $content .= "APP_ENV=production\n";
    $content .= "APP_DEBUG=true\n";
    $content .= "APP_URL=" . (isset($merged['APP_URL']) ? $merged['APP_URL'] : 'https://xiadot.com/redtaxi') . "\n";
    $content .= "API_PREFIX=/api/v1\n\n";

    $content .= "# Database Configuration\n";
    $content .= "DB_HOST=" . (isset($merged['DB_HOST']) ? $merged['DB_HOST'] : 'localhost') . "\n";
    $content .= "DB_PORT=" . (isset($merged['DB_PORT']) ? $merged['DB_PORT'] : '3306') . "\n";
    $content .= "DB_NAME=" . (isset($merged['DB_NAME']) ? $merged['DB_NAME'] : 'redtaxi_db') . "\n";
    $content .= "DB_USER=" . (isset($merged['DB_USER']) ? $merged['DB_USER'] : 'root') . "\n";
    $content .= "DB_PASS=\"" . (isset($merged['DB_PASS']) ? $merged['DB_PASS'] : '') . "\"\n";
    $content .= "DB_CHARSET=utf8mb4\n\n";

    $content .= "# Security & CORS\n";
    $content .= "CORS_ALLOWED_ORIGINS=*\n";
    $content .= "CORS_ALLOWED_METHODS=\"GET, POST, PUT, PATCH, DELETE, OPTIONS\"\n";
    $content .= "CORS_ALLOWED_HEADERS=\"Content-Type, Authorization, X-Requested-With\"\n";
    $content .= "CORS_ALLOW_CREDENTIALS=true\n";
    $content .= "CORS_MAX_AGE=86400\n";

    return file_put_contents($filePath, $content);
}

// Handle Form Submission
$actionMessage = '';
$actionError = '';

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = isset($_POST['action']) ? $_POST['action'] : '';

    if ($action === 'save_db') {
        $newDb = array(
            'DB_HOST' => trim($_POST['db_host']),
            'DB_PORT' => trim($_POST['db_port']),
            'DB_NAME' => trim($_POST['db_name']),
            'DB_USER' => trim($_POST['db_user']),
            'DB_PASS' => $_POST['db_pass']
        );

        // Test connection with submitted credentials first
        try {
            $dsn = "mysql:host={$newDb['DB_HOST']};port={$newDb['DB_PORT']};dbname={$newDb['DB_NAME']};charset=utf8mb4";
            $testPdo = new PDO($dsn, $newDb['DB_USER'], $newDb['DB_PASS'], array(
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
            ));
            
            // Save to .env
            if (writeEnvConfig($envPath, $newDb)) {
                $actionMessage = "✓ Database credentials saved to .env and verified successfully!";
            } else {
                $actionError = "Connected successfully, but could not write to .env. Please verify folder permissions (chmod 644 on .env or 755 on api folder).";
            }
        } catch (PDOException $e) {
            $actionError = "Connection test failed: " . $e->getMessage();
        }
    } elseif ($action === 'import_sql') {
        if (file_exists(__DIR__ . '/migrate.php')) {
            header('Location: migrate.php');
            exit;
        }
        $env = readEnvConfig($envPath);
        try {
            $dsn = "mysql:host={$env['DB_HOST']};port={$env['DB_PORT']};dbname={$env['DB_NAME']};charset=utf8mb4";
            $pdo = new PDO($dsn, $env['DB_USER'], $env['DB_PASS'], array(
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
            ));

            // Read SQL schema file
            $sqlCandidates = array(
                __DIR__ . '/database/redtaxi_complete_production.sql',
                dirname(__DIR__) . '/database/redtaxi_complete_production.sql',
                __DIR__ . '/../database/redtaxi_complete_production.sql'
            );

            $sqlFile = null;
            foreach ($sqlCandidates as $cand) {
                if (file_exists($cand)) {
                    $sqlFile = $cand;
                    break;
                }
            }

            if (!$sqlFile) {
                $actionError = "SQL schema file not found. Looked in: " . implode(', ', $sqlCandidates);
            } else {
                $sqlContent = file_get_contents($sqlFile);
                // Strip CREATE DATABASE / USE to prevent cPanel permission errors
                $sqlContent = preg_replace('/CREATE\s+DATABASE\s+[^;]+;/i', '', $sqlContent);
                $sqlContent = preg_replace('/USE\s+[^;]+;/i', '', $sqlContent);
                $pdo->exec($sqlContent);
                $actionMessage = "✓ Database schema and initial data imported successfully!";
            }
        } catch (Exception $e) {
            $actionError = "SQL Import failed: " . $e->getMessage();
        }
    }
}

// Current Config & Test
$currentEnv = readEnvConfig($envPath);
$connectionStatus = 'FAILED';
$connectionError = '';
$tablesFound = array();

try {
    $dsn = "mysql:host={$currentEnv['DB_HOST']};port={$currentEnv['DB_PORT']};dbname={$currentEnv['DB_NAME']};charset=utf8mb4";
    $pdo = new PDO($dsn, $currentEnv['DB_USER'], $currentEnv['DB_PASS'], array(
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ));
    $connectionStatus = 'CONNECTED';
    
    // Query existing tables
    $stmt = $pdo->query("SHOW TABLES");
    $tablesFound = $stmt->fetchAll(PDO::FETCH_COLUMN);
} catch (PDOException $e) {
    $connectionStatus = 'FAILED';
    $connectionError = $e->getMessage();
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RedTaxi - Database Setup & Connection Wizard</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: #0f172a;
            color: #f8fafc;
            padding: 30px 15px;
            display: flex;
            justify-content: center;
        }
        .container {
            max-width: 720px;
            width: 100%;
            background: #1e293b;
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5);
            border: 1px solid #334155;
        }
        .header {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 24px;
            border-bottom: 1px solid #334155;
            padding-bottom: 20px;
        }
        .logo {
            background: #dc2626;
            color: white;
            font-weight: 900;
            font-size: 24px;
            padding: 10px 18px;
            border-radius: 12px;
            letter-spacing: -0.5px;
        }
        h1 { font-size: 22px; font-weight: 700; color: #fff; }
        p.subtitle { color: #94a3b8; font-size: 14px; margin-top: 4px; }
        
        .badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }
        .badge-success { background: #059669; color: #ecfdf5; }
        .badge-danger { background: #dc2626; color: #fef2f2; }

        .alert {
            padding: 14px 18px;
            border-radius: 10px;
            font-size: 14px;
            margin-bottom: 20px;
            line-height: 1.5;
        }
        .alert-success { background: #064e3b; color: #a7f3d0; border: 1px solid #059669; }
        .alert-danger { background: #450a0a; color: #fecaca; border: 1px solid #dc2626; }
        .alert-info { background: #1e3a8a; color: #bfdbfe; border: 1px solid #3b82f6; }

        .card {
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 24px;
        }
        .card-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 12px;
            color: #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .form-group {
            margin-bottom: 16px;
        }
        label {
            display: block;
            font-size: 13px;
            font-weight: 600;
            color: #cbd5e1;
            margin-bottom: 6px;
        }
        input[type="text"], input[type="password"] {
            width: 100%;
            background: #1e293b;
            border: 1px solid #475569;
            border-radius: 8px;
            padding: 10px 14px;
            color: #fff;
            font-size: 14px;
            font-family: monospace;
            outline: none;
            transition: border-color 0.2s;
        }
        input:focus { border-color: #ef4444; }

        .btn {
            background: #dc2626;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 12px 20px;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.2s;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            text-decoration: none;
        }
        .btn:hover { background: #b91c1c; }
        .btn-green { background: #059669; }
        .btn-green:hover { background: #047857; }
        .btn-secondary { background: #475569; }
        .btn-secondary:hover { background: #334155; }

        .instructions {
            font-size: 13px;
            color: #94a3b8;
            line-height: 1.6;
            background: #1e293b;
            padding: 16px;
            border-radius: 10px;
            border-left: 4px solid #ef4444;
            margin-bottom: 24px;
        }
        .instructions ol { margin-left: 20px; margin-top: 8px; }
        .instructions li { margin-bottom: 6px; }

        .tamil-text {
            color: #f59e0b;
            font-weight: 500;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">REDTAXI</div>
            <div>
                <h1>Database Setup & Diagnostics</h1>
                <p class="subtitle">Quickly configure or fix MySQL credentials for live server and local environment</p>
            </div>
        </div>

        <?php if ($actionMessage): ?>
            <div class="alert alert-success"><?php echo htmlspecialchars($actionMessage); ?></div>
        <?php endif; ?>

        <?php if ($actionError): ?>
            <div class="alert alert-danger"><?php echo htmlspecialchars($actionError); ?></div>
        <?php endif; ?>

        <!-- Connection Status Card -->
        <div class="card">
            <div class="card-title">
                <span>Current Connection Status</span>
                <?php if ($connectionStatus === 'CONNECTED'): ?>
                    <span class="badge badge-success">✓ CONNECTED</span>
                <?php else: ?>
                    <span class="badge badge-danger">✗ DISCONNECTED</span>
                <?php endif; ?>
            </div>

            <?php if ($connectionStatus === 'CONNECTED'): ?>
                <div class="alert alert-success" style="margin-bottom: 12px;">
                    MySQL Database is connected! Found <strong><?php echo count($tablesFound); ?> tables</strong> in database <code><?php echo htmlspecialchars($currentEnv['DB_NAME']); ?></code>.
                </div>

                <?php if (count($tablesFound) < 20): ?>
                    <div class="alert alert-danger" style="margin-bottom: 12px;">
                        ⚠️ Database is connected, but tables are missing (found <?php echo count($tablesFound); ?>/26 tables). Click below to create all 26 tables and populate seed data:
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap;">
                        <a href="migrate.php" class="btn btn-green">⚡ Run Database Migration (migrate.php)</a>
                    </div>
                <?php else: ?>
                    <p style="color: #a7f3d0; font-size: 14px; margin-bottom: 16px;">
                        ✓ All RedTaxi tables are loaded and ready to serve customer, driver, and admin portals!
                    </p>
                    <div style="display: flex; gap: 10px;">
                        <a href="../" class="btn">🚀 Go to RedTaxi App</a>
                        <a href="../admin" class="btn btn-secondary">🛡️ Open Admin Panel</a>
                    </div>
                <?php endif; ?>

            <?php else: ?>
                <div class="alert alert-danger" style="margin-bottom: 16px;">
                    <strong>Database Connection Failed:</strong><br>
                    <?php echo htmlspecialchars($connectionError); ?>
                </div>

                <div class="instructions">
                    <strong class="tamil-text">cPanel-ல் Database எப்படி connect செய்வது? (Instructions):</strong>
                    <ol>
                        <li>Log in to your <strong>cPanel</strong>.</li>
                        <li>Open <strong>MySQL Database Wizard</strong> (or MySQL Databases).</li>
                        <li>Note your <strong>Database Name</strong> (e.g. <code>xiadot_redtaxi</code>) and <strong>Database Username</strong> (e.g. <code>xiadot_redtaxi</code>).</li>
                        <li>Set a strong password and click <strong>Add User to Database</strong> &rarr; Select <strong>ALL PRIVILEGES</strong>.</li>
                        <li>Enter those exact details in the form below and click <strong>"Save & Test Connection"</strong>!</li>
                    </ol>
                </div>
            <?php endif; ?>
        </div>

        <!-- Configuration Form -->
        <div class="card">
            <div class="card-title">
                <span>Update MySQL Credentials (saved directly to .env)</span>
            </div>
            <form method="POST">
                <input type="hidden" name="action" value="save_db">

                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">
                    <div class="form-group">
                        <label>Database Host</label>
                        <input type="text" name="db_host" value="<?php echo htmlspecialchars($currentEnv['DB_HOST']); ?>" required>
                    </div>
                    <div class="form-group">
                        <label>Port</label>
                        <input type="text" name="db_port" value="<?php echo htmlspecialchars($currentEnv['DB_PORT']); ?>" required>
                    </div>
                </div>

                <div class="form-group">
                    <label>Database Name (cPanel prefix included, e.g. xiadot_redtaxi)</label>
                    <input type="text" name="db_name" value="<?php echo htmlspecialchars($currentEnv['DB_NAME']); ?>" required>
                </div>

                <div class="form-group">
                    <label>Database Username (e.g. xiadot_redtaxi or root)</label>
                    <input type="text" name="db_user" value="<?php echo htmlspecialchars($currentEnv['DB_USER']); ?>" required>
                </div>

                <div class="form-group">
                    <label>Database Password</label>
                    <input type="password" name="db_pass" value="<?php echo htmlspecialchars($currentEnv['DB_PASS']); ?>" placeholder="Enter MySQL Password">
                </div>

                <button type="submit" class="btn" style="width: 100%;">
                    💾 Save & Test Connection
                </button>
            </form>
        </div>

        <div style="text-align: center; font-size: 12px; color: #64748b; margin-top: 20px;">
            RedTaxi API Backend &bull; PHP <?php echo PHP_VERSION; ?> &bull; Self-Service Setup Wizard
        </div>
    </div>
</body>
</html>
