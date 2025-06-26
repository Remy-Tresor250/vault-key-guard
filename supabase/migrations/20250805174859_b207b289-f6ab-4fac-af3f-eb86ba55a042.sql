-- Create tables for airdrop functionality
CREATE TABLE public.airdrop_campaigns (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    contract_address TEXT NOT NULL,
    token_address TEXT NOT NULL,
    token_symbol TEXT NOT NULL,
    token_decimals INTEGER NOT NULL DEFAULT 18,
    total_amount BIGINT NOT NULL,
    recipients_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.airdrop_recipients (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES public.airdrop_campaigns(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    amount BIGINT NOT NULL,
    claimed BOOLEAN NOT NULL DEFAULT false,
    transaction_hash TEXT,
    claimed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.airdrop_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airdrop_recipients ENABLE ROW LEVEL SECURITY;

-- Create policies for airdrop_campaigns
CREATE POLICY "Users can view their own campaigns" 
ON public.airdrop_campaigns 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own campaigns" 
ON public.airdrop_campaigns 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns" 
ON public.airdrop_campaigns 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns" 
ON public.airdrop_campaigns 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for airdrop_recipients
CREATE POLICY "Users can view recipients of their campaigns" 
ON public.airdrop_recipients 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.airdrop_campaigns 
        WHERE id = campaign_id AND user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert recipients for their campaigns" 
ON public.airdrop_recipients 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.airdrop_campaigns 
        WHERE id = campaign_id AND user_id = auth.uid()
    )
);

CREATE POLICY "Users can update recipients of their campaigns" 
ON public.airdrop_recipients 
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.airdrop_campaigns 
        WHERE id = campaign_id AND user_id = auth.uid()
    )
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_airdrop_campaigns_updated_at
BEFORE UPDATE ON public.airdrop_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_airdrop_campaigns_user_id ON public.airdrop_campaigns(user_id);
CREATE INDEX idx_airdrop_recipients_campaign_id ON public.airdrop_recipients(campaign_id);
CREATE INDEX idx_airdrop_recipients_wallet_address ON public.airdrop_recipients(wallet_address);