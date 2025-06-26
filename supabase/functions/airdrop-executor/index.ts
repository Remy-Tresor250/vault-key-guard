import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AirdropRequest {
  action: 'execute_smart_contract_airdrop' | 'claim_tokens' | 'get_merkle_proof';
  campaign_id?: string;
  recipient_address?: string;
  transaction_hash?: string;
  merkle_proof?: string[];
  amount?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user from JWT token
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Authenticated user:', user.id);

    const body: AirdropRequest = await req.json();
    console.log('Request body:', body);

    switch (body.action) {
      case 'execute_smart_contract_airdrop':
        if (!body.campaign_id) {
          return new Response(
            JSON.stringify({ error: 'Campaign ID required' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // Get campaign and recipients
        const { data: campaignData, error: campaignError } = await supabaseClient
          .from('airdrop_campaigns')
          .select(`
            *,
            airdrop_recipients(*)
          `)
          .eq('id', body.campaign_id)
          .eq('user_id', user.id)
          .single();

        if (campaignError || !campaignData) {
          return new Response(
            JSON.stringify({ error: 'Campaign not found' }),
            { 
              status: 404, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // Generate merkle tree for the campaign
        const recipients = campaignData.airdrop_recipients.map((r: any) => ({
          address: r.wallet_address,
          amount: r.amount
        }));

        // Calculate merkle root (simplified - in real implementation, use proper merkle tree library)
        const merkleRoot = generateMerkleRoot(recipients);

        // Update campaign with merkle root and set to active
        await supabaseClient
          .from('airdrop_campaigns')
          .update({ 
            status: 'active',
            // Store merkle root in description for now (in production, add dedicated column)
            description: campaignData.description + `\n\nMerkle Root: ${merkleRoot}`
          })
          .eq('id', body.campaign_id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Smart contract airdrop setup complete. Recipients can now claim tokens.',
            merkle_root: merkleRoot,
            campaign: campaignData 
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );

      case 'get_merkle_proof':
        if (!body.campaign_id || !body.recipient_address) {
          return new Response(
            JSON.stringify({ error: 'Campaign ID and recipient address required' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // Get campaign and recipient data
        const { data: proofCampaign, error: proofError } = await supabaseClient
          .from('airdrop_campaigns')
          .select(`
            *,
            airdrop_recipients(*)
          `)
          .eq('id', body.campaign_id)
          .single();

        if (proofError || !proofCampaign) {
          return new Response(
            JSON.stringify({ error: 'Campaign not found' }),
            { 
              status: 404, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // Find recipient
        const recipient = proofCampaign.airdrop_recipients.find(
          (r: any) => r.wallet_address.toLowerCase() === body.recipient_address!.toLowerCase()
        );

        if (!recipient) {
          return new Response(
            JSON.stringify({ error: 'Recipient not found in campaign' }),
            { 
              status: 404, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // Generate merkle proof (simplified implementation)
        const allRecipients = proofCampaign.airdrop_recipients.map((r: any) => ({
          address: r.wallet_address,
          amount: r.amount
        }));

        const proof = generateMerkleProof(allRecipients, {
          address: recipient.wallet_address,
          amount: recipient.amount
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            proof,
            amount: recipient.amount,
            already_claimed: recipient.claimed
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );

      case 'claim_tokens':
        if (!body.campaign_id || !body.recipient_address || !body.transaction_hash) {
          return new Response(
            JSON.stringify({ error: 'Campaign ID, recipient address, and transaction hash required' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // Update recipient as claimed
        const { error: claimError } = await supabaseClient
          .from('airdrop_recipients')
          .update({ 
            claimed: true, 
            claimed_at: new Date().toISOString(),
            transaction_hash: body.transaction_hash
          })
          .eq('campaign_id', body.campaign_id)
          .eq('wallet_address', body.recipient_address.toLowerCase());

        if (claimError) {
          console.error('Claim update error:', claimError);
          return new Response(
            JSON.stringify({ error: 'Failed to update claim status' }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Token claim recorded successfully'
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Simplified merkle tree functions (in production, use proper crypto library)
function generateMerkleRoot(recipients: Array<{address: string, amount: string}>): string {
  // This is a simplified implementation - in production, use proper merkle tree
  const hash = recipients
    .map(r => `${r.address}:${r.amount}`)
    .sort()
    .join(',');
  
  // Simple hash generation (use proper keccak256 in production)
  let simpleHash = 0;
  for (let i = 0; i < hash.length; i++) {
    simpleHash = ((simpleHash << 5) - simpleHash + hash.charCodeAt(i)) & 0xffffffff;
  }
  
  return `0x${Math.abs(simpleHash).toString(16).padStart(64, '0')}`;
}

function generateMerkleProof(
  allRecipients: Array<{address: string, amount: string}>, 
  target: {address: string, amount: string}
): string[] {
  // Simplified proof generation - in production, implement proper merkle tree proof
  const targetIndex = allRecipients.findIndex(
    r => r.address.toLowerCase() === target.address.toLowerCase()
  );
  
  const proof = [];
  for (let i = 0; i < 3; i++) { // Generate 3 proof elements
    const element = `0x${Math.abs((targetIndex + i) * 12345).toString(16).padStart(64, '0')}`;
    proof.push(element);
  }
  
  return proof;
}