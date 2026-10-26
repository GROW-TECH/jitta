# RedTaxi — Driver REST API Documentation

> **Base URL**: `/api/v1`  
> **API Version**: `v1`  
> **Protocol**: HTTP/1.1 or HTTP/2  
> **Content-Type**: `application/json`  
> **Authentication**: `Bearer <token>` (Driver token required for all endpoints)  
> **Role Restriction**: Customer tokens receive `403 Forbidden`  
> **Compatibility**: PHP 5.6+ and PHP 8.x  

---

## Overview

The RedTaxi Driver REST API provides full management of driver partner operations, fleet vehicle details, live online/offline GPS tracking, real-time ride matching (available ride dispatch, acceptance locks, rejections), active trip execution state transitions (`ARRIVED`, `STARTED` with customer OTP verification, `COMPLETED` with automated commission deduction and earnings credit), paginated ride history, driver earnings wallet & transaction ledger, driver notifications, and official verification document status.

---

## Endpoints Summary

| # | Method | Endpoint | Description |
|---|---|---|---|
| 1 | `GET` | `/api/v1/driver/profile` | Retrieve driver partner profile, rating, vehicle, and wallet summary |
| 2 | `PUT` | `/api/v1/driver/profile` | Update driver profile details (name, email, photo URL, city) |
| 3 | `GET` | `/api/v1/driver/vehicle` | Retrieve active vehicle details and list of registered vehicles |
| 4 | `PUT` | `/api/v1/driver/vehicles/{id}` | Update vehicle specifications (model, registration number, type, color, year) |
| 5 | `PATCH` | `/api/v1/driver/status` | Toggle driver Online/Offline status and broadcast current GPS coordinates |
| 6 | `GET` | `/api/v1/driver/rides/available` | Get nearby available ride requests (`SEARCHING`) in driver's operational city |
| 7 | `POST` | `/api/v1/driver/rides/{id}/accept` | Accept ride request (atomic row lock, assigns driver & active vehicle) |
| 8 | `POST` | `/api/v1/driver/rides/{id}/reject` | Reject/decline ride request (releases booking back to search pool) |
| 9 | `GET` | `/api/v1/driver/rides/current` | Get current active trip details, passenger info, and route coordinates |
| 10 | `PATCH` | `/api/v1/driver/rides/{id}/status` | Transition trip status (`ARRIVED`, `STARTED` + OTP, `COMPLETED` + earnings credit) |
| 11 | `GET` | `/api/v1/driver/rides/history` | Retrieve paginated driver trip history with fare & customer details |
| 12 | `GET` | `/api/v1/driver/wallet` | Get driver wallet balance, today's earnings, commission summary, and ledger |
| 13 | `GET` | `/api/v1/driver/notifications` | Fetch targeted and driver-broadcast notifications with unread count |
| 14 | `GET` | `/api/v1/driver/documents` | Get driver KYC document verification statuses (License, RC, Insurance) |

---

## Security & Role Authorization

All Driver API endpoints require a valid JWT/Bearer token issued specifically for the `driver` role:
* Requests missing the `Authorization: Bearer <token>` header receive `401 Unauthorized`.
* Requests presenting a token with `role: "customer"` receive `403 Forbidden` with the message:  
  `"Driver access required"`.
* Unapproved drivers (`approval_status: "PENDING"`, `"SUSPENDED"`, `"REJECTED"`) cannot go online and receive `403 Forbidden`.

---

## 1. Driver Profile

### `GET /api/v1/driver/profile`
Retrieves the authenticated driver partner's profile, operational city, rating, completed trips count, commission percentage, current vehicle info, and wallet balance. Sensitive fields (`password_hash`) are stripped.

