import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Shield, Zap } from "lucide-react";

interface WalletCardProps {
  name: string;
  icon: string;
  description: string;
  isPopular?: boolean;
  onConnect: () => void;
}

export const WalletCard = ({ name, icon, description, isPopular, onConnect }: WalletCardProps) => {
  return (
    <Card className="relative p-6 bg-card-elevated border-border hover:border-web3/50 transition-all duration-300 group hover:shadow-lg hover:shadow-web3/20">
      {isPopular && (
        <Badge className="absolute -top-2 -right-2 bg-web3 text-primary-foreground">
          Popular
        </Badge>
      )}
      
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-web3/20 to-web3-accent/20 flex items-center justify-center">
          <span className="text-2xl">{icon}</span>
        </div>
        
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-foreground mb-1">{name}</h3>
          <p className="text-muted-foreground text-sm mb-4">{description}</p>
          
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-1 text-xs text-web3-accent">
              <Shield className="w-3 h-3" />
              <span>Secure</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-web3-success">
              <Zap className="w-3 h-3" />
              <span>Fast</span>
            </div>
          </div>
          
          <Button 
            variant="wallet" 
            className="w-full group-hover:border-web3/70"
            onClick={onConnect}
          >
            <Wallet className="w-4 h-4" />
            Connect {name}
          </Button>
        </div>
      </div>
    </Card>
  );
};