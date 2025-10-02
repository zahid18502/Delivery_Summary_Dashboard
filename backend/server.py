from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Cookie, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Union
from datetime import datetime, timezone, timedelta
import os
import logging
import uuid
import httpx
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer(auto_error=False)

# Data Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    picture: str = ""
    role: str = "user"  # "user" or "admin"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: str
    name: str
    picture: str = ""

class Session(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DeliveryEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    date: str  # ISO date string
    challan_amount: float
    delivered_amount: float
    pending_amount: float
    vehicle_required: int
    vehicle_confirmed: int
    vehicle_missing: int
    notes: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DeliveryEntryCreate(BaseModel):
    date: str
    challan_amount: float
    delivered_amount: float
    pending_amount: float
    vehicle_required: int
    vehicle_confirmed: int
    vehicle_missing: int
    notes: str = ""

class DeliveryEntryUpdate(BaseModel):
    date: Optional[str] = None
    challan_amount: Optional[float] = None
    delivered_amount: Optional[float] = None
    pending_amount: Optional[float] = None
    vehicle_required: Optional[int] = None
    vehicle_confirmed: Optional[int] = None
    vehicle_missing: Optional[int] = None
    notes: Optional[str] = None

class DashboardSummary(BaseModel):
    total_challan_amount: float
    total_delivered_amount: float
    total_pending_amount: float
    total_vehicle_required: int
    total_vehicle_confirmed: int
    total_vehicle_missing: int
    delivery_rate: float  # delivered/challan percentage
    vehicle_utilization_rate: float  # confirmed/required percentage
    recent_entries_count: int

# Helper functions for authentication
async def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials = None) -> Union[User, None]:
    """Get current authenticated user from session token"""
    session_token = None
    
    # First try to get token from cookies
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token and credentials:
        session_token = credentials.credentials
    
    if not session_token:
        return None
    
    # Find session in database
    session = await db.sessions.find_one({"session_token": session_token})
    if not session or datetime.now(timezone.utc) > session["expires_at"]:
        # Clean up expired session
        if session:
            await db.sessions.delete_one({"_id": session["_id"]})
        return None
    
    # Get user
    user = await db.users.find_one({"id": session["user_id"]})
    if not user:
        return None
    
    return User(**user)

async def require_auth(request: Request, credentials: HTTPAuthorizationCredentials = None) -> User:
    """Require authentication, raise 401 if not authenticated"""
    user = await get_current_user(request, credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return user

async def require_admin(request: Request, credentials: HTTPAuthorizationCredentials = None) -> User:
    """Require admin role, raise 403 if not admin"""
    user = await require_auth(request, credentials)
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user

# Auth endpoints
@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Process session_id from Emergent Auth and create user session"""
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required in X-Session-ID header")
    
    # Call Emergent Auth API to get user data
    try:
        async with httpx.AsyncClient() as client:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            
        if auth_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Invalid session ID")
        
        user_data = auth_response.json()
        
        # Determine user role - admin if email matches specific email
        role = "admin" if user_data["email"] == "jibon.ipe@gmail.com" else "user"
        
        # Check if user exists, create if not
        existing_user = await db.users.find_one({"email": user_data["email"]})
        if existing_user:
            user = User(**existing_user)
        else:
            user = User(
                email=user_data["email"],
                name=user_data["name"],
                picture=user_data.get("picture", ""),
                role=role
            )
            await db.users.insert_one(user.dict())
        
        # Create session
        session = Session(
            user_id=user.id,
            session_token=user_data["session_token"],
            expires_at=datetime.now(timezone.utc) + timedelta(days=7)
        )
        await db.sessions.insert_one(session.dict())
        
        # Set HTTP-only cookie
        response.set_cookie(
            key="session_token",
            value=user_data["session_token"],
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=7 * 24 * 60 * 60  # 7 days
        )
        
        return {"user": user.dict(), "message": "Session created successfully"}
        
    except httpx.RequestError:
        raise HTTPException(status_code=500, detail="Authentication service unavailable")

@api_router.get("/auth/me")
async def get_me(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user information"""
    user = await get_current_user(request, credentials)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"user": user.dict()}

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Logout current user"""
    session_token = request.cookies.get("session_token")
    if not session_token and credentials:
        session_token = credentials.credentials
    
    if session_token:
        # Delete session from database
        await db.sessions.delete_one({"session_token": session_token})
        
        # Clear cookie
        response.delete_cookie(key="session_token", path="/")
    
    return {"message": "Logged out successfully"}

# Delivery entries endpoints
@api_router.post("/entries", response_model=DeliveryEntry)
async def create_entry(entry_data: DeliveryEntryCreate, request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Create a new delivery entry"""
    user = await require_auth(request, credentials)
    
    entry = DeliveryEntry(
        user_id=user.id,
        **entry_data.dict()
    )
    
    await db.delivery_entries.insert_one(entry.dict())
    return entry

