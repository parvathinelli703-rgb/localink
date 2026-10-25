-- ============================================================
-- Localink MySQL 8 Schema (MVP) - Production Ready
-- ============================================================

CREATE DATABASE IF NOT EXISTS localink
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE localink;

-- ------------------------------------------------------------
-- Users (customers + providers + admin)
-- ------------------------------------------------------------
CREATE TABLE users (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NULL,
  full_name       VARCHAR(150) NOT NULL,
  phone           VARCHAR(20) NULL,
  role            ENUM('customer','provider','admin') NOT NULL DEFAULT 'customer',
  avatar_url      VARCHAR(500) NULL,
  is_verified     TINYINT(1) NOT NULL DEFAULT 0,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at   DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_users_role (role),
  INDEX idx_users_email (email)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Providers
-- ------------------------------------------------------------
CREATE TABLE providers (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id             BIGINT UNSIGNED NOT NULL UNIQUE,
  business_name       VARCHAR(200) NULL,
  bio                 TEXT NULL,
  experience_years    TINYINT UNSIGNED NULL,
  is_online           TINYINT(1) NOT NULL DEFAULT 0,
  is_approved         TINYINT(1) NOT NULL DEFAULT 0,
  location            POINT NOT NULL SRID 4326,
  address             VARCHAR(500) NULL,
  service_radius_km   DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  rating_avg          DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  rating_count        INT UNSIGNED NOT NULL DEFAULT 0,
  completed_jobs      INT UNSIGNED NOT NULL DEFAULT 0,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_providers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  SPATIAL INDEX idx_providers_location (location),
  INDEX idx_providers_online_approved (is_online, is_approved)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Categories & Services
-- ------------------------------------------------------------
CREATE TABLE categories (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  slug        VARCHAR(100) NOT NULL UNIQUE,
  icon        VARCHAR(100) NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  sort_order  INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE services (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id   BIGINT UNSIGNED NOT NULL,
  name          VARCHAR(150) NOT NULL,
  description   TEXT NULL,
  base_price    DECIMAL(10,2) NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  
  CONSTRAINT fk_services_category FOREIGN KEY (category_id) REFERENCES categories(id),
  INDEX idx_services_category (category_id)
) ENGINE=InnoDB;

CREATE TABLE provider_services (
  provider_id   BIGINT UNSIGNED NOT NULL,
  service_id    BIGINT UNSIGNED NOT NULL,
  price         DECIMAL(10,2) NULL,
  PRIMARY KEY (provider_id, service_id),
  
  CONSTRAINT fk_ps_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
  CONSTRAINT fk_ps_service  FOREIGN KEY (service_id)  REFERENCES services(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Requests
-- ------------------------------------------------------------
CREATE TABLE requests (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id     BIGINT UNSIGNED NOT NULL,
  service_id      BIGINT UNSIGNED NOT NULL,
  title           VARCHAR(200) NOT NULL,
  description     TEXT NULL,
  location        POINT NOT NULL SRID 4326,
  address         VARCHAR(500) NOT NULL,
  preferred_time  DATETIME NULL,
  budget_max      DECIMAL(10,2) NULL,
  status          ENUM(
                    'searching',
                    'accepted',
                    'on_the_way',
                    'in_progress',
                    'completed',
                    'cancelled',
                    'expired'
                  ) NOT NULL DEFAULT 'searching',
  expires_at      DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_requests_customer FOREIGN KEY (customer_id) REFERENCES users(id),
  CONSTRAINT fk_requests_service  FOREIGN KEY (service_id)  REFERENCES services(id),
  SPATIAL INDEX idx_requests_location (location),
  INDEX idx_requests_status (status),
  INDEX idx_requests_customer (customer_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Bookings
-- ------------------------------------------------------------
CREATE TABLE bookings (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  request_id      BIGINT UNSIGNED NOT NULL UNIQUE,
  provider_id     BIGINT UNSIGNED NOT NULL,
  customer_id     BIGINT UNSIGNED NOT NULL,
  status          ENUM(
                    'accepted',
                    'on_the_way',
                    'in_progress',
                    'completed',
                    'cancelled'
                  ) NOT NULL DEFAULT 'accepted',
  started_at      DATETIME NULL,
  completed_at    DATETIME NULL,
  cancelled_at    DATETIME NULL,
  cancel_reason   VARCHAR(500) NULL,
  final_amount    DECIMAL(10,2) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_bookings_request  FOREIGN KEY (request_id)  REFERENCES requests(id),
  CONSTRAINT fk_bookings_provider FOREIGN KEY (provider_id) REFERENCES providers(id),
  CONSTRAINT fk_bookings_customer FOREIGN KEY (customer_id) REFERENCES users(id),
  INDEX idx_bookings_provider (provider_id),
  INDEX idx_bookings_status (status)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Messages
-- ------------------------------------------------------------
CREATE TABLE messages (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id    BIGINT UNSIGNED NOT NULL,
  sender_id     BIGINT UNSIGNED NOT NULL,
  body          TEXT NOT NULL,
  is_read       TINYINT(1) NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_messages_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_sender  FOREIGN KEY (sender_id)  REFERENCES users(id),
  INDEX idx_messages_booking (booking_id, created_at)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Reviews
-- ------------------------------------------------------------
CREATE TABLE reviews (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id    BIGINT UNSIGNED NOT NULL UNIQUE,
  reviewer_id   BIGINT UNSIGNED NOT NULL,
  provider_id   BIGINT UNSIGNED NOT NULL,
  rating        TINYINT UNSIGNED NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_reviews_booking  FOREIGN KEY (booking_id)  REFERENCES bookings(id),
  CONSTRAINT fk_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id),
  CONSTRAINT fk_reviews_provider FOREIGN KEY (provider_id) REFERENCES providers(id),
  INDEX idx_reviews_provider (provider_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Notifications
-- ------------------------------------------------------------
CREATE TABLE notifications (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  type          VARCHAR(50) NOT NULL,
  title         VARCHAR(200) NOT NULL,
  body          TEXT NULL,
  data          JSON NULL,
  is_read       TINYINT(1) NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notifications_user_unread (user_id, is_read)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Seed data
-- ------------------------------------------------------------
INSERT INTO categories (name, slug, sort_order) VALUES
('Plumbing', 'plumbing', 1),
('Electrical', 'electrical', 2),
('AC & Cooling', 'ac-cooling', 3),
('Appliance Repair', 'appliance-repair', 4),
('Carpentry', 'carpentry', 5);

INSERT INTO services (category_id, name, description, base_price) VALUES
(1, 'Leak Repair', 'Fix leaking pipes, faucets, etc.', 300.00),
(1, 'Drain Cleaning', 'Unclog drains and sewers', 400.00),
(2, 'Wiring & Switches', 'New wiring, switchboard work', 500.00),
(3, 'AC Installation', 'Split AC installation', 1500.00),
(3, 'AC Service', 'Gas refill, cleaning, repair', 800.00),
(4, 'Washing Machine Repair', 'Repair common washing machine issues', 600.00),
(5, 'Furniture Assembly', 'Assemble beds, tables, cupboards', 400.00);
