"""
database/seed/seed_data.py
Populates PostgreSQL / SQLite database with cleaned fashion catalog and demo users.
"""

import os
import sys
import time
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import pandas as pd
from backend.common.database import engine, SessionLocal, init_db
from backend.common.models import Product, User, UserInteraction, SavedOutfit, OutfitItem

def seed_database(limit_products: int = 5000):
    print("=" * 60)
    print("SEEDING FASHION RECOMMENDATION DATABASE")
    print("=" * 60)
    
    init_db()
    db = SessionLocal()
    
    # 1. Seed Demo Users
    print("\n[1/3] Seeding Demo Users...")
    demo_users = [
        {"user_id": "user_demo_01", "email": "alex@fashion.ai", "full_name": "Alex Taylor", "age": 28},
        {"user_id": "user_demo_02", "email": "sam@fashion.ai", "full_name": "Samantha Green", "age": 34},
        {"user_id": "user_fashionista", "email": "chloe@fashion.ai", "full_name": "Chloe Bennett", "age": 24}
    ]
    
    for u_data in demo_users:
        existing = db.query(User).filter(User.user_id == u_data["user_id"]).first()
        if not existing:
            user = User(**u_data)
            db.add(user)
    db.commit()
    print(f"Ensured {len(demo_users)} demo users in database.")
    
    # 2. Seed Products from Cleaned Parquet
    print(f"\n[2/3] Seeding Catalog Products (Sample: {limit_products:,} items)...")
    parquet_path = PROJECT_ROOT / "data" / "processed" / "hm_articles_cleaned.parquet"
    assert parquet_path.exists(), f"Processed catalog missing: {parquet_path}"
    
    df_articles = pd.read_parquet(parquet_path)
    
    # Take active items with verified images across categories
    active_with_images = df_articles[df_articles["has_image"] == 1].copy()
    if len(active_with_images) > limit_products:
        sample_df = active_with_images.sample(n=limit_products, random_state=42)
    else:
        sample_df = active_with_images
        
    existing_count = db.query(Product).count()
    if existing_count >= limit_products:
        print(f"Products already populated ({existing_count:,} items in DB). Skipping.")
    else:
        # Batch insert
        products_to_add = []
        for _, row in sample_df.iterrows():
            ig = str(row.get("index_group_name", "")).strip()
            idx = str(row.get("index_name", "")).strip()
            sec = str(row.get("section_name", "")).strip()
            if ig == 'Baby/Children' or 'children' in idx.lower() or 'baby' in idx.lower():
                g = 'Kids'
            elif ig == 'Menswear' or 'men ' in sec.lower() or 'menswear' in idx.lower() or sec.lower().startswith('men'):
                g = 'Men'
            elif ig == 'Ladieswear' or 'ladies' in idx.lower() or 'lingeries' in idx.lower() or 'ladies' in sec.lower():
                g = 'Women'
            elif ig == 'Sport' or idx == 'Sport':
                g = 'Unisex'
            elif ig == 'Divided':
                g = 'Men' if 'men' in sec.lower() else 'Women'
            else:
                g = 'Unisex'

            prod = Product(
                article_id=str(row["article_id"]),
                prod_name=str(row["prod_name"]),
                product_type_name=str(row["product_type_name"]),
                product_group_name=str(row["product_group_name"]),
                standard_category=str(row["standard_category"]),
                colour_group_name=str(row["colour_group_name"]),
                perceived_colour_value_name=str(row.get("perceived_colour_value_name", "")),
                department_name=str(row.get("department_name", "")),
                index_name=idx,
                section_name=sec,
                gender=g,
                detail_desc=str(row.get("detail_desc_clean", "")),
                price_cents=2999,
                image_path=str(row.get("image_path", "")),
                has_image=bool(row.get("has_image", 1)),
                is_active=True
            )
            products_to_add.append(prod)
            
        db.bulk_save_objects(products_to_add)
        db.commit()
        print(f"Successfully seeded {len(products_to_add):,} products into database!")
        
    # 3. Seed Initial User Interactions & Saved Outfit
    print("\n[3/3] Seeding Demo Interactions & Saved Look...")
    test_user_id = "user_demo_01"
    first_products = db.query(Product).filter(Product.has_image == True).limit(5).all()
    
    if first_products:
        for p in first_products[:3]:
            interaction = UserInteraction(
                user_id=test_user_id,
                article_id=p.article_id,
                interaction_type="view",
                context="catalog"
            )
            db.add(interaction)
            
        # Like the first item
        like_interaction = UserInteraction(
            user_id=test_user_id,
            article_id=first_products[0].article_id,
            interaction_type="like",
            context="detail"
        )
        db.add(like_interaction)
        db.commit()
        print("Seeded demo user interactions.")
        
    db.close()
    print("=" * 60)
    print("DATABASE SEEDING COMPLETED SUCCESSFULLY (100% OK)")
    print("=" * 60)

if __name__ == "__main__":
    seed_database()
