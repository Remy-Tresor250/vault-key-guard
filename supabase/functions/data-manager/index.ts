import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AirdropRequest {
  action: 'create_campaign' | 'add_recipients' | 'execute_airdrop' | 'get_campaigns'
  campaign?: {
    title: string
    description?: string
    contract_address: string
    token_address: string
    token_symbol: string
    token_decimals: number
    total_amount: string
  }
  recipients?: Array<{
    wallet_address: string
    amount: string
  }>
  campaign_id?: string
}

Deno.serve(async (req) => {
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
    )

    // Get user from JWT token
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Authenticated user:', user.id)

    const body: AirdropRequest = await req.json()
    console.log('Request body:', body)

    switch (body.action) {
      case 'create_campaign':
        if (!body.campaign) {
          return new Response(
            JSON.stringify({ error: 'Campaign data required' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        const { data: campaign, error: campaignError } = await supabaseClient
          .from('airdrop_campaigns')
          .insert({
            user_id: user.id,
            title: body.campaign.title,
            description: body.campaign.description,
            contract_address: body.campaign.contract_address,
            token_address: body.campaign.token_address,
            token_symbol: body.campaign.token_symbol,
            token_decimals: body.campaign.token_decimals,
            total_amount: BigInt(body.campaign.total_amount).toString(),
          })
          .select()
          .single()

        if (campaignError) {
          console.error('Campaign creation error:', campaignError)
          return new Response(
            JSON.stringify({ error: 'Failed to create campaign' }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        return new Response(
          JSON.stringify({ success: true, campaign }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )

      case 'add_recipients':
        if (!body.campaign_id || !body.recipients) {
          return new Response(
            JSON.stringify({ error: 'Campaign ID and recipients required' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        // Verify campaign ownership
        const { data: campaignCheck, error: checkError } = await supabaseClient
          .from('airdrop_campaigns')
          .select('id')
          .eq('id', body.campaign_id)
          .eq('user_id', user.id)
          .single()

        if (checkError || !campaignCheck) {
          return new Response(
            JSON.stringify({ error: 'Campaign not found or unauthorized' }),
            { 
              status: 404, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        const recipients = body.recipients.map(recipient => ({
          campaign_id: body.campaign_id,
          wallet_address: recipient.wallet_address.toLowerCase(),
          amount: BigInt(recipient.amount).toString(),
        }))

        const { data: insertedRecipients, error: recipientsError } = await supabaseClient
          .from('airdrop_recipients')
          .insert(recipients)
          .select()

        if (recipientsError) {
          console.error('Recipients insertion error:', recipientsError)
          return new Response(
            JSON.stringify({ error: 'Failed to add recipients' }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        // Update campaign recipients count
        await supabaseClient
          .from('airdrop_campaigns')
          .update({ recipients_count: recipients.length })
          .eq('id', body.campaign_id)

        return new Response(
          JSON.stringify({ success: true, recipients: insertedRecipients }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )

      case 'get_campaigns':
        const { data: campaigns, error: getCampaignsError } = await supabaseClient
          .from('airdrop_campaigns')
          .select(`
            *,
            airdrop_recipients(count)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (getCampaignsError) {
          console.error('Get campaigns error:', getCampaignsError)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch campaigns' }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        return new Response(
          JSON.stringify({ success: true, campaigns }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )

      case 'execute_airdrop':
        if (!body.campaign_id) {
          return new Response(
            JSON.stringify({ error: 'Campaign ID required' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        // Get campaign and recipients
        const { data: campaignData, error: campaignDataError } = await supabaseClient
          .from('airdrop_campaigns')
          .select(`
            *,
            airdrop_recipients(*)
          `)
          .eq('id', body.campaign_id)
          .eq('user_id', user.id)
          .single()

        if (campaignDataError || !campaignData) {
          return new Response(
            JSON.stringify({ error: 'Campaign not found' }),
            { 
              status: 404, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        // Update campaign status to active
        await supabaseClient
          .from('airdrop_campaigns')
          .update({ status: 'active' })
          .eq('id', body.campaign_id)

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Airdrop activated. Recipients can now claim their tokens.',
            campaign: campaignData 
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
    }
  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})