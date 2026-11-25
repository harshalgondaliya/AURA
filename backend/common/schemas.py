"""
backend/common/schemas.py
Pydantic Data Validation Schemas for APIs and Microservices.
"""

from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from pydantic import BaseModel, Field

# --- Product Schemas ---
class ProductBase(BaseModel):
    article_id: str
    prod_name: str
    product_type_name: str
    product_group_name: str
    standard_category: str
    colour_group_name: str
    perceived_colour_value_name: Optional[str] = None
    gender: Optional[str] = "Unisex"
    sizes: Optional[List[str]] = None
    size_type: Optional[str] = None
    size_system: Optional[str] = None
    availability_status: Optional[str] = "supported_sizes"
    selected_size: Optional[str] = None
    detail_desc: Optional[str] = None
    price_cents: int = 2999
    image_path: Optional[str] = None
    has_image: bool = True

class ProductResponse(ProductBase):
    id: Optional[int] = None
    created_at: Optional[datetime] = None
    similarity_score: Optional[float] = None
    
    class Config:
        from_attributes = True

class ProductListResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[ProductResponse]


# --- Recommendation Schemas ---
class RecommendationRequest(BaseModel):
    customer_id: Optional[str] = None
    article_id: Optional[str] = None
    top_k: int = Field(default=8, ge=1, le=50)
    category_filter: Optional[str] = None
    size_filter: Optional[str] = None

class OutfitSlotItem(BaseModel):
    article_id: str
    slot: str
    prod_name: str
    product_type_name: str
    colour_group_name: str
    gender: Optional[str] = "Unisex"
    sizes: Optional[List[str]] = None
    size_type: Optional[str] = None
    size_system: Optional[str] = None
    selected_size: Optional[str] = None
    availability_status: Optional[str] = "supported_sizes"
    image_path: Optional[str] = None
    compatibility_score: float = 1.0

class OutfitResponse(BaseModel):
    anchor: OutfitSlotItem
    slots: Dict[str, OutfitSlotItem]
    overall_score: float = 0.95
    selected_sizes: Optional[Dict[str, str]] = None
    exhausted: bool = False
    message: Optional[str] = None


# --- Interaction Schemas ---
class InteractionCreate(BaseModel):
    user_id: str
    article_id: str
    interaction_type: str = Field(..., pattern="^(view|like|save|click|dismiss|purchase)$")
    session_id: Optional[str] = None
    context: Optional[Union[str, Dict[str, Any]]] = "feed"

class InteractionResponse(BaseModel):
    id: int
    user_id: str
    article_id: str
    interaction_type: str
    created_at: datetime
    
    class Config:
        from_attributes = True


# --- Outfit Save Schemas ---
class SaveOutfitRequest(BaseModel):
    user_id: str
    outfit_name: str = "My Fashion Look"
    anchor_article_id: str
    item_article_ids: List[str] # List of items in outfit
    selected_sizes: Optional[Dict[str, str]] = None # Optional mapping of article_id -> size

class SavedOutfitResponse(BaseModel):
    outfit_id: str
    user_id: str
    outfit_name: str
    created_at: datetime
    items: List[ProductResponse]


# --- Asynchronous Job Schemas ---
class JobSubmitRequest(BaseModel):
    user_id: Optional[str] = None
    job_type: str = "outfit_synthesis"
    payload: Dict[str, Any] = {}

class JobStatusResponse(BaseModel):
    job_id: str
    status: str # pending, processing, completed, failed
    job_type: str
    result: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# --- Health & Metrics Schemas ---
class NodeHealth(BaseModel):
    name: str
    status: str # UP, DEGRADED, DOWN
    latency_ms: Optional[float] = None
    details: Optional[Dict[str, Any]] = None

class SystemHealthResponse(BaseModel):
    status: str # HEALTHY, DEGRADED, UNHEALTHY
    environment: str
    timestamp: datetime
    services: Dict[str, NodeHealth]
    dependencies: Dict[str, NodeHealth]