#### Headers
```http
Authorization: Bearer <driver_token>
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Driver profile retrieved",
  "data": {
    "id": "e6a0d2f1-3965-4f4c-9f82-a08dfbb29091",
    "name": "Karthik Raja",
    "phone": "9700148291",
    "email": "karthik@example.com",
    "photo_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
    "city_id": 1,
    "city_name": "Coimbatore",
    "rating": "4.92",
    "trips_count": 142,
    "is_online": 1,
    "approval_status": "APPROVED",
    "commission_percent": "15.00",
    "current_lat": "11.0168445",
    "current_lng": "76.9558321",
    "last_location_at": "2026-09-10 18:05:00",
    "created_at": "2026-09-10 16:30:00",
    "updated_at": "2026-09-10 18:05:00",
    "wallet_id": "71a92e10-14bf-42d9-a78b-d784a9190ab1",
    "wallet_balance": "1450.50",
    "today_earnings": "385.00",
    "today_trips": 2,
    "total_commission_paid": "67.94",
    "vehicle_id": "31cb8291-88f1-4c12-9214-e532a10bf982",
    "vehicle_model": "Maruti Dzire",
    "vehicle_number": "TN 38 BR 9123",
    "vehicle_type": "Sedan",
    "vehicle_color": "White"
  },
  "timestamp": "2026-09-10T12:37:33Z"
}
```

---

## 2. Update Driver Profile

### `PUT /api/v1/driver/profile`
Updates driver profile information. Validates name length, email format, and checks for email uniqueness across other driver partners.

#### Headers
```http
Authorization: Bearer <driver_token>
Content-Type: application/json
```

#### Request Body
```json
{
  "name": "Karthik Raja K",
  "email": "karthik.raja@example.com",
  "photo_url": "https://images.unsplash.com/photo-karthik-new.jpg",
  "city_id": 1
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Driver profile updated successfully",
  "data": {
    "id": "e6a0d2f1-3965-4f4c-9f82-a08dfbb29091",
    "name": "Karthik Raja K",
    "phone": "9700148291",
    "email": "karthik.raja@example.com",
    "photo_url": "https://images.unsplash.com/photo-karthik-new.jpg",
    "city_id": 1
  },
  "timestamp": "2026-09-10T12:37:33Z"
}
```

---

## 3. Get Driver Vehicle Details

### `GET /api/v1/driver/vehicle` or `GET /api/v1/driver/vehicles`
Returns the driver's currently active primary vehicle and a list of all registered vehicles under the driver partner's account.

#### Headers
```http
Authorization: Bearer <driver_token>
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Driver vehicle details retrieved",
  "data": {
    "active_vehicle": {
      "id": "31cb8291-88f1-4c12-9214-e532a10bf982",
      "driver_id": "e6a0d2f1-3965-4f4c-9f82-a08dfbb29091",
      "vehicle_model": "Maruti Dzire",
      "vehicle_number": "TN 38 BR 9123",
      "vehicle_type": "Sedan",
      "category_id": null,
      "color": "White",
      "year": 2022,
      "is_active": 1,
      "created_at": "2026-09-10 16:30:00"
    },
    "all_vehicles": [
      {
        "id": "31cb8291-88f1-4c12-9214-e532a10bf982",
        "vehicle_model": "Maruti Dzire",
        "vehicle_number": "TN 38 BR 9123",
        "vehicle_type": "Sedan",
        "color": "White",
        "year": 2022,
        "is_active": 1
      }
    ]
  },
  "timestamp": "2026-09-10T12:37:33Z"
}
```

---

## 4. Update Driver Vehicle Details

### `PUT /api/v1/driver/vehicles/{id}` or `PUT /api/v1/driver/vehicle`
Updates vehicle specifications (model, plate number, type, color, year, active status). When activating a vehicle, previously active vehicles for the driver are automatically set to inactive.

#### Headers
```http
Authorization: Bearer <driver_token>
Content-Type: application/json
```

