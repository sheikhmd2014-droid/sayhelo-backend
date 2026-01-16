import { useState, useRef, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Heart, MessageCircle, Share2, Play, Pause, Volume2, VolumeX, Music, Download, Instagram, Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { lazy, Suspense } from 'react';

const CommentModal = lazy(() => import('./CommentModal'));

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
    setShowShareModal(true);
  };

  const handleNativeShare = async () => {
    try {
      await axios.post(`${API}/videos/${video.id}/share`);
      setSharesCount(prev => prev + 1);
      
      if (navigator.share) {
        await navigator.share({
          title: `${video.username} on FunMastis`,
          text: video.caption,
          url: window.location.origin + `/?v=${video.id}`
        });
      } else {
        await navigator.clipboard.writeText(window.location.origin + `/?v=${video.id}`);
        toast.success('Link copied!');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Share failed:', error);
      }
    }
  };

  const handleShareToInstagram = async () => {
    try {
      await axios.post(`${API}/videos/${video.id}/share`);
      setSharesCount(prev => prev + 1);
      
      // Open Instagram story share (works on mobile)
      const instagramUrl = `instagram://library?AssetPath=${encodeURIComponent(video.video_url)}`;
      
      // Try to open Instagram, fallback to web
      window.open(instagramUrl, '_blank');
      
      // Also copy link
      await navigator.clipboard.writeText(window.location.origin + `/?v=${video.id}`);
      toast.success('Link copied! Paste in Instagram');
    } catch (error) {
      toast.error('Copy the link and share on Instagram');
    }
  };

  const handleShareToSnapchat = async () => {
    try {
      await axios.post(`${API}/videos/${video.id}/share`);
      setSharesCount(prev => prev + 1);
      
      const shareUrl = window.location.origin + `/?v=${video.id}`;
      const snapchatUrl = `https://www.snapchat.com/share?url=${encodeURIComponent(shareUrl)}`;
      
      window.open(snapchatUrl, '_blank');
      toast.success('Opening Snapchat...');
    } catch (error) {
      toast.error('Failed to share');
    }
  };

  const handleShareToWhatsApp = async () => {
    try {
      await axios.post(`${API}/videos/${video.id}/share`);
      setSharesCount(prev => prev + 1);
      
      const shareUrl = window.location.origin + `/?v=${video.id}`;
      const text = `Check out this video on Fun Video App: ${video.caption}`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text + '\n' + shareUrl)}`;
      
      window.open(whatsappUrl, '_blank');
    } catch (error) {
      toast.error('Failed to share');
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      toast.info('Downloading video...');
      
      // Fetch video as blob
      const response = await fetch(video.video_url);
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `funvideo_${video.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('Video downloaded!');
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: open video in new tab
      window.open(video.video_url, '_blank');
      toast.info('Video opened in new tab - long press to save');
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + `/?v=${video.id}`);
      toast.success('Link copied!');
    } catch (error) {
      toast.error('Failed to copy link');
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
            <span className="text-xs font-semibold">{formatCount(sharesCount)}</span>
          </button>

          {/* Download */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex flex-col items-center gap-1 active-scale"
            data-testid={`download-button-${video.id}`}
          >
            <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
              {downloading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-6 h-6" />
              )}
            </div>
            <span className="text-xs font-semibold">Save</span>
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
      <Suspense fallback={null}>
        <CommentModal
          isOpen={showComments}
          onClose={() => setShowComments(false)}
          videoId={video.id}
          onCommentAdded={() => setCommentsCount(prev => prev + 1)}
        />
      </Suspense>

      {/* Share Modal */}
      <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-sm mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-unbounded text-center">Share Video</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-4 gap-4 py-4">
            {/* Instagram */}
            <button
              onClick={handleShareToInstagram}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-zinc-800 transition-colors"
              data-testid="share-instagram"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center">
                <Instagram className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs">Instagram</span>
            </button>

            {/* Snapchat */}
            <button
              onClick={handleShareToSnapchat}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-zinc-800 transition-colors"
              data-testid="share-snapchat"
            >
              <div className="w-12 h-12 rounded-full bg-yellow-400 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-white fill-current">
                  <path d="M12.166 3c.796 0 3.495.223 4.769 3.073.426.955.322 2.574.24 3.91l-.015.253c-.004.07-.008.14-.01.206.12.062.253.095.39.095.248 0 .476-.093.628-.188a.946.946 0 0 1 .47-.136c.283 0 .548.115.742.29.213.194.332.46.332.738 0 .487-.347.874-.998 1.092a4.635 4.635 0 0 1-.818.194c-.18.028-.31.058-.394.087-.128.043-.154.088-.163.11-.054.138.01.381.066.525l.008.02c.097.254.206.54.206.843 0 .15-.023.296-.073.446-.212.628-.816 1.058-1.39 1.308-.302.132-.606.23-.89.304-.118.03-.237.06-.35.092-.047.013-.2.058-.22.088-.024.042-.008.143.006.196.031.115.115.333.115.333.085.225.143.448.143.688 0 .378-.178.772-.594.97-.397.19-.858.26-1.263.315l-.238.032c-.265.035-.452.06-.64.116-.248.073-.48.203-.788.442-.395.308-.838.672-1.578.672-.025 0-.05-.001-.076-.003H10.5c-.74 0-1.183-.364-1.578-.672a2.27 2.27 0 0 0-.788-.442c-.188-.056-.375-.08-.64-.116l-.24-.032c-.403-.056-.865-.126-1.262-.316-.416-.198-.594-.592-.594-.97 0-.24.058-.462.143-.687l.115-.334c.014-.052.03-.153.007-.195-.022-.03-.174-.075-.22-.088-.114-.032-.233-.062-.35-.092a6.07 6.07 0 0 1-.89-.304c-.575-.25-1.18-.68-1.39-1.308a1.182 1.182 0 0 1-.074-.446c0-.303.11-.59.206-.843l.008-.02c.057-.144.12-.387.066-.524-.01-.023-.035-.068-.163-.11-.084-.03-.214-.06-.394-.088a4.635 4.635 0 0 1-.818-.194C3.347 12.08 3 11.693 3 11.206c0-.278.12-.544.332-.738a1.02 1.02 0 0 1 .743-.29.946.946 0 0 1 .469.136c.152.095.38.188.628.188a.87.87 0 0 0 .39-.095 14.035 14.035 0 0 1-.01-.206l-.016-.253c-.08-1.336-.186-2.955.24-3.91C7.052 3.223 9.75 3 10.546 3h1.62z"/>
                </svg>
              </div>
              <span className="text-xs">Snapchat</span>
            </button>

            {/* WhatsApp */}
            <button
              onClick={handleShareToWhatsApp}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-zinc-800 transition-colors"
              data-testid="share-whatsapp"
            >
              <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                <Send className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs">WhatsApp</span>
            </button>

            {/* Copy Link */}
            <button
              onClick={handleCopyLink}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-zinc-800 transition-colors"
              data-testid="share-copy"
            >
              <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center">
                <Share2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs">Copy Link</span>
            </button>
          </div>

          {/* Download option in share modal */}
          <button
            onClick={() => { handleDownload(); setShowShareModal(false); }}
            disabled={downloading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-600 font-semibold flex items-center justify-center gap-2"
            data-testid="share-download"
          >
            {downloading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Download className="w-5 h-5" />
                Download Video
              </>
            )}
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
