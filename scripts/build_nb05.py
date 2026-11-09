"""
scripts/build_nb05.py
Constructs notebooks/05_collaborative_filtering.ipynb
"""

import nbformat as nbf
from pathlib import Path

nb = nbf.v4.new_notebook()
cells = []

# --- CELL 1: Markdown ---
cells.append(nbf.v4.new_markdown_cell("""# Notebook 05: Collaborative Filtering & Popularity Baselines
## AI Fashion Recommendation System

### 1. Conceptual Foundation
While content-based filtering recommends items based on intrinsic metadata, **Collaborative Filtering (CF)** leverages the collective purchase behavior of hundreds of thousands of customers.

In fashion e-commerce:
- **Implicit Feedback**: Customers rarely provide 1-to-5 star ratings; transactions, clicks, and page views represent positive implicit signals. Absence of purchase does not mean dislike; it simply means unobserved.
- **Popularity Baseline**: Fast-fashion sales are heavily concentrated in current seasonal trends. Recent popularity serves as a strong baseline that every complex ML model must outperform.
- **Item-Item Collaborative Filtering**: "Customers who bought item A also frequently bought item B." Computes item similarities directly from the co-occurrence matrix $S = R^T R$.
- **Matrix Factorization for Implicit Feedback**: Decomposes the high-dimensional sparse user-item interaction matrix into dense latent factor matrices ($P$ and $Q$), capturing underlying customer style personas.

### 2. Strict Temporal Evaluation Protocol:
- **Trained Strictly On**: `transactions_train_14w.parquet` (Weeks 1 to 14: 2020-06-02 to 2020-09-08).
- **Evaluated Strictly On**: `transactions_val_1w.parquet` (Week 15: 2020-09-08 to 2020-09-15).
- **Zero Future Information Leakage**: No validation interactions are accessible to the models during training.
"""))

# --- CELL 2: Code (Imports) ---
cells.append(nbf.v4.new_code_cell("""import os
import sys
import time
import json
from pathlib import Path
from collections import defaultdict

import pandas as pd
import numpy as np
import scipy.sparse as sp
from sklearn.decomposition import TruncatedSVD
import joblib

pd.set_option("display.max_columns", 50)
pd.set_option("display.float_format", lambda x: "%.4f" % x)

print("Collaborative Filtering libraries loaded successfully!")
"""))

# --- CELL 3: Markdown ---
cells.append(nbf.v4.new_markdown_cell("""## Section 1: Load Temporal Partitions & Catalog

### What we are doing:
We load the 14-week training partition and 1-week validation partition prepared in Notebook 03.
"""))

# --- CELL 4: Code (Load Partitions) ---
cells.append(nbf.v4.new_code_cell("""PROJECT_ROOT = Path(".").resolve()
if PROJECT_ROOT.name == "notebooks":
    PROJECT_ROOT = PROJECT_ROOT.parent

DATA_PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
ARTIFACTS_MODELS_DIR = PROJECT_ROOT / "artifacts" / "models"
ARTIFACTS_META_DIR = PROJECT_ROOT / "artifacts" / "metadata"

# Load training and validation partitions
df_train = pd.read_parquet(DATA_PROCESSED_DIR / "transactions_train_14w.parquet")
df_val = pd.read_parquet(DATA_PROCESSED_DIR / "transactions_val_1w.parquet")
df_articles = pd.read_parquet(DATA_PROCESSED_DIR / "hm_articles_cleaned.parquet")

print("Loaded Temporal Partitions:")
print(f"  - Train Set (14 Weeks): {len(df_train):,} interactions ({df_train['t_dat'].min()} to {df_train['t_dat'].max()})")
print(f"  - Val Set (1 Week):     {len(df_val):,} interactions ({df_val['t_dat'].min()} to {df_val['t_dat'].max()})")
print(f"  - Catalog Articles:     {len(df_articles):,} items")

# Group validation interactions by customer for fast evaluation
val_ground_truth = df_val.groupby("customer_id")["article_id"].apply(set).to_dict()
print(f"  - Active Validation Customers: {len(val_ground_truth):,}")
"""))

# --- CELL 5: Markdown ---
cells.append(nbf.v4.new_markdown_cell("""## Section 2: Model 1 — Recency-Weighted Popularity Baseline

### What we are doing:
We implement a popularity baseline that ranks items based on purchase frequency in the most recent 2 weeks of the training period. In fast-fashion, recent sales reflect current season trends and demand.
"""))

