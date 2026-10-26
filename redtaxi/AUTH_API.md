# RedTaxi — Authentication REST API Documentation

> **Base URL**: `/api/v1`  
> **API Version**: `v1`  
> **Protocol**: HTTP/1.1 or HTTP/2  
> **Content-Type**: `application/json`  
> **Authentication Scheme**: `Bearer <token>` (HMAC-SHA256 stateless signed token)  
> **Runtime Compatibility**: PHP 5.6+ and PHP 8.x  

---

## Overview

The RedTaxi Authentication API handles registration, login, session management, and profile retrieval for **Customers** and **Driver Partners**.

### Key Features
* **Multi-Mode Login**: Supports both **OTP Verification** (mobile phone OTP flow matching the RedTaxi frontend) and **Password Login** (using secure PHP `password_hash(PASSWORD_BCRYPT)`).
* **Automatic Wallet Creation**: Registering a customer or driver partner automatically initializes their dedicated wallet in `customer_wallets` or `driver_wallets`.
* **Stateless Bearer Tokens**: Fast, secure token issuance using HMAC-SHA256 signature, carrying user ID, role, phone, and 30-day expiration.
* **Unified JSON Structure**: All responses return a consistent envelope with `success`, `statusCode`, `message`, `data`, and UTC `timestamp`.

---

## Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/v1/auth/customer/register` | Register a new customer account | No |
| `POST` | `/api/v1/auth/customer/login` | Login customer via Password or OTP | No |
| `POST` | `/api/v1/auth/driver/login` | Login driver partner via Password or OTP | No |
| `POST` | `/api/v1/auth/send-otp` | Request a 4-digit verification code | No |
| `GET` | `/api/v1/auth/me` | Fetch authenticated user profile | **Yes** (Bearer) |
| `POST` | `/api/v1/auth/logout` | Invalidate current session / token | **Yes** (Bearer) |

---

## 1. Customer Registration

### `POST /api/v1/auth/customer/register`

Creates a new customer profile and initializes their wallet with a `0.00` balance.

#### Request Headers
```http
Content-Type: application/json
```

#### Request Body
```json
{
  "name": "Karthik Raja",
  "phone": "9876543210",
  "email": "karthik@example.com",
  "password": "SecurePassword123",
  "city_id": 1
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | **Yes** | Full name (minimum 2 characters) |
| `phone` | string | **Yes** | 10-digit Indian mobile number (e.g. `9876543210`) |
| `email` | string | No | Optional email address |
| `password` | string | No | Optional password (minimum 6 characters, hashed with BCRYPT) |
| `city_id` | integer | No | Operational city ID |

#### Success Response (`201 Created`)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Customer account created successfully",
  "data": {
    "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmNWQwODNiOS...signature",
    "tokenType": "Bearer",
    "customer": {
      "id": "f5d083b9-9466-4a45-9f61-40bca61906e4",
      "name": "Karthik Raja",
      "phone": "9876543210",
      "email": "karthik@example.com",
      "avatar_url": null,
      "city_id": 1,
      "status": "ACTIVE",
      "total_rides": 0,
      "created_at": "2026-09-10 17:48:52",
      "updated_at": "2026-09-10 17:48:52",
      "wallet_balance": "0.00",
      "wallet_id": "3b7f1b6d-cfa9-450b-a0e1-dee9f5488acd"
    }
  },
  "timestamp": "2026-09-10T12:18:52Z"
}
```

#### Error Responses
* **400 Bad Request** (Validation failure):
  ```json
  {
    "success": false,
    "statusCode": 400,
    "message": "Invalid mobile number. Please provide a 10-digit number",
    "errors": null,
    "timestamp": "2026-09-10T12:18:52Z"
  }
  ```
* **409 Conflict** (Phone number already in use):
  ```json
  {
    "success": false,
    "statusCode": 409,
    "message": "A customer with this mobile number already exists",
    "errors": null,
    "timestamp": "2026-09-10T12:18:52Z"
  }
  ```

---

## 2. Customer Login

### `POST /api/v1/auth/customer/login`

Supports three login modes:
1. **Password Login**: Send `phone` + `password`.
2. **OTP Verification Login**: Send `phone` + `otp` (supports demo code `4821`).
3. **Request OTP**: Send only `phone` to generate an OTP verification code.

#### Request Body — Mode A: Password Login
```json
{
  "phone": "9876543210",
  "password": "SecurePassword123"
}
```

#### Request Body — Mode B: OTP Login
```json
{
  "phone": "9876543210",
  "otp": "4821"
}
```

#### Request Body — Mode C: Trigger / Request OTP
```json
{
  "phone": "9876543210"
}
```

