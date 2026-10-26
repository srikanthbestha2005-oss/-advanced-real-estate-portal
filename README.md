# Advanced Reliable Real Estate Portal

A production-ready, full-stack real estate web application built with **React**, **Django REST Framework (DRF)**, and **MySQL**. The platform connects property owners, prospective buyers/tenants, and administrators in a secure, role-governed marketplace emphasizing verified listings, direct communication, and ownership integrity.

---

## 📌 Project Overview & Problem Statement

In online real estate portals, reliability, verified listings, and direct communication are critical. Unmoderated platforms frequently suffer from spam listings, outdated information, duplicate usernames, and fraudulent contacts.

The **Advanced Reliable Real Estate Portal** solves these challenges through:
1. **Administrative Moderation:** New listings submitted by users or agents default to `PENDING` status and must be vetted and approved by an administrator before appearing in public searches.
2. **Verified Badge System:** Trust is communicated visually through a green `Verified` badge displayed strictly on admin-approved listings.
3. **Direct Contact Quick-Actions:** Each listing supports an owner-designated contact phone number with instant **Call Owner** (`tel:`) and **WhatsApp** (`https://wa.me/`) links.
4. **Dedicated "My Properties" Dashboard:** Authenticated owners can monitor all their listings across `APPROVED`, `PENDING`, and `REJECTED` states with tabbed filtering, status counters, and direct edit links.
5. **Primary Image Control:** Owners and admins can upload gallery images and select a designated primary image with atomic mutual exclusivity.
6. **In-App Messaging:** An integrated, secure buyer-to-owner conversation thread for property inquiries, negotiation, and inspection planning.
7. **Dynamic Property Type Fields:** Intelligently adapts form fields and validation based on property type (e.g. bedrooms hidden for plots and shops; bathrooms required for shops).

---

## 🛠️ Technology Stack

- **Frontend:**
  - **Framework:** React.js 18 (Vite build tool)
  - **Styling:** Tailwind CSS (responsive mobile-first design)
  - **Routing:** React Router DOM (v6)
  - **HTTP Client:** Axios (configured with automated JWT Bearer token request interceptor)
- **Backend:**
  - **Framework:** Python 3.10+, Django 5.x, Django REST Framework (DRF)
  - **Authentication:** Stateless JWT via `djangorestframework-simplejwt`
  - **Filtering & Search:** `django-filter` and DRF `SearchFilter` / `OrderingFilter`
  - **Image Processing:** `Pillow` (with 5 MB max file size validation)
  - **Database Driver:** `PyMySQL`
- **Database:**
  - **Production / Development:** MySQL 8.0+ (InnoDB, UTF8mb4)
  - **Automated Testing:** Isolated in-memory SQLite runner (`test_db.sqlite3`)

---

## 🏗️ Architecture & Database Models

The project follows a decoupled client-server architecture:
- **Client Tier:** React Single Page Application (SPA) running on port `5173`. Decodes JWT payloads to adapt navigation bars, edit controls, and role-specific dashboards (`USER`, `AGENT`, `ADMIN`).
- **API Tier:** Django REST API running on port `8000`. Acts as the authoritative source of truth, enforcing object-level permissions (`IsOwnerOrAdmin`, `IsAdminRoleOrReadOnly`) and validating all payloads.
- **Relational Schema:**
  - `accounts_user`: Custom user model with `email` as unique login identifier, automatic unique username generation, hashed password, and `role` (`USER`, `AGENT`, `ADMIN`).
  - `properties_property`: Listing records with FK to `accounts_user` (`owner`), price, area, location, dynamic specs, `contact_phone`, `status` (`ACTIVE`, `SOLD`, `RENTED`, `INACTIVE`), and `verification_status` (`PENDING`, `APPROVED`, `REJECTED`).
  - `properties_propertyimage`: Gallery images with FK to `properties_property`, `image`, `is_primary`, `is_active`, and `display_order`.
  - `messaging_conversation`: Thread connecting two participants (buyer and property owner) referencing a specific property.
  - `messaging_message`: Timestamped messages with read tracking within a conversation.
  - *Backend Model Capabilities:* Models and serializers also exist for `favorites_favorite`, `inquiries_inquiry`, and `notifications_notification`.

---

## 👥 User Roles & Permissions

