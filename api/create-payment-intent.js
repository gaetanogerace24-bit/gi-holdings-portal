import Stripe from "stripe";

const stripeKey = process.env.STRIPE_TEST_MODE === "true" ? process.env.STRIPE_TEST_KEY : process.env.STRIPE_SECRET_KEY;
const stripe = new Stripe(stripeKey);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { amount, tenantId, tenantName, address, paymentType, month, invoiceId, invoiceIds, customInvoiceIds } = req.body;

    if (!amount || amount < 50) return res.status(400).json({ error: "Invalid amount" });

    const allInvoiceIds = invoiceIds || (invoiceId ? [invoiceId] : []);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "usd",
      payment_method_types: paymentType === "ach" ? ["us_bank_account"] : ["card"],
      metadata: {
        tenantId: String(tenantId),
        tenant_id: String(tenantId),
        tenantName,
        address,
        month: month || "",
        invoice_ids: JSON.stringify(allInvoiceIds),
        custom_invoice_ids: JSON.stringify(customInvoiceIds || []),
        type: "rent_payment",
        landlord: "G&I Holdings LLC",
      },
      description: `Rent — ${tenantName} — ${month || address}`,
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });

  } catch (err) {
    console.error("Stripe error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
