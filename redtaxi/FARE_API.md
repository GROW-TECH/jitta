# RedTaxi — Fare Estimate REST API Documentation

> **Base URL**: `/api/v1`  
> **Endpoint**: `POST /api/v1/booking/fare-estimate`  
> **Protocol**: HTTP/1.1 or HTTP/2  
> **Content-Type**: `application/json`  
> **Authentication**: `Bearer <token>` (Authenticated **Customer** token strictly required; Driver token returns `403 Forbidden`)  
> **Compatibility**: PHP 5.6+ and PHP 8.x  
> **Database Tables Used**: `fare_rules`, `vehicle_categories`, `cities`, `coupons`  

---

## 1. Overview & Architecture

The RedTaxi Fare Estimate API allows customers to estimate total ride fares and obtain an itemized pricing breakdown before booking a trip. 

### Key Architectural Highlights:
1. **Dynamic Database Rules**: Pricing is retrieved directly from `fare_rules` and `vehicle_categories` in `redtaxi_db` based on the active city and vehicle category.
2. **Customer Role Enforcement**: Secured via `AuthMiddleware::requireCustomer()`. Unauthenticated requests receive `401 Unauthorized`. Driver partner tokens receive `403 Forbidden`.
3. **Rigorous Input Validation**: Pickup, drop, vehicle type, distance, and duration are validated against bounds and type rules.
4. **Flexible Input Formats**: Supports structured GPS objects (`{ name, address, lat, lng }`), simple strings, or flat field parameters (`pickup_address`, `drop_address`).
5. **Flexible Vehicle Category Slugs**: Matches exact names (e.g., `'Red Mini'`), IDs (e.g., `'vc-mini-01'`), or case-insensitive slugs (`'mini'`, `'sedan'`, `'suv'`, `'outstation'`).
6. **Dual Key Compatibility**: Returns both `snake_case` (e.g., `total_fare`) and `camelCase` (e.g., `totalFare`) properties to ensure seamless compatibility with both MySQL schemas and React/TypeScript frontends.

---

## 2. Fare Calculation Formula

All calculations are computed dynamically using rates from `fare_rules` (or `vehicle_categories` fallback):

$$\text{Billable Distance (km)} = \max(0, \text{Distance (km)} - \text{Free KM})$$

$$\text{Distance Fare} = \text{round}(\text{Billable Distance} \times \text{Per KM Rate}, 2)$$

$$\text{Time Fare} = \text{round}(\text{Duration (min)} \times \text{Per Minute Rate}, 2)$$

$$\text{Subtotal} = \text{Base Fare} + \text{Distance Fare} + \text{Time Fare} + \text{Waiting Fare} + \text{Platform Fee}$$

$$\text{Tax (GST 5\%)} = \text{round}\left(\text{Subtotal} \times \frac{\text{Tax Percent}}{100}, 2\right)$$

$$\text{Total Fare} = \max(0, \text{Subtotal} + \text{Tax} - \text{Discount})$$

### Master Vehicle Categories & Standard Rates in Coimbatore (`city_id = 1`):

| Vehicle Category | Slug | Capacity | Base Fare | Free KM | Per KM Rate | Per Min Rate | Platform Fee | Tax (GST) |
|---|---|---|---|---|---|---|---|---|
| **Red Mini** | `mini` | 4 | ₹99.00 | 2.0 km | ₹14.00/km | ₹2.00/min | ₹10.00 | 5% |
| **Red Sedan** | `sedan` | 4 | ₹149.00 | 2.0 km | ₹18.00/km | ₹2.50/min | ₹10.00 | 5% |
| **Red SUV Prime** | `suv` | 6 | ₹199.00 | 3.0 km | ₹24.00/km | ₹3.00/min | ₹15.00 | 5% |
| **Red Outstation** | `outstation` | 5 | ₹499.00 | 0.0 km | ₹16.00/km | ₹1.00/min | ₹20.00 | 5% |

---

## 3. Endpoint Specification

### `POST /api/v1/booking/fare-estimate`

#### Headers
```http
POST /api/v1/booking/fare-estimate HTTP/1.1
Host: localhost:8001
Content-Type: application/json
Authorization: Bearer <customer_jwt_token>
```

#### Request Body Schema

| Field | Type | Required | Description | Constraints / Examples |
|---|---|---|---|---|
| `pickup` | `string` or `object` | **Yes** | Origin location | Object with `{ name, address, lat, lng }` or string |
| `drop` | `string` or `object` | **Yes** | Destination location | Object with `{ name, address, lat, lng }` or string |
| `vehicle_type` | `string` | **Yes** | Vehicle category name or slug | `'Red Mini'`, `'mini'`, `'Red Sedan'`, `'sedan'`, `'suv'`, `'outstation'` |
| `distance_km` | `float` | **Yes** | Estimated distance in km | Positive number: `> 0` and `≤ 5000` |
| `duration_min` | `float` | **Yes** | Estimated duration in minutes | Non-negative number: `≥ 0` and `≤ 10080` (7 days) |
| `city_id` | `integer` | No | Operational City ID | Defaults to `1` (Coimbatore) |
| `coupon_code` | `string` | No | Optional promotional coupon | E.g. `'SAVE50'`, `'FIRST100'` |

