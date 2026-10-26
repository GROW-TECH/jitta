# RedTaxi — Customer REST API Documentation

> **Base URL**: `/api/v1`  
> **API Version**: `v1`  
> **Protocol**: HTTP/1.1 or HTTP/2  
> **Content-Type**: `application/json`  
> **Authentication**: `Bearer <token>` (Customer token required for all endpoints)  
> **Compatibility**: PHP 5.6+ and PHP 8.x  

---

## Overview

The RedTaxi Customer API provides full profile management, multi-point saved places, ride booking history with complete fare breakdown and route tracking, push/in-app notifications, customer wallet and ledger transactions, and a customer helpdesk support ticket system with threaded replies.

---

## Endpoints Summary

| # | Method | Endpoint | Description |
|---|---|---|---|
| 1 | `GET` | `/api/v1/customer/profile` | Retrieve authenticated customer profile & wallet balance |
| 2 | `PUT` | `/api/v1/customer/profile` | Update profile (name, email, avatar URL, city) |
| 3 | `GET` | `/api/v1/customer/places` | List saved Home, Work, and Other places |
| 4 | `POST` | `/api/v1/customer/places` | Add a new saved address with GPS coordinates |
| 5 | `PUT` | `/api/v1/customer/places/{id}` | Update an existing saved address |
| 6 | `DELETE` | `/api/v1/customer/places/{id}` | Remove a saved place |
| 7 | `GET` | `/api/v1/customer/bookings` | Retrieve paginated ride booking history |
| 8 | `GET` | `/api/v1/customer/bookings/{id}` | Retrieve complete booking detail (fare, route, driver, payment) |
| 9 | `GET` | `/api/v1/customer/notifications` | Fetch customer notifications & unread count |
| 10 | `PATCH` | `/api/v1/customer/notifications/{id}/read` | Mark a notification as read |
| 11 | `GET` | `/api/v1/customer/wallet` | Get wallet balance and ledger transaction history |
| 12 | `POST` | `/api/v1/customer/support/tickets` | Open a customer support inquiry or dispute |
| 13 | `GET` | `/api/v1/customer/support/tickets` | List customer's support tickets |
| 14 | `GET` | `/api/v1/customer/support/tickets/{id}` | View support ticket details and full message thread |
| 15 | `POST` | `/api/v1/customer/support/tickets/{id}/reply` | Add reply message to a support ticket thread |

---

## 1. Customer Profile

### `GET /api/v1/customer/profile`
Retrieves customer details, primary city, total lifetime rides, and live wallet balance.

#### Headers
```http
Authorization: Bearer <customer_token>
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Customer profile retrieved",
  "data": {
    "id": "f5d083b9-9466-4a45-9f61-40bca61906e4",
    "name": "Priya Sundaram",
    "phone": "9800123456",
    "email": "priya@example.com",
    "avatar_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
    "city_id": 1,
    "city_name": "Coimbatore",
    "status": "ACTIVE",
    "total_rides": 14,
    "created_at": "2026-09-10 17:48:52",
    "updated_at": "2026-09-10 17:48:52",
    "wallet_balance": "350.00",
    "wallet_id": "3b7f1b6d-cfa9-450b-a0e1-dee9f5488acd"
  },
  "timestamp": "2026-09-10T12:28:49Z"
}
```

---

### `PUT /api/v1/customer/profile`
Updates profile details. Validates name, email uniqueness across other customers, and formats.

#### Request Body
```json
{
  "name": "Priya S. Kumar",
  "email": "priya.kumar@example.com",
  "avatar_url": "https://example.com/avatar.jpg",
  "city_id": 1
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Customer profile updated successfully",
  "data": {
    "id": "f5d083b9-9466-4a45-9f61-40bca61906e4",
    "name": "Priya S. Kumar",
    "phone": "9800123456",
    "email": "priya.kumar@example.com",
    "avatar_url": "https://example.com/avatar.jpg",
    "city_id": 1,
    "city_name": "Coimbatore",
    "status": "ACTIVE",
    "wallet_balance": "350.00"
  },
  "timestamp": "2026-09-10T12:28:49Z"
}
```

---

## 2. Saved Places (Home, Work, Other)

