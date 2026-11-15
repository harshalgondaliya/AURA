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
    gender = Column(String(32), default="Unisex", index=True)
    sizes = Column(String(255), nullable=True) # Comma-separated sizes e.g. "XS,S,M,L,XL"
    size_type = Column(String(32), nullable=True, index=True) # alpha, waist, footwear_uk, onesize, age
    size_system = Column(String(32), nullable=True) # Standard, Waist (in), UK, Universal
    availability_status = Column(String(32), default="supported_sizes") # supported_sizes, unverified, unavailable
    detail_desc = Column(Text, nullable=True)
    price_cents = Column(Integer, default=2999)
    image_path = Column(String(255), nullable=True)
    has_image = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self, selected_size=None):
        sizes_list = [s.strip() for s in self.sizes.split(",")] if self.sizes else []
        return {
            "id": self.id,
            "article_id": self.article_id,
            "prod_name": self.prod_name,
            "product_type_name": self.product_type_name,
            "product_group_name": self.product_group_name,
            "standard_category": self.standard_category,
            "colour_group_name": self.colour_group_name,
            "perceived_colour_value_name": self.perceived_colour_value_name,
            "department_name": self.department_name,
            "index_name": self.index_name,
            "section_name": self.section_name,
            "gender": self.gender or "Unisex",
            "sizes": sizes_list,
            "size_type": self.size_type,
            "size_system": self.size_system,
            "availability_status": self.availability_status or ("supported_sizes" if sizes_list else "unavailable"),
            "selected_size": selected_size,
            "detail_desc": self.detail_desc,
            "price_cents": self.price_cents or 2999,
            "image_path": self.image_path,
            "has_image": self.has_image,
            "is_active": self.is_active,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


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
    selected_size = Column(String(32), nullable=True)
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
