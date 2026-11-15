"""
backend/services/product_service/main.py
Product Catalog Microservice: Filtering, Search, Categories, and Product Detail.
"""

import os
import sys
import time
from pathlib import Path
from typing import Optional, List

PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.common.database import get_db
from backend.common.models import Product
from backend.common.schemas import ProductResponse, ProductListResponse, NodeHealth
from backend.common.redis_cache import cache

app = FastAPI(title="Fashion Product Service", version="1.0.0")

@app.get("/health", response_model=NodeHealth)
def health_check(db: Session = Depends(get_db)):
    t0 = time.perf_counter()
    try:
        count = db.query(Product).count()
        latency = (time.perf_counter() - t0) * 1000
        return NodeHealth(
            name="product_service",
            status="UP",
            latency_ms=round(latency, 2),
            details={"catalog_items": count}
        )
    except Exception as e:
        return NodeHealth(
            name="product_service",
            status="DOWN",
            details={"error": str(e)}
        )

def format_product(p: Product) -> dict:
    sizes_list = [s.strip() for s in p.sizes.split(",")] if p.sizes else []
    return {
        "article_id": p.article_id,
        "prod_name": p.prod_name,
        "product_type_name": p.product_type_name,
        "product_group_name": p.product_group_name,
        "standard_category": p.standard_category,
        "colour_group_name": p.colour_group_name,
        "perceived_colour_value_name": p.perceived_colour_value_name,
        "gender": p.gender or "Unisex",
        "sizes": sizes_list,
        "size_type": p.size_type,
        "size_system": p.size_system,
        "availability_status": p.availability_status or ("supported_sizes" if sizes_list else "unavailable"),
        "detail_desc": p.detail_desc,
        "price_cents": p.price_cents or 2999,
        "image_path": p.image_path,
        "has_image": p.has_image,
        "id": p.id,
        "created_at": p.created_at,
    }

@app.get("/products", response_model=ProductListResponse)
def get_products(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    category: Optional[str] = None,
    color: Optional[str] = None,
    gender: Optional[str] = None,
    size: Optional[str] = None,
    size_type: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    cache_key = f"products:p{page}:l{limit}:c{category}:col{color}:g{gender}:sz{size}:st{size_type}:s{search}"
    cached = cache.get_json(cache_key)
    if cached:
        return cached

    query = db.query(Product).filter(Product.is_active == True)
    
    # Scope filtering by catalog gender
    if gender:
        g_lower = gender.lower().strip()
        if g_lower == "men":
            query = query.filter(Product.gender.in_(["Men", "Unisex"]))
        elif g_lower == "women":
            query = query.filter(Product.gender.in_(["Women", "Unisex"]))
        elif g_lower == "kids":
            query = query.filter(Product.gender == "Kids")
        elif g_lower == "unisex":
            query = query.filter(Product.gender == "Unisex")
    
    if category:
        query = query.filter(Product.standard_category == category)
    if color:
        query = query.filter(Product.colour_group_name.ilike(f"%{color}%"))
    if size:
        # Exact token match inside comma-separated sizes string
        s_clean = size.strip()
        query = query.filter(
            or_(
                Product.sizes == s_clean,
                Product.sizes.like(f"{s_clean},%"),
                Product.sizes.like(f"%,{s_clean},%"),
                Product.sizes.like(f"%,{s_clean}")
            )
        )
    if size_type:
        query = query.filter(Product.size_type == size_type)
    if search:
        search_filter = or_(
            Product.prod_name.ilike(f"%{search}%"),
            Product.product_type_name.ilike(f"%{search}%"),
            Product.detail_desc.ilike(f"%{search}%")
        )
        query = query.filter(search_filter)
        
    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()
    
    resp = {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [format_product(p) for p in items]
    }
    cache.set_json(cache_key, resp, ttl_seconds=120)
    return resp

@app.get("/products/{article_id}", response_model=ProductResponse)
def get_product_detail(article_id: str, db: Session = Depends(get_db)):
    cache_key = f"product:{article_id}"
    cached = cache.get_json(cache_key)
    if cached:
        return cached
        
    product = db.query(Product).filter(Product.article_id == article_id).first()
    if not product:
        raise HTTPException(status_code=404, detail=f"Product '{article_id}' not found.")
        
    resp = format_product(product)
    cache.set_json(cache_key, resp, ttl_seconds=600)
    return resp

@app.get("/categories")
def get_categories(
    gender: Optional[str] = None,
    db: Session = Depends(get_db)
):
    cache_key = f"categories:g{gender}"
    cached = cache.get_json(cache_key)
    if cached:
        return cached
        
    from sqlalchemy import func
    query = db.query(Product.standard_category, func.count(Product.id)).filter(Product.is_active == True)
    if gender:
        g_lower = gender.lower().strip()
        if g_lower == "men":
            query = query.filter(Product.gender.in_(["Men", "Unisex"]))
        elif g_lower == "women":
            query = query.filter(Product.gender.in_(["Women", "Unisex"]))
        elif g_lower == "kids":
            query = query.filter(Product.gender == "Kids")
        elif g_lower == "unisex":
            query = query.filter(Product.gender == "Unisex")

    results = query.group_by(Product.standard_category).all()
    categories = [{"category": r[0], "count": r[1]} for r in results]
    cache.set_json(cache_key, categories, ttl_seconds=3600)
    return categories

@app.get("/sizes")
def get_available_sizes(
    category: Optional[str] = None,
    gender: Optional[str] = None,
    db: Session = Depends(get_db)
):
    cache_key = f"sizes:c{category}:g{gender}"
    cached = cache.get_json(cache_key)
    if cached:
        return cached

    query = db.query(Product.sizes, Product.size_type, Product.size_system).filter(
        Product.is_active == True,
        Product.sizes != None
    )
    if category:
        query = query.filter(Product.standard_category == category)
    if gender:
        g_lower = gender.lower().strip()
        if g_lower == "men":
            query = query.filter(Product.gender.in_(["Men", "Unisex"]))
        elif g_lower == "women":
            query = query.filter(Product.gender.in_(["Women", "Unisex"]))
        elif g_lower == "kids":
            query = query.filter(Product.gender == "Kids")
        elif g_lower == "unisex":
            query = query.filter(Product.gender == "Unisex")

    rows = query.distinct().all()
    seen = set()
    size_list = []
    for r in rows:
        if r[0]:
            for s in r[0].split(","):
                clean = s.strip()
                if clean and clean not in seen:
                    seen.add(clean)
                    size_list.append({
                        "size": clean,
                        "size_type": r[1],
                        "size_system": r[2]
                    })
    cache.set_json(cache_key, size_list, ttl_seconds=3600)
    return size_list