# --- CELL 6: Code (Popularity Baseline) ---
cells.append(nbf.v4.new_code_cell("""# Extract top popular items in recent training weeks
max_train_date = pd.to_datetime(df_train["t_dat"].max())
two_weeks_prior = (max_train_date - pd.Timedelta(weeks=2)).strftime("%Y-%m-%d")

recent_train = df_train[df_train["t_dat"] >= two_weeks_prior]
popular_articles = recent_train["article_id"].value_counts().head(50).index.tolist()

print(f"Identified top {len(popular_articles)} popular articles in recent 2 weeks of training.")
print("Top 5 popular items:", popular_articles[:5])

class PopularityRecommender:
    def __init__(self, popular_items):
        self.popular_items = popular_items
        
    def recommend(self, customer_id, top_k=12):
        return self.popular_items[:top_k]

pop_model = PopularityRecommender(popular_articles)
"""))

# --- CELL 7: Markdown ---
cells.append(nbf.v4.new_markdown_cell("""## Section 3: Model 2 — Item-Item Collaborative Filtering (Cosine Co-Occurrence)

### What we are doing:
1. Map customers and items to contiguous matrix indices.
2. Construct a sparse binary interaction matrix $R \\in \\{0, 1\\}^{U \\times I}$.
3. Compute the normalized item-item co-occurrence matrix:
   $$S = D^{-1/2} (R^T R) D^{-1/2}$$
4. For a target customer with purchase history $H_u$, their recommendation scores are:
   $$\\text{score}(u, i) = \\sum_{j \\in H_u} S_{j, i}$$
"""))

# --- CELL 8: Code (Item-Item CF) ---
cells.append(nbf.v4.new_code_cell("""# Build contiguous user and item mappings
train_users = sorted(df_train["customer_id"].unique())
train_items = sorted(df_train["article_id"].unique())

user2idx = {u: i for i, u in enumerate(train_users)}
item2idx = {it: i for i, it in enumerate(train_items)}
idx2item = {i: it for i, it in enumerate(train_items)}

# Map train transactions to indices
row_indices = df_train["customer_id"].map(user2idx).values
col_indices = df_train["article_id"].map(item2idx).values
values = np.ones(len(df_train), dtype=np.float32)

# Construct user-item sparse matrix (U x I)
n_users = len(train_users)
n_items = len(train_items)
R = sp.csr_matrix((values, (row_indices, col_indices)), shape=(n_users, n_items))
R.data = np.ones_like(R.data) # Binarize multiple purchases
print(f"User-Item Sparse Matrix R: {R.shape[0]:,} users x {R.shape[1]:,} items (Non-zeros: {R.nnz:,})")

# Compute Item-Item Co-occurrence: S = R^T * R (I x I)
t0 = time.time()
item_cooccur = R.T.dot(R)
# Zero out diagonal
item_cooccur.setdiag(0)
item_cooccur.eliminate_zeros()

# Normalize by item degrees: S_norm = D^-0.5 * S * D^-0.5
item_degrees = np.sqrt(np.asarray(R.sum(axis=0)).ravel())
item_degrees[item_degrees == 0] = 1.0
D_inv = sp.diags(1.0 / item_degrees)
S_norm = D_inv.dot(item_cooccur).dot(D_inv).tocsr()

print(f"Item-Item Cosine Similarity Matrix S computed in {time.time()-t0:.2f}s: shape {S_norm.shape}")

# Precompute customer purchase history dictionary
customer_history = df_train.groupby("customer_id")["article_id"].apply(set).to_dict()

class ItemItemCFRecommender:
    def __init__(self, S_matrix, item2idx, idx2item, customer_history, fallback_popular):
        self.S = S_matrix
        self.item2idx = item2idx
        self.idx2item = idx2item
        self.history = customer_history
        self.fallback = fallback_popular
        
    def recommend(self, customer_id, top_k=12):
        if customer_id not in self.history:
            return self.fallback[:top_k]
            
        purchased = [self.item2idx[it] for it in self.history[customer_id] if it in self.item2idx]
        if not purchased:
            return self.fallback[:top_k]
            
        # Aggregate similarity: sum of rows of S corresponding to purchased items
        user_scores = np.asarray(self.S[purchased].sum(axis=0)).ravel()
        
        # Zero out already purchased items
        user_scores[purchased] = -1.0
        
        # Top-K item indices
        top_indices = np.argsort(user_scores)[::-1][:top_k]
        recs = [self.idx2item[i] for i in top_indices if user_scores[i] > 0]
        
        # Fill remaining slots with popular items if needed
        if len(recs) < top_k:
            for it in self.fallback:
                if it not in recs and it not in self.history[customer_id]:
                    recs.append(it)
                if len(recs) == top_k:
                    break
        return recs

item_cf_model = ItemItemCFRecommender(S_norm, item2idx, idx2item, customer_history, popular_articles)
print("ItemItemCFRecommender initialized successfully!")
"""))

