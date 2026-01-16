import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { X, Send, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CommentModal({ isOpen, onClose, videoId, onCommentAdded }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);
  const { token, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen && videoId) {
      fetchComments();
    }
  }, [isOpen, videoId]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/videos/${videoId}/comments`);
      setComments(response.data);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    
    if (!token) {
      toast.error('Please login to comment');
      navigate('/auth');
      return;
    }

    setSubmitting(true);
    try {
      const response = await axios.post(
        `${API}/videos/${videoId}/comments`,
        { content: newComment.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setComments(prev => [response.data, ...prev]);
      setNewComment('');
      onCommentAdded?.();
      toast.success('Comment added!');
    } catch (error) {
      toast.error('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    try {
      await axios.delete(`${API}/comments/${commentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComments(prev => prev.filter(c => c.id !== commentId));
      toast.success('Comment deleted');
    } catch (error) {
      toast.error('Failed to delete comment');
    }
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = (now - date) / 1000;
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-lg h-[70vh] glass rounded-t-3xl flex flex-col fade-in"
        onClick={(e) => e.stopPropagation()}
        data-testid="comments-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="font-unbounded font-semibold text-lg">
            {comments.length} Comments
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
            data-testid="close-comments"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comments list */}
        <ScrollArea className="flex-1 p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              No comments yet. Be the first!
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div 
                  key={comment.id} 
                  className="flex gap-3"
                  data-testid={`comment-${comment.id}`}
                >
                  <button onClick={() => navigate(`/profile/${comment.user_id}`)}>
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={comment.user_avatar} />
                      <AvatarFallback className="bg-zinc-800 text-white text-sm">
                        {comment.username?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/profile/${comment.user_id}`)}
                        className="font-semibold text-sm hover:underline"
                      >
                        @{comment.username}
                      </button>
                      <span className="text-xs text-zinc-500">
                        {formatTime(comment.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-300 mt-1 break-words">
                      {comment.content}
                    </p>
                  </div>
                  {user && user.id === comment.user_id && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="text-zinc-500 hover:text-red-500 transition-colors p-1"
                      data-testid={`delete-comment-${comment.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <form 
          onSubmit={handleSubmit}
          className="p-4 border-t border-white/10 flex gap-3"
        >
          <Input
            ref={inputRef}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={token ? "Add a comment..." : "Login to comment"}
            disabled={!token || submitting}
            className="flex-1 bg-zinc-900/50 border-zinc-800 focus:border-primary h-11 rounded-full px-4"
            data-testid="comment-input"
          />
          <button
            type="submit"
            disabled={!newComment.trim() || submitting || !token}
            className="w-11 h-11 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 flex items-center justify-center disabled:opacity-50 active-scale"
            data-testid="submit-comment"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
