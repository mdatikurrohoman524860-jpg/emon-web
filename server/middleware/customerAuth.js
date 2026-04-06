/**
 * Optional JWT — attaches req.user if valid Bearer token present.
 */
import jwt from 'jsonwebtoken';

export function optionalCustomerAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return next();
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role === 'customer') {
      req.user = { id: payload.sub, email: payload.email };
    }
  } catch {
    /* ignore invalid token for optional auth */
  }
  next();
}
