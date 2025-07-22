import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));


// src/middlewares/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../utils/db';
import cipher from '../utils/cipher';

// Type definitions
interface DecodedToken {
  email: string;
  [key: string]: any;
}

interface UserData {
  team: string;
  company: string;
  role: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface ErrorResponse {
  code: string;
  message: string;
}

/**
 * Authentication middleware that verifies JWT tokens and attaches user data to requests
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Validate token presence
    const token = validateTokenHeader(req, res);
    if (!token) return;

    // 2. Decode and verify token
    const decoded = decodeAndVerifyToken(token, res);
    if (!decoded) return;

    // 3. Verify user exists in database
    await verifyUserExists(decoded.email, req, res, next);
  } catch (error) {
    console.error('Authentication error:', error);
    sendErrorResponse(res, 500, {
      code: 'SERVER_ERROR',
      message: 'Internal server error during authentication'
    });
  }
};

// Helper functions

/**
 * Validates the presence of an authorization token in request headers
 */
const validateTokenHeader = (req: Request, res: Response): string | null => {
  const authHeader = req.headers['x-authorization'];
  
  if (!authHeader || typeof authHeader !== 'string') {
    sendErrorResponse(res, 401, {
      code: 'MISSING_TOKEN',
      message: 'Authorization token required'
    });
    return null;
  }
  
  return authHeader;
};

/**
 * Decodes and validates the JWT token structure
 */
const decodeAndVerifyToken = (token: string, res: Response): DecodedToken | null => {
  try {
    // Remove 'Bearer ' prefix if present
    const cleanToken = token.replace(/^Bearer\s+/i, '');
    const decoded = jwt.decode(cleanToken) as DecodedToken;
    
    if (!decoded?.email) {
      sendErrorResponse(res, 401, {
        code: 'INVALID_TOKEN',
        message: 'Malformed authentication token'
      });
      return null;
    }
    
    return decoded;
  } catch (error) {
    console.error('Token decoding failed:', error);
    sendErrorResponse(res, 401, {
      code: 'INVALID_TOKEN',
      message: 'Failed to process authentication token'
    });
    return null;
  }
};

/**
 * Verifies user exists in database and attaches user data to request
 */
const verifyUserExists = async (
  email: string,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const encryptedEmail = cipher.encryptData(email.toLowerCase());
    
    const [users] = await pool.query<UserData[]>(
      'SELECT * FROM sys_users WHERE email = ?',
      [encryptedEmail]
    );

    if (!users?.length) {
      return sendErrorResponse(res, 403, {
        code: 'UNAUTHORIZED',
        message: 'Invalid user credentials'
      });
    }

    const user = users[0];
    attachUserData(req, res, user);
    next();
  } catch (error) {
    console.error('Database verification error:', error);
    sendErrorResponse(res, 503, {
      code: 'SERVICE_UNAVAILABLE',
      message: 'User verification service unavailable'
    });
  }
};

/**
 * Attaches user information to request and response headers
 */
const attachUserData = (req: Request, res: Response, user: UserData): void => {
  // Attach to request object
  req.user = {
    team: user.team,
    company: user.company,
    role: user.role,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email
  };

  // Set response headers
  res.setHeader('X-User-Role', cipher.decryptData(user.role));
  res.setHeader('X-User-Team', cipher.decryptData(user.team));
  res.setHeader(
    'X-User',
    `${cipher.decryptData(user.first_name)} ${cipher.decryptData(user.last_name)}`
  );
  res.setHeader(
    'Access-Control-Expose-Headers',
    'X-User, X-User-Role, X-User-Team'
  );
};

/**
 * Standardized error response handler
 */
const sendErrorResponse = (
  res: Response,
  status: number,
  error: ErrorResponse
): Response => {
  return res.status(status).json(error);
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        team: string;
        company: string;
        role: string;
        firstName: string;
        lastName: string;
        email: string;
      };
    }
  }
}
