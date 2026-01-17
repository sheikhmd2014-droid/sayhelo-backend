import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { Coins, Wallet, Gift, ArrowRight, Check, Sparkles } from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function CoinsPage() {
  const { token, user } = useAuth();
  const [packages, setPackages] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const [razorpayKey, setRazorpayKey] = useState("");

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const fetchData = async () => {
    try {
      const [packagesRes, walletRes] = await Promise.all([
        fetch(`${API_URL}/api/coins/packages`),
        fetch(`${API_URL}/api/wallet`, {
          headers: { "Authorization": `Bearer ${token}` }
        })
      ]);

      if (packagesRes.ok) {
        const data = await packagesRes.json();
        setPackages(data.packages);
        setRazorpayKey(data.razorpay_key);
      }

      if (walletRes.ok) {
        const data = await walletRes.json();
        setWallet(data);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleBuyCoins = async (packageId) => {
    if (!token) {
      toast.error("Please login to buy coins");
      return;
    }

    setPurchasing(packageId);

    try {
      // Load Razorpay script
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error("Failed to load payment gateway");
        return;
      }

      // Create order
      const orderRes = await fetch(`${API_URL}/api/coins/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ package_id: packageId })
      });

      if (!orderRes.ok) {
        const error = await orderRes.json();
        throw new Error(error.detail || "Failed to create order");
      }

      const orderData = await orderRes.json();

      // Open Razorpay checkout
      const options = {
        key: razorpayKey,
        amount: orderData.amount * 100,
        currency: "INR",
        name: "FunMastis",
        description: `Buy ${orderData.package.coins + orderData.package.bonus_coins} Coins`,
        order_id: orderData.order_id,
        handler: async function (response) {
          // Verify payment
          try {
            const verifyRes = await fetch(`${API_URL}/api/coins/verify-payment`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                package_id: packageId
              })
            });

            if (verifyRes.ok) {
              const data = await verifyRes.json();
              toast.success(`${data.coins_added} coins added to your wallet!`);
              setWallet(data.wallet);
            } else {
              toast.error("Payment verification failed");
            }
          } catch (error) {
            toast.error("Payment verification failed");
          }
        },
        prefill: {
          name: user?.username || "",
          email: user?.email || ""
        },
        theme: {
          color: "#D946EF"
        },
        modal: {
          ondismiss: function () {
            setPurchasing(null);
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      toast.error(error.message || "Failed to initiate payment");
    } finally {
      setPurchasing(null);
    }
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
        <div className="flex items-center gap-2">
          <Coins className="w-6 h-6 text-yellow-500" />
          <h1 className="text-xl font-bold">Buy Coins</h1>
        </div>
      </div>

      {/* Wallet Summary */}
      {wallet && (
        <div className="mx-4 mt-4 bg-gradient-to-r from-fuchsia-900/50 to-purple-900/50 rounded-2xl p-4 border border-fuchsia-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <Wallet className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Your Balance</p>
                <p className="text-2xl font-bold text-yellow-500">{wallet.coins} <span className="text-sm">coins</span></p>
              </div>
            </div>
            {wallet.earned_coins > 0 && (
              <div className="text-right">
                <p className="text-xs text-gray-400">Earned from gifts</p>
                <p className="text-lg font-semibold text-green-500">+{wallet.earned_coins}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Coin Packages */}
      <div className="p-4 space-y-3">
        <h2 className="text-lg font-semibold mb-3">Choose Package</h2>
        
        {packages.map((pkg, index) => (
          <div
            key={pkg.id}
            className={`relative bg-gray-900 rounded-2xl p-4 border transition-all ${
              index === 1 ? "border-fuchsia-500 ring-1 ring-fuchsia-500" : "border-gray-800"
            }`}
          >
            {/* Popular badge */}
            {index === 1 && (
              <div className="absolute -top-2 left-4 bg-fuchsia-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                POPULAR
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                  <Coins className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                  <p className="font-semibold">{pkg.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-500 font-bold">{pkg.coins} coins</span>
                    {pkg.bonus_coins > 0 && (
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                        +{pkg.bonus_coins} bonus
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <Button
                onClick={() => handleBuyCoins(pkg.id)}
                disabled={purchasing === pkg.id}
                className="bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700 font-semibold px-6"
                data-testid={`buy-${pkg.id}`}
              >
                {purchasing === pkg.id ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>₹{pkg.price_inr}</>
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* What are coins for */}
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-3">What are coins for?</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3 bg-gray-900 rounded-xl p-3">
            <Gift className="w-5 h-5 text-pink-500 mt-0.5" />
            <div>
              <p className="font-medium">Send Gifts</p>
              <p className="text-sm text-gray-400">Support your favorite creators during live streams</p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-gray-900 rounded-xl p-3">
            <Sparkles className="w-5 h-5 text-yellow-500 mt-0.5" />
            <div>
              <p className="font-medium">Get Noticed</p>
              <p className="text-sm text-gray-400">Your gift appears on screen for everyone to see</p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-gray-900 rounded-xl p-3">
            <ArrowRight className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-medium">Creators Earn</p>
              <p className="text-sm text-gray-400">70% of gift value goes to creators</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