---

## 4. Request & Response Examples

### Example 1: Standard Red Mini City Ride (10 km, 20 min)

#### Request
```json
{
  "pickup": {
    "name": "Gandhipuram Central Bus Stand",
    "address": "Cross Cut Rd, Gandhipuram, Coimbatore",
    "lat": 11.0168,
    "lng": 76.9656
  },
  "drop": {
    "name": "Coimbatore International Airport",
    "address": "Avinashi Rd, Peelamedu, Coimbatore",
    "lat": 11.0300,
    "lng": 77.0434
  },
  "vehicle_type": "Red Mini",
  "distance_km": 10.0,
  "duration_min": 20.0
}
```

#### Calculation Breakdown:
* Base Fare = **₹99.00**
* Free KM = **2.0 km** $\implies$ Billable Distance = $10.0 - 2.0 = \mathbf{8.0\text{ km}}$
* Distance Fare = $8.0 \times 14.00 = \mathbf{₹112.00}$
* Time Fare = $20.0 \times 2.00 = \mathbf{₹40.00}$
* Platform Fee = **₹10.00**
* Subtotal = $99.00 + 112.00 + 40.00 + 10.00 = \mathbf{₹261.00}$
* GST Tax (5%) = $261.00 \times 0.05 = \mathbf{₹13.05}$
* **Total Estimated Fare** = $261.00 + 13.05 = \mathbf{₹274.05}$

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Fare estimate calculated successfully",
  "data": {
    "fare_breakdown": {
      "base_fare": 99,
      "distance_fare": 112,
      "time_fare": 40,
      "waiting_fare": 0,
      "platform_fee": 10,
      "subtotal": 261,
      "tax": 13.05,
      "discount": 0,
      "total_fare": 274.05,
      "baseFare": 99,
      "distanceFare": 112,
      "timeFare": 40,
      "waitingFare": 0,
      "platformFee": 10,
      "taxAmount": 13.05,
      "discountAmount": 0,
      "totalFare": 274.05
    },
    "trip": {
      "pickup": {
        "name": "Gandhipuram Central Bus Stand",
        "address": "Cross Cut Rd, Gandhipuram, Coimbatore",
        "lat": 11.0168,
        "lng": 76.9656
      },
      "drop": {
        "name": "Coimbatore International Airport",
        "address": "Avinashi Rd, Peelamedu, Coimbatore",
        "lat": 11.03,
        "lng": 77.0434
      },
      "distance_km": 10,
      "duration_min": 20
    },
    "vehicle": {
      "id": "vc-mini-01",
      "name": "Red Mini",
      "category": "Compact Hatchback",
      "capacity": 4,
      "eta_min": 3,
      "tagline": "Quick & affordable city rides",
      "image_url": "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=300&auto=format&fit=crop&q=80"
    },
    "pricing_rule": {
      "city_id": 1,
      "free_km": 2,
      "billable_distance_km": 8,
      "per_km_rate": 14,
      "per_minute_rate": 2,
      "platform_fee": 10,
      "tax_percent": 5,
      "cancellation_fee": 30,
      "currency": "INR",
      "currency_symbol": "₹"
    },
    "applied_coupon": null
  },
  "timestamp": "2026-09-10T13:07:39Z"
}
```

---

### Example 2: Red Sedan Trip (15 km, 30 min)

#### Request
```json
{
  "pickup": "RS Puram DB Road, Coimbatore",
  "drop": "Tidel Park, Peelamedu, Coimbatore",
  "vehicle_type": "sedan",
  "distance_km": 15.0,
  "duration_min": 30.0
}
```

#### Calculation Breakdown:
* Base Fare = **₹149.00**
* Free KM = **2.0 km** $\implies$ Billable Distance = $15.0 - 2.0 = \mathbf{13.0\text{ km}}$
* Distance Fare = $13.0 \times 18.00 = \mathbf{₹234.00}$
* Time Fare = $30.0 \times 2.50 = \mathbf{₹75.00}$
* Platform Fee = **₹10.00**
* Subtotal = $149.00 + 234.00 + 75.00 + 10.00 = \mathbf{₹468.00}$
* GST Tax (5%) = $468.00 \times 0.05 = \mathbf{₹23.40}$
* **Total Estimated Fare** = $468.00 + 23.40 = \mathbf{₹491.40}$

---

### Example 3: Short Trip Within Free Distance (1.5 km in Red Mini)

When trip distance is within inclusive Free KM ($1.5 \le 2.0\text{ km}$), distance fare is **₹0.00**.

#### Request
```json
{
  "pickup": "Gopalapuram",
  "drop": "Coimbatore Junction Railway Station",
  "vehicle_type": "mini",
  "distance_km": 1.5,
  "duration_min": 5.0
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Fare estimate calculated successfully",
  "data": {
    "fare_breakdown": {
      "base_fare": 99,
      "distance_fare": 0,
      "time_fare": 10,
      "waiting_fare": 0,
      "platform_fee": 10,
      "subtotal": 119,
      "tax": 5.95,
      "discount": 0,
      "total_fare": 124.95,
      "baseFare": 99,
      "distanceFare": 0,
      "timeFare": 10,
      "waitingFare": 0,
      "platformFee": 10,
      "taxAmount": 5.95,
      "discountAmount": 0,
      "totalFare": 124.95
    },
    "pricing_rule": {
      "free_km": 2,
      "billable_distance_km": 0,
      "per_km_rate": 14,
      "per_minute_rate": 2
    }
  }
}
```

---

### Example 4: Coupon Discount (`SAVE50`)

When a valid promo code is provided and the booking amount satisfies the coupon minimum, the discount is deducted from the total.

#### Request
```json
{
  "pickup": "Gandhipuram",
  "drop": "Peelamedu Airport",
  "vehicle_type": "Red Mini",
  "distance_km": 10.0,
  "duration_min": 20.0,
  "coupon_code": "SAVE50"
}
```

#### Calculation Breakdown:
* Subtotal = **₹261.00**
* Tax (5%) = **₹13.05**
* Coupon Discount (`SAVE50`) = **-₹50.00**
* **Total Estimated Fare** = $261.00 + 13.05 - 50.00 = \mathbf{₹224.05}$

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Fare estimate calculated successfully",
  "data": {
    "fare_breakdown": {
      "base_fare": 99,
      "distance_fare": 112,
      "time_fare": 40,
      "platform_fee": 10,
      "subtotal": 261,
      "tax": 13.05,
      "discount": 50,
      "total_fare": 224.05,
      "totalFare": 224.05
    },
    "applied_coupon": {
      "code": "SAVE50",
      "discount_type": "FLAT",
      "discount_amount": 50,
      "savings": 50,
      "description": "Flat 50 OFF"
    }
  }
}
```

