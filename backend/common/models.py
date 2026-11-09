"""
backend/common/models.py
SQLAlchemy Declarative Models supporting PostgreSQL and SQLite.
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Float, DateTime, ForeignKey, Index, JSON
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(64), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=True)
    full_name = Column(String(128), nullable=True)
    age = Column(Integer, nullable=True)
    club_member_status = Column(String(32), default="ACTIVE")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    interactions = relationship("UserInteraction", back_populates="user", cascade="all, delete-orphan")
    saved_outfits = relationship("SavedOutfit", back_populates="user", cascade="all, delete-orphan")


class Product(Base):
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    article_id = Column(String(16), unique=True, nullable=False, index=True)
    prod_name = Column(String(128), nullable=False)
    product_type_name = Column(String(64), nullable=False)
    product_group_name = Column(String(64), nullable=False)
    standard_category = Column(String(32), nullable=False, index=True)
    colour_group_name = Column(String(64), nullable=False, index=True)
    perceived_colour_value_name = Column(String(64), nullable=True)
    department_name = Column(String(64), nullable=True)
    index_name = Column(String(64), nullable=True)
    section_name = Column(String(64), nullable=True)
    detail_desc = Column(Text, nullable=True)
    price_cents = Column(Integer, default=2999)
    image_path = Column(String(255), nullable=True)
    has_image = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserInteraction(Base):
    __tablename__ = "user_interactions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(64), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    article_id = Column(String(16), ForeignKey("products.article_id", ondelete="CASCADE"), nullable=False, index=True)
    interaction_type = Column(String(32), nullable=False, index=True) # view, like, save, click, dismiss, purchase
    session_id = Column(String(64), nullable=True)
    context = Column(String(64), default="feed")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    user = relationship("User", back_populates="interactions")
    product = relationship("Product")


class SavedOutfit(Base):
    __tablename__ = "saved_outfits"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    outfit_id = Column(String(64), unique=True, nullable=False, index=True)
    user_id = Column(String(64), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    outfit_name = Column(String(128), default="My Fashion Look")
    anchor_article_id = Column(String(16), ForeignKey("products.article_id"), nullable=True)
    compatibility_score = Column(Float, default=0.95)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="saved_outfits")
    items = relationship("OutfitItem", back_populates="outfit", cascade="all, delete-orphan")


class OutfitItem(Base):
    __tablename__ = "outfit_items"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    outfit_id = Column(String(64), ForeignKey("saved_outfits.outfit_id", ondelete="CASCADE"), nullable=False, index=True)
    article_id = Column(String(16), ForeignKey("products.article_id"), nullable=False)
    slot = Column(String(32), nullable=False) # anchor, upper_body, lower_body, shoes, accessories
    item_score = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    outfit = relationship("SavedOutfit", back_populates="items")
    product = relationship("Product")


class RecommendationJob(Base):
    __tablename__ = "recommendation_jobs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String(64), unique=True, nullable=False, index=True)
    user_id = Column(String(64), nullable=True, index=True)
    job_type = Column(String(64), nullable=False) # personalized_feed, outfit_synthesis, batch_refresh
    status = Column(String(32), default="pending", nullable=False, index=True) # pending, processing, completed, failed
    payload = Column(JSON, nullable=True)
    result = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
