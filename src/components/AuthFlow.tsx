import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff, Mail, Lock, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AuthFlowProps {
  onAuthComplete: (user: { email: string; address?: string }) => void;
}

export const AuthFlow = ({ onAuthComplete }: AuthFlowProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate authentication
    setTimeout(() => {
      onAuthComplete({ email: "user@example.com" });
      toast({
        title: "Authentication Successful",
        description: "Welcome to the decentralized future!",
      });
      setLoading(false);
    }, 2000);
  };

  const handleWalletAuth = () => {
    setLoading(true);
    // Simulate wallet authentication
    setTimeout(() => {
      onAuthComplete({ 
        email: "wallet@user.eth", 
        address: "0x1234...5678" 
      });
      toast({
        title: "Wallet Authentication Successful",
        description: "Connected via wallet signature",
      });
      setLoading(false);
    }, 1500);
  };

  return (
    <Card className="w-full max-w-md mx-auto p-6 bg-card-elevated">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Welcome Back</h2>
        <p className="text-muted-foreground">Sign in to access your account</p>
      </div>

      <Tabs defaultValue="email" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="space-y-4 mt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className="pl-10 pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-8 w-8"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button type="submit" variant="web3" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="text-center">
            <a href="#" className="text-sm text-web3-accent hover:underline">
              Forgot your password?
            </a>
          </div>
        </TabsContent>

        <TabsContent value="wallet" className="space-y-4 mt-6">
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-web3-gradient rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-white" />
              </div>
              <p className="text-sm text-muted-foreground">
                Connect your wallet and sign a message to authenticate
              </p>
            </div>

            <Button 
              onClick={handleWalletAuth} 
              variant="connect" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? "Authenticating..." : "Sign Message"}
            </Button>

            <div className="text-xs text-center text-muted-foreground">
              This will not trigger any blockchain transaction
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-6">
        <Separator className="my-4" />
        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <a href="#" className="text-web3-accent hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </Card>
  );
};