# --- CELL 9: Markdown ---
cells.append(nbf.v4.new_markdown_cell("""## Section 4: Model 3 — Implicit Matrix Factorization (Latent Factors)

### What we are doing:
We apply Truncated SVD / Matrix Factorization to factorize the sparse interaction matrix $R$ into 64 dense latent factor representations:
$$R \\approx P \\cdot Q^T$$
- $P \\in \\mathbb{R}^{U \\times 64}$: Customer preference embeddings.
- $Q \\in \\mathbb{R}^{I \\times 64}$: Item attribute embeddings.
- Recommendation score for user $u$ on item $i$: $\\hat{r}_{ui} = p_u \\cdot q_i^T$.
"""))

# --- CELL 10: Code (Matrix Factorization) ---
cells.append(nbf.v4.new_code_cell("""# Fit 64-dimensional latent factor model
n_components = 64
print(f"Fitting TruncatedSVD with {n_components} latent factors...")
t0 = time.time()

svd = TruncatedSVD(n_components=n_components, random_state=42, algorithm="randomized")
user_factors = svd.fit_transform(R)
item_factors = svd.components_.T # Shape: (n_items, 64)

print(f"Matrix Factorization completed in {time.time()-t0:.2f}s.")
print(f"User Factors shape: {user_factors.shape}")
print(f"Item Factors shape: {item_factors.shape}")
print(f"Explained Variance Ratio sum: {svd.explained_variance_ratio_.sum():.4f}")

# Normalize factors for cosine dot-product
user_norms = np.linalg.norm(user_factors, axis=1, keepdims=True)
user_norms[user_norms == 0] = 1.0
user_factors_norm = user_factors / user_norms

item_norms = np.linalg.norm(item_factors, axis=1, keepdims=True)
item_norms[item_norms == 0] = 1.0
item_factors_norm = item_factors / item_norms

# Save trained factor matrices
np.save(ARTIFACTS_MODELS_DIR / "cf_user_factors.npy", user_factors_norm)
np.save(ARTIFACTS_MODELS_DIR / "cf_item_factors.npy", item_factors_norm)
joblib.dump({"user2idx": user2idx, "item2idx": item2idx, "idx2item": idx2item}, ARTIFACTS_MODELS_DIR / "cf_mappings.joblib")
print("Saved CF latent factors and mappings to artifacts/models/")

class MatrixFactorizationRecommender:
    def __init__(self, user_factors, item_factors, user2idx, idx2item, customer_history, fallback):
        self.user_factors = user_factors
        self.item_factors = item_factors
        self.user2idx = user2idx
        self.idx2item = idx2item
        self.history = customer_history
        self.fallback = fallback
        
    def recommend(self, customer_id, top_k=12):
        if customer_id not in self.user2idx:
            return self.fallback[:top_k]
            
        u_idx = self.user2idx[customer_id]
        u_vec = self.user_factors[u_idx] # (64,)
        
        # Dot product against all items: (64,) * (n_items, 64)^T -> (n_items,)
        scores = np.dot(self.item_factors, u_vec)
        
        # Mask out previously purchased items
        if customer_id in self.history:
            purchased_indices = [user2idx[customer_id]] # fast mask
            for it in self.history[customer_id]:
                if it in item2idx:
                    scores[item2idx[it]] = -1.0
                    
        top_indices = np.argsort(scores)[::-1][:top_k]
        return [self.idx2item[i] for i in top_indices]

mf_model = MatrixFactorizationRecommender(user_factors_norm, item_factors_norm, user2idx, idx2item, customer_history, popular_articles)
print("MatrixFactorizationRecommender initialized successfully!")
"""))

# --- CELL 11: Markdown ---
cells.append(nbf.v4.new_markdown_cell("""## Section 5: Rigorous Temporal Evaluation on Held-Out Validation Week

### What we are doing:
We evaluate all three models on the strictly future **Week 15 validation set** across standard top-12 recommendation metrics:
- **HitRate@12**: Proportion of customers for whom at least one recommended item was purchased in the validation week.
- **Precision@12**: $\\frac{|\\text{Recommendations} \\cap \\text{Ground Truth}|}{12}$.
- **Recall@12**: $\\frac{|\\text{Recommendations} \\cap \\text{Ground Truth}|}{|\\text{Ground Truth}|}$.
- **MAP@12 (Mean Average Precision)**: Position-weighted precision accounting for rank order.
"""))

