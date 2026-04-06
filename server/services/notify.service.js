/**
 * Order status notifications — logs to DB; optional email via SMTP env vars.
 */
import { query } from '../config/database.js';

export async function logOrderEvent(orderId, eventType, detail) {
  await query('INSERT INTO order_events (order_id, event_type, detail) VALUES (?, ?, ?)', [
    orderId,
    eventType,
    detail || null,
  ]);
}

/**
 * Fire-and-forget customer notification (email if configured).
 * Set: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, NOTIFY_EMAIL_TEST
 */
export async function notifyOrderStatusChange(order, newStatus) {
  const msg = `Order ${order.order_ref} is now: ${newStatus}. Total ৳${order.total}.`;
  await logOrderEvent(order.id, `status_${newStatus}`, msg);

  /* SMS: integrate Twilio / local BD gateway here using order.guest_phone */
  if (process.env.SMS_WEBHOOK_URL) {
    console.info('SMS webhook placeholder for order', order.order_ref, order.guest_phone);
  }

  if (!process.env.SMTP_HOST || !order.guest_email) {
    return;
  }
  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === '1',
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@medicinestore.local',
      to: order.guest_email,
      subject: `Order ${order.order_ref} — ${newStatus}`,
      text: msg,
    });
  } catch (e) {
    console.warn('notifyOrderStatusChange email skipped:', e.message);
  }
}
