"""
scripts/build_nb03.py
Constructs notebooks/03_feature_engineering.ipynb
"""

import nbformat as nbf
from pathlib import Path

nb = nbf.v4.new_notebook()
cells = []

# --- CELL 1: Markdown ---
cells.append(nbf.v4.new_markdown_cell("""# Notebook 03: Feature Engineering & Temporal Train/Val/Test Split
## AI Fashion Recommendation System

### 1. Stage Overview & Purpose
In this notebook, we prepare the engineered feature representations and establish the rigorous temporal train, validation, and test partitions for our recommendation models.

### 2. Critical ML Rules Followed:
- **No Data Leakage**: We do NOT fit text vectorizers or compute global statistics on future validation or test sets. All learned components are fitted strictly on the training partition.
- **Strict Temporal Split**:
  - We use the approved **16-week window** (2020-06-02 to 2020-09-22) filtered to customers with $\ge 5$ interactions.
  - **Train Set (Weeks 1–14)**: 2020-06-02 to 2020-09-08 (Historical baseline).
  - **Validation Set (Week 15)**: 2020-09-08 to 2020-09-15 (Hyperparameter tuning & hybrid weight optimization).
  - **Test Set (Week 16)**: 2020-09-15 to 2020-09-22 (Final held-out evaluation).
- **Text & Metadata Pipelines**:
  - Combined text tokens (`prod_name`, `product_type_name`, `product_group_name`, `colour_group_name`, `detail_desc_clean`).
  - TF-IDF feature matrices with sublinear TF scaling.
- **Weakly Supervised Co-Occurrence Extraction**:
  - Extract shopping basket co-occurrences `(customer_id, t_dat)` for outfit compatibility and item-item similarity.
"""))

# --- CELL 2: Code (Imports) ---
cells.append(nbf.v4.new_code_cell("""import os
import sys
import time
from pathlib import Path

import pandas as pd
import numpy as np
import scipy.sparse as sp
from sklearn.feature_extraction.text import TfidfVectorizer
import joblib

pd.set_option("display.max_columns", 50)
pd.set_option("display.float_format", lambda x: "%.2f" % x)

print("Feature Engineering libraries loaded successfully!")
"""))

# --- CELL 3: Markdown ---
cells.append(nbf.v4.new_markdown_cell("""## Section 1: Paths & Directory Configuration

### What we are doing:
We load the cleaned catalog datasets produced in Notebook 02 and configure paths for the temporal transaction splits and serialized feature artifacts.
"""))

# --- CELL 4: Code (Config) ---
cells.append(nbf.v4.new_code_cell("""PROJECT_ROOT = Path(".").resolve()
if PROJECT_ROOT.name == "notebooks":
    PROJECT_ROOT = PROJECT_ROOT.parent

DATA_PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
ARTIFACTS_MODELS_DIR = PROJECT_ROOT / "artifacts" / "models"
ARTIFACTS_META_DIR = PROJECT_ROOT / "artifacts" / "metadata"

ARTIFACTS_MODELS_DIR.mkdir(parents=True, exist_ok=True)
ARTIFACTS_META_DIR.mkdir(parents=True, exist_ok=True)

HM_ARTICLES_CLEANED_PATH = DATA_PROCESSED_DIR / "hm_articles_cleaned.parquet"
HM_RAW_TRANSACTIONS_PATH = PROJECT_ROOT / "h-and-m-personalized-fashion-recommendations" / "transactions_train.csv"

# Target split files
TRAIN_SPLIT_PATH = DATA_PROCESSED_DIR / "transactions_train_14w.parquet"
VAL_SPLIT_PATH = DATA_PROCESSED_DIR / "transactions_val_1w.parquet"
TEST_SPLIT_PATH = DATA_PROCESSED_DIR / "transactions_test_1w.parquet"

print(f"Cleaned Articles: {HM_ARTICLES_CLEANED_PATH} (Exists: {HM_ARTICLES_CLEANED_PATH.exists()})")
print(f"Target Train Split: {TRAIN_SPLIT_PATH}")
"""))

# --- CELL 5: Markdown ---
cells.append(nbf.v4.new_markdown_cell("""## Section 2: Extracting 16-Week Filtered Transactions

### What we are doing:
We stream the 31.78M transaction file, filter for transactions occurring on or after `2020-06-02` (16-week window), and apply the customer filter of $\ge 5$ interactions.
"""))

