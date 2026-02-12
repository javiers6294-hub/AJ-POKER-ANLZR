import Stripe from 'stripe';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import { buffer } from 'micro';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const session = event.data.object;
  // Obtener el Customer para sacar el ClerkId de sus metadatos
  const customer = await stripe.customers.retrieve(session.customer);
  const clerkId = customer.metadata.clerkId;

  if (!clerkId) return res.status(400).send("No clerkId found in customer");

  switch (event.type) {
    case 'checkout.session.completed':
    case 'invoice.paid':
      // Dar acceso
      await clerkClient.users.updateUserMetadata(clerkId, {
        publicMetadata: { status: 'active' }
      });
      break;

    case 'customer.subscription.deleted':
    case 'invoice.payment_failed':
      // Quitar acceso
      await clerkClient.users.updateUserMetadata(clerkId, {
        publicMetadata: { status: 'expired' }
      });
      break;
  }

  res.json({ received: true });
}
