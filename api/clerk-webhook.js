import { createClerkClient } from '@clerk/clerk-sdk-node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { data, type } = req.body;

  if (type === 'user.created') {
    const clerkId = data.id;
    const email = data.email_addresses[0].email_address;

    // BUSCAR SI YA EXISTE EL CLIENTE PARA EVITAR DUPLICADOS
    const existingCustomers = await stripe.customers.list({ email, limit: 1 });
    let customer;

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
      // Actualizar metadatos del cliente existente para incluir el Clerk ID
      await stripe.customers.update(customer.id, { metadata: { clerkId } });
    } else {
      // Crear uno nuevo solo si no existe
      customer = await stripe.customers.create({
        email: email,
        metadata: { clerkId }
      });
    }

    // Guardar el ID de Stripe en Clerk (Punto clave para la portada)
    await clerkClient.users.updateUserMetadata(clerkId, {
      publicMetadata: {
        stripeCustomerId: customer.id,
        status: 'pending'
      }
    });
  }
  res.json({ received: true });
}
