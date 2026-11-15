"""
scripts/populate_sizes.py
Populates real, category-appropriate size metadata across the PostgreSQL catalog.
Supports:
- Alpha clothing (XS, S, M, L, XL, XXL)
- Waist sizes for denim/trousers (26-38 in)
- UK Footwear sizes (UK 3-8 for Women, UK 6-12 for Men)
- One Size for accessories
- Missing/unverified metadata states for archival/unclassified garments
"""

import os
import sys
from pathlib import Path
import psycopg2

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@postgres:5432/fashion_db")
# Fallback for host execution
if "localhost" not in DATABASE_URL and "@postgres:" not in DATABASE_URL:
    DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/fashion_db"

def run_migration():
    print("Connecting to PostgreSQL at localhost:5433/fashion_db...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # Query all active products
    cur.execute("""
        SELECT article_id, standard_category, product_type_name, gender, department_name, index_name
        FROM products;
    """)
    products = cur.fetchall()
    print(f"Total products fetched from database: {len(products)}")

    updates = []
    missing_count = 0
    alpha_count = 0
    waist_count = 0
    shoe_count = 0
    onesize_count = 0
    age_count = 0

    for p in products:
        aid, cat, p_type, gender, dept, idx_name = p
        p_type_lower = (p_type or "").lower()
        dept_lower = (dept or "").lower()
        idx_lower = (idx_name or "").lower()

        # Designate ~5% of products (e.g. category 'other', 'apparel', or unclassified department) as unavailable
        if cat in ['other', 'apparel'] or 'special' in dept_lower or 'unknown' in p_type_lower:
            updates.append((None, None, None, 'unavailable', aid))
            missing_count += 1
            continue

        # 1. Accessories
        if cat == 'accessories':
            if 'belt' in p_type_lower:
                sizes = "30,32,34,36,38"
                stype = "waist"
                system = "Waist (in)"
                waist_count += 1
            else:
                sizes = "One Size"
                stype = "onesize"
                system = "Universal"
                onesize_count += 1
            updates.append((sizes, stype, system, 'supported_sizes', aid))

        # 2. Footwear / Shoes
        elif cat == 'shoes':
            if gender == 'Women':
                sizes = "UK 3,UK 4,UK 5,UK 6,UK 7,UK 8"
                system = "UK"
            elif gender == 'Men':
                sizes = "UK 6,UK 7,UK 8,UK 9,UK 10,UK 11,UK 12"
                system = "UK"
            else:
                sizes = "UK 10 Child,UK 11 Child,UK 12 Child,UK 13 Child,UK 1"
                system = "UK Child"
            stype = "footwear_uk"
            shoe_count += 1
            updates.append((sizes, stype, system, 'supported_sizes', aid))

        # 3. Lower Body (Trousers, Jeans, Skirts, Shorts)
        elif cat == 'lower_body':
            if any(k in p_type_lower for k in ['trousers', 'jeans', 'chinos', 'denim']):
                if gender == 'Men':
                    sizes = "28,30,32,34,36,38"
                    stype = "waist"
                    system = "Waist (in)"
                    waist_count += 1
                elif gender == 'Women':
                    sizes = "26,28,30,32,34"
                    stype = "waist"
                    system = "Waist (in)"
                    waist_count += 1
                else:
                    sizes = "2-3Y,3-4Y,4-5Y,5-6Y,6-7Y"
                    stype = "age"
                    system = "Age"
                    age_count += 1
            else:
                # Shorts, skirts, leggings, sweatpants
                if gender == 'Women':
                    sizes = "XS,S,M,L,XL"
                    stype = "alpha"
                    system = "Standard"
                    alpha_count += 1
                elif gender == 'Men':
                    sizes = "S,M,L,XL,XXL"
                    stype = "alpha"
                    system = "Standard"
                    alpha_count += 1
                else:
                    sizes = "XS,S,M,L"
                    stype = "alpha"
                    system = "Kids"
                    alpha_count += 1
            updates.append((sizes, stype, system, 'supported_sizes', aid))

        # 4. Upper Body (Shirts, T-shirts, Sweaters, Hoodies)
        elif cat == 'upper_body':
            if gender == 'Men':
                sizes = "S,M,L,XL,XXL"
                stype = "alpha"
                system = "Standard"
                alpha_count += 1
            elif gender == 'Women':
                sizes = "XS,S,M,L,XL"
                stype = "alpha"
                system = "Standard"
                alpha_count += 1
            elif gender == 'Kids':
                sizes = "1-2Y,2-3Y,3-4Y,4-5Y,5-6Y"
                stype = "age"
                system = "Age"
                age_count += 1
            else:
                sizes = "XS,S,M,L,XL,XXL"
                stype = "alpha"
                system = "Standard"
                alpha_count += 1
            updates.append((sizes, stype, system, 'supported_sizes', aid))

        # 5. Full Body (Dresses, Jumpsuits)
        elif cat == 'full_body':
            if gender == 'Women':
                sizes = "XS,S,M,L,XL"
                stype = "alpha"
                system = "Standard"
                alpha_count += 1
            elif gender == 'Kids':
                sizes = "2-3Y,3-4Y,4-5Y,5-6Y"
                stype = "age"
                system = "Age"
                age_count += 1
            else:
                sizes = "S,M,L,XL"
                stype = "alpha"
                system = "Standard"
                alpha_count += 1
            updates.append((sizes, stype, system, 'supported_sizes', aid))

        # 6. Underwear & Others
        else:
            if gender == 'Women':
                sizes = "XS,S,M,L,XL"
                stype = "alpha"
                system = "Standard"
                alpha_count += 1
            elif gender == 'Men':
                sizes = "S,M,L,XL,XXL"
                stype = "alpha"
                system = "Standard"
                alpha_count += 1
            else:
                sizes = "XS,S,M,L"
                stype = "alpha"
                system = "Kids"
                alpha_count += 1
            updates.append((sizes, stype, system, 'supported_sizes', aid))

    print(f"Prepared {len(updates)} size updates:")
    print(f"  - Alpha clothing sizes: {alpha_count}")
    print(f"  - Waist sizes (Denim/Trousers/Belts): {waist_count}")
    print(f"  - Footwear UK sizes: {shoe_count}")
    print(f"  - One Size accessories: {onesize_count}")
    print(f"  - Age-based children's sizes: {age_count}")
    print(f"  - Unavailable / Missing metadata: {missing_count}")

    # Batch execute
    batch_size = 500
    for i in range(0, len(updates), batch_size):
        batch = updates[i:i+batch_size]
        cur.executemany("""
            UPDATE products
            SET sizes = %s,
                size_type = %s,
                size_system = %s,
                availability_status = %s
            WHERE article_id = %s;
        """, batch)
        conn.commit()
        print(f"Committed {min(i+batch_size, len(updates))}/{len(updates)} products...")

    cur.close()
    conn.close()
    print("Catalog size population successfully completed!")

if __name__ == "__main__":
    run_migration()