#### Request Body
```json
{
  "vehicle_model": "Maruti Dzire ZXi+",
  "color": "Pearl White",
  "year": 2023,
  "vehicle_type": "Sedan"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Vehicle details updated successfully",
  "data": {
    "id": "31cb8291-88f1-4c12-9214-e532a10bf982",
    "driver_id": "e6a0d2f1-3965-4f4c-9f82-a08dfbb29091",
    "vehicle_model": "Maruti Dzire ZXi+",
    "vehicle_number": "TN 38 BR 9123",
    "vehicle_type": "Sedan",
    "color": "Pearl White",
    "year": 2023,
    "is_active": 1
  },
  "timestamp": "2026-09-10T12:37:34Z"
}
```

---

## 5. Driver Online/Offline Status & GPS

### `PATCH /api/v1/driver/status`
Toggles driver availability for new trip dispatch and updates current GPS latitude and longitude.

#### Headers
```http
Authorization: Bearer <driver_token>
Content-Type: application/json
```

#### Request Body
```json
{
  "is_online": true,
  "lat": 11.0168445,
  "lng": 76.9558321
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Driver status updated to ONLINE",
  "data": {
    "is_online": true,
    "current_lat": 11.0168445,
    "current_lng": 76.9558321,
    "last_location_at": "2026-09-10 18:07:34"
  },
  "timestamp": "2026-09-10T12:37:34Z"
}
```

---

## 6. Get Available Ride Requests

### `GET /api/v1/driver/rides/available`
Retrieves incoming ride requests in `SEARCHING` status located within the driver's active operating city. Includes passenger name, ride category, estimated fare, distance, and pickup/drop waypoint locations.

#### Headers
```http
Authorization: Bearer <driver_token>
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Available ride requests retrieved",
  "data": [
    {
      "id": "TXI-582910",
      "ride_type": "CITY",
      "vehicle_category": "Red Sedan",
      "status": "SEARCHING",
      "distance_km": "8.50",
      "duration_min": "22.00",
      "total_fare": "257.25",
      "payment_method": "UPI",
      "customer_name": "Divya N",
      "customer_phone": "9700412345",
      "created_at": "2026-09-10 18:06:12",
      "pickup": {
        "type": "PICKUP",
        "name": "Gandhipuram Bus Stand",
        "address": "Cross Cut Road, Coimbatore",
        "lat": "11.0183000",
        "lng": "76.9644000"
      },
      "drop": {
        "type": "DROP",
        "name": "Brookefields Mall",
        "address": "Dr Krishnasamy Rd, Coimbatore",
        "lat": "11.0116000",
        "lng": "76.9587000"
      }
    }
  ],
  "timestamp": "2026-09-10T12:37:35Z"
}
```

---

## 7. Accept Ride Request

### `POST /api/v1/driver/rides/{id}/accept`
Accepts a pending ride request using atomic database row locking (`FOR UPDATE`). Transitions status from `SEARCHING` to `ASSIGNED` and binds the driver and their active vehicle.

#### Security & Concurrency Controls
* Returns `409 Conflict` if another driver accepted or customer cancelled the ride first.
* Returns `409 Conflict` if the driver already has an ongoing active ride.

#### Headers
```http
Authorization: Bearer <driver_token>
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Ride accepted successfully",
  "data": {
    "id": "TXI-582910",
    "customer_id": "89b7a1e0-6214-41d9-9182-df982a10be11",
    "driver_id": "e6a0d2f1-3965-4f4c-9f82-a08dfbb29091",
    "vehicle_id": "31cb8291-88f1-4c12-9214-e532a10bf982",
    "status": "ASSIGNED",
    "total_fare": "257.25",
    "customer_name": "Divya N",
    "customer_phone": "9700412345",
    "vehicle_model": "Maruti Dzire ZXi+",
    "vehicle_number": "TN 38 BR 9123",
    "assigned_at": "2026-09-10 18:07:35"
  },
  "timestamp": "2026-09-10T12:37:35Z"
}
```

---

## 8. Reject Ride Request

### `POST /api/v1/driver/rides/{id}/reject`
Declines an assigned ride request. Unassigns the driver and releases the booking back to the `SEARCHING` dispatch pool so other nearby drivers can accept it.

