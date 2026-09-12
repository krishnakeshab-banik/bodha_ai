import { createHmac, randomUUID } from 'node:crypto';

import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env.js';
import { requireUser } from '../middleware/auth.js';
import { activatePro, creditStatus } from '../models/userRepository.js';
import { HttpError } from '../utils/httpError.js';

export const billingRoutes = Router();

billingRoutes.get('/plan', requireUser, (req: Request, res: Response): void => {
  res.json({
    ...creditStatus(req.user!),
    amountPaise: env.proPricePaise,
    amountUsd: 10,
    currency: 'INR',
    razorpayConfigured: Boolean(env.razorpayKeyId && env.razorpayKeySecret),
  });
});

billingRoutes.post(
  '/order',
  requireUser,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw HttpError.unauthorized();

      if (!env.razorpayKeyId || !env.razorpayKeySecret) {
        res.json({
          mock: true,
          orderId: 'order_dev_' + randomUUID(),
          amount: env.proPricePaise,
          currency: 'INR',
          keyId: 'rzp_test_demo',
        });
        return;
      }

      const auth = Buffer.from(env.razorpayKeyId + ':' + env.razorpayKeySecret).toString('base64');
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + auth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: env.proPricePaise,
          currency: 'INR',
          receipt: 'bodha_' + req.user.id.slice(0, 8) + '_' + Date.now(),
          notes: { userId: req.user.id, plan: 'pro' },
        }),
      });
      const body = (await response.json()) as { id?: string; error?: { description?: string } };
      if (!response.ok || !body.id) {
        throw HttpError.badRequest(body.error?.description ?? 'Could not start Razorpay checkout');
      }

      res.json({
        mock: false,
        orderId: body.id,
        amount: env.proPricePaise,
        currency: 'INR',
        keyId: env.razorpayKeyId,
      });
    } catch (error) {
      next(error);
    }
  },
);

billingRoutes.post(
  '/verify',
  requireUser,
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) throw HttpError.unauthorized();
      const orderId = String(req.body?.razorpay_order_id ?? '');
      const paymentId = String(req.body?.razorpay_payment_id ?? '');
      const signature = String(req.body?.razorpay_signature ?? '');

      if (orderId.startsWith('order_dev_') && !env.razorpayKeySecret) {
        const user = activatePro(req.user.id);
        res.json({ user: { ...user, credits: creditStatus(user) } });
        return;
      }

      if (!env.razorpayKeySecret) {
        throw HttpError.badRequest('Razorpay is not configured');
      }
      if (!orderId || !paymentId || !signature) {
        throw HttpError.badRequest('Payment verification details are missing');
      }

      const expected = createHmac('sha256', env.razorpayKeySecret)
        .update(orderId + '|' + paymentId)
        .digest('hex');
      if (expected !== signature) {
        throw HttpError.badRequest('Payment signature did not match');
      }

      const user = activatePro(req.user.id);
      res.json({ user: { ...user, credits: creditStatus(user) } });
    } catch (error) {
      next(error);
    }
  },
);