---

## 5. Validation & Error Responses

The API returns standardized JSON error responses with proper HTTP status codes.

### 1. Missing or Invalid Authentication Token (`401 Unauthorized`)
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Authentication token required. Format: Authorization: Bearer <token>",
  "errors": null,
  "timestamp": "2026-09-10T13:07:10Z"
}
```

### 2. Driver Token Used (`403 Forbidden`)
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Customer access required",
  "errors": null,
  "timestamp": "2026-09-10T13:07:10Z"
}
```

### 3. Missing Pickup Location (`400 Bad Request`)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Pickup location is required. Provide name/address or coordinate object",
  "errors": null,
  "timestamp": "2026-09-10T13:07:10Z"
}
```

### 4. Missing Drop Location (`400 Bad Request`)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Drop location is required. Provide name/address or coordinate object",
  "errors": null,
  "timestamp": "2026-09-10T13:07:10Z"
}
```

### 5. Invalid Vehicle Category (`400 Bad Request`)
Includes list of valid active category options.
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Invalid vehicle type \"RocketShip Luxury\". Available options: Red Mini, Red Sedan, Red SUV Prime, Red Outstation",
  "errors": {
    "available_categories": [
      "Red Mini",
      "Red Sedan",
      "Red SUV Prime",
      "Red Outstation"
    ]
  },
  "timestamp": "2026-09-10T13:07:10Z"
}
```

### 6. Invalid / Negative Distance (`400 Bad Request`)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Estimated distance must be greater than 0 km",
  "errors": null,
  "timestamp": "2026-09-10T13:07:10Z"
}
```

### 7. Invalid / Negative Duration (`400 Bad Request`)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Estimated duration must be a non-negative number",
  "errors": null,
  "timestamp": "2026-09-10T13:07:10Z"
}
```

### 8. Invalid HTTP Method (`405 Method Not Allowed`)
```json
{
  "success": false,
  "statusCode": 405,
  "message": "Method Not Allowed",
  "errors": null,
  "timestamp": "2026-09-10T13:07:10Z"
}
```

---

## 6. Automated Test Suite & Results

An automated test suite was constructed and executed in `backend/test_fare_api.php`, covering 67 test conditions across all functional categories:

```
=======================================================
RedTaxi Fare Estimate API Test Suite (PHP 5.6+)
=======================================================