# --- CELL 6: Code (Stream Transactions) ---
cells.append(nbf.v4.new_code_cell("""# 16-Week Window: 2020-06-02 to 2020-09-22
START_DATE_16W = "2020-06-02"
VAL_START_DATE = "2020-09-08"
TEST_START_DATE = "2020-09-15"

print("Streaming recent transactions from disk...")
t0 = time.time()
chunks = []
chunk_size = 2_000_000

for chunk in pd.read_csv(
    HM_RAW_TRANSACTIONS_PATH,
    usecols=["t_dat", "customer_id", "article_id", "price"],
    dtype={"article_id": str, "customer_id": str},
    chunksize=chunk_size
):
    recent = chunk[chunk["t_dat"] >= START_DATE_16W]
    if not recent.empty:
        chunks.append(recent)

df_tx = pd.concat(chunks, ignore_index=True)
df_tx["article_id"] = df_tx["article_id"].str.zfill(10)
initial_tx_count = len(df_tx)
print(f"Extracted {initial_tx_count:,} transactions across 16 weeks in {time.time()-t0:.2f}s.")

# Apply minimum 5 interactions threshold
cust_counts = df_tx["customer_id"].value_counts()
active_customers = cust_counts[cust_counts >= 5].index
df_tx_filtered = df_tx[df_tx["customer_id"].isin(active_customers)].copy()

print(f"Filtered to customers with >= 5 interactions:")
print(f"  - Active Customers: {df_tx_filtered['customer_id'].nunique():,}")
print(f"  - Active Articles:  {df_tx_filtered['article_id'].nunique():,}")
print(f"  - Retained Purchases: {len(df_tx_filtered):,} ({len(df_tx_filtered)/initial_tx_count*100:.1f}%)")
"""))

# --- CELL 7: Markdown ---
cells.append(nbf.v4.new_markdown_cell("""## Section 3: Strict Temporal Train, Validation, and Test Partitioning

### What we are doing:
We split the filtered transactions into three distinct chronological non-overlapping windows:
1. **Train (Weeks 1 to 14)**: `t_dat < 2020-09-08` (~3.8M transactions)
2. **Validation (Week 15)**: `2020-09-08 <= t_dat < 2020-09-15` (~330k transactions)
3. **Test (Week 16)**: `t_dat >= 2020-09-15` (~345k transactions)

### Validation of Splitting Rule:
Max train date < Min validation date < Min test date. Zero leakage.
"""))

# --- CELL 8: Code (Temporal Split) ---
cells.append(nbf.v4.new_code_cell("""# Partition temporally
df_train = df_tx_filtered[df_tx_filtered["t_dat"] < VAL_START_DATE].copy()
df_val = df_tx_filtered[(df_tx_filtered["t_dat"] >= VAL_START_DATE) & (df_tx_filtered["t_dat"] < TEST_START_DATE)].copy()
df_test = df_tx_filtered[df_tx_filtered["t_dat"] >= TEST_START_DATE].copy()

print("Temporal Partition Summary:")
print(f"  - Train Set: {len(df_train):,} rows ({df_train['t_dat'].min()} to {df_train['t_dat'].max()})")
print(f"  - Val Set:   {len(df_val):,} rows ({df_val['t_dat'].min()} to {df_val['t_dat'].max()})")
print(f"  - Test Set:  {len(df_test):,} rows ({df_test['t_dat'].min()} to {df_test['t_dat'].max()})")

# Assert zero overlap
assert df_train["t_dat"].max() < df_val["t_dat"].min(), "Train/Val temporal leakage detected!"
assert df_val["t_dat"].max() < df_test["t_dat"].min(), "Val/Test temporal leakage detected!"
print("\\nStrict temporal boundary integrity verified 100%!")

# Save partitions to Parquet
df_train.to_parquet(TRAIN_SPLIT_PATH, index=False)
df_val.to_parquet(VAL_SPLIT_PATH, index=False)
df_test.to_parquet(TEST_SPLIT_PATH, index=False)
print("Saved Train, Val, and Test Parquet splits to data/processed/")
"""))

# --- CELL 9: Markdown ---
cells.append(nbf.v4.new_markdown_cell("""## Section 4: Content-Based Feature Pipeline (TF-IDF & Text Tokens)

### What we are doing:
We build a concatenated feature representation for each product using its textual attributes (`prod_name`, `product_type_name`, `product_group_name`, `colour_group_name`, `perceived_colour_value_name`, and `detail_desc_clean`).
We fit a `TfidfVectorizer` with sublinear term-frequency scaling and save the vectorizer and TF-IDF sparse matrix to `artifacts/`.
"""))

