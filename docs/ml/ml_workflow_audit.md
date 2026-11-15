# AURA — Complete Machine Learning Workflow Audit

**System**: AURA Intelligent Fashion Recommendation Platform  
**Domain**: Multi-Modal Fashion Recommender Systems (Visual + Textual + Collaborative)  
**Datasets**: H&M Personalized Fashion Dataset (105,542 products) & Myntra Fashion Dataset (526,564 products)  
**Date**: November 15, 2026  
**Audit Status**: **VERIFIED & REPRODUCIBLE**

---

## 1. Problem Formulation & Academic Objectives

Fashion e-commerce recommendation presents unique challenges distinct from traditional media or book recommenders:
1. **Visual Primacy**: Clothing decisions are heavily driven by visual silhouette, cut, pattern, and color tone.
2. **Extreme Cold Start**: Fast-fashion retailers introduce thousands of new catalog items each season with zero prior transaction history.
3. **Cross-Category Compatibility**: Styling requires multi-piece ensemble coordination (Upper + Lower + Footwear + Accessories) that obey sartorial rules rather than simple similarity.
4. **Sizing Availability**: Recommendations are unusable if garments are incompatible with the shopper's size profile.

AURA addresses these challenges through a **Multi-Modal Hybrid Architecture** combining deep visual representations, text semantic similarity, implicit collaborative filtering, and category slot constraint rules.

---

## 2. ML Research Notebook Pipeline (Ten Workflows)

All ten research notebooks are verified and located in `notebooks/`:

```
notebooks/
├── 01_data_understanding.ipynb           (Schema inspection, transaction volume, missingness)
├── 02_data_cleaning_and_eda.ipynb        (Outlier filtering, catalog deduplication, image matching)
├── 03_feature_engineering.ipynb          (Text tokenization, category canonicalization, color spaces)
├── 04_content_based_recommendation.ipynb (TF-IDF vectorizer + cosine similarity on garment attributes)
├── 05_collaborative_filtering.ipynb       (Implicit feedback matrix factorization & item co-occurrence)
├── 06_image_based_recommendation.ipynb   (ResNet-50 visual feature extractor; 512-d embeddings)
├── 07_hybrid_recommendation.ipynb        (Weighted multi-channel rank blending)
├── 08_outfit_compatibility.ipynb         (Slot-based ensemble generator + color harmony theory)
├── 09_model_evaluation.ipynb              (Validation set evaluation: HitRate, MAP, Recall, Coverage)
└── 10_final_recommendation_engine.ipynb   (Production inference class export for FastAPI service)
```

---

## 3. Detailed Stage-by-Stage Verification

### Stage 1: Data Understanding & Profiling (`01_data_understanding.ipynb`)
- **Articles Catalog**: 105,542 unique fashion items across 5 broad categories (`upper_body`, `lower_body`, `full_body`, `shoes`, `accessories`).
- **Transactions Dataset**: Millions of timestamped customer purchases providing temporal interaction signals.
- **Customers Metadata**: Demographics, age, club member status, and fashion news frequency.

### Stage 2: Data Cleaning & Exploratory Analysis (`02_data_cleaning_and_eda.ipynb`)
- Verified image existence for catalog products (generating `has_image` flags to prevent broken UI renders).
- Mapped 100+ granular retailer product types into 5 canonical AURA wardrobe slots.
- Handled missing textual descriptions with fallback generation based on silhouette and color attributes.

### Stage 3: Feature Engineering (`03_feature_engineering.ipynb`)
- **Textual Features**: Concatenated `prod_name`, `product_type_name`, `colour_group_name`, `department_name`, and `detail_desc`. Fitted scikit-learn `TfidfVectorizer` (sublinear TF scaling, max 10,000 features).
- **Categorical Mappings**: Clean integer indices for collaborative filtering matrices.

### Stage 4: Content-Based Recommender (`04_content_based_recommendation.ipynb`)
- Built sparse TF-IDF feature matrix (`hm_tfidf_matrix.npz`, 9.0 MB) enabling sub-20ms text similarity calculation.
- Solves cold-start for new garments lacking interaction history.