### `GET /api/v1/customer/places`
Returns saved locations ordered by Home, Work, then custom destinations.

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Saved places retrieved",
  "data": [
    {
      "id": "plc-home-uuid",
      "label": "Home",
      "custom_label": null,
      "address": "42, Race Course Road, Coimbatore, Tamil Nadu",
      "lat": "11.0168000",
      "lng": "76.9558000",
      "created_at": "2026-09-10 17:50:00"
    },
    {
      "id": "plc-work-uuid",
      "label": "Work",
      "custom_label": null,
      "address": "Tidel Park, Avinashi Road, Coimbatore",
      "lat": "11.0285000",
      "lng": "77.0276000",
      "created_at": "2026-09-10 17:50:10"
    },
    {
      "id": "plc-other-uuid",
      "label": "Other",
      "custom_label": "Gold Gym",
      "address": "RS Puram, Coimbatore",
      "lat": "11.0080000",
      "lng": "76.9460000",
      "created_at": "2026-09-10 17:50:20"
    }
  ],
  "timestamp": "2026-09-10T12:28:49Z"
}
```

---

### `POST /api/v1/customer/places`
Add a new saved place.

#### Request Body
```json
{
  "label": "Home",
  "address": "42, Race Course Road, Coimbatore",
  "lat": 11.0168,
  "lng": 76.9558
}
```

#### Response (`201 Created`)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Saved place added successfully",
  "data": {
    "id": "673f8a92-3c22-48a1-b841-314ef8231e84",
    "customer_id": "f5d083b9-9466-4a45-9f61-40bca61906e4",
    "label": "Home",
    "custom_label": null,
    "address": "42, Race Course Road, Coimbatore",
    "lat": "11.0168000",
    "lng": "76.9558000",
    "created_at": "2026-09-10 17:58:00"
  },
  "timestamp": "2026-09-10T12:28:49Z"
}
```

---

### `PUT /api/v1/customer/places/{id}`
Updates address, label, or coordinates.

#### Request Body
```json
{
  "address": "42B, New Race Course Road, Coimbatore",
  "lat": 11.0170,
  "lng": 76.9560
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Saved place updated successfully",
  "data": {
    "id": "673f8a92-3c22-48a1-b841-314ef8231e84",
    "address": "42B, New Race Course Road, Coimbatore",
    "lat": "11.0170000",
    "lng": "76.9560000"
  },
  "timestamp": "2026-09-10T12:28:49Z"
}
```

---

