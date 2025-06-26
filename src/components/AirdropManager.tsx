import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWeb3 } from "@/hooks/useWeb3";
import { ethers } from "ethers";
import { Coins, Users, Zap, Plus, Upload, ExternalLink, CheckCircle } from "lucide-react";
import { AIRDROP_CONTRACT_ABI, ERC20_ABI } from "@/contracts/AirdropContractABI";
import { generateMerkleTree, type AirdropEntry } from "@/utils/merkleTree";

interface AirdropCampaign {
  id: string;
  title: string;
  description?: string;
  contract_address: string;
  token_address: string;
  token_symbol: string;
  token_decimals: number;
  total_amount: string;
  recipients_count: number;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  created_at: string;
}

interface AirdropRecipient {
  wallet_address: string;
  amount: string;
}

export const AirdropManager = () => {
  const { account, provider, signer, isConnected } = useWeb3();
  const [campaigns, setCampaigns] = useState<AirdropCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimingTokens, setClaimingTokens] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    contract_address: '',
    token_address: '',
    token_symbol: '',
    token_decimals: 18,
    total_amount: '',
  });
  const [recipientData, setRecipientData] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('airdrop-manager', {
        body: { action: 'get_campaigns' }
      });

      if (error) throw error;
      
      if (data.success) {
        setCampaigns(data.campaigns);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      toast({
        title: "Error",
        description: "Failed to fetch campaigns",
        variant: "destructive",
      });
    }
  };

  const createCampaign = async () => {
    if (!formData.title || !formData.contract_address || !formData.token_address) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('airdrop-manager', {
        body: {
          action: 'create_campaign',
          campaign: formData
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Success",
          description: "Airdrop campaign created successfully",
        });
        setFormData({
          title: '',
          description: '',
          contract_address: '',
          token_address: '',
          token_symbol: '',
          token_decimals: 18,
          total_amount: '',
        });
        fetchCampaigns();
      }
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast({
        title: "Error",
        description: "Failed to create campaign",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addRecipients = async () => {
    if (!selectedCampaign || !recipientData) {
      toast({
        title: "Error",
        description: "Please select a campaign and provide recipient data",
        variant: "destructive",
      });
      return;
    }

    try {
      // Parse CSV format: address,amount
      const lines = recipientData.trim().split('\n');
      const recipients: AirdropRecipient[] = lines.map(line => {
        const [wallet_address, amount] = line.split(',');
        return {
          wallet_address: wallet_address.trim(),
          amount: amount.trim()
        };
      });

      setLoading(true);
      const { data, error } = await supabase.functions.invoke('airdrop-manager', {
        body: {
          action: 'add_recipients',
          campaign_id: selectedCampaign,
          recipients
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Success",
          description: `Added ${recipients.length} recipients to the campaign`,
        });
        setRecipientData('');
        fetchCampaigns();
      }
    } catch (error) {
      console.error('Error adding recipients:', error);
      toast({
        title: "Error",
        description: "Failed to add recipients. Check your data format.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const executeAirdrop = async (campaignId: string) => {
    if (!signer || !account) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to execute airdrop",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Get campaign details
      const campaign = campaigns.find(c => c.id === campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Get recipients from database
      const { data: recipientsData, error: recipientsError } = await supabase
        .from('airdrop_recipients')
        .select('*')
        .eq('campaign_id', campaignId);

      if (recipientsError || !recipientsData || recipientsData.length === 0) {
        throw new Error('No recipients found for this campaign');
      }

      // Prepare merkle tree
      const recipients: AirdropEntry[] = recipientsData.map(r => ({
        address: r.wallet_address,
        amount: r.amount.toString()
      }));

      const { root, tree } = generateMerkleTree(recipients);

      // Connect to smart contract
      const airdropContract = new ethers.Contract(
        campaign.contract_address,
        AIRDROP_CONTRACT_ABI,
        signer
      );

      // Create campaign on smart contract
      const tx = await airdropContract.createCampaign(campaign.total_amount, root);
      
      toast({
        title: "Transaction Sent",
        description: "Creating airdrop campaign on blockchain...",
      });

      const receipt = await tx.wait();

      // Update campaign status in database
      await supabase.functions.invoke('airdrop-manager', {
        body: {
          action: 'execute_airdrop',
          campaign_id: campaignId
        }
      });

      toast({
        title: "Airdrop Campaign Created",
        description: `Campaign deployed with transaction: ${receipt.hash}`,
      });

      fetchCampaigns();
    } catch (error: any) {
      console.error('Error executing airdrop:', error);
      toast({
        title: "Execution Failed",
        description: error.message || "Failed to execute airdrop",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const claimTokens = async (campaignId: string) => {
    if (!signer || !account) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to claim tokens",
        variant: "destructive",
      });
      return;
    }

    setClaimingTokens(campaignId);
    try {
      // Get merkle proof from backend
      const { data: proofData, error: proofError } = await supabase.functions.invoke('airdrop-executor', {
        body: {
          action: 'get_merkle_proof',
          campaign_id: campaignId,
          recipient_address: account
        }
      });

      if (proofError || !proofData.success) {
        throw new Error(proofData?.error || 'Failed to get merkle proof');
      }

      if (proofData.already_claimed) {
        toast({
          title: "Already Claimed",
          description: "You have already claimed tokens from this campaign",
          variant: "destructive",
        });
        return;
      }

      const campaign = campaigns.find(c => c.id === campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Connect to smart contract
      const airdropContract = new ethers.Contract(
        campaign.contract_address,
        AIRDROP_CONTRACT_ABI,
        signer
      );

      // Claim tokens
      const tx = await airdropContract.claimTokens(
        0, // campaign ID on contract (assuming first campaign)
        proofData.amount,
        proofData.proof
      );

      toast({
        title: "Claiming Tokens",
        description: "Transaction sent to blockchain...",
      });

      const receipt = await tx.wait();

      // Update claim status in database
      await supabase.functions.invoke('airdrop-executor', {
        body: {
          action: 'claim_tokens',
          campaign_id: campaignId,
          recipient_address: account,
          transaction_hash: receipt.hash
        }
      });

      toast({
        title: "Tokens Claimed Successfully",
        description: `Transaction: ${receipt.hash}`,
      });

      fetchCampaigns();
    } catch (error: any) {
      console.error('Error claiming tokens:', error);
      toast({
        title: "Claim Failed",
        description: error.message || "Failed to claim tokens",
        variant: "destructive",
      });
    } finally {
      setClaimingTokens(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30';
      case 'active': return 'bg-blue-500/20 text-blue-700 border-blue-500/30';
      case 'completed': return 'bg-green-500/20 text-green-700 border-green-500/30';
      case 'cancelled': return 'bg-red-500/20 text-red-700 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-700 border-gray-500/30';
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-foreground">Airdrop Manager</h2>
        <p className="text-muted-foreground">Create and manage token airdrops with smart contract integration</p>
      </div>

      <Tabs defaultValue="campaigns" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="create">Create Campaign</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          <div className="grid gap-4">
            {campaigns.map((campaign) => (
              <Card key={campaign.id} className="border-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{campaign.title}</CardTitle>
                    <Badge className={getStatusColor(campaign.status)}>
                      {campaign.status}
                    </Badge>
                  </div>
                  {campaign.description && (
                    <CardDescription>{campaign.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-web3" />
                      <span className="text-sm text-muted-foreground">
                        {campaign.token_symbol}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-web3-success" />
                      <span className="text-sm text-muted-foreground">
                        {campaign.recipients_count} recipients
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-web3-accent" />
                      <span className="text-sm text-muted-foreground">
                        {(parseInt(campaign.total_amount) / Math.pow(10, campaign.token_decimals)).toLocaleString()} tokens
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Contract: {campaign.contract_address}</p>
                    <p>Token: {campaign.token_address}</p>
                  </div>

                  <div className="flex gap-2">
                    {campaign.status === 'pending' && campaign.recipients_count > 0 && isConnected && (
                      <Button 
                        onClick={() => executeAirdrop(campaign.id)}
                        disabled={loading}
                        className="flex-1"
                        variant="web3"
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        Deploy to Blockchain
                      </Button>
                    )}
                    
                    {campaign.status === 'active' && isConnected && (
                      <Button 
                        onClick={() => claimTokens(campaign.id)}
                        disabled={claimingTokens === campaign.id}
                        className="flex-1"
                        variant="outline"
                      >
                        {claimingTokens === campaign.id ? (
                          "Claiming..."
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Claim Tokens
                          </>
                        )}
                      </Button>
                    )}
                    
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => window.open(`https://etherscan.io/address/${campaign.contract_address}`, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {!isConnected && (
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Connect your wallet to interact with this campaign
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            
            {campaigns.length === 0 && (
              <Card className="border-dashed border-2 border-border">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Coins className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No campaigns yet</h3>
                  <p className="text-muted-foreground text-center">Create your first airdrop campaign to get started</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="create" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Create New Campaign
              </CardTitle>
              <CardDescription>
                Set up a new token airdrop campaign with smart contract integration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Campaign Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Community Rewards Airdrop"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="token_symbol">Token Symbol *</Label>
                  <Input
                    id="token_symbol"
                    value={formData.token_symbol}
                    onChange={(e) => setFormData({ ...formData, token_symbol: e.target.value })}
                    placeholder="e.g., VGT"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe your airdrop campaign..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contract_address">Contract Address *</Label>
                  <Input
                    id="contract_address"
                    value={formData.contract_address}
                    onChange={(e) => setFormData({ ...formData, contract_address: e.target.value })}
                    placeholder="0x..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="token_address">Token Address *</Label>
                  <Input
                    id="token_address"
                    value={formData.token_address}
                    onChange={(e) => setFormData({ ...formData, token_address: e.target.value })}
                    placeholder="0x..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="token_decimals">Token Decimals</Label>
                  <Input
                    id="token_decimals"
                    type="number"
                    value={formData.token_decimals}
                    onChange={(e) => setFormData({ ...formData, token_decimals: parseInt(e.target.value) || 18 })}
                    placeholder="18"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total_amount">Total Amount (in wei)</Label>
                  <Input
                    id="total_amount"
                    value={formData.total_amount}
                    onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                    placeholder="1000000000000000000"
                  />
                </div>
              </div>

              <Button 
                onClick={createCampaign} 
                disabled={loading} 
                className="w-full"
                variant="web3"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Campaign
              </Button>
            </CardContent>
          </Card>

          {campaigns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Add Recipients
                </CardTitle>
                <CardDescription>
                  Upload recipient list in CSV format: wallet_address,amount (one per line)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="campaign">Select Campaign</Label>
                  <select
                    id="campaign"
                    value={selectedCampaign}
                    onChange={(e) => setSelectedCampaign(e.target.value)}
                    className="w-full p-2 border border-border rounded-md bg-background"
                  >
                    <option value="">Select a campaign...</option>
                    {campaigns.filter(c => c.status === 'pending').map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.title} ({campaign.token_symbol})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recipients">Recipients Data</Label>
                  <Textarea
                    id="recipients"
                    value={recipientData}
                    onChange={(e) => setRecipientData(e.target.value)}
                    placeholder="0x1234...abcd,1000000000000000000&#10;0x5678...efgh,500000000000000000"
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: wallet_address,amount (in wei). One recipient per line.
                  </p>
                </div>

                <Button 
                  onClick={addRecipients} 
                  disabled={loading} 
                  className="w-full"
                  variant="outline"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Add Recipients
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};