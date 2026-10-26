# College Demonstration Checklist & Live Evaluation Script

This document serves as the official viva presentation script and manual testing checklist for the **Advanced Reliable Real Estate Portal**. It clearly distinguishes between **automated test verifications** (which have been run and verified) and **manual browser workflows** (which are to be performed during live demonstration).

---

## 📊 Summary of Verification Status

| Category | Verification Mode | Current Status | Notes |
|---|---|---|---|
| **Backend Test Suite** | Automated (`python manage.py test`) | **PASSED (87/87 tests)** | 100% passing across properties (63), accounts (13), and messaging (11) |
| **Frontend Production Build** | Automated (`npm run build`) | **PASSED (0 errors)** | Clean Vite bundle in ~17-23s |
| **Database Migrations** | Statically Checked | **VERIFIED** | All migrations applied without schema drift |
| **Live Interactive Browser Testing** | Manual Viva Session | **PENDING LIVE DEMO** | Requires starting the local MySQL daemon (`sudo service mysql start`) |

---

## 🛠️ Step 0: Pre-Demonstration Environment Setup

Before starting the presentation or viva demonstration, execute the following commands in separate terminals:

### 1. Start MySQL Service
```bash
sudo service mysql start
# Verify service is running:
service mysql status
```

### 2. Start Django Backend (Port 8000)
```bash
cd ~/Desktop/MYFIRSTPROJECT1/advanced-real-estate-portal/backend
source venv/bin/activate
python manage.py migrate
python manage.py runserver 8000
```
*Verify API health check in browser:* `http://127.0.0.1:8000/api/health/`

### 3. Start React Frontend (Port 5173)
```bash
cd ~/Desktop/MYFIRSTPROJECT1/advanced-real-estate-portal/frontend
npm run dev
```
*Open in browser:* `http://localhost:5173/`

### 4. Provision Administrator Account (One-time)
If not already present in the database, provision the admin account via the Django shell:
```bash
cd ~/Desktop/MYFIRSTPROJECT1/advanced-real-estate-portal/backend
source venv/bin/activate
python manage.py shell -c "from accounts.models import User; u, _ = User.objects.get_or_create(email='admin@demo.com', defaults={'username': 'admin'}); u.set_password('AdminDemo123'); u.role = 'ADMIN'; u.is_staff = True; u.is_superuser = True; u.save(); print('Admin ready: admin@demo.com')"
```

---

## 📋 Comprehensive Demonstration Checklist

### Check 1: Starting MySQL and Backend Server
- [x] **Automated Verification:** Django settings configured for MySQL with fallback SQLite test runner.
- [ ] **Manual Browser Action (Pending Live Demo):** Start MySQL daemon (`sudo service mysql start`) and run `python manage.py runserver 8000`. Navigate to `http://127.0.0.1:8000/api/health/` and confirm JSON response `{"status": "ok"}`.

### Check 2: Starting React Frontend
- [x] **Automated Verification:** `npm run build` succeeds cleanly (`✓ built in ~17-23s`).
- [ ] **Manual Browser Action (Pending Live Demo):** Run `npm run dev` in `frontend/`. Navigate to `http://localhost:5173/` and confirm the landing page renders with hero section, search bar, and navigation links.

### Check 3: Registering and Logging In
- [x] **Automated Verification:** Covered by `AuthenticationTests` in `accounts/tests.py` (unique username generation, password hashing, JWT claim generation).
- [ ] **Manual Browser Action (Pending Live Demo):**
  1. Click **Register** on the Navbar.
  2. Fill in registration form (e.g. `buyer1@test.com` / `Password123`).
  3. Submit and verify automatic redirect to Login.
  4. Log in and verify that the user profile dropdown displays the user icon and email in the Navbar.

### Check 4: Creating a Property as a Normal User
- [x] **Automated Verification:** Verified by `PropertyAPITests` in `properties/tests.py` (auto-assigns `owner=request.user` and forces `verification_status='PENDING'`).
- [ ] **Manual Browser Action (Pending Live Demo):**
  1. Click **+ Add Property** (or navigate to `/properties/new`).
  2. Fill out property form:
     - Title: "Modern 3BHK Greenview Apartment"
     - Property Type: `APARTMENT` (confirm bedrooms, bathrooms, and parking fields appear).
     - Listing Type: `SALE`
     - Price: `8500000` | Area: `1850`
     - Contact Phone: `+91 98765 43210`
     - Address: "Plot 12, Jubilee Hills", City: "Hyderabad", State: "Telangana", Pincode: "500033".
  3. Submit the listing and verify redirect to `/properties/<id>`.

### Check 5: Confirming New Listing Remains Pending
- [x] **Automated Verification:** Verified by `test_public_search_hides_pending` and `MyPropertiesDashboardTests`.
- [ ] **Manual Browser Action (Pending Live Demo):**
  1. As the logged-in owner, observe that the property details page shows the `PENDING` badge.
  2. Open an Incognito window (unauthenticated) and visit `http://localhost:5173/properties`.
  3. Search for "Modern 3BHK Greenview Apartment" and confirm the property **does not appear** in public listings.

