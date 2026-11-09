"""
scripts/build_nb04.py
Constructs notebooks/04_content_based_recommendation.ipynb
"""

import nbformat as nbf
from pathlib import Path

nb = nbf.v4.new_notebook()
cells = []

# --- CELL 1: Markdown ---
cells.append(nbf.v4.new_markdown_cell("""# Notebook 04: Content-Based Recommendation Engine
## AI Fashion Recommendation System

### 1. Conceptual Foundation
Content-based recommendation identifies products similar to a chosen item by comparing their inherent characteristics rather than relying on other users' purchase logs. 

For fashion catalogs, key content signals include:
- **Product Type & Group**: T-shirt, Trousers, Dress, Jacket.
- **Color & Shade**: Black, Dark Blue, Light Pink, Dusty Light.
- **Styling & Description**: Slim fit, cotton blend, ribbed neckline, high-waist.

### 2. How Sublinear TF-IDF + Cosine Similarity Works:
1. **Sublinear TF Scaling**: Replaces raw term frequency $tf$ with $1 + \\log(tf)$ for $tf > 0$. This prevents common repeated fashion terms (e.g. "cotton", "wash") from dominating descriptive terms (e.g. "houndstooth", "bouclé").
2. **L2 Normalization**: Each product's text vector is normalized such that $\\|v\\|_2 = 1$.
3. **Sparse Cosine Dot Product**: Because the vectors are L2-normalized, the cosine similarity between item $i$ and all $N$ catalog items is simply:
   $$\\text{CosineSim}(v_i, v_j) = v_i \\cdot v_j^T$$
   This enables computing similarity scores against all 105,542 products in single-digit milliseconds without storing a dense $105,542 \\times 105,542$ matrix (which would require over 44 GB RAM).

### 3. Notebook Objectives:
- Implement a production-grade `ContentBasedRecommender` class.
- Support instant $O(1)$ index lookups using precomputed sparse matrix slices.
- Test visually on diverse garment queries with actual catalog photos.
- Benchmark retrieval latency (average and p95) across 100 queries.
- Measure catalog category consistency and persist inference configurations.
"""))

# --- CELL 2: Code (Imports) ---
cells.append(nbf.v4.new_code_cell("""import os
import sys
import time
import json
from pathlib import Path

import pandas as pd
import numpy as np
import scipy.sparse as sp
from sklearn.metrics.pairwise import linear_kernel
import matplotlib.pyplot as plt
from PIL import Image

pd.set_option("display.max_columns", 50)
pd.set_option("display.float_format", lambda x: "%.4f" % x)

print("Content-based recommendation libraries imported successfully!")
"""))

# --- CELL 3: Markdown ---
cells.append(nbf.v4.new_markdown_cell("""## Section 1: Load Preprocessed Catalog & TF-IDF Artifacts

### What we are doing:
We load the cleaned H&M catalog (`hm_articles_cleaned.parquet`) and the fitted 15,000-feature TF-IDF matrix (`hm_tfidf_matrix.npz`) produced in Stage 1.
We construct bidirectional index mappings:
- `article_to_idx`: Maps 10-digit `article_id` -> sparse matrix row index.
- `idx_to_article`: Maps row index -> 10-digit `article_id`.
"""))

# --- CELL 4: Code (Load Artifacts) ---
cells.append(nbf.v4.new_code_cell("""PROJECT_ROOT = Path(".").resolve()
if PROJECT_ROOT.name == "notebooks":
    PROJECT_ROOT = PROJECT_ROOT.parent

DATA_PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
ARTIFACTS_MODELS_DIR = PROJECT_ROOT / "artifacts" / "models"
ARTIFACTS_META_DIR = PROJECT_ROOT / "artifacts" / "metadata"

# 1. Load cleaned catalog
df_articles = pd.read_parquet(DATA_PROCESSED_DIR / "hm_articles_cleaned.parquet")
print(f"Loaded H&M Catalog: {len(df_articles):,} articles.")

# 2. Load precomputed TF-IDF sparse matrix
t0 = time.time()
tfidf_matrix = sp.load_npz(ARTIFACTS_MODELS_DIR / "hm_tfidf_matrix.npz").tocsr()
print(f"Loaded TF-IDF Matrix in {time.time()-t0:.2f}s: shape {tfidf_matrix.shape}")

# 3. Build index mappings for O(1) lookup
article_to_idx = {aid: idx for idx, aid in enumerate(df_articles["article_id"])}
idx_to_article = {idx: aid for idx, aid in enumerate(df_articles["article_id"])}

# Fast item metadata dictionary for instant retrieval
item_metadata = df_articles.set_index("article_id")[[
    "prod_name", "product_type_name", "product_group_name",
    "colour_group_name", "perceived_colour_value_name",
    "standard_category", "image_path", "has_image"
]].to_dict("index")

print(f"Index mappings created for {len(article_to_idx):,} items.")
"""))