### `DELETE /api/v1/customer/places/{id}`
Deletes the specified saved place.

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Saved place deleted successfully",
  "data": {
    "deleted": true,
    "id": "673f8a92-3c22-48a1-b841-314ef8231e84"
  },
  "timestamp": "2026-09-10T12:28:49Z"
}
```

---

## 3. Customer Ride Bookings History & Details

### `GET /api/v1/customer/bookings`
Retrieves customer ride history with pagination, driver summary, vehicle info, and pickup/drop points.

#### Query Parameters
* `status` (optional): `SEARCHING`, `ASSIGNED`, `ARRIVED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
* `page` (optional, default: `1`): Page number
* `limit` (optional, default: `20`): Items per page

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Booking history retrieved",
  "data": [
    {
      "id": "TXI-204918",
      "ride_type": "CITY",
      "vehicle_category": "Red Sedan",
      "status": "COMPLETED",
      "distance_km": "12.50",
      "duration_min": "28.00",
      "total_fare": "284.50",
      "payment_method": "UPI",
      "payment_status": "PAID",
      "rating": 5,
      "driver_name": "Ravi V",
      "driver_phone": "9800311223",
      "driver_rating": "4.92",
      "vehicle_model": "Toyota Etios",
      "vehicle_number": "TN 37 CD 4821",
      "created_at": "2026-09-10 16:48:52",
      "pickup": {
        "type": "PICKUP",
        "name": "Railway Station",
        "address": "Coimbatore Junction",
        "lat": "11.0016000",
        "lng": "76.9628000"
      },
      "drop": {
        "type": "DROP",
        "name": "Airport",
        "address": "Coimbatore International Airport",
        "lat": "11.0300000",
        "lng": "77.0434000"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "count": 1
  },
  "timestamp": "2026-09-10T12:28:49Z"
}
```

---

### `GET /api/v1/customer/bookings/{id}`
Returns complete booking details including itemized fare breakdown, driver profile, vehicle details, multi-stop route points, payments, and cancellations.

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Booking details retrieved",
  "data": {
    "id": "TXI-204918",
    "customer_id": "f5d083b9-9466-4a45-9f61-40bca61906e4",
    "city_id": 1,
    "city_name": "Coimbatore",
    "ride_type": "CITY",
    "vehicle_category": "Red Sedan",
    "status": "COMPLETED",
    "start_otp": "4821",
    "distance_km": "12.50",
    "duration_min": "28.00",
    "fare_breakdown": {
      "base_fare": 100.0,
      "distance_fare": 150.0,
      "time_fare": 30.0,
      "waiting_fare": 0.0,
      "platform_fee": 10.0,
      "tax": 14.5,
      "discount": 20.0,
      "total_fare": 284.5
    },
    "payment_method": "UPI",
    "payment_status": "PAID",
    "driver": {
      "id": "drv-uuid-1",
      "name": "Ravi V",
      "phone": "9800311223",
      "photo_url": null,
      "rating": "4.92"
    },
    "vehicle": {
      "id": "veh-uuid-1",
      "vehicle_model": "Toyota Etios",
      "vehicle_number": "TN 37 CD 4821",
      "vehicle_type": "Sedan",
      "color": "Silver"
    },
    "locations": [
      {
        "id": "loc-1",
        "type": "PICKUP",
        "sequence_order": 0,
        "name": "Railway Station",
        "address": "Coimbatore Junction",
        "lat": "11.0016000",
        "lng": "76.9628000",
        "category": "STATION"
      },
      {
        "id": "loc-2",
        "type": "DROP",
        "sequence_order": 1,
        "name": "Airport",
        "address": "Coimbatore International Airport",
        "lat": "11.0300000",
        "lng": "77.0434000",
        "category": "AIRPORT"
      }
    ],
    "payments": [
      {
        "id": "pay-1",
        "method": "UPI",
        "type": "PAYMENT",
        "amount": "284.50",
        "status": "SUCCESS",
        "gateway_txn_id": "TXN_UPI_84920",
        "paid_at": "2026-09-10 17:16:52"
      }
    ],
    "cancellation": null,
    "created_at": "2026-09-10 16:48:52",
    "completed_at": "2026-09-10 17:16:52"
  },
  "timestamp": "2026-09-10T12:28:49Z"
}
```

---

## 4. Wallet & Ledger Transactions

### `GET /api/v1/customer/wallet`
Fetches the customer's wallet balance and detailed credit/debit transaction history.

#### Query Parameters
* `page` (optional, default: `1`)
* `limit` (optional, default: `50`)

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Wallet details and transactions retrieved",
  "data": {
    "walletId": "3b7f1b6d-cfa9-450b-a0e1-dee9f5488acd",
    "balance": 500.0,
    "currency": "INR",
    "isActive": true,
    "transactions": [
      {
        "id": "tx-uuid-1",
        "type": "CREDIT",
        "amount": "500.00",
        "description": "Top-up via UPI",
        "reference_id": "UPI_REF_99",
        "created_at": "2026-09-10 17:30:00"
      },
      {
        "id": "tx-uuid-2",
        "type": "DEBIT",
        "amount": "284.50",
        "description": "Paid for ride TXI-204918",
        "reference_id": "TXI-204918",
        "created_at": "2026-09-10 17:16:52"
      }
    ]
  },
  "meta": {
    "page": 1,
    "limit": 50,
    "count": 2
  },
  "timestamp": "2026-09-10T12:28:49Z"
}
```

---

## 5. Support Tickets & Threaded Replies

### `POST /api/v1/customer/support/tickets`
Creates a new support ticket and posts the initial description message into the conversation thread.

#### Request Body
```json
{
  "category": "Billing",
  "subject": "Charged twice for ride",
  "description": "I was deducted twice for my booking TXI-204918. Kindly refund.",
  "booking_id": "TXI-204918",
  "priority": "HIGH"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `category` | string | **Yes** | "Billing", "Lost Item", "Safety", "Driver Behavior", "App Issue" |
| `subject` | string | **Yes** | Minimum 3 characters |
| `description` | string | **Yes** | Initial ticket message (minimum 5 characters) |
| `booking_id` | string | No | Associated ride ID |
| `priority` | string | No | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` (default: `MEDIUM`) |

#### Response (`201 Created`)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Support ticket created successfully",
  "data": {
    "id": "TCK-8f20b391-482a",
    "user_id": "f5d083b9-9466-4a45-9f61-40bca61906e4",
    "user_type": "CUSTOMER",
    "booking_id": "TXI-204918",
    "category": "Billing",
    "subject": "Charged twice for ride",
    "status": "OPEN",
    "priority": "HIGH",
    "created_at": "2026-09-10 17:52:00",
    "messages": [
      {
        "id": "msg-1",
        "sender_type": "CUSTOMER",
        "sender_id": "f5d083b9-9466-4a45-9f61-40bca61906e4",
        "message": "I was deducted twice for my booking TXI-204918. Kindly refund.",
        "attachments": null,
        "created_at": "2026-09-10 17:52:00"
      }
    ]
  },
  "timestamp": "2026-09-10T12:28:49Z"
}
```

---

### `GET /api/v1/customer/support/tickets`
Returns all support tickets submitted by the authenticated customer.

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Support tickets retrieved",
  "data": [
    {
      "id": "TCK-8f20b391-482a",
      "booking_id": "TXI-204918",
      "category": "Billing",
      "subject": "Charged twice for ride",
      "status": "OPEN",
      "priority": "HIGH",
      "messages_count": 2,
      "created_at": "2026-09-10 17:52:00"
    }
  ],
  "timestamp": "2026-09-10T12:28:49Z"
}
```

---

### `GET /api/v1/customer/support/tickets/{id}`
Returns ticket header and all threaded messages in chronological order.

---

### `POST /api/v1/customer/support/tickets/{id}/reply`
Posts a follow-up reply message to the support ticket. Reopens resolved tickets if closed.

#### Request Body
```json
{
  "message": "Here is my bank transaction reference: UPI-102948201"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Reply submitted successfully",
  "data": {
    "id": "TCK-8f20b391-482a",
    "status": "IN_PROGRESS",
    "messages": [
      {
        "id": "msg-1",
        "sender_type": "CUSTOMER",
        "message": "I was deducted twice for my booking TXI-204918. Kindly refund."
      },
      {
        "id": "msg-2",
        "sender_type": "CUSTOMER",
        "message": "Here is my bank transaction reference: UPI-102948201"
      }
    ]
  },
  "timestamp": "2026-09-10T12:28:49Z"
}
```

---

## 6. Notifications

### `GET /api/v1/customer/notifications`
Retrieves customer-specific notifications and platform broadcasts. Includes `unreadCount` in metadata.

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Notifications retrieved",
  "data": [
    {
      "id": "notif-uuid-1",
      "title": "Ride Completed!",
      "message": "Your ride TXI-204918 has been completed. Thank you for riding Red Taxi!",
      "type": "RIDE",
      "is_read": false,
      "data_payload": { "booking_id": "TXI-204918" },
      "created_at": "2026-09-10 17:16:52"
    }
  ],
  "meta": {
    "total": 1,
    "unreadCount": 1
  },
  "timestamp": "2026-09-10T12:28:49Z"
}
```

