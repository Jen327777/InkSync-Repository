# InkSync

InkSync is a web-based order management system for a printing business. It lets staff log customer orders, track them through production, and lets admins manage staff accounts and view revenue reports.

## Team

| Member | Role |
|---|---|
| Geraldine | Frontend |
| Jen Villareal | Backend |
| Joshua | QA and Documentation |

Developed using the Agile methodology (sprints 0 to 5).

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript (vanilla), Bootstrap 5.3.3 (loaded from a CDN, so an internet connection is needed)
- **Backend:** PHP 8.1 (PDO)
- **Database:** MySQL / MariaDB
- **Local server:** XAMPP (Apache + MySQL)
- **API testing:** Postman

## Features

- Login and logout with two roles: **Admin** and **Staff**
- **Order Tracking Board** with four stages: Pending, Approved, In Production, Completed (auto-refreshes every 10 seconds)
- **Log New Order** form with validation, discounts, delivery option, custom services, and live total preview
- **Order Logs** to view, filter, and edit orders
- **Revenue & Reports** (daily revenue, monthly revenue, order volume)
- **User Management** to create staff accounts and deactivate them
- **Profile** view

## Project Structure

```
InkSync-Repository/
├── backend/
│   ├── api/            # API endpoints (authentication, orders, users, dashboard)
│   ├── config/         # Database configuration
│   └── middleware/     # Authentication and CSRF protection
├── database/
│   └── schema.sql      # Database structure
├── frontend/
│   ├── assets/
│   ├── css/
│   ├── html/           # login.html, dashboard.html, create-staff.html
│   ├── js/
│   └── index.html
├── scripts/
│   └── create-user.php # Command-line tool to create admin or staff accounts
├── InkSync API Testing.postman_collection.json
└── README.md
```

## Requirements

- [XAMPP](https://www.apachefriends.org/) with PHP 8.1 or newer (includes Apache, MySQL, and phpMyAdmin)
- A web browser (Chrome, Edge, or Firefox)
- Internet connection (for Bootstrap)
- Git (to clone the repository)
- Postman (optional, for API testing)

## Setup Instructions

### 1. Get the project

```bash
git clone https://github.com/Jen327777/InkSync-Repository.git
```

To test the latest version before final release, use the testing branch:

```bash
cd InkSync-Repository
git checkout integration-test
```

### 2. Put the project in XAMPP's `htdocs` folder

Copy the whole `InkSync-Repository` folder into the `htdocs` folder of your XAMPP installation (for example `C:\xampp\htdocs\`).

The folder name must stay `InkSync-Repository`, and the `backend` and `frontend` folders must remain side by side.

### 3. Start XAMPP

Open the XAMPP Control Panel and click **Start** next to both **Apache** and **MySQL**.

### 4. Create and import the database

1. Open [http://localhost/phpmyadmin](http://localhost/phpmyadmin).
2. Click **New** and create a database named `inksync_db`.
3. Select `inksync_db`, click the **Import** tab, choose `database/schema.sql`, and click **Go**.

### 5. Configure the database connection

Create a file named `backend/config/database.local.php` with the following content. These are the default XAMPP settings; change them if yours are different.

```php
<?php
declare(strict_types=1);

return [
    'host' => '127.0.0.1',
    'port' => 3306,
    'database' => 'inksync_db',
    'username' => 'root',
    'password' => ''
];
```

This file is private to each computer and is not uploaded to GitHub. Never commit real passwords.

### 6. Create a login account

Accounts are created from the command line. Open a terminal in the project folder and make sure PHP can be found. In Git Bash with XAMPP, for example:

```bash
export PATH="$PATH:/c/xampp/php"
```

(Use your own XAMPP location, such as `/e/xampp/php` if XAMPP is on drive E.)

Create an admin account:

```bash
php scripts/create-user.php admin
```

Then type a **username** and press Enter, then type a **password** and press Enter.

- Username: 3 to 50 characters (letters, numbers, dots, underscores, hyphens)
- Password: at least **12 characters**

To create a staff account, use `staff` instead of `admin`. Admins can also create staff accounts from the **User Management** page after logging in.

### 7. Open the system

Go to:

```
http://localhost/InkSync-Repository/frontend/html/login.html
```

Choose **Admin** or **Staff**, then log in with the account you created.

## API Testing (Postman)

1. Open Postman and click **Import**.
2. Select `InkSync API Testing.postman_collection.json`.
3. Run the requests against your local server (`http://localhost/InkSync-Repository/backend/api`).

## Git Workflow

| Branch | Purpose |
|---|---|
| `main` | Final, tested version for submission |
| `Villareal_Backend` | Backend development |
| `gege_FrontEnd` | Frontend development |
| `QA-and-Documentation` | Testing and documentation |
| `integration-test` | Combined build used for testing before merging to `main` |

Changes are tested on `integration-test` first. Only after testing passes is it merged into `main`.

