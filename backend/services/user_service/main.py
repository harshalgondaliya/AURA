"""
backend/services/user_service/main.py
User Management, Interaction Logging, and Saved Outfits Microservice.
"""

import os
import sys
import uuid
import time
from pathlib import Path
from typing import List, Optional

PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.common.database import get_db
from backend.common.models import User, UserInteraction, Product, SavedOutfit, OutfitItem
from backend.common.schemas import (
    InteractionCreate, InteractionResponse, SaveOutfitRequest,
    SavedOutfitResponse, ProductResponse, NodeHealth
)
from backend.common.redis_cache import cache

app = FastAPI(title="Fashion User Service", version="1.0.0")

@app.get("/health", response_model=NodeHealth)
def health_check(db: Session = Depends(get_db)):
    t0 = time.perf_counter()
    try:
        user_cnt = db.query(User).count()
        interaction_cnt = db.query(UserInteraction).count()
        return NodeHealth(
            name="user_service",
            status="UP",
            latency_ms=round((time.perf_counter() - t0) * 1000, 2),
            details={"users": user_cnt, "interactions": interaction_cnt}
        )
    except Exception as e:
        return NodeHealth(name="user_service", status="DOWN", details={"error": str(e)})

def ensure_product_exists(db: Session, aid: str):
    p = db.query(Product).filter(Product.article_id == aid).first()
    if not p:
        p = Product(
            article_id=aid,
            prod_name=f"Fashion Item {aid}",
            product_type_name="Apparel",
            product_group_name="Garment",
            standard_category="apparel",
            colour_group_name="Multi",
            price_cents=2999,
            has_image=True
        )
        db.add(p)
        db.commit()
    return p

@app.post("/interactions", response_model=InteractionResponse, status_code=status.HTTP_201_CREATED)
def record_interaction(interaction_in: InteractionCreate, db: Session = Depends(get_db)):
    """Feature C: Store user interactions (view, like, save, click, dismiss)."""
    # Ensure user exists or create automatically
    user = db.query(User).filter(User.user_id == interaction_in.user_id).first()
    if not user:
        user = User(user_id=interaction_in.user_id)
        db.add(user)
        db.commit()

    ensure_product_exists(db, interaction_in.article_id)

    interaction = UserInteraction(
        user_id=interaction_in.user_id,
        article_id=interaction_in.article_id,
        interaction_type=interaction_in.interaction_type,
        session_id=interaction_in.session_id,
        context=interaction_in.context
    )
    db.add(interaction)
    db.commit()
    db.refresh(interaction)

    # Invalidate user recommendation cache on new like/save interaction
    cache.delete(f"rec:user:{interaction_in.user_id}")
    return interaction

@app.get("/users/{user_id}/history", response_model=List[ProductResponse])
def get_user_history(
    user_id: str,
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """Retrieve user's previously viewed/clicked products in reverse chronological order."""
    interactions = (
        db.query(UserInteraction)
        .filter(UserInteraction.user_id == user_id)
        .order_by(UserInteraction.created_at.desc())
        .limit(limit)
        .all()
    )
    
    seen = set()
    products = []
    for inter in interactions:
        if inter.article_id not in seen:
            seen.add(inter.article_id)
            prod = db.query(Product).filter(Product.article_id == inter.article_id).first()
            if prod:
                products.append(ProductResponse.from_orm(prod))
    return products

@app.get("/users/{user_id}/favorites", response_model=List[ProductResponse])
def get_user_favorites(user_id: str, db: Session = Depends(get_db)):
    """Retrieve products liked by user."""
    likes = (
        db.query(UserInteraction)
        .filter(UserInteraction.user_id == user_id, UserInteraction.interaction_type == "like")
        .order_by(UserInteraction.created_at.desc())
        .all()
    )
    
    seen = set()
    favorites = []
    for l in likes:
        if l.article_id not in seen:
            seen.add(l.article_id)
            p = db.query(Product).filter(Product.article_id == l.article_id).first()
            if p:
                favorites.append(ProductResponse.from_orm(p))
    return favorites

@app.post("/outfits/save", status_code=status.HTTP_201_CREATED)
def save_outfit(req: SaveOutfitRequest, db: Session = Depends(get_db)):
    """Feature B & C: Save a complete outfit look."""
    ensure_product_exists(db, req.anchor_article_id)
    outfit_uuid = f"outfit_{uuid.uuid4().hex[:12]}"
    outfit = SavedOutfit(
        outfit_id=outfit_uuid,
        user_id=req.user_id,
        outfit_name=req.outfit_name,
        anchor_article_id=req.anchor_article_id,
        compatibility_score=0.96
    )
    db.add(outfit)
    db.commit()

    for idx, aid in enumerate(req.item_article_ids):
        ensure_product_exists(db, aid)
        item = OutfitItem(
            outfit_id=outfit_uuid,
            article_id=aid,
            slot=f"slot_{idx}" if idx > 0 else "anchor"
        )
        db.add(item)
    db.commit()
    return {"outfit_id": outfit_uuid, "message": "Outfit saved successfully!"}

@app.get("/users/{user_id}/outfits")
def get_saved_outfits(user_id: str, db: Session = Depends(get_db)):
    """Retrieve all outfits saved by the user."""
    outfits = db.query(SavedOutfit).filter(SavedOutfit.user_id == user_id).all()
    results = []
    for o in outfits:
        items = db.query(OutfitItem).filter(OutfitItem.outfit_id == o.outfit_id).all()
        prod_list = []
        for it in items:
            p = db.query(Product).filter(Product.article_id == it.article_id).first()
            if p:
                prod_list.append(ProductResponse.from_orm(p).dict())
        results.append({
            "outfit_id": o.outfit_id,
            "outfit_name": o.outfit_name,
            "anchor_article_id": o.anchor_article_id,
            "compatibility_score": o.compatibility_score,
            "created_at": o.created_at,
            "items": prod_list
        })
    return results
