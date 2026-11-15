-- database/migrations/002_add_sizing_and_indexes.sql
-- Migration 002: Add Sizing Columns, Sizing Attributes & Performance Indexes
-- Safe column addition with existence checks

-- 1. Add sizing columns to products table if they do not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='sizes') THEN
        ALTER TABLE products ADD COLUMN sizes VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='size_type') THEN
        ALTER TABLE products ADD COLUMN size_type VARCHAR(32);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='size_system') THEN
        ALTER TABLE products ADD COLUMN size_system VARCHAR(32);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='availability_status') THEN
        ALTER TABLE products ADD COLUMN availability_status VARCHAR(32) DEFAULT 'supported_sizes';
    END IF;
END $$;

-- 2. Add selected_size column to outfit_items if it does not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='outfit_items' AND column_name='selected_size') THEN
        ALTER TABLE outfit_items ADD COLUMN selected_size VARCHAR(32);
    END IF;
END $$;

-- 3. Create sizing performance indices
CREATE INDEX IF NOT EXISTS idx_products_size_type ON products(size_type);
CREATE INDEX IF NOT EXISTS idx_products_gender_category ON products(gender, standard_category);