#### Headers
```http
Authorization: Bearer <driver_token>
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Ride request rejected",
  "data": {
    "rejected": true,
    "booking_id": "TXI-582910"
  },
  "timestamp": "2026-09-10T12:37:35Z"
}
```

---

## 9. Get Current / Active Ride

### `GET /api/v1/driver/rides/current`
Returns the active trip currently assigned to the driver (status in `ASSIGNED`, `ARRIVED`, or `IN_PROGRESS`). If no active trip exists, returns `data: null`.

#### Headers
```http
Authorization: Bearer <driver_token>
```

#### Response with Active Ride (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Active ride retrieved",
  "data": {
    "id": "TXI-582910",
    "customer_id": "89b7a1e0-6214-41d9-9182-df982a10be11",
    "driver_id": "e6a0d2f1-3965-4f4c-9f82-a08dfbb29091",
    "status": "ASSIGNED",
    "customer_name": "Divya N",
    "customer_phone": "9700412345",
    "customer_photo": null,
    "total_fare": "257.25",
    "locations": [
      {
        "type": "PICKUP",
        "sequence_order": 0,
        "name": "Gandhipuram Bus Stand",
        "address": "Cross Cut Road, Coimbatore",
        "lat": "11.0183000",
        "lng": "76.9644000"
      },
      {
        "type": "DROP",
        "sequence_order": 1,
        "name": "Brookefields Mall",
        "address": "Dr Krishnasamy Rd, Coimbatore",
        "lat": "11.0116000",
        "lng": "76.9587000"
      }
    ]
  },
  "timestamp": "2026-09-10T12:37:36Z"
}
```

#### Response when No Active Ride (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "No active ride at the moment",
  "data": null,
  "timestamp": "2026-09-10T12:37:36Z"
}
```

---

## 10. Update Ride Status (ARRIVED, STARTED, COMPLETED)

### `PATCH /api/v1/driver/rides/{id}/status`
Controls ride life-cycle state transitions. Enforces sequential trip steps and automates driver earnings calculations upon completion.

#### Allowed Status Transitions:
1. `ASSIGNED` -> `ARRIVED` (Driver has reached passenger pickup point)
2. `ARRIVED` -> `STARTED` (Trip starts; requires valid passenger 4-digit OTP)
3. `IN_PROGRESS` -> `COMPLETED` (Trip ends; calculates commission and credits driver wallet)

---

### Step 10A: Mark `ARRIVED`

#### Request Body
```json
{
  "status": "ARRIVED"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Ride status updated to ARRIVED",
  "data": {
    "id": "TXI-582910",
    "status": "ARRIVED"
  },
  "timestamp": "2026-09-10T12:37:36Z"
}
```

---

### Step 10B: Start Trip `STARTED` (with OTP Verification)

#### Request Body
```json
{
  "status": "STARTED",
  "otp": "7732"
}
```

#### Validation Rules
* Missing OTP -> `400 Bad Request` (`"Start OTP is required to begin the trip"`)
* Incorrect OTP -> `401 Unauthorized` (`"Invalid OTP verification code"`)
* Valid OTP (matching `bookings.start_otp` or demo `4821`) -> transitions booking status to `IN_PROGRESS` and sets `started_at = NOW()`.

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Ride status updated to STARTED",
  "data": {
    "id": "TXI-582910",
    "status": "IN_PROGRESS",
    "started_at": "2026-09-10 18:07:37"
  },
  "timestamp": "2026-09-10T12:37:37Z"
}
```

---

### Step 10C: Complete Trip `COMPLETED` (Automated Wallet Credit)

#### Request Body
```json
{
  "status": "COMPLETED"
}
```

#### Automated Financial Settlement
1. Sets `bookings.status = 'COMPLETED'` and records `completed_at = NOW()`.
2. Computes platform commission (default `15.00%`).  
   * Example: Fare = ₹257.25, Commission (15%) = ₹38.59, Driver Earnings = ₹218.66.
3. Automatically updates `driver_wallets`:
   * `balance` credited with ₹218.66
   * `today_earnings` credited with ₹218.66
   * `today_trips` incremented by 1
   * `total_commission_paid` incremented by ₹38.59
4. Increments `drivers.trips_count` by 1.
5. Inserts an immutable transaction record into `driver_wallet_transactions` (`type: 'CREDIT'`).

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Ride completed! ₹218.66 credited to your wallet.",
  "data": {
    "booking_id": "TXI-582910",
    "status": "COMPLETED",
    "total_fare": 257.25,
    "driver_earnings": 218.66,
    "commission": 38.59,
    "completed_at": "2026-09-10 18:07:38"
  },
  "timestamp": "2026-09-10T12:37:38Z"
}
```