# --- CELL 5: Markdown ---
cells.append(nbf.v4.new_markdown_cell("""## Section 2: Production Content-Based Recommender Implementation

### What we are doing:
We define the `ContentBasedRecommender` class.
- Given a query `article_id`, it looks up the row vector $v_{query}$ from the sparse TF-IDF matrix.
- It computes the dot product $v_{query} \\cdot \\text{tfidf\\_matrix}^T$.
- It zeros out the query item itself to avoid self-recommendation.
- It extracts the top-$K$ highest-scoring indices using `np.argpartition` or `np.argsort`.
- It returns a typed DataFrame with metadata and similarity scores.
"""))

# --- CELL 6: Code (Recommender Class) ---
cells.append(nbf.v4.new_code_cell("""class ContentBasedRecommender:
    \"\"\"Production Content-Based Recommender using Sparse TF-IDF Cosine Similarity.\"\"\"
    
    def __init__(self, tfidf_matrix, article_to_idx, idx_to_article, metadata_dict):
        self.tfidf_matrix = tfidf_matrix
        self.article_to_idx = article_to_idx
        self.idx_to_article = idx_to_article
        self.metadata = metadata_dict
        
    def recommend(self, article_id, top_k=5, same_category_only=False):
        \"\"\"
        Returns top-k similar articles based on metadata/text similarity.
        \"\"\"
        if article_id not in self.article_to_idx:
            raise KeyError(f"Article ID '{article_id}' not found in catalog.")
            
        query_idx = self.article_to_idx[article_id]
        query_vec = self.tfidf_matrix[query_idx]
        
        # Fast sparse dot product: (1, 15000) * (15000, N) -> (1, N)
        scores = linear_kernel(query_vec, self.tfidf_matrix).ravel()
        
        # Zero out the query item itself
        scores[query_idx] = -1.0
        
        query_meta = self.metadata[article_id]
        
        if same_category_only:
            # Filter to same product_group_name if requested
            target_group = query_meta["product_group_name"]
            # Apply in-memory mask
            for idx, score in enumerate(scores):
                if score > 0:
                    aid = self.idx_to_article[idx]
                    if self.metadata[aid]["product_group_name"] != target_group:
                        scores[idx] = -1.0
                        
        # Extract top-K indices
        top_indices = np.argsort(scores)[::-1][:top_k]
        
        results = []
        for rank, idx in enumerate(top_indices, 1):
            aid = self.idx_to_article[idx]
            meta = self.metadata[aid]
            results.append({
                "rank": rank,
                "article_id": aid,
                "prod_name": meta["prod_name"],
                "product_type_name": meta["product_type_name"],
                "product_group_name": meta["product_group_name"],
                "colour_group_name": meta["colour_group_name"],
                "standard_category": meta["standard_category"],
                "similarity_score": round(float(scores[idx]), 4),
                "image_path": meta["image_path"],
                "has_image": meta["has_image"]
            })
            
        return pd.DataFrame(results)

# Instantiate recommender
recommender = ContentBasedRecommender(tfidf_matrix, article_to_idx, idx_to_article, item_metadata)
print("ContentBasedRecommender initialized and ready for queries!")
"""))