---

### `PATCH /api/v1/customer/notifications/{id}/read`
Marks the specified notification as read.

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Notification marked as read",
  "data": {
    "markedRead": true,
    "id": "notif-uuid-1"
  },
  "timestamp": "2026-09-10T12:28:49Z"
}
```

---

## Automated Test Results

Run via [test_customer_api.php](file:///c:/Users/Giridharan/Desktop/redtaxi/backend/test_customer_api.php):

```
=======================================================
RedTaxi Customer API Test Suite (PHP 5.6+)
=======================================================

1. Testing Get Customer Profile (GET /api/v1/customer/profile)...
  [PASS] Profile retrieved successfully
  [PASS] Profile contains expected name and phone
  [PASS] Profile contains wallet balance
  [PASS] Profile without token returns 401 Unauthorized
  [PASS] Profile with Driver token returns 403 Forbidden

2. Testing Update Customer Profile (PUT /api/v1/customer/profile)...
  [PASS] Profile updated successfully
  [PASS] Updated name reflects in profile
  [PASS] Duplicate email returns 409 Conflict
  [PASS] Invalid email format returns 400 Bad Request

3 & 4. Testing Saved Places CRUD (/api/v1/customer/places)...
  [PASS] Add Home place returns 201 Created
  [PASS] Home place contains coordinates and address
  [PASS] Add Work place returns 201 Created
  [PASS] Add Other place returns 201 Created
  [PASS] Get saved places returns array of places
  [PASS] Update saved place returns updated address
  [PASS] Delete saved place returns success
  [PASS] Deleted place is absent in list

5 & 10. Testing Customer Bookings History & Details...
  [PASS] Get booking history returns list of rides
  [PASS] Booking item includes pickup and drop locations
  [PASS] Booking item includes driver & vehicle details
  [PASS] Get booking detail returns 200 Success
  [PASS] Detail includes full fare breakdown
  [PASS] Detail includes all route locations
  [PASS] Detail includes payment records
  [PASS] Non-existent booking returns 404 Not Found

6. Testing Notifications (/api/v1/customer/notifications)...
  [PASS] Get notifications returns list
  [PASS] Notifications includes unreadCount in metadata
  [PASS] Mark notification read returns success

7. Testing Wallet & Transactions (GET /api/v1/customer/wallet)...
  [PASS] Get wallet returns 200 Success
  [PASS] Wallet returns balance of 500
  [PASS] Wallet returns transactions array

8 & 9. Testing Support Tickets (/api/v1/customer/support/tickets)...
  [PASS] Create support ticket returns 201 Created
  [PASS] Ticket has status OPEN and priority HIGH
  [PASS] Ticket contains initial threaded message
  [PASS] Get tickets returns list
  [PASS] Get ticket detail returns 200 with messages
  [PASS] Reply to ticket returns updated messages list

=======================================================
Customer API Test Summary: 37 Passed, 0 Failed.
=======================================================
```