---

## 11. Driver Ride History

### `GET /api/v1/driver/rides/history`
Returns past completed and cancelled trips for the authenticated driver with pagination support.

#### Query Parameters
* `limit` (int, default: 20, max: 100)
* `page` (int, default: 1)

#### Headers
```http
Authorization: Bearer <driver_token>
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Driver ride history retrieved",
  "data": [
    {
      "id": "TXI-582910",
      "ride_type": "CITY",
      "vehicle_category": "Red Sedan",
      "status": "COMPLETED",
      "distance_km": "8.50",
      "duration_min": "22.00",
      "total_fare": "257.25",
      "payment_method": "UPI",
      "payment_status": "PENDING",
      "rating": null,
      "created_at": "2026-09-10 18:06:12",
      "completed_at": "2026-09-10 18:07:38",
      "customer_name": "Divya N",
      "customer_phone": "9700412345",
      "pickup": {
        "type": "PICKUP",
        "name": "Gandhipuram Bus Stand",
        "address": "Cross Cut Road, Coimbatore"
      },
      "drop": {
        "type": "DROP",
        "name": "Brookefields Mall",
        "address": "Dr Krishnasamy Rd, Coimbatore"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "count": 1
  },
  "timestamp": "2026-09-10T12:37:38Z"
}
```

---

## 12. Driver Wallet and Transactions

### `GET /api/v1/driver/wallet`
Retrieves live driver wallet account details, balance, today's accumulated earnings, trips count today, total commission paid, and the ledger transactions list.

#### Query Parameters
* `limit` (int, default: 50)
* `page` (int, default: 1)

#### Headers
```http
Authorization: Bearer <driver_token>
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Driver wallet and earnings ledger retrieved",
  "data": {
    "walletId": "71a92e10-14bf-42d9-a78b-d784a9190ab1",
    "balance": 218.66,
    "todayEarnings": 218.66,
    "todayTrips": 1,
    "totalCommissionPaid": 38.59,
    "currency": "INR",
    "isActive": true,
    "transactions": [
      {
        "id": "e9b110a1-6a23-4e89-b789-9182a0be9812",
        "type": "CREDIT",
        "amount": "218.66",
        "description": "Earnings for ride TXI-582910 (Fare: ₹257.25 - 15% commission)",
        "reference_id": "TXI-582910",
        "created_at": "2026-09-10 18:07:38"
      }
    ]
  },
  "meta": {
    "page": 1,
    "limit": 50,
    "count": 1
  },
  "timestamp": "2026-09-10T12:37:38Z"
}
```

---

## 13. Driver Notifications

### `GET /api/v1/driver/notifications`
Retrieves personal notifications targeted directly to this driver partner as well as global broadcast alerts intended for all drivers. Includes unread count in response metadata.

#### Headers
```http
Authorization: Bearer <driver_token>
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Driver notifications retrieved",
  "data": [
    {
      "id": "c19b8120-1a4e-4f01-8b1a-91280ebcb123",
      "title": "Trip Earnings Credited",
      "message": "₹218.66 has been credited for ride TXI-582910",
      "type": "PAYMENT",
      "is_read": false,
      "data_payload": null,
      "created_at": "2026-09-10 18:07:39"
    },
    {
      "id": "d20c9231-2b5f-5012-9c2b-02391fcdc234",
      "title": "Peak Hours Bonus",
      "message": "Earn 20% extra on trips between 6 PM and 9 PM today!",
      "type": "OFFER",
      "is_read": false,
      "data_payload": null,
      "created_at": "2026-09-10 18:07:39"
    }
  ],
  "meta": {
    "total": 2,
    "unreadCount": 2
  },
  "timestamp": "2026-09-10T12:37:39Z"
}
```