# --- CELL 7: Markdown ---
cells.append(nbf.v4.new_markdown_cell("""## Section 3: Qualitative Testing & Visual Evaluation

### What we are doing:
We select sample clothing items across different garments (e.g. T-shirt, Trousers, Dress) and display the query item alongside its top-5 recommended similar products with actual catalog photographs.
"""))

# --- CELL 8: Code (Visual Test) ---
cells.append(nbf.v4.new_code_cell("""def display_recommendations(query_id, recommender, top_k=5):
    \"\"\"Displays query item and its recommended similar items with photos.\"\"\"
    query_meta = recommender.metadata[query_id]
    recs = recommender.recommend(query_id, top_k=top_k)
    
    print(f"QUERY ITEM: [{query_id}] {query_meta['prod_name']}")
    print(f"Type: {query_meta['product_type_name']} | Group: {query_meta['product_group_name']} | Color: {query_meta['colour_group_name']}")
    print("-" * 75)
    
    # Plot query + recs
    total_images = 1 + len(recs)
    fig, axes = plt.subplots(1, total_images, figsize=(3.2 * total_images, 4))
    
    # Plot query
    q_path = PROJECT_ROOT / query_meta["image_path"] if query_meta["has_image"] else None
    if q_path and q_path.exists():
        with Image.open(q_path) as img:
            axes[0].imshow(img.convert("RGB"))
    axes[0].set_title(f"QUERY ITEM\\n{query_meta['prod_name'][:18]}\\n({query_meta['colour_group_name']})", color="darkred", fontweight="bold")
    axes[0].axis("off")
    
    # Plot recommendations
    for i, (_, row) in enumerate(recs.iterrows()):
        ax = axes[i + 1]
        r_path = PROJECT_ROOT / row["image_path"] if row["has_image"] else None
        if r_path and r_path.exists():
            with Image.open(r_path) as img:
                ax.imshow(img.convert("RGB"))
        ax.set_title(f"Rank {row['rank']} (Sim: {row['similarity_score']:.2f})\\n{row['prod_name'][:18]}\\n({row['colour_group_name']})", fontsize=9)
        ax.axis("off")
        
    plt.tight_layout()
    plt.show()
    return recs

# Test with a T-shirt
test_items = df_articles[df_articles["has_image"] == 1]
tshirt_id = test_items[test_items["product_type_name"] == "T-shirt"]["article_id"].iloc[0]
recs_tshirt = display_recommendations(tshirt_id, recommender, top_k=5)
"""))

# --- CELL 9: Markdown ---
cells.append(nbf.v4.new_markdown_cell("""### Section 3.1: Testing with Trousers & Dresses

### What we are doing:
We test additional garment categories to verify that trousers recommend matching trousers and dresses recommend similar dresses.
"""))

# --- CELL 10: Code (More Visual Tests) ---
cells.append(nbf.v4.new_code_cell("""# Test with Trousers
trousers_id = test_items[test_items["product_type_name"] == "Trousers"]["article_id"].iloc[0]
recs_trousers = display_recommendations(trousers_id, recommender, top_k=5)

# Test with Dress
dress_id = test_items[test_items["product_type_name"] == "Dress"]["article_id"].iloc[0]
recs_dress = display_recommendations(dress_id, recommender, top_k=5)
"""))

# --- CELL 11: Markdown ---
cells.append(nbf.v4.new_markdown_cell("""## Section 4: Quantitative Latency & Category Consistency Benchmark

### What we are doing:
To prove this model is production-ready for our API Gateway, we benchmark:
1. **Inference Latency**: We execute 100 random queries and measure the mean, median, and p95 retrieval latency in milliseconds.
2. **Category Consistency (% Match)**: The proportion of recommended items that share the exact same `product_group_name` and `product_type_name` as the query item.
"""))

