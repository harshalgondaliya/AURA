-- database/migrations/001_initial_schema.sql
-- Migration 001: Initial Relational Schema for AURA Fashion Platform
-- Idempotent schema initialization for PostgreSQL and SQLite

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    full_name VARCHAR(128),
    age INTEGER,
    club_member_status VARCHAR(32) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);

CREATE TABLE IF NOT EXISTS product_categories (
    id SERIAL PRIMARY KEY,
    category_code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(64) NOT NULL,
    standard_slot VARCHAR(32) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prod_categories_slot ON product_categories(standard_slot);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    article_id VARCHAR(16) UNIQUE NOT NULL,
    prod_name VARCHAR(128) NOT NULL,
    product_type_name VARCHAR(64) NOT NULL,
    product_group_name VARCHAR(64) NOT NULL,
    standard_category VARCHAR(32) NOT NULL,
    colour_group_name VARCHAR(64) NOT NULL,
    perceived_colour_value_name VARCHAR(64),
    department_name VARCHAR(64),
    index_name VARCHAR(64),
    section_name VARCHAR(64),
    gender VARCHAR(32) DEFAULT 'Unisex',
    detail_desc TEXT,
    price_cents INTEGER DEFAULT 2999,
    image_path VARCHAR(255),
    has_image BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_article_id ON products(article_id);
CREATE INDEX IF NOT EXISTS idx_products_gender ON products(gender);
CREATE INDEX IF NOT EXISTS idx_products_standard_category ON products(standard_category);
CREATE INDEX IF NOT EXISTS idx_products_colour ON products(colour_group_name);
CREATE INDEX IF NOT EXISTS idx_products_active_has_image ON products(is_active, has_image);

CREATE TABLE IF NOT EXISTS user_interactions (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    article_id VARCHAR(16) NOT NULL REFERENCES products(article_id) ON DELETE CASCADE,
    interaction_type VARCHAR(32) NOT NULL,
    session_id VARCHAR(64),
    context VARCHAR(64) DEFAULT 'feed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interactions_user ON user_interactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_article ON user_interactions(article_id);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON user_interactions(interaction_type);

CREATE TABLE IF NOT EXISTS saved_outfits (
    id SERIAL PRIMARY KEY,
    outfit_id VARCHAR(64) UNIQUE NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    outfit_name VARCHAR(128) DEFAULT 'My Fashion Look',
    anchor_article_id VARCHAR(16) REFERENCES products(article_id),
    compatibility_score REAL DEFAULT 0.95,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_saved_outfits_user ON saved_outfits(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS outfit_items (
    id SERIAL PRIMARY KEY,
    outfit_id VARCHAR(64) NOT NULL REFERENCES saved_outfits(outfit_id) ON DELETE CASCADE,
    article_id VARCHAR(16) NOT NULL REFERENCES products(article_id),
    slot VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_outfit_items_outfit ON outfit_items(outfit_id);
CREATE INDEX IF NOT EXISTS idx_outfit_items_article ON outfit_items(article_id);

CREATE TABLE IF NOT EXISTS recommendation_jobs (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(64) UNIQUE NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    anchor_article_id VARCHAR(16) NOT NULL,
    status VARCHAR(32) DEFAULT 'pending',
    result_json TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jobs_job_id ON recommendation_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON recommendation_jobs(status);
