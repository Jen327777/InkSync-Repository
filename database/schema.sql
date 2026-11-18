
CREATE DATABASE IF NOT EXISTS inksync_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE inksync_db;


-- ==========================================
-- SPRINT 1: USER AUTHENTICATION
-- ==========================================


CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    username VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(120) NULL,
    password_hash VARCHAR(255) NOT NULL,

    role ENUM('admin', 'staff')
        NOT NULL DEFAULT 'staff',

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- ==========================================
-- SPRINT 2: ORDER MANAGEMENT
-- ==========================================

CREATE TABLE IF NOT EXISTS orders (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    customer_name VARCHAR(120) NOT NULL,
    customer_email VARCHAR(150) NULL,
    customer_phone VARCHAR(30) NULL,

    order_channel VARCHAR(50) NOT NULL,
    service_type VARCHAR(80) NOT NULL,
    description TEXT NULL,

    quantity INT UNSIGNED NOT NULL,

    unit_price DECIMAL(12,2) NOT NULL,
    discount_amount DECIMAL(12,2)
        NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12,2) NOT NULL,

    due_date DATE NOT NULL,

    fulfillment_method ENUM(
        'pickup',
        'delivery'
    ) NOT NULL,

    delivery_address TEXT NULL,

    status ENUM(
        'pending',
        'approved',
        'in_production',
        'completed'
    ) NOT NULL DEFAULT 'pending',

completed_at DATETIME NULL DEFAULT NULL,


    created_by INT UNSIGNED NOT NULL,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_orders_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id),

    INDEX idx_orders_status (status),
    INDEX idx_orders_due_date (due_date)
);
