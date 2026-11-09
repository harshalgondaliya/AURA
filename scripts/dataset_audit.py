"""
scripts/dataset_audit.py
Stage 0: Comprehensive Dataset Audit and Transaction Sampling Analysis
"""

import os
import sys
import time
import json
from pathlib import Path
import pandas as pd
import numpy as np

MYNTRA_PATH = Path("archive/Myntra Fasion Clothing.csv")
HM_DIR = Path("h-and-m-personalized-fashion-recommendations")
ARTICLES_PATH = HM_DIR / "articles.csv"
CUSTOMERS_PATH = HM_DIR / "customers.csv"
TRANSACTIONS_PATH = HM_DIR / "transactions_train.csv"
IMAGE_DIR = HM_DIR / "images"

print("=" * 70)
print("STAGE 0: DATASET AUDIT & SAMPLING ANALYSIS")
print("=" * 70)

# 1. MYNTRA DATASET AUDIT
print("\n[1/4] AUDITING MYNTRA CATALOG...")
t0 = time.time()
df_myntra = pd.read_csv(MYNTRA_PATH, low_memory=False)
myntra_rows, myntra_cols = df_myntra.shape
print(f"Myntra Shape: {myntra_rows:,} rows, {myntra_cols} columns ({time.time()-t0:.2f}s)")

myntra_audit = {
    "total_records": int(myntra_rows),
    "total_columns": int(myntra_cols),
    "unique_product_ids": int(df_myntra["Product_id"].nunique()),
    "duplicate_product_ids": int(df_myntra["Product_id"].duplicated().sum()),
    "columns": list(df_myntra.columns),
    "null_counts": {k: int(v) for k, v in df_myntra.isna().sum().items()},
    "null_percentages": {k: round(float(v) * 100 / myntra_rows, 2) for k, v in df_myntra.isna().sum().items()},
    "top_brands": df_myntra["BrandName"].value_counts().head(10).to_dict(),
    "top_categories": df_myntra["Category"].value_counts().head(10).to_dict(),
    "gender_categories": df_myntra["category_by_Gender"].value_counts().to_dict(),
    "price_summary": {
        "original_price_mean": round(float(df_myntra["OriginalPrice (in Rs)"].dropna().mean()), 2),
        "original_price_median": round(float(df_myntra["OriginalPrice (in Rs)"].dropna().median()), 2),
        "discount_price_mean": round(float(df_myntra["DiscountPrice (in Rs)"].dropna().mean()), 2),
        "discount_price_median": round(float(df_myntra["DiscountPrice (in Rs)"].dropna().median()), 2)
    }
}
print(f"  - Unique Product IDs: {myntra_audit['unique_product_ids']:,}")
print(f"  - Missing DiscountPrice: {myntra_audit['null_counts']['DiscountPrice (in Rs)']:,} ({myntra_audit['null_percentages']['DiscountPrice (in Rs)']}%)")
print(f"  - Missing Ratings: {myntra_audit['null_counts']['Ratings']:,} ({myntra_audit['null_percentages']['Ratings']}%)")

# 2. H&M ARTICLES & IMAGES AUDIT
print("\n[2/4] AUDITING H&M ARTICLES & IMAGE DIRECTORY...")
t0 = time.time()
df_articles = pd.read_csv(ARTICLES_PATH, dtype={"article_id": str})
df_articles["article_id"] = df_articles["article_id"].str.zfill(10)
art_rows, art_cols = df_articles.shape
print(f"H&M Articles Shape: {art_rows:,} rows, {art_cols} columns ({time.time()-t0:.2f}s)")

# Scan images
image_extensions = {".jpg", ".jpeg", ".png", ".webp"}
image_files = [p for p in IMAGE_DIR.rglob("*") if p.is_file() and p.suffix.lower() in image_extensions]
image_count = len(image_files)
image_stems = set(p.stem for p in image_files)
article_ids = set(df_articles["article_id"])
matched_images = len(image_stems.intersection(article_ids))

hm_art_audit = {
    "total_articles": int(art_rows),
    "total_columns": int(art_cols),
    "unique_articles": int(df_articles["article_id"].nunique()),
    "total_images_on_disk": int(image_count),
    "matched_article_images": int(matched_images),
    "image_coverage_pct": round(matched_images * 100.0 / art_rows, 2),
    "missing_images": int(art_rows - matched_images),
    "top_product_types": df_articles["product_type_name"].value_counts().head(10).to_dict(),
    "top_product_groups": df_articles["product_group_name"].value_counts().to_dict(),
    "top_colour_groups": df_articles["colour_group_name"].value_counts().head(10).to_dict(),
    "index_groups": df_articles["index_group_name"].value_counts().to_dict(),
    "null_counts": {k: int(v) for k, v in df_articles.isna().sum().items() if v > 0}
}
print(f"  - Total Images on Disk: {image_count:,}")
print(f"  - Matched Articles with Images: {matched_images:,} / {art_rows:,} ({hm_art_audit['image_coverage_pct']}%)")
print(f"  - Product Groups: {list(hm_art_audit['top_product_groups'].keys())[:5]}")

