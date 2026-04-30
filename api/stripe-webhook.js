import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify the webhook came from Stripe
    event = stripe.webhooks.constructEvent(
      req.body, // raw body
      sig,
      webhookSecret
    );
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Handle successful payment
  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    const { tenantId, tenantName, address } = paymentIntent.metadata;

    console.log(`✅ Payment confirmed for ${tenantName} — ${address}`);
    console.log(`   Amount: $${paymentIntent.amount / 100}`);
    console.log(`   Tenant ID: ${tenantId}`);

    // When Supabase is connected, this is where we'll update the DB:
    // await supabase.from("payments").insert({ tenant_id: tenantId, amount: paymentIntent.amount / 100, status: "paid" });
    // await supabase.from("tenants").update({ paid: true, paid_date: new Date() }).eq("id", tenantId);
  }

  if (event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object;
    console.log(`❌ Payment failed for ${paymentIntent.metadata.tenantName}`);
  }

  res.status(200).json({ received: true });
}

// Vercel needs raw body for Stripe webhook signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};
