import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { ArrowLeft, Grid3X3, Heart, Settings, LogOut, Play, Edit, Camera } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ProfilePage() {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [videos, setVideos] = useState([]);
  const [likedVideos, setLikedVideos] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({ username: '', bio: '', avatar: '' });
  const [saving, setSaving] = useState(false);
  const { user, token, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    fetchProfile();
    fetchVideos();
  }, [userId]);

  useEffect(() => {
    if (token && !isOwnProfile && userId) {
      checkFollowing();
    }
  }, [token, userId, isOwnProfile]);

  const fetchProfile = async () => {
    try {
      const response = await axios.get(`${API}/users/${userId}`);
      setProfile(response.data);
    } catch (error) {
      toast.error('User not found');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const fetchVideos = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API}/videos/user/${userId}`, { headers });
      setVideos(response.data);
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    }
  };

  const checkFollowing = async () => {
    try {
      const response = await axios.get(`${API}/users/${userId}/is-following`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsFollowing(response.data.is_following);
    } catch (error) {
      console.error('Failed to check following:', error);
    }
  };

  const handleFollow = async () => {
    if (!token) {
      navigate('/auth');
      return;
    }

    setFollowLoading(true);
    try {
      if (isFollowing) {
        await axios.delete(`${API}/users/${userId}/follow`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setIsFollowing(false);
        setProfile(prev => ({
          ...prev,
          followers_count: Math.max(0, prev.followers_count - 1)
        }));
      } else {
        await axios.post(`${API}/users/${userId}/follow`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setIsFollowing(true);
        setProfile(prev => ({
          ...prev,
          followers_count: prev.followers_count + 1
        }));
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Action failed');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
    toast.success('Logged out successfully');
  };

  const openEditModal = () => {
    setEditData({
      username: profile?.username || '',
      bio: profile?.bio || '',
      avatar: profile?.avatar || ''
    });
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    if (!editData.username.trim()) {
      toast.error('Username is required');
      return;
    }

    setSaving(true);
    try {
      const response = await axios.put(`${API}/users/profile`, editData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(response.data);
      updateUser(response.data);
      setShowEditModal(false);
      toast.success('Profile updated!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const avatarOptions = [
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.username}`,
    `https://api.dicebear.com/7.x/bottts/svg?seed=${profile?.username}`,
    `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${profile?.username}`,
    `https://api.dicebear.com/7.x/lorelei/svg?seed=${profile?.username}`,
    `https://api.dicebear.com/7.x/micah/svg?seed=${profile?.username}`,
    `https://api.dicebear.com/7.x/notionists/svg?seed=${profile?.username}`,
    `https://api.dicebear.com/7.x/personas/svg?seed=${profile?.username}`,
    `https://api.dicebear.com/7.x/pixel-art/svg?seed=${profile?.username}`,
  ];

  const formatCount = (count) => {
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-zinc-500">User not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20" data-testid="profile-page">
      {/* Header */}
      <div className="sticky top-0 z-30 glass border-b border-white/5">
        <div className="max-w-lg mx-auto flex items-center justify-between h-14 px-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
            data-testid="back-button"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-unbounded font-bold text-lg">@{profile.username}</h1>
          {isOwnProfile ? (
            <button
              onClick={handleLogout}
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors text-red-500"
              data-testid="logout-button"
            >
              <LogOut className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-10" />
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto">
        {/* Profile Info */}
        <div className="p-6 text-center">
          <Avatar className="w-24 h-24 mx-auto mb-4 border-2 border-zinc-800">
            <AvatarImage src={profile.avatar} />
            <AvatarFallback className="bg-zinc-800 text-white text-2xl font-bold">
              {profile.username?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <h2 className="font-unbounded font-bold text-xl mb-1" data-testid="profile-username">
            @{profile.username}
          </h2>
          
          {profile.bio && (
            <p className="text-zinc-400 text-sm mb-4 max-w-xs mx-auto">
              {profile.bio}
            </p>
          )}

          {/* Stats */}
          <div className="flex justify-center gap-8 mb-6">
            <div className="text-center">
              <p className="font-unbounded font-bold text-lg" data-testid="following-count">
                {formatCount(profile.following_count)}
              </p>
              <p className="text-zinc-500 text-xs">Following</p>
            </div>
            <div className="text-center">
              <p className="font-unbounded font-bold text-lg" data-testid="followers-count">
                {formatCount(profile.followers_count)}
              </p>
              <p className="text-zinc-500 text-xs">Followers</p>
            </div>
            <div className="text-center">
              <p className="font-unbounded font-bold text-lg" data-testid="videos-count">
                {videos.length}
              </p>
              <p className="text-zinc-500 text-xs">Videos</p>
            </div>
          </div>

          {/* Actions */}
          {isOwnProfile ? (
            <div className="flex gap-3">
              <Button
                onClick={openEditModal}
                className="px-6 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 font-semibold active-scale"
                data-testid="edit-profile-button"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
              <Button
                onClick={() => navigate('/upload')}
                className="px-6 h-10 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 hover:from-fuchsia-600 hover:to-violet-700 font-semibold active-scale"
                data-testid="add-video-button"
              >
                + Add Video
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleFollow}
              disabled={followLoading}
              className={`px-8 h-10 rounded-full font-semibold active-scale ${
                isFollowing
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                  : 'bg-gradient-to-r from-fuchsia-500 to-violet-600 hover:from-fuchsia-600 hover:to-violet-700'
              }`}
              data-testid="follow-button"
            >
              {followLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isFollowing ? (
                'Following'
              ) : (
                'Follow'
              )}
            </Button>
          )}
        </div>

        {/* Videos Grid */}
        <Tabs defaultValue="videos" className="w-full">

      {/* Edit Profile Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-unbounded">Edit Profile</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Avatar Selection */}
            <div className="space-y-3">
              <label className="text-sm text-zinc-400">Choose Avatar</label>
              <div className="flex justify-center mb-4">
                <Avatar className="w-20 h-20 border-2 border-primary">
                  <AvatarImage src={editData.avatar} />
                  <AvatarFallback className="bg-zinc-800 text-white text-2xl">
                    {editData.username?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {avatarOptions.map((avatar, index) => (
                  <button
                    key={index}
                    onClick={() => setEditData({ ...editData, avatar })}
                    className={`rounded-xl overflow-hidden border-2 transition-all ${
                      editData.avatar === avatar ? 'border-primary glow-primary' : 'border-zinc-700 hover:border-zinc-500'
                    }`}
                  >
                    <img src={avatar} alt={`Avatar ${index + 1}`} className="w-full h-full" />
                  </button>
                ))}
              </div>
            </div>

            {/* Username */}
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Username</label>
              <Input
                value={editData.username}
                onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                className="bg-zinc-800 border-zinc-700 h-11 rounded-xl"
                placeholder="Your username"
                data-testid="edit-username"
              />
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Bio</label>
              <Textarea
                value={editData.bio}
                onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                className="bg-zinc-800 border-zinc-700 rounded-xl resize-none"
                placeholder="Tell us about yourself..."
                rows={3}
                maxLength={150}
                data-testid="edit-bio"
              />
              <p className="text-xs text-zinc-600 text-right">{editData.bio?.length || 0}/150</p>
            </div>

            {/* Save Button */}
            <Button
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full h-11 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 hover:from-fuchsia-600 hover:to-violet-700 font-semibold"
              data-testid="save-profile-btn"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
          <TabsList className="w-full bg-transparent border-b border-zinc-800 rounded-none h-12 p-0">
            <TabsTrigger
              value="videos"
              className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-transparent"
              data-testid="videos-tab"
            >
              <Grid3X3 className="w-5 h-5" />
            </TabsTrigger>
            <TabsTrigger
              value="liked"
              className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-transparent"
              data-testid="liked-tab"
            >
              <Heart className="w-5 h-5" />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="videos" className="mt-0">
            {videos.length === 0 ? (
              <div className="py-16 text-center">
                <Grid3X3 className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
                <p className="text-zinc-500">No videos yet</p>
                {isOwnProfile && (
                  <Button
                    onClick={() => navigate('/upload')}
                    className="mt-4 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600"
                    data-testid="upload-first-video"
                  >
                    Upload your first video
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-0.5 p-0.5">
                {videos.map((video) => (
                  <button
                    key={video.id}
                    onClick={() => navigate(`/?video=${video.id}`)}
                    className="relative aspect-[9/16] bg-zinc-900 overflow-hidden group"
                    data-testid={`video-thumbnail-${video.id}`}
                  >
                    {video.thumbnail_url ? (
                      <img
                        src={video.thumbnail_url}
                        alt={video.caption}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        src={video.video_url}
                        className="w-full h-full object-cover"
                        muted
                      />
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <Play className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity fill-white" />
                    </div>
                    <div className="absolute bottom-1 left-1 flex items-center gap-1 text-xs">
                      <Play className="w-3 h-3 fill-white" />
                      <span className="font-medium">{formatCount(video.likes_count)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="liked" className="mt-0">
            <div className="py-16 text-center">
              <Heart className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
              <p className="text-zinc-500">Liked videos will appear here</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
