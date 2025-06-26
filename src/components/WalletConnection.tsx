import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WalletCard } from "./WalletCard";
import { Badge } from "@/components/ui/badge";
import { Wallet, Copy, ExternalLink, LogOut, Send, ArrowUpRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWeb3 } from "@/hooks/useWeb3";
import { ethers } from "ethers";

export const WalletConnection = () => {
  const { account, isConnected, provider, connectWallet, disconnectWallet, sendTransaction, chainId } = useWeb3();
  const { toast } = useToast();
  const [balance, setBalance] = useState<string>("0");
  const [sendAmount, setSendAmount] = useState<string>("");
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [showSendForm, setShowSendForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const wallets = [
    {
      name: "MetaMask",
      icon: "🦊",
      description: "Connect using browser wallet",
      isPopular: true,
    },
    {
      name: "WalletConnect",
      icon: "🔗",
      description: "Scan with WalletConnect QR code",
    },
    {
      name: "Coinbase Wallet",
      icon: "🔵",
      description: "Connect to your Coinbase Wallet",
    },
  ];

  useEffect(() => {
    if (isConnected && provider && account) {
      fetchBalance();
    }
  }, [isConnected, provider, account]);

  const fetchBalance = async () => {
    if (!provider || !account) return;
    
    try {
      const balance = await provider.getBalance(account);
      setBalance(ethers.formatEther(balance));
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  const getNetworkName = (chainId: number | null) => {
    switch (chainId) {
      case 1: return "Ethereum Mainnet";
      case 5: return "Goerli Testnet";
      case 11155111: return "Sepolia Testnet";
      case 137: return "Polygon Mainnet";
      case 80001: return "Mumbai Testnet";
      default: return `Chain ID: ${chainId}`;
    }
  };

  const handleSendTransaction = async () => {
    if (!sendAmount || !recipientAddress) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (!ethers.isAddress(recipientAddress)) {
      toast({
        title: "Error",
        description: "Invalid recipient address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const txHash = await sendTransaction(recipientAddress, sendAmount);
      setSendAmount("");
      setRecipientAddress("");
      setShowSendForm(false);
      
      toast({
        title: "Transaction Sent",
        description: `Transaction hash: ${txHash}`,
      });
    } catch (error) {
      console.error('Transaction failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    if (account) {
      navigator.clipboard.writeText(account);
      toast({
        title: "Address Copied",
        description: "Wallet address copied to clipboard",
      });
    }
  };

  if (isConnected && account) {
    return (
      <div className="space-y-4">
        <Card className="p-6 bg-card-elevated border-web3/30">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-web3-gradient rounded-full flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Connected Wallet</h3>
                <Badge variant="outline" className="border-web3-success text-web3-success mt-1">
                  {getNetworkName(chainId)}
                </Badge>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={disconnectWallet}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="font-mono text-sm">{account.slice(0, 6)}...{account.slice(-4)}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={copyAddress}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Balance</p>
                <p className="font-semibold text-lg">{parseFloat(balance).toFixed(4)} ETH</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => window.open(`https://etherscan.io/address/${account}`, '_blank')}>
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <Button variant="web3" className="flex-1" onClick={() => setShowSendForm(!showSendForm)}>
              <Send className="w-4 h-4 mr-2" />
              Send ETH
            </Button>
            <Button variant="outline" className="flex-1" onClick={copyAddress}>
              <Copy className="w-4 h-4 mr-2" />
              Receive
            </Button>
          </div>
        </Card>

        {showSendForm && (
          <Card className="p-6 bg-card-elevated border-web3/30">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <ArrowUpRight className="w-5 h-5 text-web3" />
                <h3 className="font-semibold">Send ETH</h3>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="recipient">Recipient Address</Label>
                <Input
                  id="recipient"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder="0x..."
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (ETH)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.001"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  placeholder="0.0"
                />
                <p className="text-xs text-muted-foreground">
                  Available: {parseFloat(balance).toFixed(4)} ETH
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="web3" 
                  onClick={handleSendTransaction}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? "Sending..." : "Send Transaction"}
                </Button>
                <Button variant="outline" onClick={() => setShowSendForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">Connect Your Wallet</h2>
        <p className="text-muted-foreground">
          Choose your preferred wallet to connect to the decentralized web
        </p>
      </div>

      <div className="grid gap-4">
        {wallets.map((wallet) => (
          <WalletCard
            key={wallet.name}
            {...wallet}
            onConnect={() => connectWallet()}
          />
        ))}
      </div>

      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          New to wallets?{" "}
          <a href="#" className="text-web3-accent hover:underline">
            Learn more about Web3 wallets
          </a>
        </p>
      </div>
    </div>
  );
};