1. Testing Authentication & Role Authorization...
  [PASS] Missing Bearer token returns 401 Unauthorized
  [PASS] Error message clarifies token requirement
  [PASS] Invalid Bearer token returns 401 Unauthorized
  [PASS] Driver token returns 403 Forbidden (Customer required)
  [PASS] Forbidden message notes customer access

2. Testing Input Validation Rules (400 Bad Request)...
  [PASS] Empty payload returns 400 Bad Request
  [PASS] Missing pickup returns 400 Bad Request
  [PASS] Message indicates pickup location is required
  [PASS] Missing drop returns 400 Bad Request
  [PASS] Message indicates drop location is required
  [PASS] Missing vehicle type returns 400 Bad Request
  [PASS] Message indicates vehicle type is required
  [PASS] Invalid vehicle type returns 400 Bad Request
  [PASS] Error includes available category suggestions
  [PASS] Missing distance_km returns 400 Bad Request
  [PASS] Non-numeric distance returns 400 Bad Request
  [PASS] Zero distance (0 km) returns 400 Bad Request
  [PASS] Negative distance returns 400 Bad Request
  [PASS] Excessive distance (>5000 km) returns 400 Bad Request
  [PASS] Missing duration_min returns 400 Bad Request
  [PASS] Non-numeric duration returns 400 Bad Request
  [PASS] Negative duration returns 400 Bad Request
  [PASS] Excessive duration (>7 days) returns 400 Bad Request
  [PASS] GET method on POST-only endpoint returns 404/405 error

3. Testing Valid Fare Estimations & Mathematical Accuracy...
  [PASS] Red Mini API returns 200 OK
  [PASS] Red Mini base fare is 99.00
  [PASS] Red Mini distance fare is 112.00 (8 km @ 14/km)
  [PASS] Red Mini time fare is 40.00 (20 min @ 2/min)
  [PASS] Red Mini platform fee is 10.00
  [PASS] Red Mini subtotal is 261.00
  [PASS] Red Mini tax (5%) is 13.05
  [PASS] Red Mini total fare is 274.05
  [PASS] Red Mini camelCase totalFare matches total_fare
  [PASS] Red Sedan API returns 200 OK
  [PASS] Red Sedan base fare is 149.00
  [PASS] Red Sedan distance fare is 234.00 (13 km @ 18/km)
  [PASS] Red Sedan time fare is 75.00 (30 min @ 2.50/min)
  [PASS] Red Sedan platform fee is 10.00
  [PASS] Red Sedan subtotal is 468.00
  [PASS] Red Sedan tax is 23.40
  [PASS] Red Sedan total fare is 491.40
  [PASS] Red SUV Prime API returns 200 OK
  [PASS] Red SUV Prime base fare is 199.00
  [PASS] Red SUV Prime distance fare is 528.00 (22 km @ 24/km)
  [PASS] Red SUV Prime time fare is 135.00 (45 min @ 3/min)
  [PASS] Red SUV Prime platform fee is 15.00
  [PASS] Red SUV Prime subtotal is 877.00
  [PASS] Red SUV Prime tax is 43.85
  [PASS] Red SUV Prime total fare is 920.85
  [PASS] Red Outstation API returns 200 OK
  [PASS] Red Outstation base fare is 499.00
  [PASS] Red Outstation distance fare is 1376.00
  [PASS] Red Outstation time fare is 180.00
  [PASS] Red Outstation platform fee is 20.00
  [PASS] Red Outstation total fare is 2178.75

4. Testing Flexibility (Slugs, Free KM, Formats & Coupons)...
  [PASS] Short trip <= free_km succeeds
  [PASS] Lowercase slug "mini" resolves to Red Mini
  [PASS] Distance fare is 0.00 when distance <= free_km
  [PASS] Total fare calculated accurately for short trip
  [PASS] Slug "sedan" resolves to Red Sedan
  [PASS] Slug "suv" resolves to Red SUV Prime
  [PASS] Flat pickup_address / drop_address parameters supported
  [PASS] Flat address parsed in trip info
  [PASS] Valid coupon SAVE50 applied successfully
  [PASS] Discount is 50.00
  [PASS] Total fare reflects discount: 224.05
  [PASS] Applied coupon details included in response

=======================================================
Test Execution Summary:
  Total Tests: 67
  Passed:      67
  Failed:      0
=======================================================
SUCCESS: All Fare Estimate API tests PASSED!
```

### Cumulative Backend Test Matrix
* `test_auth_api.php`: **21 / 21 Passed (100%)**
* `test_customer_api.php`: **37 / 37 Passed (100%)**
* `test_driver_api.php`: **82 / 82 Passed (100%)**
* `test_fare_api.php`: **67 / 67 Passed (100%)**
* **Total Backend Tests**: **207 / 207 Passed (100%)**
