import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Search, Users, Video, Play, ArrowLeft } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('users');
  const { token } = useAuth();
  const navigate = useNavigate();

  const search = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setUsers([]);
      setVideos([]);
      return;
    }

    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [usersRes, videosRes] = await Promise.all([
        axios.get(`${API}/search/users?q=${encodeURIComponent(searchQuery)}&limit=20`, { headers }),
        axios.get(`${API}/search/videos?q=${encodeURIComponent(searchQuery)}&limit=20`, { headers })
      ]);
      setUsers(usersRes.data);
      setVideos(videosRes.data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      search(query);
    }, 300);
    return () => clearTimeout(debounce);
  }, [query, search]);

  const formatCount = (count) => {
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count;
  };

  return (
    <div className="min-h-screen bg-black pb-20" data-testid="search-page">
      {/* Header */}
      <div className="sticky top-0 z-30 glass border-b border-white/5">
        <div className="max-w-lg mx-auto flex items-center gap-3 h-14 px-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors shrink-0"
            data-testid="back-button"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <Input
              type="text"
              placeholder="Search users or videos..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-zinc-900/50 border-zinc-800 focus:border-primary h-10 rounded-full pl-10 pr-4"
              data-testid="search-input"
              autoFocus
            />
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto">
        {query.trim() ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full bg-transparent border-b border-zinc-800 rounded-none h-12 p-0">
              <TabsTrigger
                value="users"
                className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-transparent gap-2"
                data-testid="users-tab"
              >
                <Users className="w-4 h-4" />
                Users ({users.length})
              </TabsTrigger>
              <TabsTrigger
                value="videos"
                className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-transparent gap-2"
                data-testid="videos-tab"
              >
                <Video className="w-4 h-4" />
                Videos ({videos.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="mt-0">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : users.length === 0 ? (
                <div className="py-16 text-center">
                  <Users className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
                  <p className="text-zinc-500">No users found</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-900">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => navigate(`/profile/${user.id}`)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-zinc-900/50 transition-colors text-left"
                      data-testid={`user-result-${user.id}`}
                    >
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback className="bg-zinc-800 text-white">
                          {user.username?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">@{user.username}</p>
                        <p className="text-sm text-zinc-500">
                          {formatCount(user.followers_count)} followers
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="videos" className="mt-0">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : videos.length === 0 ? (
                <div className="py-16 text-center">
                  <Video className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
                  <p className="text-zinc-500">No videos found</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-0.5 p-0.5">
                  {videos.map((video) => (
                    <button
                      key={video.id}
                      onClick={() => navigate(`/?video=${video.id}`)}
                      className="relative aspect-[9/16] bg-zinc-900 overflow-hidden group"
                      data-testid={`video-result-${video.id}`}
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
          </Tabs>
        ) : (
          <div className="py-16 text-center">
            <Search className="w-16 h-16 mx-auto mb-4 text-zinc-800" />
            <h2 className="font-unbounded font-bold text-lg mb-2">Search TikVerse</h2>
            <p className="text-zinc-500 text-sm">Find users and videos</p>
          </div>
        )}
      </div>
    </div>
  );
}