| Role | Permissions & Capabilities |
|---|---|
| **`USER`** | Public registration default. Can browse approved listings, send messages to owners, submit new listings (created as `PENDING`), view personal listings on the My Properties dashboard, and manage images for their own properties. Cannot access `/admin` or approve listings. |
| **`AGENT`** | Real estate professional account. Has all user capabilities with distinct agent badge indication in navigation and profile dropdowns. |
| **`ADMIN`** | Platform administrator. Full access to the Admin Dashboard (`/admin`), can approve (`APPROVED`) or reject (`REJECTED`) pending listings, update listing statuses (`ACTIVE`, `INACTIVE`), edit or delete any listing, and manage all images across the platform. |

---

## 🔌 API Endpoints Reference

All API routes are prefixed with `/api/`.

### System & Health
- `GET /api/health/` — Returns API operational status: `{"status": "ok", "message": "Advanced Reliable Real Estate Portal API is running"}`.

### Authentication (`/api/auth/`)
- `POST /api/auth/register/` — Public registration (creates standard user with role `USER`, auto-generates unique username).
- `POST /api/auth/login/` — Authenticates credentials, returns `access` and `refresh` JWT tokens with user claims (`user_id`, `role`, `is_staff`).
- `POST /api/auth/token/refresh/` — Refreshes expired access tokens.

### Properties (`/api/properties/`)
- `GET /api/properties/` — Public listing of active and approved properties. Supports filtering by `search`, `city`, `state`, `property_type`, `listing_type`, `min_price`, `max_price`, `min_bedrooms`, and `ordering`.
- `GET /api/properties/?my_properties=true` — Dedicated authenticated owner dashboard endpoint. Returns **only** properties owned by `request.user` across all statuses (`APPROVED`, `PENDING`, `REJECTED`, `ACTIVE`, `INACTIVE`). Anonymous requests receive HTTP 401 Unauthorized.
- `POST /api/properties/` — Creates a listing (Auth required). Backend securely forces `owner = request.user` and `verification_status = 'PENDING'` for non-admins.
- `GET /api/properties/<id>/` — Retrieves listing details. Unapproved listings return 404 for non-owners/non-admins.
- `PATCH /api/properties/<id>/` — Updates listing (Owner or Admin only). Only Admins can modify `verification_status` or `status`.
- `DELETE /api/properties/<id>/` — Deletes listing (Owner or Admin only).

### Property Images (`/api/properties/<property_id>/images/`)
- `GET /api/properties/<property_id>/images/` — Lists gallery images for a property (public sees active; owner/admin sees all).
- `POST /api/properties/<property_id>/images/` — Uploads an image (Owner or Admin only; max file size 5 MB).
- `PATCH /api/properties/<property_id>/images/<id>/` — Updates image properties (e.g. `is_primary: true, is_active: true`). Setting an image as primary atomically unsets all other primary images for that property.
- `DELETE /api/properties/<property_id>/images/<id>/` — Removes image (Owner or Admin only).

### Messaging (`/api/messaging/`)
- `GET /api/messaging/conversations/` — Lists all conversations for the authenticated user.
- `POST /api/messaging/conversations/` — Initiates a conversation with a property owner.
- `GET /api/messaging/conversations/<id>/` — Retrieves conversation details.
- `GET /api/messaging/conversations/<id>/messages/` — Retrieves messages in a conversation.
- `POST /api/messaging/conversations/<id>/messages/` — Sends a message.

---

## ⚙️ Local Installation & Setup Guide

### 1. Prerequisites
- **Ubuntu Linux / macOS / Windows**
- **Python 3.10+** and `pip`
- **Node.js 18+** and `npm`
- **MySQL Server 8.0+**
- **Git**

---

### 2. Database Setup (MySQL)

1. Ensure the MySQL service daemon is running:
   ```bash
   sudo service mysql start
   # or on systemd: sudo systemctl start mysql
   ```
2. Log into MySQL and create the project database:
   ```bash
   mysql -u root -p
   ```
   ```sql
   CREATE DATABASE IF NOT EXISTS real_estate_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   EXIT;
   ```

---

### 3. Backend Setup (Django REST Framework)

1. Navigate to `backend/`:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Configure `.env` with your local database credentials:
   ```ini
   DB_NAME=real_estate_portal
   DB_USER=root
   DB_PASSWORD=your_actual_mysql_password
   DB_HOST=127.0.0.1
   DB_PORT=3306
   SECRET_KEY=django-insecure-your-secret-key-here
   DEBUG=True
   ```