### Check 6: Approving a Property as an Admin
- [x] **Automated Verification:** Verified by `test_admin_can_approve_property` in `properties/tests.py`.
- [ ] **Manual Browser Action (Pending Live Demo):**
  1. Log out of the user account and log in as `admin@demo.com` (`AdminDemo123`).
  2. Note the **Admin Dashboard** link appears in the Navbar with shield icon `🛡️`.
  3. Click **Admin Dashboard** (`/admin`) and locate the pending property in the moderation queue.
  4. Click **Approve**. Confirm the status changes to `APPROVED`.

### Check 7: Confirming Approved Properties Appear in Public Browsing
- [x] **Automated Verification:** Verified by `test_public_browsing` in `properties/tests.py`.
- [ ] **Manual Browser Action (Pending Live Demo):**
  1. In the Incognito window or public browser session, refresh `http://localhost:5173/properties`.
  2. Confirm "Modern 3BHK Greenview Apartment" now appears in the search results and listing grid.

### Check 8: Checking Verification Badges
- [x] **Automated Verification:** Verified by `test_verification_status_values_for_badge_rendering`.
- [ ] **Manual Browser Action (Pending Live Demo):**
  1. On the property card in `/properties`, verify the prominent green **Verified** badge.
  2. Click into the property details page and verify the green **Verified** badge alongside the listing type and status.

### Check 9: Uploading Images & Selecting a Primary Image (T-03)
- [x] **Automated Verification:** Verified by 11 tests in `PropertyImageTests` (upload, 5 MB size limit, atomic mutual exclusivity, serializer ordering).
- [ ] **Manual Browser Action (Pending Live Demo):**
  1. Log in as the property owner and open the property details page.
  2. Scroll to the **Property Image Manager** at the bottom of the page.
  3. Upload 2 or 3 distinct property images.
  4. Notice the first uploaded image has a **★ Primary** badge.
  5. On another uploaded image, click the **Set as Primary** button.
  6. Confirm the button shows a loading spinner, then switches to the active primary badge.
  7. Confirm the hero image at the top of the details page and thumbnail cards on `/properties` immediately reflect the new primary image.

### Check 10: Checking Contact Phone, Call, and WhatsApp Actions
- [x] **Automated Verification:** Verified by `PropertyContactPhoneTests` (format validation, E.164 conversion, unauthorized modification blocks).
- [ ] **Manual Browser Action (Pending Live Demo):**
  1. Open the property details page as any visitor.
  2. Inspect the **Contact Owner** section.
  3. Hover over / click **Call Owner**: confirm it opens `tel:+919876543210`.
  4. Hover over / click **WhatsApp**: confirm it links to `https://wa.me/919876543210`.

### Check 11: Checking My Properties Dashboard (T-02)
- [x] **Automated Verification:** Verified by 7 tests in `MyPropertiesDashboardTests` (`?my_properties=true` query parameter, status counters, status inclusion).
- [ ] **Manual Browser Action (Pending Live Demo):**
  1. Log in as an owner and click **My Properties** in the Navbar or user dropdown (`/my-properties`).
  2. Confirm the tabs show accurate live counts: `All Listings`, `Approved`, `Pending Verification`, `Rejected`.
  3. Click through each tab and confirm matching listings are filtered dynamically.
  4. Confirm each card displays verification badge, price, specs, and direct **View Details** and **Edit Property** buttons.

### Check 12: Confirming Users Cannot Access Other Users' Private Listings
- [x] **Automated Verification:** Verified by `test_user_cannot_retrieve_another_users_private_listings` and `test_supplying_another_owner_id_does_not_bypass_ownership_filtering`.
- [ ] **Manual Browser Action (Pending Live Demo):**
  1. Create a second user account (`buyer2@test.com`).
  2. Navigate to `/my-properties` as `buyer2` and confirm none of `buyer1`'s pending or rejected properties appear.
  3. Attempt to access `http://localhost:5173/properties/<pending_id>` directly while logged in as `buyer2`: confirm an error / 404 message is displayed.

### Check 13: Testing In-App Messaging
- [x] **Automated Verification:** Verified by 11 tests in `MessagingTests` (self-messaging block, unauthorized thread access, spoofing prevention).
- [ ] **Manual Browser Action (Pending Live Demo):**
  1. As `buyer2@test.com`, open `buyer1`'s approved property.
  2. Click **Message Owner**.
  3. Type and send: "Hello, is this property available for a site visit this Saturday?".
  4. Open `/messages` in the Navbar and verify the thread exists with full message history.
  5. Log in as `buyer1` and navigate to `/messages`: confirm the inquiry from `buyer2` is visible and reply.

---

## 🔍 Viva Troubleshooting Quick-Reference

| Symptom | Probable Cause | Immediate Remediation |
|---|---|---|
| `OperationalError: (2002, "Can't connect to local MySQL server")` | MySQL daemon is stopped | Run `sudo service mysql start` in terminal |
| Admin Dashboard redirects to `/properties` | Account was created with standard `createsuperuser` without `role='ADMIN'` | Run Django shell: `u = User.objects.get(email='admin@demo.com'); u.role = 'ADMIN'; u.save()` |
| Property cards show broken image icons | Media files not found or relative URLs | The app provides automatic SVG placeholders; verify `MEDIA_URL` is configured in `settings.py` |
| Image upload fails with 400 Bad Request | Image exceeds 5 MB size limit | Upload an image smaller than 5 MB |
| Commercial Shop creation fails | Bathrooms count missing | Commercial shops require bathrooms to be specified (enter `0` if none) |

---
**End of Demonstration Checklist.**
