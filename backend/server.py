from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Set
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import base64
import shutil
import json
from agora_token_builder import RtcTokenBuilder

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create uploads directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise ValueError("JWT_SECRET environment variable is required")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Agora Config
AGORA_APP_ID = os.environ.get('AGORA_APP_ID', '')
AGORA_APP_CERTIFICATE = os.environ.get('AGORA_APP_CERTIFICATE', '')

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

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    reset_code: str
    new_password: str

# Live Stream Models
class CreateStreamRequest(BaseModel):
    title: str
    description: Optional[str] = ""

class StreamResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    channel_name: str
    title: str
    description: str
    host_id: str
    host_username: str
    host_avatar: Optional[str] = None
    viewer_count: int = 0
    is_live: bool = True
    created_at: str

class AgoraTokenResponse(BaseModel):
    token: str
    channel_name: str
    uid: int
    app_id: str

class StreamChatMessage(BaseModel):
    content: str

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

@api_router.post("/auth/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user:
        # Don't reveal if email exists or not for security
        return {"message": "If email exists, reset code has been generated", "success": True}
    
    # Generate 6-digit reset code
    import random
    reset_code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
    
    # Store reset code with expiry (15 minutes)
    expiry = datetime.now(timezone.utc) + timedelta(minutes=15)
    await db.password_resets.delete_many({"email": data.email})  # Remove old codes
    await db.password_resets.insert_one({
        "email": data.email,
        "code": reset_code,
        "expires_at": expiry.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # In production, send email here
    # For now, return the code (ONLY FOR DEMO - remove in production)
    return {
        "message": "Reset code generated", 
        "success": True,
        "reset_code": reset_code,  # DEMO ONLY - In production, send via email
        "expires_in": "15 minutes"
    }

@api_router.post("/auth/reset-password")
async def reset_password(data: ResetPasswordRequest):
    # Find reset code
    reset_entry = await db.password_resets.find_one({
        "email": data.email,
        "code": data.reset_code
    }, {"_id": 0})
    
    if not reset_entry:
        raise HTTPException(status_code=400, detail="Invalid reset code")
    
    # Check expiry
    expiry = datetime.fromisoformat(reset_entry['expires_at'].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expiry:
        await db.password_resets.delete_one({"email": data.email})
        raise HTTPException(status_code=400, detail="Reset code expired")
    
    # Validate new password
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Update password
    new_hashed = hash_password(data.new_password)
    result = await db.users.update_one(
        {"email": data.email},
        {"$set": {"password": new_hashed}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Failed to update password")
    
    # Delete used reset code
    await db.password_resets.delete_one({"email": data.email})
    
    return {"message": "Password reset successfully", "success": True}

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
    return {"message": "FunMastis API is running"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# ==================== FILE UPLOAD ====================

@api_router.post("/upload/video")
async def upload_video_file(
    video: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    # Validate file type
    if not video.content_type.startswith('video/'):
        raise HTTPException(status_code=400, detail="File must be a video")
    
    # Check file size (read in chunks to get size)
    contents = await video.read()
    file_size = len(contents)
    
    # 100MB limit
    if file_size > 100 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Video must be less than 100MB. Please trim your video.")
    
    # Generate unique filename
    file_ext = video.filename.split('.')[-1] if '.' in video.filename else 'mp4'
    unique_filename = f"{uuid.uuid4()}.{file_ext}"
    file_path = UPLOAD_DIR / unique_filename
    
    # Save file
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to save video")
    
    # Return the URL
    video_url = f"/api/uploads/{unique_filename}"
    
    return {"video_url": video_url, "filename": unique_filename, "size": file_size}

# Serve uploaded videos through API
@api_router.get("/uploads/{filename}")
async def get_uploaded_video(filename: str):
    from fastapi.responses import FileResponse
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path, media_type="video/mp4")

# ==================== ADMIN HELPER ====================

async def get_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if not user.get('is_admin', False):
            raise HTTPException(status_code=403, detail="Admin access required")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== LIVE STREAMING ====================

# WebSocket Connection Manager for Live Chat
class StreamConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.stream_viewers: Dict[str, int] = {}
    
    async def connect(self, websocket: WebSocket, channel_name: str):
        await websocket.accept()
        if channel_name not in self.active_connections:
            self.active_connections[channel_name] = set()
            self.stream_viewers[channel_name] = 0
        self.active_connections[channel_name].add(websocket)
        self.stream_viewers[channel_name] += 1
    
    def disconnect(self, websocket: WebSocket, channel_name: str):
        if channel_name in self.active_connections:
            self.active_connections[channel_name].discard(websocket)
            self.stream_viewers[channel_name] = max(0, self.stream_viewers.get(channel_name, 1) - 1)
            if not self.active_connections[channel_name]:
                del self.active_connections[channel_name]
                del self.stream_viewers[channel_name]
    
    async def broadcast(self, channel_name: str, message: dict):
        if channel_name in self.active_connections:
            disconnected = []
            for connection in self.active_connections[channel_name]:
                try:
                    await connection.send_json(message)
                except:
                    disconnected.append(connection)
            for conn in disconnected:
                self.disconnect(conn, channel_name)
    
    def get_viewer_count(self, channel_name: str) -> int:
        return self.stream_viewers.get(channel_name, 0)

stream_manager = StreamConnectionManager()

@api_router.post("/streams/create", response_model=StreamResponse)
async def create_stream(stream_data: CreateStreamRequest, user: dict = Depends(get_current_user)):
    """Create a new live stream"""
    if user.get('is_banned', False):
        raise HTTPException(status_code=403, detail="You are banned from streaming")
    
    # Check if user already has an active stream
    existing = await db.streams.find_one({"host_id": user['id'], "is_live": True})
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active stream")
    
    stream_id = str(uuid.uuid4())
    channel_name = f"stream_{stream_id[:8]}"
    
    stream_doc = {
        "id": stream_id,
        "channel_name": channel_name,
        "title": stream_data.title,
        "description": stream_data.description or "",
        "host_id": user['id'],
        "host_username": user['username'],
        "host_avatar": user.get('avatar'),
        "viewer_count": 0,
        "is_live": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.streams.insert_one(stream_doc)
    
    return StreamResponse(**{k: v for k, v in stream_doc.items() if k != '_id'})

@api_router.get("/streams/token/{channel_name}", response_model=AgoraTokenResponse)
async def get_agora_token(channel_name: str, role: str = "publisher", user: dict = Depends(get_current_user)):
    """Generate Agora RTC token for streaming"""
    if not AGORA_APP_ID or not AGORA_APP_CERTIFICATE:
        raise HTTPException(status_code=500, detail="Agora credentials not configured")
    
    # Generate unique UID for user
    uid = abs(hash(user['id'])) % (10**9)
    
    # Set token expiration (1 hour)
    privilege_expired_ts = int(datetime.now(timezone.utc).timestamp()) + 3600
    
    # Role: 1 = publisher, 2 = subscriber
    agora_role = 1 if role == "publisher" else 2
    
    token = RtcTokenBuilder.buildTokenWithUid(
        AGORA_APP_ID,
        AGORA_APP_CERTIFICATE,
        channel_name,
        uid,
        agora_role,
        privilege_expired_ts
    )
    
    return AgoraTokenResponse(
        token=token,
        channel_name=channel_name,
        uid=uid,
        app_id=AGORA_APP_ID
    )

@api_router.get("/streams/live", response_model=List[StreamResponse])
async def get_live_streams():
    """Get all active live streams"""
    streams = await db.streams.find({"is_live": True}, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    # Update viewer counts from connection manager
    for stream in streams:
        stream['viewer_count'] = stream_manager.get_viewer_count(stream['channel_name'])
    
    return [StreamResponse(**s) for s in streams]

@api_router.get("/streams/{stream_id}", response_model=StreamResponse)
async def get_stream(stream_id: str):
    """Get stream details"""
    stream = await db.streams.find_one({"id": stream_id}, {"_id": 0})
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    stream['viewer_count'] = stream_manager.get_viewer_count(stream['channel_name'])
    return StreamResponse(**stream)

@api_router.post("/streams/{stream_id}/end")
async def end_stream(stream_id: str, user: dict = Depends(get_current_user)):
    """End a live stream"""
    stream = await db.streams.find_one({"id": stream_id})
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    if stream['host_id'] != user['id'] and not user.get('is_admin', False):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.streams.update_one({"id": stream_id}, {"$set": {"is_live": False}})
    
    # Notify all viewers
    await stream_manager.broadcast(stream['channel_name'], {
        "type": "stream_ended",
        "message": "Stream has ended"
    })
    
    return {"message": "Stream ended successfully"}

@api_router.get("/streams/{stream_id}/chat")
async def get_stream_chat(stream_id: str, limit: int = 50):
    """Get chat messages for a stream"""
    messages = await db.stream_messages.find(
        {"stream_id": stream_id}, 
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return list(reversed(messages))

# WebSocket for Live Stream Chat
@app.websocket("/ws/stream/{channel_name}/{user_id}/{username}")
async def stream_chat_websocket(websocket: WebSocket, channel_name: str, user_id: str, username: str):
    await stream_manager.connect(websocket, channel_name)
    
    # Broadcast viewer joined
    await stream_manager.broadcast(channel_name, {
        "type": "viewer_joined",
        "username": username,
        "viewer_count": stream_manager.get_viewer_count(channel_name)
    })
    
    # Update viewer count in database
    await db.streams.update_one(
        {"channel_name": channel_name},
        {"$set": {"viewer_count": stream_manager.get_viewer_count(channel_name)}}
    )
    
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            if message_data.get("type") == "chat":
                # Save message to database
                msg_doc = {
                    "id": str(uuid.uuid4()),
                    "stream_id": channel_name,
                    "user_id": user_id,
                    "username": username,
                    "content": message_data.get("content", ""),
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.stream_messages.insert_one(msg_doc)
                
                # Broadcast to all viewers
                await stream_manager.broadcast(channel_name, {
                    "type": "chat",
                    "id": msg_doc["id"],
                    "user_id": user_id,
                    "username": username,
                    "content": msg_doc["content"],
                    "created_at": msg_doc["created_at"]
                })
            
            elif message_data.get("type") == "reaction":
                # Broadcast reaction
                await stream_manager.broadcast(channel_name, {
                    "type": "reaction",
                    "username": username,
                    "emoji": message_data.get("emoji", "❤️")
                })
    
    except WebSocketDisconnect:
        stream_manager.disconnect(websocket, channel_name)
        
        # Broadcast viewer left
        await stream_manager.broadcast(channel_name, {
            "type": "viewer_left",
            "username": username,
            "viewer_count": stream_manager.get_viewer_count(channel_name)
        })
        
        # Update viewer count in database
        await db.streams.update_one(
            {"channel_name": channel_name},
            {"$set": {"viewer_count": stream_manager.get_viewer_count(channel_name)}}
        )

# ==================== ADMIN ROUTES ====================

@api_router.post("/admin/login", response_model=TokenResponse)
async def admin_login(admin_data: AdminLogin):
    user = await db.users.find_one({"email": admin_data.email}, {"_id": 0})
    if not user or not verify_password(admin_data.password, user['password']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get('is_admin', False):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    token = create_token(user['id'])
    user_response = {k: v for k, v in user.items() if k != 'password'}
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(**user_response)
    )

@api_router.post("/admin/create-admin")
async def create_admin():
    """Create default admin if not exists"""
    existing = await db.users.find_one({"email": "admin@tikverse.com"})
    if existing:
        return {"message": "Admin already exists", "email": "admin@tikverse.com"}
    
    admin_id = str(uuid.uuid4())
    admin_doc = {
        "id": admin_id,
        "username": "admin",
        "email": "admin@tikverse.com",
        "password": hash_password("admin123"),
        "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
        "bio": "FunMastis Administrator",
        "followers_count": 0,
        "following_count": 0,
        "is_banned": False,
        "is_admin": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(admin_doc)
    return {"message": "Admin created", "email": "admin@tikverse.com", "password": "admin123"}

@api_router.get("/admin/stats", response_model=AdminStatsResponse)
async def get_admin_stats(admin: dict = Depends(get_admin_user)):
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    total_users = await db.users.count_documents({})
    total_videos = await db.videos.count_documents({})
    total_likes = await db.likes.count_documents({})
    total_comments = await db.comments.count_documents({})
    total_follows = await db.follows.count_documents({})
    banned_users = await db.users.count_documents({"is_banned": True})
    pending_videos = await db.videos.count_documents({"is_approved": False})
    users_today = await db.users.count_documents({"created_at": {"$gte": today}})
    videos_today = await db.videos.count_documents({"created_at": {"$gte": today}})
    
    return AdminStatsResponse(
        total_users=total_users,
        total_videos=total_videos,
        total_likes=total_likes,
        total_comments=total_comments,
        total_follows=total_follows,
        banned_users=banned_users,
        pending_videos=pending_videos,
        users_today=users_today,
        videos_today=videos_today
    )

@api_router.get("/admin/users", response_model=List[AdminUserResponse])
async def get_all_users(skip: int = 0, limit: int = 50, admin: dict = Depends(get_admin_user)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [AdminUserResponse(**u) for u in users]

@api_router.put("/admin/users/{user_id}/ban")
async def ban_user(user_id: str, admin: dict = Depends(get_admin_user)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get('is_admin'):
        raise HTTPException(status_code=400, detail="Cannot ban admin")
    
    await db.users.update_one({"id": user_id}, {"$set": {"is_banned": True}})
    return {"message": "User banned"}

@api_router.put("/admin/users/{user_id}/unban")
async def unban_user(user_id: str, admin: dict = Depends(get_admin_user)):
    await db.users.update_one({"id": user_id}, {"$set": {"is_banned": False}})
    return {"message": "User unbanned"}

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(get_admin_user)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get('is_admin'):
        raise HTTPException(status_code=400, detail="Cannot delete admin")
    
    # Delete user and all their data
    await db.users.delete_one({"id": user_id})
    await db.videos.delete_many({"user_id": user_id})
    await db.likes.delete_many({"user_id": user_id})
    await db.comments.delete_many({"user_id": user_id})
    await db.follows.delete_many({"$or": [{"follower_id": user_id}, {"following_id": user_id}]})
    
    return {"message": "User deleted"}

@api_router.put("/admin/users/{user_id}/make-admin")
async def make_admin(user_id: str, admin: dict = Depends(get_admin_user)):
    await db.users.update_one({"id": user_id}, {"$set": {"is_admin": True}})
    return {"message": "User is now admin"}

@api_router.put("/admin/users/{user_id}/remove-admin")
async def remove_admin(user_id: str, admin: dict = Depends(get_admin_user)):
    if user_id == admin['id']:
        raise HTTPException(status_code=400, detail="Cannot remove own admin status")
    await db.users.update_one({"id": user_id}, {"$set": {"is_admin": False}})
    return {"message": "Admin status removed"}

@api_router.get("/admin/videos", response_model=List[AdminVideoResponse])
async def get_all_videos(skip: int = 0, limit: int = 50, admin: dict = Depends(get_admin_user)):
    videos = await db.videos.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [AdminVideoResponse(**v) for v in videos]

@api_router.put("/admin/videos/{video_id}/approve")
async def approve_video(video_id: str, admin: dict = Depends(get_admin_user)):
    await db.videos.update_one({"id": video_id}, {"$set": {"is_approved": True}})
    return {"message": "Video approved"}

@api_router.put("/admin/videos/{video_id}/reject")
async def reject_video(video_id: str, admin: dict = Depends(get_admin_user)):
    await db.videos.update_one({"id": video_id}, {"$set": {"is_approved": False}})
    return {"message": "Video rejected"}

@api_router.delete("/admin/videos/{video_id}")
async def admin_delete_video(video_id: str, admin: dict = Depends(get_admin_user)):
    video = await db.videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    await db.videos.delete_one({"id": video_id})
    await db.likes.delete_many({"video_id": video_id})
    await db.comments.delete_many({"video_id": video_id})
    
    return {"message": "Video deleted"}

@api_router.get("/admin/comments", response_model=List[CommentResponse])
async def get_all_comments(skip: int = 0, limit: int = 100, admin: dict = Depends(get_admin_user)):
    comments = await db.comments.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [CommentResponse(**c) for c in comments]

@api_router.delete("/admin/comments/{comment_id}")
async def admin_delete_comment(comment_id: str, admin: dict = Depends(get_admin_user)):
    comment = await db.comments.find_one({"id": comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    await db.comments.delete_one({"id": comment_id})
    await db.videos.update_one({"id": comment['video_id']}, {"$inc": {"comments_count": -1}})
    
    return {"message": "Comment deleted"}

@api_router.put("/admin/change-password")
async def change_admin_password(data: ChangePasswordRequest, admin: dict = Depends(get_admin_user)):
    # Verify current password
    user = await db.users.find_one({"id": admin['id']}, {"_id": 0})
    if not verify_password(data.current_password, user['password']):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Update password
    new_hashed = hash_password(data.new_password)
    await db.users.update_one({"id": admin['id']}, {"$set": {"password": new_hashed}})
    
    return {"message": "Password changed successfully"}

# Include router and middleware
app.include_router(api_router)

# Serve uploaded files
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

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