5. Apply database migrations:
   ```bash
   python manage.py migrate
   ```
6. Start the Django development server on port `8000`:
   ```bash
   python manage.py runserver 8000
   ```
   Verify backend health: `http://127.0.0.1:8000/api/health/`

---

### 4. Admin Account Provisioning

> [!IMPORTANT]
> Standard Django `createsuperuser` defaults the `role` field on our custom `User` model to `'USER'`. Because this project uses strict role-based checks (`user.role == 'ADMIN'`) to secure the Admin Dashboard and approval endpoints, an administrator account must have `role='ADMIN'`.

Create an administrator account safely via the Django shell:
```bash
python manage.py shell -c "from accounts.models import User; u, _ = User.objects.get_or_create(email='admin@demo.com', defaults={'username': 'admin'}); u.set_password('AdminDemo123'); u.role = 'ADMIN'; u.is_staff = True; u.is_superuser = True; u.save(); print('Admin ready: admin@demo.com')"
```

---

### 5. Frontend Setup (React & Vite)

1. Open a new terminal and navigate to `frontend/`:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Access the web application at:
   **`http://localhost:5173`**

---

## 🧪 Automated Testing & Production Build

### Running Backend Regression Tests
The backend test suite contains **87 unit and integration tests** verifying authentication, authorization, ownership privacy, property moderation, image controls, phone validation, and messaging:

```bash
cd backend
source venv/bin/activate
python manage.py test
```

**Verified Test Results:**
- **Discovered & Executed:** 87 tests
- **Passed:** 87 tests (100% OK)
- **Failures / Errors:** 0
- **Execution Breakdown:**
  - `properties` app: 63 tests (moderation, filters, bathroom validation, contact phone, primary images, my properties dashboard)
  - `accounts` app: 13 tests (registration, unique usernames, JWT claims, role protections)
  - `messaging` app: 11 tests (conversation creation, recipient validation, isolation, spoofing protection)

*Note: Tests automatically execute against an isolated SQLite test database (`test_db.sqlite3`) and do not modify the MySQL database.*

### Running Frontend Production Build
To verify bundling, JSX syntax, and CSS:
```bash
cd frontend
npm run build
```
**Verified Build Output:** `✓ built in ~17-23s` with 0 syntax errors and 0 missing imports.

---

## 🛡️ Security & Business Logic Highlights

- **Ownership Integrity:** The backend overrides any incoming `owner` field on property submission with `request.user`. Client-supplied owner IDs are completely ignored.
- **Unapproved Visibility Guard:** Properties in `PENDING` or `REJECTED` status cannot be retrieved by unauthenticated visitors or other normal users via search, list, or direct URL.
- **My Properties Privacy:** `GET /api/properties/?my_properties=true` is strictly tied to `request.user`. Query parameters like `?owner=999` are disregarded, ensuring strict data isolation.
- **Primary Image Mutual Exclusivity:** Setting an image to `is_primary=True` executes inside a database transaction that atomically resets `is_primary=False` on all other images of that property.
- **Contact Phone Format Validation:** Enforces valid Indian mobile formats (10 digits starting with 6, 7, 8, or 9; allows optional `+91`, `91`, or `0` prefix, with optional hyphens/spaces).
- **Shop Bathroom Rule:** Commercial shops require explicit bathroom count declaration (allows `0` for shops without dedicated facilities, rejects omitted/null values).
- **Graceful Image Fallback:** If a property has no uploaded images or if an image link fails, an inline SVG placeholder is displayed automatically.

---

## 📋 Known Limitations & Future Enhancements

1. **Favorites Feature:** Backend models and serializers exist in `favorites/`, but the frontend card bookmark toggle is not yet wired to the backend API.
2. **Visit Scheduling:** The "Request Visit" button on property details displays an informative placeholder modal ("Request Visit feature coming soon!"). Direct in-app messaging, Call, and WhatsApp currently handle scheduling.
3. **Push Notifications:** Backend models exist in `notifications/`; real-time in-app notification toasts are planned for a subsequent release.
4. **Local Database Service:** When developing in headless or containerized sandbox environments, the MySQL daemon may be stopped by default. Running `sudo service mysql start` is required before live browser interactions.
