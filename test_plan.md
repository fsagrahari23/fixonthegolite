# FixOnTheGo Test Plan

## Environment

- Node 20+
- In-memory MongoDB
- NODE_ENV=test; app exported without listening

---

## Validation Test Cases (PASS)

Auth
- VAL-AUTH-001: Login invalid credentials
	- Steps: POST /auth/login with wrong password
	- Expected: 400 JSON with error message
	- Result: PASS
- AUTH-LOGIN-200: Login success
	- Steps: Create user → POST /auth/login with correct password
	- Expected: 200 JSON + session cookie set
	- Result: PASS

Route Guards
- VAL-GUARD-001: Unauthenticated user dashboard
	- Steps: GET /user/dashboard unauthenticated
	- Expected: 302 → /auth/login
	- Result: PASS
- GUARD-USER: User access
	- Steps: Login as role=user → GET /user/book
	- Expected: 200
	- Result: PASS
- GUARD-MECHANIC: Unapproved mechanic
	- Steps: Login as role=mechanic, isApproved=false → GET /mechanic/dashboard
	- Expected: 302 → /auth/pending-approval
	- Result: PASS
- GUARD-ADMIN: Non-admin blocked
	- Steps: Login as role=user → GET /admin/dashboard
	- Expected: 302 → /
	- Result: PASS

User Bookings
- VAL-BOOK-001: Required fields
	- Steps: POST /user/book missing required fields
	- Expected: 302 → /user/book
	- Result: PASS
- BOOK-VAL-LOC-INVALID: Invalid coords
	- Steps: POST /user/book with (0,0)
	- Expected: 302 → /user/book
	- Result: PASS
- BOOK-VAL-TOWING-DROPOFF-INVALID: Bad dropoff coords
	- Steps: POST /user/book requiresTowing=on with invalid dropoff lat/lng
	- Expected: 302 → /user/book
	- Result: PASS
- BOOK-DETAILS-UNAUTHORIZED: Access control
	- Steps: Login as other user → GET /user/booking/:id
	- Expected: 302 → /user/dashboard
	- Result: PASS
- BOOK-CANCEL-INVALID-STATE: State guard
	- Steps: Login as owner, booking status=in-progress → POST /user/booking/:id/cancel
	- Expected: 302 → booking page
	- Result: PASS
- BOOK-RATE-VALIDATION: Missing rating
	- Steps: POST /user/booking/:id/rate without rating
	- Expected: 400 JSON
	- Result: PASS
- BOOK-RATE-NOT-ALLOWED: Not completed/paid
	- Steps: POST /user/booking/:id/rate when status/payment not complete
	- Expected: 400 JSON
	- Result: PASS

Payments (Validation)
- VAL-PAY-001: Invalid booking id (GET)
	- Steps: GET /payment/not-an-id unauthenticated
	- Expected: 302 → /auth/login
	- Result: PASS
- VAL-PAY-004: Invalid booking id (POST)
	- Steps: Login as user → POST /payment/not-an-id/process
	- Expected: 400 JSON
	- Result: PASS

---

## Async Test Cases (PASS)

Auth + OTP (email + OTP mocked)
- AUTH-REGISTER-OTP-FLOW: Register then verify
	- Steps: POST /auth/register → POST /auth/verify-otp with correct OTP
	- Expected: 302 → /auth/verify-otp then 302 → /auth/login; user created
	- Result: PASS
- OTP-VERIFY-INVALID: Wrong OTP
	- Steps: POST /auth/verify-otp with wrong code
	- Expected: 302 → /auth/verify-otp
	- Result: PASS

Payments (Stripe mocked)
- PAYMENT-PROCESS-OK: Booking payment success
	- Steps: Login → create completed booking with pending payment → POST /payment/:id/process
	- Expected: 200 JSON { success: true }
	- Result: PASS
- SUBSCRIPTION-PREMIUM-OK: Monthly plan success
	- Steps: Login → POST /payment/premium/process with plan=monthly
	- Expected: 200 JSON { success: true }
	- Result: PASS

---

Total: 20 tests passing across 6 suites.
