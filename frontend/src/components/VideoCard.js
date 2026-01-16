import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Heart, MessageCircle, Share2, Play, Pause, Volume2, VolumeX, Music, Download, Instagram, Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import CommentModal from './CommentModal';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function VideoCard({ video, isActive, onLikeUpdate }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isLiked, setIsLiked] = useState(video.is_liked);
  const [likesCount, setLikesCount] = useState(video.likes_count);
  const [commentsCount, setCommentsCount] = useState(video.comments_count);
  const [sharesCount, setSharesCount] = useState(video.shares_count);
  const [likeAnimation, setLikeAnimation] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const videoRef = useRef(null);
  const { token, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        setIsPlaying(false);
      }
    }
  }, [isActive]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleLike = async (e) => {
    e.stopPropagation();
    if (!token) {
      toast.error('Please login to like videos');
      navigate('/auth');
      return;
    }

    try {
      if (isLiked) {
        await axios.delete(`${API}/videos/${video.id}/like`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
        onLikeUpdate?.(video.id, false, likesCount - 1);
      } else {
        await axios.post(`${API}/videos/${video.id}/like`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
        setLikeAnimation(true);
        setTimeout(() => setLikeAnimation(false), 300);
        onLikeUpdate?.(video.id, true, likesCount + 1);
      }
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to update like';
      if (!message.includes('Already')) {
        toast.error(message);
      }
    }
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    try {
      await axios.post(`${API}/videos/${video.id}/share`);
      if (navigator.share) {
        await navigator.share({
          title: video.caption,
          url: window.location.origin + `/video/${video.id}`
        });
      } else {
        await navigator.clipboard.writeText(window.location.origin + `/video/${video.id}`);
        toast.success('Link copied!');
      }
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const handleDoubleClick = (e) => {
    e.preventDefault();
    if (!isLiked && token) {
      handleLike(e);
    }
  };

  const formatCount = (count) => {
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count;
  };

  return (
    <>
      <div 
        className="snap-item relative w-full h-[100dvh] bg-black"
        data-testid={`video-card-${video.id}`}
      >
        {/* Video */}
        <div 
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={togglePlay}
          onDoubleClick={handleDoubleClick}
        >
          <video
            ref={videoRef}
            src={video.video_url}
            poster={video.thumbnail_url}
            className="w-full h-full object-cover"
            loop
            muted={isMuted}
            playsInline
            data-testid={`video-player-${video.id}`}
          />
          
          {/* Play/Pause overlay */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="w-20 h-20 rounded-full bg-black/50 flex items-center justify-center">
                <Play className="w-10 h-10 text-white fill-white ml-1" />
              </div>
            </div>
          )}
        </div>

        {/* Gradient overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-1/3 video-gradient pointer-events-none" />

        {/* Mute button */}
        <button
          onClick={toggleMute}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center active-scale z-10"
          data-testid="mute-toggle"
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>

        {/* Right sidebar - Actions */}
        <div className="absolute right-3 bottom-32 flex flex-col items-center gap-5 z-10">
          {/* Profile */}
          <button
            onClick={() => navigate(`/profile/${video.user_id}`)}
            className="relative active-scale"
            data-testid={`video-profile-${video.id}`}
          >
            <Avatar className="w-12 h-12 border-2 border-white">
              <AvatarImage src={video.user_avatar} />
              <AvatarFallback className="bg-zinc-800 text-white">
                {video.username?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </button>

          {/* Like */}
          <button
            onClick={handleLike}
            className={`flex flex-col items-center gap-1 active-scale ${likeAnimation ? 'like-animation' : ''}`}
            data-testid={`like-button-${video.id}`}
          >
            <div className={`w-12 h-12 rounded-full bg-black/50 flex items-center justify-center ${isLiked ? 'text-red-500' : 'text-white'}`}>
              <Heart className={`w-7 h-7 ${isLiked ? 'fill-current' : ''}`} />
            </div>
            <span className="text-xs font-semibold">{formatCount(likesCount)}</span>
          </button>

          {/* Comments */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowComments(true);
            }}
            className="flex flex-col items-center gap-1 active-scale"
            data-testid={`comment-button-${video.id}`}
          >
            <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
              <MessageCircle className="w-7 h-7" />
            </div>
            <span className="text-xs font-semibold">{formatCount(commentsCount)}</span>
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="flex flex-col items-center gap-1 active-scale"
            data-testid={`share-button-${video.id}`}
          >
            <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
              <Share2 className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold">{formatCount(video.shares_count)}</span>
          </button>

          {/* Music disc */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 border-2 border-zinc-600 flex items-center justify-center animate-spin" style={{ animationDuration: '3s' }}>
            <Music className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-20 left-4 right-20 z-10">
          <button
            onClick={() => navigate(`/profile/${video.user_id}`)}
            className="flex items-center gap-2 mb-2 active-scale"
            data-testid={`video-username-${video.id}`}
          >
            <span className="font-semibold">@{video.username}</span>
          </button>
          <p className="text-sm text-zinc-200 line-clamp-2">{video.caption}</p>
        </div>
      </div>

      {/* Comments Modal */}
      <CommentModal
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        videoId={video.id}
        onCommentAdded={() => setCommentsCount(prev => prev + 1)}
      />
    </>
  );
}
