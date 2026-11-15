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

@app.get("/products", response_model=ProductListResponse)
def get_products(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    category: Optional[str] = None,
    color: Optional[str] = None,
    gender: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    cache_key = f"products:p{page}:l{limit}:c{category}:col{color}:g{gender}:s{search}"
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
        "items": [ProductResponse.from_orm(p).dict() for p in items]
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
        
    resp = ProductResponse.from_orm(product).dict()
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
    return categories
