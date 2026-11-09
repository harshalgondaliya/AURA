-- database/schema/schema.sql
-- Production PostgreSQL Relational Schema for AI Fashion Recommendation Platform

-- Enable UUID extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
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

-- 2. Product Categories Table
CREATE TABLE IF NOT EXISTS product_categories (
    id SERIAL PRIMARY KEY,
    category_code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(64) NOT NULL,
    standard_slot VARCHAR(32) NOT NULL, -- upper_body, lower_body, full_body, shoes, accessories, underwear
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prod_categories_slot ON product_categories(standard_slot);

-- 3. Products Table
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
    detail_desc TEXT,
    price_cents INTEGER DEFAULT 2999, -- integer representation of currency (e.g. $29.99 or Rs 2999)
    image_path VARCHAR(255),
    has_image BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_article_id ON products(article_id);
CREATE INDEX IF NOT EXISTS idx_products_standard_category ON products(standard_category);
CREATE INDEX IF NOT EXISTS idx_products_colour ON products(colour_group_name);
CREATE INDEX IF NOT EXISTS idx_products_active_has_image ON products(is_active, has_image);

-- 4. User Interactions Table (Views, Clicks, Likes, Dislikes, Purchases)
CREATE TABLE IF NOT EXISTS user_interactions (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    article_id VARCHAR(16) NOT NULL REFERENCES products(article_id) ON DELETE CASCADE,
    interaction_type VARCHAR(32) NOT NULL, -- view, like, save, click, dismiss, purchase
    session_id VARCHAR(64),
    context VARCHAR(64) DEFAULT 'feed', -- feed, similar, outfit, search
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interactions_user ON user_interactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_article ON user_interactions(article_id);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON user_interactions(interaction_type);

-- 5. Saved Outfits Table
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

-- 6. Outfit Items Table (Items composing a saved outfit)
CREATE TABLE IF NOT EXISTS outfit_items (
    id SERIAL PRIMARY KEY,
    outfit_id VARCHAR(64) NOT NULL REFERENCES saved_outfits(outfit_id) ON DELETE CASCADE,
    article_id VARCHAR(16) NOT NULL REFERENCES products(article_id),
    slot VARCHAR(32) NOT NULL, -- anchor, upper_body, lower_body, shoes, accessories
    item_score REAL DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(outfit_id, slot)
);

CREATE INDEX IF NOT EXISTS idx_outfit_items_outfit ON outfit_items(outfit_id);

-- 7. Asynchronous Recommendation Jobs Table
CREATE TABLE IF NOT EXISTS recommendation_jobs (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(64) UNIQUE NOT NULL,
    user_id VARCHAR(64),
    job_type VARCHAR(64) NOT NULL, -- personalized_feed, outfit_synthesis, batch_refresh
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    payload JSONB,
    result JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jobs_job_id ON recommendation_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON recommendation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_user ON recommendation_jobs(user_id, created_at DESC);

-- 8. Model Versions & Metadata Table
CREATE TABLE IF NOT EXISTS model_versions (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(64) NOT NULL,
    version_tag VARCHAR(32) NOT NULL,
    metrics JSONB,
    weights JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
