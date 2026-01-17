# FunMastis - Short Video Social App PRD

## Original Problem Statement
Short video social media app banana hai with:
- Video upload aur dekhna
- Like, comment, share
- Follow/Followers system
- For You Page (feed)
- Profile page
- JWT based custom auth

## Architecture
- **Backend**: FastAPI (Python) with MongoDB
- **Frontend**: React with Tailwind CSS + Shadcn UI
- **Authentication**: JWT tokens
- **Database Collections**: users, videos, likes, comments, follows
- **PWA**: Progressive Web App for mobile installation
- **Domain**: funmastis.com

## User Personas
1. **Content Creator**: Uploads videos, builds followers
2. **Viewer**: Scrolls feed, likes, comments, follows creators
3. **Guest**: Can view feed but can't interact

## Core Requirements (Static)
- [x] User registration and login
- [x] JWT authentication
- [x] Video feed with vertical scroll
- [x] Video upload via URL
- [x] Like/unlike videos
- [x] Comment system
- [x] Follow/unfollow users
- [x] User profile page
- [x] Search (users & videos)

## What's Been Implemented (January 2026)

### Backend APIs
- `/api/auth/register` - User registration
- `/api/auth/login` - User login
- `/api/auth/me` - Get current user
- `/api/users/{id}` - Get user profile
- `/api/users/{id}/follow` - Follow/Unfollow
- `/api/users/{id}/followers` - Get followers
- `/api/users/{id}/following` - Get following
- `/api/videos` - Create video
- `/api/videos/feed` - Get video feed
- `/api/videos/user/{id}` - Get user videos
- `/api/videos/{id}` - Get/Delete video
- `/api/videos/{id}/like` - Like/Unlike
- `/api/videos/{id}/comments` - Add/Get comments
- `/api/videos/{id}/share` - Share video
- `/api/search/users` - Search users
- `/api/search/videos` - Search videos

### Frontend Pages
- Auth Page (Login/Signup)
- Feed Page (vertical scrolling videos)
- Upload Page (sample videos + URL)
- Profile Page (stats, videos, follow)
- Search Page (users & videos tabs)

### Components
- VideoCard (play/pause, mute, like, comment, share)
- CommentModal (add/view/delete comments)
- Navbar (bottom navigation)

## Design System: "Electric Midnight"
- Dark mode theme (black background)
- Primary: Fuchsia (#D946EF)
- Secondary: Green (#22C55E)
- Fonts: Unbounded (headings), Plus Jakarta Sans (body)

## Prioritized Backlog

### P0 (Critical) - Done ✅
- User auth
- Video feed
- Like/comment/share
- Follow system

### P1 (High Priority)
- Video file upload (not just URL)
- Notifications system
- Video recording in-app

### P2 (Medium Priority)
- Hashtags & trending
- Duet/stitch feature
- Effects & filters
- Analytics dashboard

### P3 (Future)
- Live streaming
- Direct messages
- Creator monetization
- AI recommendations

## Recent Updates (January 2026)

### Virtual Gifts & Coins System - COMPLETED ✅ (Jan 17, 2026)
- Razorpay payment integration (UPI, Cards, Wallets)
- 4 Coin packages: Starter (₹49), Popular (₹199), Super (₹349), Mega (₹1499)
- 6 Gift types: Rose (10), Heart (50), Star (100), Fire (200), Diamond (500), Crown (1000)
- Creator wallet with earned coins tracking
- 30% platform commission (70% to creators)
- Gift animations during live streams
- Withdrawal system for creators

### Profile Photo Upload - COMPLETED ✅ (Jan 17, 2026)
- Custom photo upload option added
- Camera icon on avatar for quick upload
- "Upload Your Photo" button
- Support for JPEG, PNG, GIF, WebP (max 5MB)
- Pre-made avatars still available as fallback

### In-App Notifications - COMPLETED ✅ (Jan 17, 2026)
- Bell icon with unread count badge
- Dropdown showing all notifications
- Notification types: Like, Comment, Follow
- Mark all as read / Mark single as read
- Click notification to navigate to relevant content
- Auto-refresh unread count every 30 seconds

### Live Streaming Feature - COMPLETED ✅ (Jan 17, 2026)
- Agora SDK integrated for real-time video streaming
- Live streams page with stream cards
- Host can go live with camera/mic controls
- Viewers can watch live streams
- Real-time chat with WebSocket
- Emoji reactions during live streams
- Viewer count tracking
- Stream end functionality

### PWA Implementation - COMPLETED ✅
- manifest.json created with app metadata
- service-worker.js for offline caching
- App icons (72x72 to 512x512) generated
- index.html updated with manifest link & apple meta tags
- index.js updated with service worker registration
- App is now installable on mobile devices

### Other Completed Features
- Admin Panel with user/video/comment management
- App renamed to "FunMastis"
- Direct video file upload & camera recording
- Video trimming feature
- Camera filters (Snapchat-style)
- Forgot Password flow
- Share, Download, QR Code features
- Performance optimizations (lazy loading, memoization)

## Next Tasks
1. Hashtags & trending system
2. Video effects/filters improvements
3. Native Mobile App (Google Play Store / iOS App Store)
4. Browser Push Notifications (optional enhancement)