# 3. H&M CUSTOMERS AUDIT
print("\n[3/4] AUDITING H&M CUSTOMERS...")
df_customers = pd.read_csv(CUSTOMERS_PATH)
cust_rows, cust_cols = df_customers.shape
hm_cust_audit = {
    "total_customers": int(cust_rows),
    "unique_customers": int(df_customers["customer_id"].nunique()),
    "age_mean": round(float(df_customers["age"].dropna().mean()), 2),
    "age_median": round(float(df_customers["age"].dropna().median()), 2),
    "null_age": int(df_customers["age"].isna().sum()),
    "club_member_status": df_customers["club_member_status"].value_counts(dropna=False).to_dict()
}
print(f"  - Total Customers: {cust_rows:,}, Mean Age: {hm_cust_audit['age_mean']}")

# 4. H&M TRANSACTIONS AUDIT & SAMPLING ANALYSIS
print("\n[4/4] ANALYZING TRANSACTIONS & EVALUATING SAMPLING CONFIGURATIONS...")
print("Reading transaction timestamps and customer interactions...")

date_counts = {}
t0 = time.time()
total_tx = 0
chunk_size = 1_000_000

for chunk in pd.read_csv(TRANSACTIONS_PATH, usecols=["t_dat", "customer_id", "article_id"], dtype={"article_id": str}, chunksize=chunk_size):
    total_tx += len(chunk)
    vc = chunk["t_dat"].value_counts()
    for dt, cnt in vc.items():
        date_counts[dt] = date_counts.get(dt, 0) + cnt
    print(f"  Processed {total_tx:,} transactions...", end="\r")

print(f"\n  Total Transactions: {total_tx:,} (Completed in {time.time()-t0:.2f}s)")

all_dates = sorted(date_counts.keys())
min_date = all_dates[0]
max_date = all_dates[-1]
print(f"  Transaction Date Range: {min_date} to {max_date}")

max_dt = pd.to_datetime(max_date)
dt_12w_start = (max_dt - pd.Timedelta(weeks=12)).strftime("%Y-%m-%d")
dt_16w_start = (max_dt - pd.Timedelta(weeks=16)).strftime("%Y-%m-%d")
print(f"  12-Week Start Date: {dt_12w_start}")
print(f"  16-Week Start Date: {dt_16w_start}")

print("\nEvaluating 16-Week and 12-Week Transaction Windows...")
df_tx_recent = []
for chunk in pd.read_csv(TRANSACTIONS_PATH, usecols=["t_dat", "customer_id", "article_id", "price"], dtype={"article_id": str}, chunksize=chunk_size):
    recent_chunk = chunk[chunk["t_dat"] >= dt_16w_start]
    if not recent_chunk.empty:
        df_tx_recent.append(recent_chunk)

df_tx_16w = pd.concat(df_tx_recent, ignore_index=True)
df_tx_16w["article_id"] = df_tx_16w["article_id"].str.zfill(10)
df_tx_12w = df_tx_16w[df_tx_16w["t_dat"] >= dt_12w_start].copy()

print(f"  16-Week Total Transactions: {len(df_tx_16w):,}")
print(f"  12-Week Total Transactions: {len(df_tx_12w):,}")

comparisons = {}

for win_name, df_win in [("12_weeks", df_tx_12w), ("16_weeks", df_tx_16w)]:
    comparisons[win_name] = {}
    cust_counts = df_win["customer_id"].value_counts()
    
    for thresh in [1, 3, 5]:
        active_custs = cust_counts[cust_counts >= thresh].index
        df_filtered = df_win[df_win["customer_id"].isin(active_custs)]
        
        n_users = df_filtered["customer_id"].nunique()
        n_items = df_filtered["article_id"].nunique()
        n_interactions = len(df_filtered)
        density = (n_interactions / (n_users * n_items)) * 100 if (n_users * n_items) > 0 else 0
        mem_mb = df_filtered.memory_usage(deep=True).sum() / (1024 ** 2)
        sparsity = (1 - (n_interactions / (n_users * n_items))) * 100 if (n_users * n_items) > 0 else 100
        
        comparisons[win_name][f"min_interactions_{thresh}"] = {
            "users": int(n_users),
            "items": int(n_items),
            "interactions": int(n_interactions),
            "interaction_density_pct": round(float(density), 5),
            "sparsity_pct": round(float(sparsity), 4),
            "memory_mb": round(float(mem_mb), 2),
            "avg_interactions_per_user": round(float(n_interactions / n_users), 2) if n_users > 0 else 0,
            "avg_interactions_per_item": round(float(n_interactions / n_items), 2) if n_items > 0 else 0
        }
        print(f"  Config: {win_name.upper()} | Min {thresh} Interactions -> {n_users:,} Users | {n_items:,} Items | {n_interactions:,} Interactions | Density: {density:.4f}% | RAM: {mem_mb:.1f} MB")

full_audit = {
    "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    "myntra": myntra_audit,
    "hm_articles": hm_art_audit,
    "hm_customers": hm_cust_audit,
    "transactions_summary": {
        "total_transactions": int(total_tx),
        "min_date": min_date,
        "max_date": max_date,
        "12_week_start": dt_12w_start,
        "16_week_start": dt_16w_start,
    },
    "sampling_comparisons": comparisons
}

output_path = Path("reports/stage0_dataset_audit.json")
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(full_audit, f, indent=2)

print(f"\n[DONE] Stage 0 dataset audit saved to: {output_path}")
