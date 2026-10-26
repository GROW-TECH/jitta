# RedTaxi — Database Connection Setup & Verification

> **Date**: September 10, 2026  
> **Database**: `redtaxi_db`  
> **Host**: `127.0.0.1:3306`  
> **Engine**: MariaDB 10.4.32 / MySQL 8.0+  
> **Charset / Collation**: `utf8mb4` / `utf8mb4_unicode_ci`  
> **PHP Compatibility**: PHP 5.6+ and PHP 8.x  

---

## 1. Connection Configuration

The PHP backend loads database credentials from `backend/.env` using the lightweight `Env` parser ([backend/config/env.php](file:///c:/Users/Giridharan/Desktop/redtaxi/backend/config/env.php)):

```ini
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=redtaxi_db
DB_USER=root
DB_PASS=
DB_CHARSET=utf8mb4
```

Database connection management is handled via the singleton `Database` class ([backend/config/database.php](file:///c:/Users/Giridharan/Desktop/redtaxi/backend/config/database.php)):
* **PDO DSN**: `mysql:host=127.0.0.1;port=3306;dbname=redtaxi_db;charset=utf8mb4`
* **Error Mode**: `PDO::ERRMODE_EXCEPTION` (all database errors throw catchable exceptions)
* **Default Fetch Mode**: `PDO::FETCH_ASSOC` (associative arrays)
* **Emulated Prepares**: Disabled (`false`) for native prepared statements and SQL injection prevention
* **Initial Command**: `SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci`

---

## 2. Error Handling & Clean JSON Responses

All database connection and query exceptions are intercepted and converted into standardized JSON responses:
* **Router & Controller Level**: [Router.php](file:///c:/Users/Giridharan/Desktop/redtaxi/backend/routes/Router.php), [index.php](file:///c:/Users/Giridharan/Desktop/redtaxi/backend/index.php), and [api/v1/index.php](file:///c:/Users/Giridharan/Desktop/redtaxi/backend/api/v1/index.php) wrap dispatching in `try ... catch (Exception $e)`.
* **Standard Response Helper**: Returns HTTP 500 JSON with structured payload:
  ```json
  {
    "success": false,
    "statusCode": 500,
    "message": "Database connection failed. Please verify database service and credentials.",
    "errors": null,
    "timestamp": "2026-09-10T11:44:34Z"
  }
  ```

---

## 3. Verification Suite Results

Run via `backend/verify_connection.php`:

| Task | Test Description | Status | Details |
|---|---|---|---|
| **1** | Environment Credentials Loading | **PASSED** | Loaded `DB_HOST`, `DB_PORT`, `DB_NAME` (`redtaxi_db`), `DB_USER`, `DB_CHARSET` |
| **2** | PDO Connection to `redtaxi_db` | **PASSED** | Connected to `redtaxi_db` (10.4.32-MariaDB), `utf8mb4`, `ERRMODE_EXCEPTION`, `FETCH_ASSOC` |
| **3** | Error Handling / Clean JSON | **PASSED** | Simulated failure caught and returned structured JSON with HTTP 500 |
| **4** | Querying All 26 Tables | **PASSED** | Successfully executed `SELECT COUNT(*)` across all 26 tables |

### Tables Verified (26 of 26 Queryable)
1. `cities`
2. `customers`
3. `customer_saved_places`
4. `customer_wallets`
5. `customer_wallet_transactions`
6. `vehicle_categories`
7. `fare_rules`
8. `drivers`
9. `driver_vehicles`
10. `admin_users`
11. `driver_documents`
12. `driver_wallets`
13. `driver_wallet_transactions`
14. `coupons`
15. `offers`
16. `bookings`
17. `booking_locations`
18. `payments`
19. `cancellations`
20. `coupon_usage`
21. `notifications`
22. `support_tickets`
23. `support_messages`
24. `sos_alerts`
25. `otp_verifications`
26. `chat_messages`

---

## 4. Live API Health Check Response

Request: `GET /api/v1/health`

```json
{
  "success": true,
  "statusCode": 200,
  "message": "All systems functional",
  "data": {
    "status": "HEALTHY",
    "api": "ONLINE",
    "database": {
      "status": "CONNECTED",
      "details": {
        "database": "redtaxi_db",
        "mysql_version": "10.4.32-MariaDB",
        "tables_found": 26
      }
    },
    "system": {
      "php_version": "8.2.12",
      "server_time_utc": "2026-09-10T11:44:41Z"
    }
  },
  "timestamp": "2026-09-10T11:44:41Z"
}
```
