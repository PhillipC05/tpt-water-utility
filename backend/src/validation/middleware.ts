import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

// Extend Express Request interface to include validation results
declare global {
  namespace Express {
    interface Request {
      validatedData?: any;
      validatedQuery?: any;
      validatedParams?: any;
    }
  }
}

// Validation error class
export class ValidationError extends Error {
  public statusCode: number;
  public details: any;

  constructor(message: string, details: any) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.details = details;
  }
}

// Validation middleware factory
export const validate = (schema: Joi.ObjectSchema, property: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // Collect all errors
      stripUnknown: true, // Remove unknown properties
      convert: true, // Convert types
    });

    if (error) {
      const details = error.details.map((detail: any) => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
      }));

      const validationError = new ValidationError('Validation failed', details);
      next(validationError);
      return;
    }

    // Store validated data on request object
    switch (property) {
      case 'body':
        req.validatedData = value;
        break;
      case 'query':
        req.validatedQuery = value;
        break;
      case 'params':
        req.validatedParams = value;
        break;
    }

    next();
  };
};

// Combined validation middleware for multiple properties
export const validateMultiple = (schemas: {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: any[] = [];

    // Validate body
    if (schemas.body) {
      const { error, value } = schemas.body.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });

      if (error) {
        errors.push(...error.details.map((detail: any) => ({
          property: 'body',
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value,
        })));
      } else {
        req.validatedData = value;
      }
    }

    // Validate query
    if (schemas.query) {
      const { error, value } = schemas.query.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });

      if (error) {
        errors.push(...error.details.map((detail: any) => ({
          property: 'query',
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value,
        })));
      } else {
        req.validatedQuery = value;
      }
    }

    // Validate params
    if (schemas.params) {
      const { error, value } = schemas.params.validate(req.params, {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });

      if (error) {
        errors.push(...error.details.map((detail: any) => ({
          property: 'params',
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value,
        })));
      } else {
        req.validatedParams = value;
      }
    }

    if (errors.length > 0) {
      const validationError = new ValidationError('Validation failed', errors);
      next(validationError);
      return;
    }

    next();
  };
};

// Error handler for validation errors
export const handleValidationError = (error: Error, req: Request, res: Response, next: NextFunction): void => {
  if (error instanceof ValidationError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      errors: error.details,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  next(error);
};

// Utility function to sanitize input (remove potentially dangerous characters)
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return input;

  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .trim();
};

// Middleware to sanitize request body
export const sanitizeBody = (req: Request, res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === 'object') {
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return sanitizeInput(obj);
      }
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
      }
      return obj;
    };

    req.body = sanitizeObject(req.body);
  }

  next();
};