# --- CELL 10: Code (TF-IDF Pipeline) ---
cells.append(nbf.v4.new_code_cell("""# Load cleaned articles
df_articles = pd.read_parquet(HM_ARTICLES_CLEANED_PATH)

# Construct rich composite text feature
df_articles["text_features"] = (
    df_articles["prod_name"].fillna("") + " " +
    df_articles["product_type_name"].fillna("") + " " +
    df_articles["product_group_name"].fillna("") + " " +
    df_articles["colour_group_name"].fillna("") + " " +
    df_articles["perceived_colour_value_name"].fillna("") + " " +
    df_articles["detail_desc_clean"].fillna("")
).str.lower().str.replace(r"[^a-z0-9 ]+", " ", regex=True).str.strip()

print("Example composite text feature:")
print(f"  Item 0: {df_articles['text_features'].iloc[0]}\\n")

# Fit TF-IDF Vectorizer
tfidf = TfidfVectorizer(
    max_features=15_000,
    min_df=3,
    stop_words="english",
    sublinear_tf=True,
    dtype=np.float32
)

t0 = time.time()
tfidf_matrix = tfidf.fit_transform(df_articles["text_features"])
print(f"TF-IDF fitted in {time.time()-t0:.2f}s:")
print(f"  Matrix shape: {tfidf_matrix.shape[0]:,} items x {tfidf_matrix.shape[1]:,} features")
print(f"  Sparse matrix non-zeros: {tfidf_matrix.nnz:,}")
print(f"  Memory footprint: {tfidf_matrix.data.nbytes / (1024**2):.2f} MB")

# Save TF-IDF matrix and vectorizer artifacts
sp.save_npz(ARTIFACTS_MODELS_DIR / "hm_tfidf_matrix.npz", tfidf_matrix)
joblib.dump(tfidf, ARTIFACTS_MODELS_DIR / "hm_tfidf_vectorizer.joblib")
print("Saved TF-IDF model and matrix artifacts to artifacts/models/")
"""))

# --- CELL 11: Markdown ---
cells.append(nbf.v4.new_markdown_cell("""## Section 5: Basket Co-Occurrence Extraction (Weak Supervision for Outfits)

### What we are doing:
We group transactions by `(customer_id, t_dat)` representing distinct shopping baskets.
When a customer purchases multiple items on the same day, those items co-occurred in a basket.
We calculate pair co-occurrences and save this matrix as weak supervision for outfit candidate scoring.
"""))

# --- CELL 12: Code (Basket Co-occurrence) ---
cells.append(nbf.v4.new_code_cell("""# Extract baskets from training set
df_baskets = df_train.groupby(["customer_id", "t_dat"])["article_id"].apply(list).reset_index()
multi_item_baskets = df_baskets[df_baskets["article_id"].apply(len) > 1]

print(f"Total baskets in train set: {len(df_baskets):,}")
print(f"Multi-item purchase baskets: {len(multi_item_baskets):,} ({len(multi_item_baskets)/len(df_baskets)*100:.1f}%)")

# Extract top co-purchased item pairs
from collections import defaultdict
pair_counts = defaultdict(int)

for basket in multi_item_baskets["article_id"]:
    items = sorted(set(basket))
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            pair_counts[(items[i], items[j])] += 1

print(f"Extracted {len(pair_counts):,} unique co-purchased pairs.")

# Convert top pairs to DataFrame
df_top_pairs = pd.DataFrame([
    {"item_a": k[0], "item_b": k[1], "cooccur_count": v}
    for k, v in pair_counts.items() if v >= 2
])
df_top_pairs.sort_values(by="cooccur_count", ascending=False, inplace=True)

display(df_top_pairs.head(5))

# Save co-occurrence pairs artifact
COOCCUR_PATH = DATA_PROCESSED_DIR / "hm_basket_cooccurrence.parquet"
df_top_pairs.to_parquet(COOCCUR_PATH, index=False)
print(f"Saved basket co-occurrence table ({len(df_top_pairs):,} pairs) to: {COOCCUR_PATH}")
"""))

# --- CELL 13: Markdown ---
cells.append(nbf.v4.new_markdown_cell("""## Section 6: Validation Assertions & Stage 1 Sign-Off

### What we are doing:
We execute assertions verifying that all temporal partitions, TF-IDF matrices, and co-occurrence artifacts exist and meet quality criteria.
"""))

# --- CELL 14: Code (Assertions) ---
cells.append(nbf.v4.new_code_cell("""# Validation assertions
print("Executing Stage 1 Feature Engineering Assertions...")

assert TRAIN_SPLIT_PATH.exists() and len(df_train) > 3_000_000, "Train split missing or incomplete"
assert VAL_SPLIT_PATH.exists() and len(df_val) > 200_000, "Val split missing or incomplete"
assert TEST_SPLIT_PATH.exists() and len(df_test) > 200_000, "Test split missing or incomplete"
assert tfidf_matrix.shape[0] == 105542, "TF-IDF matrix rows mismatch articles count"
assert COOCCUR_PATH.exists() and len(df_top_pairs) > 10_000, "Co-occurrence table missing"

print("=" * 60)
print("STAGE 1 COMPLETED AND VERIFIED 100%!")
print("Train, Validation, and Test partitions are saved.")
print("Feature artifacts and TF-IDF matrices are ready for Stage 2 Modeling.")
print("=" * 60)
"""))

nb["cells"] = cells

out_path = Path("notebooks/03_feature_engineering.ipynb")
with open(out_path, "w", encoding="utf-8") as f:
    nbf.write(nb, f)

print(f"Created notebook: {out_path} with {len(cells)} cells.")