#### Success Response — Authentication Completed (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmNWQwODNiOS...signature",
    "tokenType": "Bearer",
    "customer": {
      "id": "f5d083b9-9466-4a45-9f61-40bca61906e4",
      "name": "Karthik Raja",
      "phone": "9876543210",
      "email": "karthik@example.com",
      "avatar_url": null,
      "city_id": 1,
      "status": "ACTIVE",
      "total_rides": 0,
      "wallet_balance": "0.00",
      "wallet_id": "3b7f1b6d-cfa9-450b-a0e1-dee9f5488acd"
    }
  },
  "timestamp": "2026-09-10T12:19:00Z"
}
```

#### Success Response — OTP Triggered (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Verification code sent to 9876543210",
  "data": {
    "otpSent": true,
    "phone": "9876543210",
    "otpDebug": "4821",
    "expiresAt": "2026-09-10 17:59:00"
  },
  "timestamp": "2026-09-10T12:19:00Z"
}
```

#### Error Responses
* **401 Unauthorized** (Wrong password / invalid OTP):
  ```json
  {
    "success": false,
    "statusCode": 401,
    "message": "Invalid phone number or password",
    "errors": null,
    "timestamp": "2026-09-10T12:19:00Z"
  }
  ```
* **404 Not Found** (Unregistered customer):
  ```json
  {
    "success": false,
    "statusCode": 404,
    "message": "No customer account found with this phone number. Please register first.",
    "errors": null,
    "timestamp": "2026-09-10T12:19:00Z"
  }
  ```
* **403 Forbidden** (Blocked customer account):
  ```json
  {
    "success": false,
    "statusCode": 403,
    "message": "Your account has been blocked. Please contact RedTaxi support.",
    "errors": null,
    "timestamp": "2026-09-10T12:19:00Z"
  }
  ```

---

## 3. Driver Partner Login

### `POST /api/v1/auth/driver/login`

Authenticates a registered Driver Partner.

#### Request Body — OTP Login
```json
{
  "phone": "9876500001",
  "otp": "4821"
}
```

#### Request Body — Password Login
```json
{
  "phone": "9876500001",
  "password": "DriverPassword123"
}
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Driver partner authenticated successfully",
  "data": {
    "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJkcHYtMDAx...signature",
    "tokenType": "Bearer",
    "driver": {
      "id": "drv-001-uuid",
      "name": "Suresh Kumar",
      "phone": "9876500001",
      "email": "suresh@example.com",
      "photo_url": null,
      "city_id": 1,
      "rating": "5.00",
      "trips_count": 0,
      "is_online": 0,
      "approval_status": "APPROVED",
      "wallet_balance": "0.00",
      "today_earnings": "0.00",
      "today_trips": 0,
      "vehicle_id": "veh-001-uuid",
      "vehicle_model": "Maruti Suzuki Dzire",
      "vehicle_number": "TN 38 AB 1234",
      "vehicle_type": "Sedan"
    }
  },
  "timestamp": "2026-09-10T12:19:05Z"
}
```

---

## 4. Current User Profile (`/auth/me`)

### `GET /api/v1/auth/me`

Retrieves the currently authenticated user's profile based on the Bearer token.

#### Request Headers
```http
Authorization: Bearer <token>
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Operation successful",
  "data": {
    "role": "customer",
    "user": {
      "id": "f5d083b9-9466-4a45-9f61-40bca61906e4",
      "name": "Karthik Raja",
      "phone": "9876543210",
      "email": "karthik@example.com",
      "avatar_url": null,
      "city_id": 1,
      "status": "ACTIVE",
      "total_rides": 0,
      "wallet_balance": "0.00",
      "wallet_id": "3b7f1b6d-cfa9-450b-a0e1-dee9f5488acd"
    }
  },
  "timestamp": "2026-09-10T12:19:10Z"
}
```

#### Error Response (`401 Unauthorized`)
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Invalid or expired authentication token",
  "errors": null,
  "timestamp": "2026-09-10T12:19:10Z"
}
```

---

## 5. Send OTP Code

### `POST /api/v1/auth/send-otp`

Explicit endpoint for generating a 4-digit verification code.

#### Request Body
```json
{
  "phone": "9876543210",
  "purpose": "LOGIN"
}
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Verification OTP generated successfully",
  "data": {
    "phone": "9876543210",
    "purpose": "LOGIN",
    "otpDebug": "4821",
    "expiresAt": "2026-09-10 17:59:00"
  },
  "timestamp": "2026-09-10T12:19:15Z"
}
```

---

## 6. Logout

### `POST /api/v1/auth/logout`

Logs out the current session and instructs client to clear the stored Bearer token.

#### Request Headers
```http
Authorization: Bearer <token>
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Logged out successfully",
  "data": {
    "loggedOut": true
  },
  "timestamp": "2026-09-10T12:19:20Z"
}
```