---

## 14. Driver Document / Status Information

### `GET /api/v1/driver/documents`
Retrieves the driver's current account approval status (`PENDING`, `APPROVED`, `REJECTED`, or `SUSPENDED`) along with individual KYC document records (Driving License, RC, Insurance, Permit) and their verification states.

#### Headers
```http
Authorization: Bearer <driver_token>
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Driver document and verification status retrieved",
  "data": {
    "approval_status": "APPROVED",
    "documents": [
      {
        "id": "1fa90b12-5812-4c81-8012-7819abec0192",
        "document_type": "LICENSE",
        "document_number": "DL-TN38-201800912",
        "file_url": "https://storage.example.com/dl.pdf",
        "verification_status": "VERIFIED",
        "expiry_date": "2030-05-15",
        "rejection_reason": null,
        "verified_at": null
      },
      {
        "id": "2gb01c23-6923-5d92-9123-8920bcfd1203",
        "document_type": "RC",
        "document_number": "RC-TN38BR9123",
        "file_url": "https://storage.example.com/rc.pdf",
        "verification_status": "VERIFIED",
        "expiry_date": "2028-11-20",
        "rejection_reason": null,
        "verified_at": null
      },
      {
        "id": "3hc12d34-7034-6ea3-0234-9031cdae2314",
        "document_type": "INSURANCE",
        "document_number": "INS-HDFC-99120",
        "file_url": "https://storage.example.com/ins.pdf",
        "verification_status": "PENDING",
        "expiry_date": "2027-01-10",
        "rejection_reason": null,
        "verified_at": null
      }
    ]
  },
  "timestamp": "2026-09-10T12:37:39Z"
}
```

---

## Automated Test Results

The RedTaxi Driver API automated test suite (`backend/test_driver_api.php`) covers all 14 feature sets plus security and role boundaries:

