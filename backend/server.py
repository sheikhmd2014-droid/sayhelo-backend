from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'tikverse_secret_key_2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ==================== MODELS ====================

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class AdminLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    username: str
    email: str
    avatar: Optional[str] = None
    bio: Optional[str] = None
    followers_count: int = 0
    following_count: int = 0
    is_banned: bool = False
    is_admin: bool = False
    created_at: str

class VideoCreate(BaseModel):
    caption: str
    video_url: str
    thumbnail_url: Optional[str] = None

class VideoResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    username: str
    user_avatar: Optional[str] = None
    caption: str
    video_url: str
    thumbnail_url: Optional[str] = None
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    is_liked: bool = False
    is_approved: bool = True
    created_at: str

class CommentCreate(BaseModel):
    content: str

class CommentResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    video_id: str
    user_id: str
    username: str
    user_avatar: Optional[str] = None
    content: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None

# Admin Models
class AdminUserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    username: str
    email: str
    avatar: Optional[str] = None
    bio: Optional[str] = None
    followers_count: int = 0
    following_count: int = 0
    is_banned: bool = False
    is_admin: bool = False
    created_at: str

class AdminVideoResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    username: str
    user_avatar: Optional[str] = None
    caption: str
    video_url: str
    thumbnail_url: Optional[str] = None
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    is_approved: bool = True
    created_at: str

class AdminStatsResponse(BaseModel):
    total_users: int
    total_videos: int
    total_likes: int
    total_comments: int
    total_follows: int
    banned_users: int
    pending_videos: int
    users_today: int
    videos_today: int

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))) -> Optional[dict]:
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        return user
    except:
        return None

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"$or": [{"email": user_data.email}, {"username": user_data.username}]})
    if existing:
        raise HTTPException(status_code=400, detail="Email or username already exists")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "username": user_data.username,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "avatar": f"https://api.dicebear.com/7.x/avataaars/svg?seed={user_data.username}",
        "bio": "",
        "followers_count": 0,
        "following_count": 0,
        "is_banned": False,
        "is_admin": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id)
    user_response = {k: v for k, v in user_doc.items() if k != 'password'}
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(**user_response)
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if not user or not verify_password(user_data.password, user['password']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if user.get('is_banned', False):
        raise HTTPException(status_code=403, detail="Account is banned")
    
    token = create_token(user['id'])
    user_response = {k: v for k, v in user.items() if k != 'password'}
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(**user_response)
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**{k: v for k, v in current_user.items() if k != 'password'})

# ==================== USER ROUTES ====================

@api_router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(**user)

@api_router.put("/users/profile", response_model=UserResponse)
async def update_profile(profile: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in profile.model_dump().items() if v is not None}
    if update_data:
        await db.users.update_one({"id": current_user['id']}, {"$set": update_data})
    
    user = await db.users.find_one({"id": current_user['id']}, {"_id": 0, "password": 0})
    return UserResponse(**user)