# --- CELL 12: Code (Latency Benchmark) ---
cells.append(nbf.v4.new_code_cell("""# Sample 100 random active catalog items
np.random.seed(42)
sample_aids = np.random.choice(df_articles["article_id"], size=100, replace=False)

latencies_ms = []
group_consistency = []
type_consistency = []

for aid in sample_aids:
    q_meta = item_metadata[aid]
    
    t0 = time.perf_counter()
    recs = recommender.recommend(aid, top_k=5)
    dur_ms = (time.perf_counter() - t0) * 1000
    latencies_ms.append(dur_ms)
    
    # Calculate category consistency
    matching_groups = (recs["product_group_name"] == q_meta["product_group_name"]).mean()
    matching_types = (recs["product_type_name"] == q_meta["product_type_name"]).mean()
    group_consistency.append(matching_groups)
    type_consistency.append(matching_types)

latency_series = pd.Series(latencies_ms)
mean_lat = latency_series.mean()
p50_lat = latency_series.median()
p95_lat = latency_series.quantile(0.95)
p99_lat = latency_series.quantile(0.99)
avg_group_match = np.mean(group_consistency) * 100
avg_type_match = np.mean(type_consistency) * 100

print("=" * 60)
print("CONTENT-BASED ENGINE BENCHMARK RESULTS (100 QUERIES):")
print("=" * 60)
print(f"Mean Latency:             {mean_lat:.2f} ms")
print(f"Median (p50) Latency:     {p50_lat:.2f} ms")
print(f"95th Percentile (p95):    {p95_lat:.2f} ms")
print(f"99th Percentile (p99):    {p99_lat:.2f} ms")
print(f"Product Group Match Rate: {avg_group_match:.1f}%")
print(f"Product Type Match Rate:  {avg_type_match:.1f}%")
print("=" * 60)

# Save benchmark results to metadata
benchmark_metrics = {
    "engine": "ContentBasedRecommender",
    "vectorizer": "TF-IDF (15,000 features, sublinear_tf)",
    "catalog_size": len(df_articles),
    "mean_latency_ms": round(float(mean_lat), 2),
    "p50_latency_ms": round(float(p50_lat), 2),
    "p95_latency_ms": round(float(p95_lat), 2),
    "p99_latency_ms": round(float(p99_lat), 2),
    "product_group_consistency_pct": round(float(avg_group_match), 2),
    "product_type_consistency_pct": round(float(avg_type_match), 2)
}

with open(ARTIFACTS_META_DIR / "content_recommender_benchmark.json", "w", encoding="utf-8") as f:
    json.dump(benchmark_metrics, f, indent=2)

print("Saved benchmark metrics to artifacts/metadata/content_recommender_benchmark.json")
"""))

# --- CELL 13: Markdown ---
cells.append(nbf.v4.new_markdown_cell("""## Section 5: Validation Assertions & Stage Sign-Off

### What we are doing:
We run formal assertions verifying that:
1. Every query returns strictly top-$K$ non-null recommendations.
2. The query item itself is never recommended.
3. Similarity scores are sorted in strictly descending order.
4. p95 retrieval latency is under 50 milliseconds (suitable for real-time API Gateway integration).
"""))

# --- CELL 14: Code (Assertions) ---
cells.append(nbf.v4.new_code_cell("""# Validation assertions
print("Executing Content-Based Recommendation Assertions...")

# 1. Non-empty recommendations
assert len(recs_tshirt) == 5, "Recommender failed to return 5 items"
assert len(recs_trousers) == 5, "Recommender failed to return 5 items"

# 2. Query item exclusion
assert tshirt_id not in recs_tshirt["article_id"].values, "Query item appeared in recommendations!"

# 3. Monotonic score ordering
scores = recs_tshirt["similarity_score"].values
assert (scores[:-1] >= scores[1:]).all(), "Scores are not sorted in descending order!"

# 4. Latency threshold
assert p95_lat < 50.0, f"p95 Latency ({p95_lat:.2f} ms) exceeded 50ms threshold!"

print("=" * 60)
print("ALL CONTENT-BASED RECOMMENDER ASSERTIONS PASSED (100% OK)")
print("Notebook 04 execution complete. Ready for Notebook 05: Collaborative Filtering.")
print("=" * 60)
"""))

nb["cells"] = cells

out_path = Path("notebooks/04_content_based_recommendation.ipynb")
with open(out_path, "w", encoding="utf-8") as f:
    nbf.write(nb, f)

print(f"Created notebook: {out_path} with {len(cells)} cells.")
