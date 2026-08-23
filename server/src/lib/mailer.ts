import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY || 'dev-placeholder');
export const FROM_EMAIL = process.env.FROM_EMAIL || 'EvLY <noreply@estelle.app>';
export const APP_URL = process.env.APP_URL || 'http://localhost:5173';
