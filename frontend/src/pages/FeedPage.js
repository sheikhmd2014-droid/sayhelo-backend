import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import VideoCard from '../components/VideoCard';
import { Play } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Memoized VideoCard to prevent unnecessary re-renders
const MemoizedVideoCard = memo(VideoCard);

export default function FeedPage() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const containerRef = useRef(null);
  const { token } = useAuth();
  const navigate = useNavigate();

  const fetchVideos = useCallback(async (skip = 0) => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API}/videos/feed?skip=${skip}&limit=10`, { headers });
      
      if (skip === 0) {
        setVideos(response.data);
      } else {
        setVideos(prev => [...prev, ...response.data]);
      }
      setHasMore(response.data.length === 10);
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const itemHeight = container.clientHeight;
    const newIndex = Math.round(scrollTop / itemHeight);
    
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
    }
    
    // Load more when near the end
    if (newIndex >= videos.length - 3 && hasMore && !loading) {
      fetchVideos(videos.length);
    }
  }, [currentIndex, videos.length, hasMore, loading, fetchVideos]);

  const updateVideoLike = (videoId, isLiked, likesCount) => {
    setVideos(prev => prev.map(v => 
      v.id === videoId ? { ...v, is_liked: isLiked, likes_count: likesCount } : v
    ));
  };

  if (loading && videos.length === 0) {
    return (
      <div className="h-[100dvh] bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center mx-auto mb-4 glow-primary animate-pulse">
            <Play className="w-6 h-6 text-white fill-white" />
          </div>
          <p className="text-zinc-500">Loading videos...</p>
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="h-[100dvh] bg-black flex items-center justify-center" data-testid="empty-feed">
        <div className="text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center mx-auto mb-4 glow-primary">
            <Play className="w-8 h-8 text-white fill-white" />
          </div>
          <h2 className="font-unbounded font-bold text-xl mb-2">No Videos Yet</h2>
          <p className="text-zinc-500 mb-6">Be the first to share something amazing!</p>
          <button
            data-testid="upload-first-video"
            onClick={() => navigate('/upload')}
            className="px-6 py-3 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 font-semibold active-scale"
          >
            Upload Video
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="snap-feed scrollbar-hide"
      data-testid="video-feed"
    >
      {videos.map((video, index) => (
        <MemoizedVideoCard
          key={video.id}
          video={video}
          isActive={index === currentIndex}
          onLikeUpdate={updateVideoLike}
        />
      ))}
      
      {loading && (
        <div className="h-20 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
