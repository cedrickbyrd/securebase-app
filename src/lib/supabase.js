/**
 * @file supabase.js
 * @description RETIRED — Supabase auth has been replaced by the AWS Lambda / JWT auth stack.
 *
 * Auth endpoints:
 *   POST /api/login   → https://9xyetu7zq3.execute-api.us-east-1.amazonaws.com/prod/auth/login
 *   POST /api/signup  → https://api.securebase.tximhotep.com/signup
 *
 * This file is kept as a tombstone to prevent import errors during the
 * transition period. All exports are no-ops. Remove this file once all
 * consumers have been updated.
 */

export const supabase = null;
export const verifyMFA = async () => ({ success: false, error: 'Supabase auth retired' });
export const unenrollMFA = async () => ({ success: false, error: 'Supabase auth retired' });
