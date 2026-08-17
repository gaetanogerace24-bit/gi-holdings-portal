import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { listingId, amount, name, email, phone } = await req.json();

    // Pass Stripe fee through to applicant: (fee + 0.30) / (1 - 0.029)
    const amountWithFee = Math.round((amount + 30) / (1 - 0.029));

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountWithFee,
      currency: "usd",
      metadata: { listingId, name, email, phone, type: "application_fee" },
      description: "Rental application fee",
    });

    return new Response(JSON.stringify({ clientSecret: paymentIntent.client_secret, amountWithFee }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
