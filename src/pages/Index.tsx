import { useState } from "react";
import { WalletConnection } from "@/components/WalletConnection";
import { AuthFlow } from "@/components/AuthFlow";
import { AirdropManager } from "@/components/AirdropManager";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import heroImage from "@/assets/wallet-hero.jpg";
import { Shield, Zap, Globe, ArrowRight, Coins } from "lucide-react";

interface User {
  email: string;
  address?: string;
}

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  const handleAuthComplete = (userData: User) => {
    setUser(userData);
    setShowAuth(false);
  };

  const handleLogout = () => {
    setUser(null);
    setShowAuth(false);
  };

  if (showAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <AuthFlow onAuthComplete={handleAuthComplete} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-web3-gradient rounded-lg"></div>
            <h1 className="text-xl font-bold text-foreground">VaultGuard</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="border-web3-success text-web3-success">
                  {user.address ? "Wallet Connected" : "Authenticated"}
                </Badge>
                <Button variant="outline" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            ) : (
              <Button variant="web3" onClick={() => setShowAuth(true)}>
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="space-y-4">
              <Badge className="bg-web3/20 text-web3 border-web3/30">
                Next-Gen Security
              </Badge>
              <h1 className="text-5xl font-bold text-foreground leading-tight">
                Secure Your
                <span className="bg-web3-gradient bg-clip-text text-transparent"> Digital Assets</span>
              </h1>
              <p className="text-xl text-muted-foreground">
                Connect, authenticate, and manage your decentralized identity with enterprise-grade security and seamless Web3 integration.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 text-web3-accent">
                <Shield className="w-5 h-5" />
                <span className="text-sm font-medium">Bank-level Security</span>
              </div>
              <div className="flex items-center gap-2 text-web3-success">
                <Zap className="w-5 h-5" />
                <span className="text-sm font-medium">Lightning Fast</span>
              </div>
              <div className="flex items-center gap-2 text-web3">
                <Globe className="w-5 h-5" />
                <span className="text-sm font-medium">Decentralized</span>
              </div>
            </div>

            {!user && (
              <div className="flex gap-4">
                <Button variant="web3" size="lg" onClick={() => setShowAuth(true)}>
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="lg">
                  Learn More
                </Button>
              </div>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-web3-gradient opacity-20 blur-3xl rounded-full"></div>
            <img 
              src={heroImage} 
              alt="Secure Wallet Interface" 
              className="relative rounded-2xl shadow-2xl w-full"
            />
          </div>
        </div>
      </section>

      {/* Main Content for Authenticated Users */}
      {user && (
        <section className="container mx-auto px-4 py-16">
          <Tabs defaultValue="wallet" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="wallet" className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Wallet
              </TabsTrigger>
              <TabsTrigger value="airdrop" className="flex items-center gap-2">
                <Coins className="w-4 h-4" />
                Airdrop Manager
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="wallet" className="space-y-8">
              <div className="max-w-md mx-auto">
                <WalletConnection />
              </div>
            </TabsContent>
            
            <TabsContent value="airdrop" className="space-y-8">
              <AirdropManager />
            </TabsContent>
          </Tabs>
        </section>
      )}

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Why Choose VaultGuard?
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Built for the future of digital identity and asset management
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <Card className="p-6 bg-card-elevated border-border">
            <div className="w-12 h-12 bg-web3-gradient rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Military-Grade Security
            </h3>
            <p className="text-muted-foreground">
              Advanced encryption and multi-signature protection for your digital assets.
            </p>
          </Card>

          <Card className="p-6 bg-card-elevated border-border">
            <div className="w-12 h-12 bg-web3-gradient rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Instant Authentication
            </h3>
            <p className="text-muted-foreground">
              One-click wallet connection and seamless authentication across platforms.
            </p>
          </Card>

          <Card className="p-6 bg-card-elevated border-border">
            <div className="w-12 h-12 bg-web3-gradient rounded-lg flex items-center justify-center mb-4">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Cross-Chain Support
            </h3>
            <p className="text-muted-foreground">
              Connect to multiple blockchain networks with unified interface.
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Index;