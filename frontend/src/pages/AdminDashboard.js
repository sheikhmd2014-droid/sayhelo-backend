import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { 
  Shield, Users, Video, MessageSquare, BarChart3, LogOut, 
  Ban, Trash2, CheckCircle, XCircle, Search, UserCog, Play, Settings, Key
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [videos, setVideos] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const navigate = useNavigate();

  const adminToken = localStorage.getItem('adminToken');
  const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');

  useEffect(() => {
    if (!adminToken) {
      navigate('/admin');
      return;
    }
    fetchData();
  }, [adminToken, navigate]);

  const getHeaders = () => ({ Authorization: `Bearer ${adminToken}` });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, videosRes, commentsRes] = await Promise.all([
        axios.get(`${API}/admin/stats`, { headers: getHeaders() }),
        axios.get(`${API}/admin/users?limit=100`, { headers: getHeaders() }),
        axios.get(`${API}/admin/videos?limit=100`, { headers: getHeaders() }),
        axios.get(`${API}/admin/comments?limit=100`, { headers: getHeaders() })
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setVideos(videosRes.data);
      setComments(commentsRes.data);
    } catch (error) {
      if (error.response?.status === 403 || error.response?.status === 401) {
        toast.error('Admin access required');
        handleLogout();
      } else {
        toast.error('Failed to fetch data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/admin');
  };

  // User Actions
  const handleBanUser = async (userId, isBanned) => {
    try {
      await axios.put(`${API}/admin/users/${userId}/${isBanned ? 'unban' : 'ban'}`, {}, { headers: getHeaders() });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_banned: !isBanned } : u));
      toast.success(isBanned ? 'User unbanned' : 'User banned');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Action failed');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure? This will delete all user data.')) return;
    try {
      await axios.delete(`${API}/admin/users/${userId}`, { headers: getHeaders() });
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast.success('User deleted');
      fetchData(); // Refresh stats
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Delete failed');
    }
  };

  const handleToggleAdmin = async (userId, isAdmin) => {
    try {
      await axios.put(`${API}/admin/users/${userId}/${isAdmin ? 'remove-admin' : 'make-admin'}`, {}, { headers: getHeaders() });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_admin: !isAdmin } : u));
      toast.success(isAdmin ? 'Admin removed' : 'User is now admin');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Action failed');
    }
  };

  // Video Actions
  const handleApproveVideo = async (videoId, isApproved) => {
    try {
      await axios.put(`${API}/admin/videos/${videoId}/${isApproved ? 'reject' : 'approve'}`, {}, { headers: getHeaders() });
      setVideos(prev => prev.map(v => v.id === videoId ? { ...v, is_approved: !isApproved } : v));
      toast.success(isApproved ? 'Video rejected' : 'Video approved');
    } catch (error) {
      toast.error('Action failed');
    }
  };

  const handleDeleteVideo = async (videoId) => {
    if (!window.confirm('Delete this video?')) return;
    try {
      await axios.delete(`${API}/admin/videos/${videoId}`, { headers: getHeaders() });
      setVideos(prev => prev.filter(v => v.id !== videoId));
      toast.success('Video deleted');
      fetchData();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  // Comment Actions
  const handleDeleteComment = async (commentId) => {
    try {
      await axios.delete(`${API}/admin/comments/${commentId}`, { headers: getHeaders() });
      setComments(prev => prev.filter(c => c.id !== commentId));
      toast.success('Comment deleted');
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  // Password Change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordData.new !== passwordData.confirm) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordData.new.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setChangingPassword(true);
    try {
      await axios.put(`${API}/admin/change-password`, {
        current_password: passwordData.current,
        new_password: passwordData.new
      }, { headers: getHeaders() });
      toast.success('Password changed successfully!');
      setPasswordData({ current: '', new: '', confirm: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredVideos = videos.filter(v => 
    v.caption.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black" data-testid="admin-dashboard">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-unbounded font-bold text-lg">Admin Panel</h1>
              <p className="text-xs text-zinc-500">@{adminUser.username}</p>
            </div>
          </div>
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
            data-testid="admin-logout"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-zinc-900/50 rounded-xl p-1 mb-6 grid grid-cols-5 gap-1">
            <TabsTrigger value="dashboard" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-orange-600" data-testid="tab-dashboard">
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-orange-600" data-testid="tab-users">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="videos" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-orange-600" data-testid="tab-videos">
              <Video className="w-4 h-4 mr-2" />
              Videos
            </TabsTrigger>
            <TabsTrigger value="comments" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-orange-600" data-testid="tab-comments">
              <MessageSquare className="w-4 h-4 mr-2" />
              Comments
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-orange-600" data-testid="tab-settings">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Users} label="Total Users" value={stats?.total_users || 0} color="from-blue-500 to-cyan-500" />
              <StatCard icon={Video} label="Total Videos" value={stats?.total_videos || 0} color="from-fuchsia-500 to-violet-500" />
              <StatCard icon={MessageSquare} label="Total Comments" value={stats?.total_comments || 0} color="from-green-500 to-emerald-500" />
              <StatCard icon={Ban} label="Banned Users" value={stats?.banned_users || 0} color="from-red-500 to-orange-500" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Users} label="Users Today" value={stats?.users_today || 0} color="from-amber-500 to-yellow-500" small />
              <StatCard icon={Video} label="Videos Today" value={stats?.videos_today || 0} color="from-pink-500 to-rose-500" small />
              <StatCard label="Total Likes" value={stats?.total_likes || 0} color="from-red-500 to-pink-500" small />
              <StatCard label="Total Follows" value={stats?.total_follows || 0} color="from-indigo-500 to-purple-500" small />
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-zinc-900/50 border-zinc-800 h-11 rounded-xl"
                data-testid="search-users"
              />
            </div>

            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {filteredUsers.map((user) => (
                  <div 
                    key={user.id} 
                    className={`flex items-center gap-4 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 ${user.is_banned ? 'opacity-60' : ''}`}
                    data-testid={`user-row-${user.id}`}
                  >
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={user.avatar} />
                      <AvatarFallback className="bg-zinc-800">{user.username?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate">@{user.username}</span>
                        {user.is_admin && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-500">Admin</span>
                        )}
                        {user.is_banned && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-500/20 text-zinc-400">Banned</span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-500 truncate">{user.email}</p>
                      <p className="text-xs text-zinc-600">{formatDate(user.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleAdmin(user.id, user.is_admin)}
                        className={`h-9 ${user.is_admin ? 'text-red-500 hover:text-red-400' : 'text-zinc-400 hover:text-white'}`}
                        data-testid={`toggle-admin-${user.id}`}
                      >
                        <UserCog className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleBanUser(user.id, user.is_banned)}
                        className={`h-9 ${user.is_banned ? 'text-green-500 hover:text-green-400' : 'text-yellow-500 hover:text-yellow-400'}`}
                        data-testid={`ban-user-${user.id}`}
                      >
                        <Ban className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteUser(user.id)}
                        className="h-9 text-red-500 hover:text-red-400"
                        data-testid={`delete-user-${user.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Videos Tab */}
          <TabsContent value="videos" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <Input
                placeholder="Search videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-zinc-900/50 border-zinc-800 h-11 rounded-xl"
                data-testid="search-videos"
              />
            </div>

            <ScrollArea className="h-[600px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredVideos.map((video) => (
                  <div 
                    key={video.id} 
                    className={`p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 ${!video.is_approved ? 'border-yellow-500/50' : ''}`}
                    data-testid={`video-row-${video.id}`}
                  >
                    <div className="flex gap-4">
                      <div className="relative w-24 h-32 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                        {video.thumbnail_url ? (
                          <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <video src={video.video_url} className="w-full h-full object-cover" muted />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Play className="w-6 h-6 text-white fill-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm line-clamp-2 mb-1">{video.caption}</p>
                        <p className="text-xs text-zinc-500">@{video.username}</p>
                        <p className="text-xs text-zinc-600 mt-1">{formatDate(video.created_at)}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                          <span>❤️ {video.likes_count}</span>
                          <span>💬 {video.comments_count}</span>
                        </div>
                        {!video.is_approved && (
                          <span className="inline-block mt-2 px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-500">Pending</span>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-zinc-800">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleApproveVideo(video.id, video.is_approved)}
                        className={`h-8 ${video.is_approved ? 'text-yellow-500' : 'text-green-500'}`}
                        data-testid={`toggle-approve-${video.id}`}
                      >
                        {video.is_approved ? <XCircle className="w-4 h-4 mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                        {video.is_approved ? 'Reject' : 'Approve'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteVideo(video.id)}
                        className="h-8 text-red-500"
                        data-testid={`delete-video-${video.id}`}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Comments Tab */}
          <TabsContent value="comments" className="space-y-4">
            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {comments.map((comment) => (
                  <div 
                    key={comment.id} 
                    className="flex items-start gap-3 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800"
                    data-testid={`comment-row-${comment.id}`}
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={comment.user_avatar} />
                      <AvatarFallback className="bg-zinc-800">{comment.username?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">@{comment.username}</span>
                        <span className="text-xs text-zinc-600">{formatDate(comment.created_at)}</span>
                      </div>
                      <p className="text-sm text-zinc-300 mt-1">{comment.content}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteComment(comment.id)}
                      className="h-8 text-red-500 hover:text-red-400"
                      data-testid={`delete-comment-${comment.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <div className="max-w-md">
              <div className="rounded-xl bg-zinc-900/50 border border-zinc-800 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
                    <Key className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Change Password</h3>
                    <p className="text-xs text-zinc-500">Update your admin password</p>
                  </div>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="text-sm text-zinc-400 block mb-2">Current Password</label>
                    <Input
                      type="password"
                      value={passwordData.current}
                      onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                      className="bg-zinc-800 border-zinc-700 h-11 rounded-xl"
                      placeholder="Enter current password"
                      required
                      data-testid="current-password"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-zinc-400 block mb-2">New Password</label>
                    <Input
                      type="password"
                      value={passwordData.new}
                      onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                      className="bg-zinc-800 border-zinc-700 h-11 rounded-xl"
                      placeholder="Enter new password"
                      required
                      minLength={6}
                      data-testid="new-password"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-zinc-400 block mb-2">Confirm New Password</label>
                    <Input
                      type="password"
                      value={passwordData.confirm}
                      onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                      className="bg-zinc-800 border-zinc-700 h-11 rounded-xl"
                      placeholder="Confirm new password"
                      required
                      minLength={6}
                      data-testid="confirm-password"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={changingPassword}
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700"
                    data-testid="change-password-btn"
                  >
                    {changingPassword ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Change Password'
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ icon: Icon, label, value, color, small }) {
  return (
    <div className={`rounded-xl bg-zinc-900/50 border border-zinc-800 ${small ? 'p-4' : 'p-6'}`}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        )}
        <div>
          <p className={`font-unbounded font-bold ${small ? 'text-xl' : 'text-2xl'}`}>{value}</p>
          <p className="text-xs text-zinc-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
