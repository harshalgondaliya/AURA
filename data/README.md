# Dataset Documentation

This directory contains data files for the AI Fashion Recommendation System.

## Directory Structure
- `data/raw/`: Original datasets. Kept untouched to ensure reproducibility.
- `data/processed/`: Cleaned, validated, and temporally partitioned subsets for modeling and API ingestion.

## Dataset Sources
1. **Myntra Fashion Clothing**:
   - Stored in `archive/Myntra Fasion Clothing.csv` (~526k products).
   - Used for text/metadata content-based filtering, price sensitivity, and Indian retail catalog representation.
2. **H&M Personalized Fashion Recommendations**:
   - Stored in `h-and-m-personalized-fashion-recommendations/`.
   - `articles.csv`: 105,542 articles with rich multi-level product hierarchies.
   - `images/`: 105,102 images (99.58% match with catalog articles).
   - `customers.csv`: 1.37M customer profiles.
   - `transactions_train.csv`: 31.78M purchase records spanning 2018-09-20 to 2020-09-22.

## Preprocessing & Temporal Partitioning Rules
- **No data leakage**: Training sets must strictly precede validation and testing sets chronologically.
- **Strict dataset separation**: Do not fabricate synthetic joins or merge H&M and Myntra IDs.
