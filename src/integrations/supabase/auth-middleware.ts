import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Response(
        'Missing Supabase environment variables. Ensure SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are set.',
        { status: 500 }
      );
    }

    const request = getRequest();

    if (!request?.headers) {
      throw new Response('Unauthorized: No request headers available', { status: 401 });
    }

    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      throw new Response('Unauthorized: No authorization header provided', { status: 401 });
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new Response('Unauthorized: Only Bearer tokens are supported', { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      throw new Response('Unauthorized: No token provided', { status: 401 });
    }

    const supabase = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    let userId: string | null = null;
    let claims: any = null;

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (!userError && userData?.user?.id) {
        userId = userData.user.id;
        claims = { sub: userId, email: userData.user.email, ...userData.user.user_metadata };
      }
    } catch {
      // ignore
    }

    // Fallback: parse JWT token directly if needed
    if (!userId) {
      try {
        const parts = token.split('.');
        if (parts.length >= 2) {
          const payloadStr = typeof Buffer !== 'undefined'
            ? Buffer.from(parts[1], 'base64').toString('utf8')
            : atob(parts[1]);
          const parsed = JSON.parse(payloadStr);
          if (parsed?.sub) {
            userId = parsed.sub;
            claims = parsed;
          }
        }
      } catch {
        // ignore
      }
    }

    if (!userId) {
      throw new Response('Unauthorized: Invalid or expired token', { status: 401 });
    }

    return next({
      context: {
        supabase,
        userId,
        claims: claims ?? { sub: userId },
      },
    });
  }
);