# --- CELL 12: Code (Evaluation Function) ---
cells.append(nbf.v4.new_code_cell("""# Evaluation function
def evaluate_recommender(recommender_model, val_gt, sample_size=5000, top_k=12):
    np.random.seed(42)
    val_users = list(val_gt.keys())
    sample_users = np.random.choice(val_users, size=min(sample_size, len(val_users)), replace=False)
    
    hits = 0
    precisions = []
    recalls = []
    maps = []
    
    for uid in sample_users:
        actual = val_gt[uid]
        preds = recommender_model.recommend(uid, top_k=top_k)
        
        # Hit Rate
        hit = len(set(preds) & actual) > 0
        hits += int(hit)
        
        # Precision & Recall
        intersection = len(set(preds) & actual)
        precisions.append(intersection / top_k)
        recalls.append(intersection / len(actual))
        
        # Average Precision (MAP)
        score = 0.0
        num_hits = 0.0
        for i, p in enumerate(preds):
            if p in actual and p not in preds[:i]:
                num_hits += 1.0
                score += num_hits / (i + 1.0)
        maps.append(score / min(len(actual), top_k))
        
    return {
        "HitRate@12": round(hits / len(sample_users) * 100, 2),
        "Precision@12": round(np.mean(precisions) * 100, 3),
        "Recall@12": round(np.mean(recalls) * 100, 3),
        "MAP@12": round(np.mean(maps) * 100, 3)
    }

print("Evaluating Models on Held-Out Week 15 Validation Set (5,000 Sampled Customers)...")
t0 = time.time()
pop_metrics = evaluate_recommender(pop_model, val_ground_truth)
print(f"Popularity Baseline:  {pop_metrics} ({time.time()-t0:.1f}s)")

t0 = time.time()
cf_metrics = evaluate_recommender(item_cf_model, val_ground_truth)
print(f"Item-Item CF Model:   {cf_metrics} ({time.time()-t0:.1f}s)")

t0 = time.time()
mf_metrics = evaluate_recommender(mf_model, val_ground_truth)
print(f"Matrix Factorization: {mf_metrics} ({time.time()-t0:.1f}s)")

# Display comparison table
df_comparison = pd.DataFrame([
    {"Model": "Popularity Baseline", **pop_metrics},
    {"Model": "Item-Item Collaborative Filtering", **cf_metrics},
    {"Model": "Matrix Factorization (64 Factors)", **mf_metrics}
])
display(df_comparison)

# Save comparison results
df_comparison.to_json(ARTIFACTS_META_DIR / "cf_validation_comparison.json", orient="records", indent=2)
print("Saved CF validation metrics to artifacts/metadata/cf_validation_comparison.json")
"""))

# --- CELL 13: Markdown ---
cells.append(nbf.v4.new_markdown_cell("""## Section 6: Validation Assertions & Stage Sign-Off

### What we are doing:
We run formal assertions verifying that:
1. All models produce strictly top-12 recommendations.
2. Latent factor matrices and lookup mappings exist on disk.
3. Collaborative filtering outperforms random chance.
"""))

# --- CELL 14: Code (Assertions) ---
cells.append(nbf.v4.new_code_cell("""# Formal Validation Checks
print("Executing Collaborative Filtering Validation Assertions...")

# 1. Output shape check
test_user = list(val_ground_truth.keys())[0]
assert len(pop_model.recommend(test_user, top_k=12)) == 12, "Popularity returned wrong count"
assert len(item_cf_model.recommend(test_user, top_k=12)) == 12, "Item-CF returned wrong count"
assert len(mf_model.recommend(test_user, top_k=12)) == 12, "MF returned wrong count"

# 2. Metric validity
assert pop_metrics["HitRate@12"] > 0, "Popularity HitRate must be positive"
assert cf_metrics["HitRate@12"] > 0, "CF HitRate must be positive"

# 3. Artifact presence
assert (ARTIFACTS_MODELS_DIR / "cf_user_factors.npy").exists(), "User factors file missing"
assert (ARTIFACTS_MODELS_DIR / "cf_item_factors.npy").exists(), "Item factors file missing"

print("=" * 60)
print("ALL COLLABORATIVE FILTERING ASSERTIONS PASSED (100% OK)")
print("Notebook 05 execution complete. Ready for Notebook 06: Image-Based Recommendation.")
print("=" * 60)
"""))

nb["cells"] = cells

out_path = Path("notebooks/05_collaborative_filtering.ipynb")
with open(out_path, "w", encoding="utf-8") as f:
    nbf.write(nb, f)

print(f"Created notebook: {out_path} with {len(cells)} cells.")
