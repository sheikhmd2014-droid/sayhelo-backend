import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Radio, Users, Play, Plus } from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function LiveStreamsPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [streamTitle, setStreamTitle] = useState("");
  const [streamDescription, setStreamDescription] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchLiveStreams();
    const interval = setInterval(fetchLiveStreams, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchLiveStreams = async () => {
    try {
      const res = await fetch(`${API_URL}/api/streams/live`);
      if (res.ok) {
        const data = await res.json();
        setStreams(data);
      }
    } catch (error) {
      console.error("Failed to fetch streams:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStream = async () => {
    if (!streamTitle.trim()) return;
    
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/streams/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          title: streamTitle,
          description: streamDescription
        })
      });
      
      if (res.ok) {
        const stream = await res.json();
        navigate(`/live/${stream.id}?role=host`);
      } else {
        const error = await res.json();
        alert(error.detail || "Failed to create stream");
      }
    } catch (error) {
      console.error("Failed to create stream:", error);
      alert("Failed to create stream");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinStream = (streamId) => {
    navigate(`/live/${streamId}?role=viewer`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-black/90 backdrop-blur-sm z-10 p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-6 h-6 text-red-500 animate-pulse" />
            <h1 className="text-xl font-bold">Live Streams</h1>
          </div>
          {user && (
            <Button 
              onClick={() => setShowCreateModal(true)}
              className="bg-fuchsia-600 hover:bg-fuchsia-700"
              data-testid="go-live-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Go Live
            </Button>
          )}
        </div>
      </div>

      {/* Streams Grid */}
      <div className="p-4">
        {streams.length === 0 ? (
          <div className="text-center py-20">
            <Radio className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-400 mb-2">No Live Streams</h2>
            <p className="text-gray-500 mb-6">Be the first to go live!</p>
            {user && (
              <Button 
                onClick={() => setShowCreateModal(true)}
                className="bg-fuchsia-600 hover:bg-fuchsia-700"
              >
                Start Streaming
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {streams.map((stream) => (
              <div
                key={stream.id}
                onClick={() => handleJoinStream(stream.id)}
                className="bg-gray-900 rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-fuchsia-500 transition-all"
                data-testid={`stream-card-${stream.id}`}
              >
                {/* Stream Preview */}
                <div className="relative aspect-video bg-gradient-to-br from-fuchsia-900 to-purple-900 flex items-center justify-center">
                  <Play className="w-12 h-12 text-white/80" />
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-600 px-2 py-1 rounded text-xs font-semibold">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    LIVE
                  </div>
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 px-2 py-1 rounded text-xs">
                    <Users className="w-3 h-3" />
                    {stream.viewer_count}
                  </div>
                </div>
                
                {/* Stream Info */}
                <div className="p-3">
                  <h3 className="font-semibold truncate">{stream.title}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <img
                      src={stream.host_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${stream.host_username}`}
                      alt={stream.host_username}
                      className="w-6 h-6 rounded-full"
                    />
                    <span className="text-sm text-gray-400">@{stream.host_username}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Stream Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Start Live Stream</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Stream Title *</label>
                <Input
                  value={streamTitle}
                  onChange={(e) => setStreamTitle(e.target.value)}
                  placeholder="What's your stream about?"
                  className="bg-gray-800 border-gray-700"
                  data-testid="stream-title-input"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description (optional)</label>
                <Input
                  value={streamDescription}
                  onChange={(e) => setStreamDescription(e.target.value)}
                  placeholder="Tell viewers more..."
                  className="bg-gray-800 border-gray-700"
                  data-testid="stream-description-input"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="flex-1 border-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateStream}
                disabled={!streamTitle.trim() || creating}
                className="flex-1 bg-fuchsia-600 hover:bg-fuchsia-700"
                data-testid="start-stream-btn"
              >
                {creating ? "Starting..." : "Go Live"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