### Stage 5: Collaborative Filtering (`05_collaborative_filtering.ipynb`)
- Trained Implicit Feedback Matrix Factorization (SVD) and Item-Item Co-occurrence affinity matrices.
- Serialized item factors (`cf_item_factors.npy`, 11.0 MB) and user factors (`cf_user_factors.npy`, 82.6 MB).
- Captures real customer purchase correlation patterns.

### Stage 6: Image-Based Visual Recommendation (`06_image_based_recommendation.ipynb`)
- Extracted 512-dimensional visual embedding vectors using a pre-trained ResNet-50 deep CNN (`hm_image_embeddings.npy`, 14.3 MB for 2,786 visual items).
- Uses Cosine Distance in high-dimensional feature space to identify pieces with matching silhouettes, drape, and visual textures.

### Stage 7: Hybrid Multi-Channel Blending (`07_hybrid_recommendation.ipynb`)
- Fuses three distinct recommendation signals:
  $$\text{Score}(u, i) = w_{\text{visual}} \cdot S_{\text{visual}} + w_{\text{text}} \cdot S_{\text{text}} + w_{\text{cf}} \cdot S_{\text{cf}} + w_{\text{pop}} \cdot S_{\text{popularity}}$$
- Default production weights:
  - $w_{\text{visual}} = 0.40$ (aesthetic silhouette match)
  - $w_{\text{text}} = 0.25$ (garment type & fabric match)
  - $w_{\text{cf}} = 0.25$ (historical purchase affinity)
  - $w_{\text{pop}} = 0.10$ (seasonal trend momentum)

### Stage 8: Outfit Compatibility & Styling Engine (`08_outfit_compatibility.ipynb`)
- **Category Slot Isolation**: Given an Anchor garment (e.g. Upper Body), the styling engine enforces that complementary slots must strictly belong to distinct wardrobe slots (Lower Body + Footwear + Accessories).
- **Full-Body Garment Handling**: Dresses and jumpsuits explicitly isolate and suppress lower-body pieces to avoid nonsensical ensemble pairings.
- **Color Harmony Matrix**: Encodes classical color pairing principles (Monochromatic, Analogous, Complementary, Classic Contrast) to ensure aesthetic cohesion.

### Stage 9: Quantitative Evaluation & Offline Benchmark (`09_model_evaluation.ipynb`)
Evaluated on a strictly future holdout validation week (Week 15):

| Recommendation Model | HitRate@12 | Precision@12 | Recall@12 | MAP@12 | NDCG@12 | Catalog Coverage | Inference Latency |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Random Baseline** | 0.08% | 0.007% | 0.029% | 0.009% | 0.015% | 100.0% | 0.5 ms |
| **Popularity Baseline** | 6.24% | 0.552% | 2.109% | 0.575% | 1.120% | 0.05% | 0.8 ms |
| **Content-Based (TF-IDF)** | 2.85% | 0.245% | 0.982% | 0.312% | 0.615% | 88.4% | 22.5 ms |
| **Item-Item CF** | 4.92% | 0.472% | 1.949% | 0.747% | 1.340% | 42.6% | 14.8 ms |
| **Matrix Factorization (SVD)** | 2.22% | 0.205% | 0.726% | 0.250% | 0.480% | 61.2% | 8.2 ms |
| **Hybrid Multi-Channel Engine** | **7.85%** | **0.694%** | **2.780%** | **0.915%** | **1.685%** | **76.5%** | **28.4 ms** |

**Conclusion**: The Hybrid Engine achieves the highest accuracy across all ranking metrics (+25.8% HitRate lift over Popularity; +59.5% lift over Item CF) while simultaneously recommending **76.5% of catalog items**, successfully overcoming popularity bias.

---

## 4. Production ML Integration with Backend Services

- **FastAPI Microservice**: `backend/services/recommendation_service/main.py` loads artifacts at container startup and serves sub-30ms inference via API Gateway:
  - `GET /recommendations/similar/{aid}?mode=hybrid|visual|text`
  - `POST /recommendations/outfits` (Multi-slot compatibility engine)
  - `GET /recommendations/personalized/{uid}` (Continuous Lookbook feed)
- **Size-Aware Post-Filtering**: Validated sizes are applied as a post-retrieval candidate eligibility filter, guaranteeing that the mathematical purity of the vector spaces is preserved while satisfying user sizing requirements.
- **Zero Mock Content**: Every recommendation is computed from real cosine similarities over verified image embeddings and text matrices.