@api_router.get("/entries", response_model=List[DeliveryEntry])
async def get_user_entries(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user's delivery entries"""
    user = await require_auth(request, credentials)
    
    entries = await db.delivery_entries.find({"user_id": user.id}).sort("date", -1).to_list(1000)
    return [DeliveryEntry(**entry) for entry in entries]

@api_router.get("/entries/{entry_id}", response_model=DeliveryEntry)
async def get_entry(entry_id: str, request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get specific entry"""
    user = await require_auth(request, credentials)
    
    entry = await db.delivery_entries.find_one({"id": entry_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    # Check ownership or admin access
    if entry["user_id"] != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    return DeliveryEntry(**entry)

@api_router.put("/entries/{entry_id}", response_model=DeliveryEntry)
async def update_entry(entry_id: str, entry_data: DeliveryEntryUpdate, request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Update delivery entry"""
    user = await require_auth(request, credentials)
    
    entry = await db.delivery_entries.find_one({"id": entry_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    # Check ownership or admin access
    if entry["user_id"] != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Update only provided fields
    update_data = {k: v for k, v in entry_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.delivery_entries.update_one({"id": entry_id}, {"$set": update_data})
    
    updated_entry = await db.delivery_entries.find_one({"id": entry_id})
    return DeliveryEntry(**updated_entry)

@api_router.delete("/entries/{entry_id}")
async def delete_entry(entry_id: str, request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Delete delivery entry"""
    user = await require_auth(request, credentials)
    
    entry = await db.delivery_entries.find_one({"id": entry_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    # Check ownership or admin access
    if entry["user_id"] != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.delivery_entries.delete_one({"id": entry_id})
    return {"message": "Entry deleted successfully"}

# Dashboard endpoints
@api_router.get("/dashboard/summary", response_model=DashboardSummary)
async def get_dashboard_summary(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get dashboard summary - aggregate data from all users"""
    user = await require_auth(request, credentials)
    
    # Aggregate all entries data
    pipeline = [
        {
            "$group": {
                "_id": None,
                "total_challan_amount": {"$sum": "$challan_amount"},
                "total_delivered_amount": {"$sum": "$delivered_amount"},
                "total_pending_amount": {"$sum": "$pending_amount"},
                "total_vehicle_required": {"$sum": "$vehicle_required"},
                "total_vehicle_confirmed": {"$sum": "$vehicle_confirmed"},
                "total_vehicle_missing": {"$sum": "$vehicle_missing"},
                "total_entries": {"$sum": 1}
            }
        }
    ]
    
    result = await db.delivery_entries.aggregate(pipeline).to_list(1)
    
    if not result:
        return DashboardSummary(
            total_challan_amount=0,
            total_delivered_amount=0,
            total_pending_amount=0,
            total_vehicle_required=0,
            total_vehicle_confirmed=0,
            total_vehicle_missing=0,
            delivery_rate=0,
            vehicle_utilization_rate=0,
            recent_entries_count=0
        )
    
    data = result[0]
    
    # Calculate rates
    delivery_rate = (data["total_delivered_amount"] / data["total_challan_amount"]) * 100 if data["total_challan_amount"] > 0 else 0
    vehicle_utilization_rate = (data["total_vehicle_confirmed"] / data["total_vehicle_required"]) * 100 if data["total_vehicle_required"] > 0 else 0
    
    # Get recent entries count (last 7 days)
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent_entries_count = await db.delivery_entries.count_documents({
        "created_at": {"$gte": seven_days_ago}
    })
    
    return DashboardSummary(
        total_challan_amount=data["total_challan_amount"],
        total_delivered_amount=data["total_delivered_amount"],
        total_pending_amount=data["total_pending_amount"],
        total_vehicle_required=data["total_vehicle_required"],
        total_vehicle_confirmed=data["total_vehicle_confirmed"],
        total_vehicle_missing=data["total_vehicle_missing"],
        delivery_rate=delivery_rate,
        vehicle_utilization_rate=vehicle_utilization_rate,
        recent_entries_count=recent_entries_count
    )

@api_router.get("/dashboard/chart-data")
async def get_chart_data(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get chart data for dashboard visualization"""
    user = await require_auth(request, credentials)
    
    # Get daily trend data for the last 30 days
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    
    pipeline = [
        {
            "$match": {
                "created_at": {"$gte": thirty_days_ago}
            }
        },
        {
            "$group": {
                "_id": "$date",
                "challan_amount": {"$sum": "$challan_amount"},
                "delivered_amount": {"$sum": "$delivered_amount"},
                "pending_amount": {"$sum": "$pending_amount"},
                "vehicle_required": {"$sum": "$vehicle_required"},
                "vehicle_confirmed": {"$sum": "$vehicle_confirmed"}
            }
        },
        {
            "$sort": {"_id": 1}
        }
    ]
    
    daily_data = await db.delivery_entries.aggregate(pipeline).to_list(100)
    
    return {
        "daily_trend": daily_data
    }

# Admin endpoints
@api_router.get("/admin/entries", response_model=List[DeliveryEntry])
async def get_all_entries(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get all delivery entries (admin only)"""
    user = await require_admin(request, credentials)
    
    entries = await db.delivery_entries.find({}).sort("created_at", -1).to_list(1000)
    return [DeliveryEntry(**entry) for entry in entries]

@api_router.get("/admin/users", response_model=List[User])
async def get_all_users(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get all users (admin only)"""
    user = await require_admin(request, credentials)
    
    users = await db.users.find({}).to_list(1000)
    return [User(**user) for user in users]

@api_router.get("/admin/export")
async def export_data(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Export all data as JSON (admin only)"""
    user = await require_admin(request, credentials)
    
    entries = await db.delivery_entries.find({}).to_list(10000)
    users = await db.users.find({}).to_list(1000)
    
    # Clean up data for export (remove MongoDB ObjectIds)
    clean_entries = [{k: v for k, v in entry.items() if k != "_id"} for entry in entries]
    clean_users = [{k: v for k, v in user.items() if k != "_id"} for user in users]
    
    return {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "entries": clean_entries,
        "users": clean_users
    }

# Basic endpoints
@api_router.get("/")
async def root():
    return {"message": "Delivery Dashboard API", "status": "running"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include the router in the main app
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