@api_router.post("/users/{user_id}/follow")
async def follow_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if user_id == current_user['id']:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing_follow = await db.follows.find_one({
        "follower_id": current_user['id'],
        "following_id": user_id
    })
    
    if existing_follow:
        raise HTTPException(status_code=400, detail="Already following")
    
    await db.follows.insert_one({
        "id": str(uuid.uuid4()),
        "follower_id": current_user['id'],
        "following_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.users.update_one({"id": user_id}, {"$inc": {"followers_count": 1}})
    await db.users.update_one({"id": current_user['id']}, {"$inc": {"following_count": 1}})
    
    return {"message": "Followed successfully"}

@api_router.delete("/users/{user_id}/follow")
async def unfollow_user(user_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.follows.delete_one({
        "follower_id": current_user['id'],
        "following_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Not following this user")
    
    await db.users.update_one({"id": user_id}, {"$inc": {"followers_count": -1}})
    await db.users.update_one({"id": current_user['id']}, {"$inc": {"following_count": -1}})
    
    return {"message": "Unfollowed successfully"}

@api_router.get("/users/{user_id}/is-following")
async def check_following(user_id: str, current_user: dict = Depends(get_current_user)):
    follow = await db.follows.find_one({
        "follower_id": current_user['id'],
        "following_id": user_id
    })
    return {"is_following": follow is not None}

@api_router.get("/users/{user_id}/followers", response_model=List[UserResponse])
async def get_followers(user_id: str, skip: int = 0, limit: int = 20):
    follows = await db.follows.find({"following_id": user_id}, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    follower_ids = [f['follower_id'] for f in follows]
    users = await db.users.find({"id": {"$in": follower_ids}}, {"_id": 0, "password": 0}).to_list(limit)
    return [UserResponse(**u) for u in users]

@api_router.get("/users/{user_id}/following", response_model=List[UserResponse])
async def get_following(user_id: str, skip: int = 0, limit: int = 20):
    follows = await db.follows.find({"follower_id": user_id}, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    following_ids = [f['following_id'] for f in follows]
    users = await db.users.find({"id": {"$in": following_ids}}, {"_id": 0, "password": 0}).to_list(limit)
    return [UserResponse(**u) for u in users]

# ==================== VIDEO ROUTES ====================

@api_router.post("/videos", response_model=VideoResponse)
async def create_video(video_data: VideoCreate, current_user: dict = Depends(get_current_user)):
    video_id = str(uuid.uuid4())
    video_doc = {
        "id": video_id,
        "user_id": current_user['id'],
        "username": current_user['username'],
        "user_avatar": current_user.get('avatar'),
        "caption": video_data.caption,
        "video_url": video_data.video_url,
        "thumbnail_url": video_data.thumbnail_url,
        "likes_count": 0,
        "comments_count": 0,
        "shares_count": 0,
        "is_approved": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.videos.insert_one(video_doc)
    
    return VideoResponse(**video_doc, is_liked=False)

@api_router.get("/videos/feed", response_model=List[VideoResponse])
async def get_feed(skip: int = 0, limit: int = 10, current_user: Optional[dict] = Depends(get_optional_user)):
    videos = await db.videos.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for video in videos:
        is_liked = False
        if current_user:
            like = await db.likes.find_one({"video_id": video['id'], "user_id": current_user['id']})
            is_liked = like is not None
        result.append(VideoResponse(**video, is_liked=is_liked))
    
    return result

@api_router.get("/videos/user/{user_id}", response_model=List[VideoResponse])
async def get_user_videos(user_id: str, skip: int = 0, limit: int = 20, current_user: Optional[dict] = Depends(get_optional_user)):
    videos = await db.videos.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for video in videos:
        is_liked = False
        if current_user:
            like = await db.likes.find_one({"video_id": video['id'], "user_id": current_user['id']})
            is_liked = like is not None
        result.append(VideoResponse(**video, is_liked=is_liked))
    
    return result

@api_router.get("/videos/{video_id}", response_model=VideoResponse)
async def get_video(video_id: str, current_user: Optional[dict] = Depends(get_optional_user)):
    video = await db.videos.find_one({"id": video_id}, {"_id": 0})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    is_liked = False
    if current_user:
        like = await db.likes.find_one({"video_id": video_id, "user_id": current_user['id']})
        is_liked = like is not None
    
    return VideoResponse(**video, is_liked=is_liked)

@api_router.delete("/videos/{video_id}")
async def delete_video(video_id: str, current_user: dict = Depends(get_current_user)):
    video = await db.videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if video['user_id'] != current_user['id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.videos.delete_one({"id": video_id})
    await db.likes.delete_many({"video_id": video_id})
    await db.comments.delete_many({"video_id": video_id})
    
    return {"message": "Video deleted"}

# ==================== LIKE ROUTES ====================

@api_router.post("/videos/{video_id}/like")
async def like_video(video_id: str, current_user: dict = Depends(get_current_user)):
    video = await db.videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    existing = await db.likes.find_one({"video_id": video_id, "user_id": current_user['id']})
    if existing:
        raise HTTPException(status_code=400, detail="Already liked")
    
    await db.likes.insert_one({
        "id": str(uuid.uuid4()),
        "video_id": video_id,
        "user_id": current_user['id'],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.videos.update_one({"id": video_id}, {"$inc": {"likes_count": 1}})
    
    return {"message": "Liked", "likes_count": video['likes_count'] + 1}

@api_router.delete("/videos/{video_id}/like")
async def unlike_video(video_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.likes.delete_one({"video_id": video_id, "user_id": current_user['id']})
    if result.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Not liked")
    
    video = await db.videos.find_one({"id": video_id})
    await db.videos.update_one({"id": video_id}, {"$inc": {"likes_count": -1}})
    
    return {"message": "Unliked", "likes_count": max(0, video['likes_count'] - 1)}

# ==================== COMMENT ROUTES ====================

@api_router.post("/videos/{video_id}/comments", response_model=CommentResponse)
async def create_comment(video_id: str, comment_data: CommentCreate, current_user: dict = Depends(get_current_user)):
    video = await db.videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    comment_id = str(uuid.uuid4())
    comment_doc = {
        "id": comment_id,
        "video_id": video_id,
        "user_id": current_user['id'],
        "username": current_user['username'],
        "user_avatar": current_user.get('avatar'),
        "content": comment_data.content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.comments.insert_one(comment_doc)
    await db.videos.update_one({"id": video_id}, {"$inc": {"comments_count": 1}})
    
    return CommentResponse(**comment_doc)

@api_router.get("/videos/{video_id}/comments", response_model=List[CommentResponse])
async def get_comments(video_id: str, skip: int = 0, limit: int = 50):
    comments = await db.comments.find({"video_id": video_id}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [CommentResponse(**c) for c in comments]

@api_router.delete("/comments/{comment_id}")
async def delete_comment(comment_id: str, current_user: dict = Depends(get_current_user)):
    comment = await db.comments.find_one({"id": comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment['user_id'] != current_user['id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.comments.delete_one({"id": comment_id})
    await db.videos.update_one({"id": comment['video_id']}, {"$inc": {"comments_count": -1}})
    
    return {"message": "Comment deleted"}

# ==================== SHARE ROUTE ====================

@api_router.post("/videos/{video_id}/share")
async def share_video(video_id: str):
    video = await db.videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    await db.videos.update_one({"id": video_id}, {"$inc": {"shares_count": 1}})
    
    return {"message": "Shared", "shares_count": video['shares_count'] + 1}

# ==================== SEARCH ====================

@api_router.get("/search/users", response_model=List[UserResponse])
async def search_users(q: str, limit: int = 20):
    users = await db.users.find(
        {"username": {"$regex": q, "$options": "i"}},
        {"_id": 0, "password": 0}
    ).limit(limit).to_list(limit)
    return [UserResponse(**u) for u in users]

@api_router.get("/search/videos", response_model=List[VideoResponse])
async def search_videos(q: str, limit: int = 20, current_user: Optional[dict] = Depends(get_optional_user)):
    videos = await db.videos.find(
        {"caption": {"$regex": q, "$options": "i"}},
        {"_id": 0}
    ).limit(limit).to_list(limit)
    
    result = []
    for video in videos:
        is_liked = False
        if current_user:
            like = await db.likes.find_one({"video_id": video['id'], "user_id": current_user['id']})
            is_liked = like is not None
        result.append(VideoResponse(**video, is_liked=is_liked))
    
    return result

# ==================== HEALTH CHECK ====================

@api_router.get("/")
async def root():
    return {"message": "TikVerse API is running"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
