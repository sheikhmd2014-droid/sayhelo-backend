import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import AgoraRTC from "agora-rtc-sdk-ng";
import { 
  Radio, Users, MessageCircle, Heart, Send, X, 
  Mic, MicOff, Video, VideoOff, PhoneOff, Share2, Gift
} from "lucide-react";
import GiftPanel from "../components/GiftPanel";

const API_URL = process.env.REACT_APP_BACKEND_URL;
const WS_URL = API_URL.replace('https://', 'wss://').replace('http://', 'ws://');

const REACTIONS = ["❤️", "🔥", "👏", "😂", "🎉", "💯", "😍", "🙌"];

export default function LiveStreamViewPage() {
  const { streamId } = useParams();
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role") || "viewer";
  const isHost = role === "host";
  
  const { user, token } = useAuth();
  const navigate = useNavigate();
  
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [showChat, setShowChat] = useState(true);
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [reactions, setReactions] = useState([]);
  const [giftAnimations, setGiftAnimations] = useState([]);
  
  // Agora states
  const [agoraClient, setAgoraClient] = useState(null);
  const [localTracks, setLocalTracks] = useState({ video: null, audio: null });
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [joined, setJoined] = useState(false);
  
  const videoContainerRef = useRef(null);
  const wsRef = useRef(null);
  const chatContainerRef = useRef(null);
  const reactionIdRef = useRef(0);
  const giftIdRef = useRef(0);

  // Fetch stream details
  useEffect(() => {
    const fetchStream = async () => {
      try {
        const res = await fetch(`${API_URL}/api/streams/${streamId}`);
        if (!res.ok) throw new Error("Stream not found");
        const data = await res.json();
        setStream(data);
        setViewerCount(data.viewer_count);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStream();
  }, [streamId]);

  // Initialize Agora
  useEffect(() => {
    if (!stream || !user || !token) return;

    const initAgora = async () => {
      try {
        // Get Agora token
        const tokenRole = isHost ? "publisher" : "subscriber";
        const res = await fetch(
          `${API_URL}/api/streams/token/${stream.channel_name}?role=${tokenRole}`,
          { headers: { "Authorization": `Bearer ${token}` } }
        );
        
        if (!res.ok) throw new Error("Failed to get Agora token");
        const agoraData = await res.json();
        
        // Create Agora client
        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        setAgoraClient(client);
        
        // Set up event handlers
        client.on("user-published", async (remoteUser, mediaType) => {
          await client.subscribe(remoteUser, mediaType);
          
          if (mediaType === "video") {
            setRemoteUsers(prev => {
              if (prev.find(u => u.uid === remoteUser.uid)) {
                return prev.map(u => u.uid === remoteUser.uid ? remoteUser : u);
              }
              return [...prev, remoteUser];
            });
          }
          
          if (mediaType === "audio") {
            remoteUser.audioTrack?.play();
          }
        });
        
        client.on("user-unpublished", (remoteUser, mediaType) => {
          if (mediaType === "video") {
            setRemoteUsers(prev => prev.filter(u => u.uid !== remoteUser.uid));
          }
        });
        
        client.on("user-left", (remoteUser) => {
          setRemoteUsers(prev => prev.filter(u => u.uid !== remoteUser.uid));
        });
        
        // Join channel
        await client.join(agoraData.app_id, agoraData.channel_name, agoraData.token, agoraData.uid);
        setJoined(true);
        
        // If host, create and publish tracks
        if (isHost) {
          const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
          setLocalTracks({ audio: audioTrack, video: videoTrack });
          await client.publish([audioTrack, videoTrack]);
        }
        
      } catch (err) {
        console.error("Agora init error:", err);
        setError("Failed to connect to stream");
      }
    };
    
    initAgora();
    
    return () => {
      // Cleanup
      if (agoraClient) {
        agoraClient.leave();
      }
      if (localTracks.audio) localTracks.audio.close();
      if (localTracks.video) localTracks.video.close();
    };
  }, [stream, user, token, isHost]);

  // Play local video
  useEffect(() => {
    if (localTracks.video && videoContainerRef.current && isHost) {
      localTracks.video.play(videoContainerRef.current);
    }
  }, [localTracks.video, isHost]);

  // Play remote video (for viewers)
  useEffect(() => {
    if (!isHost && remoteUsers.length > 0 && videoContainerRef.current) {
      const hostUser = remoteUsers[0];
      if (hostUser?.videoTrack) {
        hostUser.videoTrack.play(videoContainerRef.current);
      }
    }
  }, [remoteUsers, isHost]);

  // WebSocket for chat
  useEffect(() => {
    if (!stream || !user) return;
    
    const wsUrl = `${WS_URL}/ws/stream/${stream.channel_name}/${user.id}/${user.username}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log("WebSocket connected");
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === "chat") {
        setMessages(prev => [...prev, data]);
      } else if (data.type === "viewer_joined" || data.type === "viewer_left") {
        setViewerCount(data.viewer_count);
        setMessages(prev => [...prev, {
          type: "system",
          content: data.type === "viewer_joined" 
            ? `${data.username} joined` 
            : `${data.username} left`,
          created_at: new Date().toISOString()
        }]);
      } else if (data.type === "reaction") {
        showReaction(data.emoji);
      } else if (data.type === "gift") {
        // Show gift animation
        showGiftAnimation(data.gift_emoji, data.sender_username, data.gift_name, data.coins);
        // Add to chat
        setMessages(prev => [...prev, {
          type: "gift",
          sender_username: data.sender_username,
          gift_emoji: data.gift_emoji,
          gift_name: data.gift_name,
          coins: data.coins,
          created_at: new Date().toISOString()
        }]);
      } else if (data.type === "stream_ended") {
        alert("Stream has ended");
        navigate("/live");
      }
    };
    
    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
    
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [stream, user]);

  // Auto scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const showReaction = useCallback((emoji) => {
    const id = reactionIdRef.current++;
    const reaction = {
      id,
      emoji,
      x: Math.random() * 80 + 10,
      y: 100
    };
    setReactions(prev => [...prev, reaction]);
    
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id));
    }, 2000);
  }, []);

  const showGiftAnimation = useCallback((emoji, sender, giftName, coins) => {
    const id = giftIdRef.current++;
    const gift = {
      id,
      emoji,
      sender,
      giftName,
      coins
    };
    setGiftAnimations(prev => [...prev, gift]);
    
    setTimeout(() => {
      setGiftAnimations(prev => prev.filter(g => g.id !== id));
    }, 4000);
  }, []);

  const sendMessage = () => {
    if (!newMessage.trim() || !wsRef.current) return;
    
    wsRef.current.send(JSON.stringify({
      type: "chat",
      content: newMessage
    }));
    setNewMessage("");
  };

  const sendReaction = (emoji) => {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({
      type: "reaction",
      emoji
    }));
    showReaction(emoji);
  };

  const toggleMute = async () => {
    if (localTracks.audio) {
      await localTracks.audio.setEnabled(isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = async () => {
    if (localTracks.video) {
      await localTracks.video.setEnabled(isVideoOff);
      setIsVideoOff(!isVideoOff);
    }
  };

  const endStream = async () => {
    if (!confirm("Are you sure you want to end the stream?")) return;
    
    try {
      await fetch(`${API_URL}/api/streams/${streamId}/end`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (agoraClient) await agoraClient.leave();
      if (localTracks.audio) localTracks.audio.close();
      if (localTracks.video) localTracks.video.close();
      
      navigate("/live");
    } catch (error) {
      console.error("Failed to end stream:", error);
    }
  };

  const leaveStream = async () => {
    if (agoraClient) await agoraClient.leave();
    navigate("/live");
  };

  const shareStream = () => {
    const url = window.location.href.replace("?role=host", "?role=viewer");
    if (navigator.share) {
      navigator.share({
        title: stream?.title || "Live Stream",
        url: url
      });
    } else {
      navigator.clipboard.writeText(url);
      alert("Link copied!");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !stream) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <Radio className="w-16 h-16 text-gray-600 mb-4" />
        <h2 className="text-xl font-semibold mb-2">{error || "Stream not found"}</h2>
        <Button onClick={() => navigate("/live")} className="mt-4">
          Back to Streams
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col lg:flex-row">
      {/* Video Section */}
      <div className="flex-1 relative">
        {/* Video Container */}
        <div 
          ref={videoContainerRef}
          className="w-full aspect-video lg:h-screen bg-gray-900 relative"
          data-testid="video-container"
        >
          {/* Stream not started overlay */}
          {!joined && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <div className="w-12 h-12 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-400">Connecting to stream...</p>
              </div>
            </div>
          )}
          
          {/* No video from host */}
          {!isHost && joined && remoteUsers.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <Radio className="w-12 h-12 text-fuchsia-500 mx-auto mb-4 animate-pulse" />
                <p className="text-gray-400">Waiting for host...</p>
              </div>
            </div>
          )}
        </div>

        {/* Floating Reactions */}
        <div className="absolute bottom-20 right-4 pointer-events-none">
          {reactions.map((reaction) => (
            <div
              key={reaction.id}
              className="absolute text-4xl animate-float-up"
              style={{ 
                left: `${reaction.x}%`,
                animation: "floatUp 2s ease-out forwards"
              }}
            >
              {reaction.emoji}
            </div>
          ))}
        </div>

        {/* Stream Info Overlay */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-red-600 px-2 py-1 rounded text-xs font-semibold">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                LIVE
              </div>
              <div className="flex items-center gap-1 text-sm">
                <Users className="w-4 h-4" />
                {viewerCount}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={shareStream}
                className="text-white hover:bg-white/20"
              >
                <Share2 className="w-5 h-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setShowChat(!showChat)}
                className="text-white hover:bg-white/20 lg:hidden"
              >
                <MessageCircle className="w-5 h-5" />
              </Button>
            </div>
          </div>
          <h2 className="text-lg font-semibold mt-2">{stream.title}</h2>
          <div className="flex items-center gap-2 mt-1">
            <img
              src={stream.host_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${stream.host_username}`}
              alt={stream.host_username}
              className="w-6 h-6 rounded-full"
            />
            <span className="text-sm text-gray-300">@{stream.host_username}</span>
          </div>
        </div>

        {/* Host Controls */}
        {isHost && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 px-4 py-2 rounded-full">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className={isMuted ? "text-red-500" : "text-white"}
              data-testid="toggle-mic-btn"
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleVideo}
              className={isVideoOff ? "text-red-500" : "text-white"}
              data-testid="toggle-video-btn"
            >
              {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </Button>
            <Button
              variant="destructive"
              size="icon"
              onClick={endStream}
              className="bg-red-600 hover:bg-red-700"
              data-testid="end-stream-btn"
            >
              <PhoneOff className="w-6 h-6" />
            </Button>
          </div>
        )}

        {/* Viewer Leave Button */}
        {!isHost && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <Button
              variant="outline"
              onClick={leaveStream}
              className="border-white/30 text-white hover:bg-white/10"
            >
              <X className="w-4 h-4 mr-2" />
              Leave
            </Button>
          </div>
        )}
      </div>

      {/* Chat Section */}
      <div className={`
        ${showChat ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-80 bg-gray-900 
        fixed lg:relative bottom-0 left-0 right-0 h-1/2 lg:h-auto lg:min-h-screen
      `}>
        {/* Chat Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-800">
          <h3 className="font-semibold">Live Chat</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowChat(false)}
            className="lg:hidden"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Messages */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-3 space-y-2"
        >
          {messages.map((msg, idx) => (
            <div key={idx} className="text-sm">
              {msg.type === "system" ? (
                <span className="text-gray-500 italic">{msg.content}</span>
              ) : (
                <>
                  <span className="font-semibold text-fuchsia-400">{msg.username}</span>
                  <span className="text-gray-300 ml-2">{msg.content}</span>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Reactions */}
        <div className="flex gap-1 p-2 border-t border-gray-800 overflow-x-auto">
          {REACTIONS.map((emoji) => (
            <Button
              key={emoji}
              variant="ghost"
              size="sm"
              onClick={() => sendReaction(emoji)}
              className="text-xl p-2 h-auto hover:bg-gray-800"
            >
              {emoji}
            </Button>
          ))}
        </div>

        {/* Message Input */}
        <div className="p-3 border-t border-gray-800">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Say something..."
              className="bg-gray-800 border-gray-700"
              data-testid="chat-input"
            />
            <Button 
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              className="bg-fuchsia-600 hover:bg-fuchsia-700"
              data-testid="send-chat-btn"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* CSS for floating animation */}
      <style jsx global>{`
        @keyframes floatUp {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-200px) scale(1.5);
          }
        }
        .animate-float-up {
          animation: floatUp 2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
