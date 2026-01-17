import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { Gift, Coins, X } from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function GiftPanel({ streamId, receiverId, onClose }) {
  const { token } = useAuth();
  const [gifts, setGifts] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [sending, setSending] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const [giftsRes, walletRes] = await Promise.all([
        fetch(`${API_URL}/api/gifts`),
        token ? fetch(`${API_URL}/api/wallet`, {
          headers: { "Authorization": `Bearer ${token}` }
        }) : Promise.resolve(null)
      ]);

      if (giftsRes.ok) {
        const data = await giftsRes.json();
        setGifts(data.gifts);
      }

      if (walletRes && walletRes.ok) {
        const data = await walletRes.json();
        setWallet(data);
      }
    } catch (error) {
      console.error("Failed to fetch gifts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendGift = async (gift) => {
    if (!token) {
      toast.error("Please login to send gifts");
      return;
    }

    if (!wallet || wallet.coins < gift.coins) {
      toast.error("Insufficient coins! Buy more coins.");
      return;
    }

    setSending(gift.id);
    try {
      const res = await fetch(`${API_URL}/api/gifts/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          gift_id: gift.id,
          stream_id: streamId,
          receiver_id: receiverId
        })
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Sent ${gift.emoji} ${gift.name}!`);
        // Update local wallet
        setWallet(prev => ({
          ...prev,
          coins: prev.coins - gift.coins
        }));
      } else {
        const error = await res.json();
        toast.error(error.detail || "Failed to send gift");
      }
    } catch (error) {
      toast.error("Failed to send gift");
    } finally {
      setSending(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-t-2xl border-t border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-pink-500" />
          <span className="font-semibold">Send Gift</span>
        </div>
        <div className="flex items-center gap-3">
          {wallet && (
            <div className="flex items-center gap-1 bg-yellow-500/20 px-2 py-1 rounded-full">
              <Coins className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium text-yellow-500">{wallet.coins}</span>
            </div>
          )}
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Gifts Grid */}
      <div className="p-3 grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
        {gifts.map((gift) => (
          <button
            key={gift.id}
            onClick={() => handleSendGift(gift)}
            disabled={sending === gift.id || !wallet || wallet.coins < gift.coins}
            className={`flex flex-col items-center p-3 rounded-xl transition-all ${
              !wallet || wallet.coins < gift.coins
                ? "bg-gray-800/50 opacity-50"
                : "bg-gray-800 hover:bg-gray-700 active:scale-95"
            }`}
            data-testid={`gift-${gift.id}`}
          >
            {sending === gift.id ? (
              <div className="w-8 h-8 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="text-3xl">{gift.emoji}</span>
            )}
            <span className="text-xs mt-1 text-gray-300">{gift.name}</span>
            <div className="flex items-center gap-0.5 mt-0.5">
              <Coins className="w-3 h-3 text-yellow-500" />
              <span className="text-xs text-yellow-500">{gift.coins}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Buy Coins Link */}
      {wallet && wallet.coins < 50 && (
        <div className="p-3 border-t border-gray-800">
          <a
            href="/coins"
            className="block w-full text-center bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-semibold py-2 rounded-xl"
          >
            Buy More Coins
          </a>
        </div>
      )}
    </div>
  );
}