```text
=======================================================
RedTaxi Driver API Test Suite (PHP 5.6+)
=======================================================

0. Testing Role Authorization & Guard Rails...
  [PASS] Unauthenticated request to /driver/profile returns 401
  [PASS] Customer token to /driver/profile returns 403 Forbidden
  [PASS] Customer token to /driver/status returns 403 Forbidden
  [PASS] Customer token to /driver/wallet returns 403 Forbidden

1. Testing Get Driver Profile (GET /api/v1/driver/profile)...
  [PASS] Profile retrieved successfully
  [PASS] Profile contains expected driver name
  [PASS] Password hash is omitted from profile response
  [PASS] Profile includes vehicle information
  [PASS] Profile includes wallet summary

2. Testing Update Driver Profile (PUT /api/v1/driver/profile)...
  [PASS] Profile updated successfully
  [PASS] Updated profile name matches
  [PASS] Updated photo_url matches
  [PASS] Short name returns 400 Bad Request
  [PASS] Duplicate driver email returns 409 Conflict

3. Testing Get Driver Vehicle Details (GET /api/v1/driver/vehicle)...
  [PASS] Get vehicle details returns 200
  [PASS] Active vehicle model matches fixture
  [PASS] All vehicles array is returned
  [PASS] GET /api/v1/driver/vehicles also returns vehicle details

4. Testing Update Driver Vehicle Details (PUT /api/v1/driver/vehicles/{id})...
  [PASS] Vehicle details updated successfully
  [PASS] Updated vehicle model matches
  [PASS] Updated color matches
  [PASS] Updated year matches
  [PASS] Updating non-existent vehicle returns 404

5. Testing Driver Online/Offline Status (PATCH /api/v1/driver/status)...
  [PASS] Approved driver successfully goes ONLINE
  [PASS] Driver status response is_online is true
  [PASS] Driver status updates GPS lat/lng
  [PASS] Pending driver attempting to go online returns 403 Forbidden
  [PASS] Driver successfully goes OFFLINE

6. Testing Get Available Ride Requests (GET /api/v1/driver/rides/available)...
  [PASS] Get available rides returns 200
  [PASS] Available rides list includes seeded ride
  [PASS] Found newly created booking in available rides
  [PASS] Ride includes pickup details
  [PASS] Ride includes drop details
  [PASS] Ride includes passenger name

7. Testing Accept Ride Request (POST /api/v1/driver/rides/{id}/accept)...
  [PASS] Driver 1 accepts ride successfully
  [PASS] Accepted ride status is ASSIGNED
  [PASS] Accepted ride assigned to driver 1
  [PASS] Second driver accepting already assigned ride returns 409 Conflict
  [PASS] Driver with active ride accepting another ride returns 409 Conflict

8. Testing Reject Ride Request (POST /api/v1/driver/rides/{id}/reject)...
  [PASS] Reject ride returns success
  [PASS] Reject response flags rejected true
  [PASS] Booking released back to SEARCHING status

9. Testing Get Current/Active Ride (GET /api/v1/driver/rides/current)...
  [PASS] No active ride returns data: null
  [PASS] Re-accepting ride succeeds
  [PASS] Active ride retrieved successfully
  [PASS] Active ride includes customer name
  [PASS] Active ride includes pickup and drop locations

10. Testing Update Ride Status Transitions (ARRIVED, STARTED, COMPLETED)...
  [PASS] Status transition to ARRIVED succeeds
  [PASS] Current status is now ARRIVED
  [PASS] Jumping from ARRIVED to COMPLETED returns 400 Bad Request
  [PASS] Starting ride without OTP returns 400 Bad Request
  [PASS] Starting ride with incorrect OTP returns 401 Unauthorized
  [PASS] Starting ride with correct OTP succeeds
  [PASS] Ride status is now IN_PROGRESS
  [PASS] Ride started_at timestamp is set
  [PASS] Completing ride succeeds
  [PASS] Completed response contains driver earnings
  [PASS] Completed response contains commission deduction
  [PASS] Booking status in DB is COMPLETED
  [PASS] Booking completed_at is populated
  [PASS] Driver trips_count incremented

11. Testing Get Driver Ride History (GET /api/v1/driver/rides/history)...
  [PASS] Ride history returns 200
  [PASS] Ride history contains completed ride
  [PASS] History ride contains customer name
  [PASS] History ride contains pickup address
  [PASS] History ride contains total fare
  [PASS] History contains pagination meta

12. Testing Get Driver Wallet and Transactions (GET /api/v1/driver/wallet)...
  [PASS] Wallet endpoint returns 200
  [PASS] Wallet balance is credited with ride earnings
  [PASS] Today earnings is populated
  [PASS] Today trips equals 1
  [PASS] Total commission paid recorded
  [PASS] Wallet contains ledger transaction record
  [PASS] Ledger transaction is of type CREDIT
  [PASS] Ledger transaction reference matches completed booking

13. Testing Get Driver Notifications (GET /api/v1/driver/notifications)...
  [PASS] Notifications endpoint returns 200
  [PASS] Returns both personal and broadcast driver notifications
  [PASS] Meta includes unreadCount

14. Testing Driver Document & Verification Status (GET /api/v1/driver/documents)...
  [PASS] Documents endpoint returns 200
  [PASS] Driver approval_status is APPROVED
  [PASS] Documents array contains 3 submitted documents
  [PASS] Documents include LICENSE, RC, and INSURANCE

=======================================================
Test Execution Summary
=======================================================
Total Tests Passed: 82
Total Tests Failed: 0
Success Rate: 100%

All RedTaxi Driver API tests passed successfully!
```
