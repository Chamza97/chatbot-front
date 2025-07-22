import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));

import { Request, Response, NextFunction, Router } from 'express';
import { ClassConstructor, plainToClass, validate } from 'class-validator';
import { transformAndValidate } from 'class-transformer-validator';

declare global {
  namespace Express {
    interface Request {
      validatedBody?: any;
      validatedQuery?: any;
      validatedParams?: any;
    }
  }
}

// Décorateur de classe pour le préfixe de route
export function Controller(prefix: string = '') {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    return class extends constructor {
      router = Router();
      constructor(...args: any[]) {
        super(...args);
        this.registerRoutes();
      }

      private registerRoutes() {
        const routes: Array<{
          method: 'get' | 'post' | 'put' | 'delete' | 'patch';
          path: string;
          handlerName: string;
          middlewares: RequestHandler[];
        }> = Reflect.getMetadata('routes', this) || [];

        routes.forEach(route => {
          this.router[route.method](
            route.path,
            ...route.middlewares,
            (req: Request, res: Response, next: NextFunction) => {
              const handler = this[route.handlerName].bind(this);
              return handler(req, res, next);
            }
          );
        });
      }
    };
  };
}

// Décorateurs HTTP
export function Get(path: string = '') {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    addRoute('get', path, target, propertyKey);
  };
}

export function Post(path: string = '') {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    addRoute('post', path, target, propertyKey);
  };
}

function addRoute(method: string, path: string, target: any, propertyKey: string) {
  const routes = Reflect.getMetadata('routes', target) || [];
  routes.push({
    method,
    path,
    handlerName: propertyKey,
    middlewares: Reflect.getMetadata('middlewares', target, propertyKey) || []
  });
  Reflect.defineMetadata('routes', routes, target);
}

// Décorateur middleware
export function Use(...middlewares: RequestHandler[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata('middlewares', middlewares, target, propertyKey);
  };
}

// Décorateur de validation pour le body
export function ValidateBody(dtoClass: ClassConstructor<any>): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (req: Request, res: Response, next: NextFunction) {
      try {
        const dtoInstance = plainToClass(dtoClass, req.body);
        const errors = await validate(dtoInstance);
        
        if (errors.length > 0) {
          return res.status(400).json({
            statusCode: 400,
            message: 'Validation failed',
            errors: errors.map(error => ({
              property: error.property,
              constraints: error.constraints
            }))
          });
        }
        
        req.validatedBody = dtoInstance;
        return originalMethod.apply(this, [req, res, next]);
      } catch (err) {
        next(err);
      }
    };
  };
}

// Décorateur de validation pour les query params
export function ValidateQuery(dtoClass: ClassConstructor<any>): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (req: Request, res: Response, next: NextFunction) {
      try {
        const dtoInstance = plainToClass(dtoClass, req.query);
        const errors = await validate(dtoInstance, { skipMissingProperties: true });
        
        if (errors.length > 0) {
          return res.status(400).json({
            statusCode: 400,
            message: 'Query validation failed',
            errors: errors.map(error => ({
              property: error.property,
              constraints: error.constraints
            }))
          });
        }
        
        req.validatedQuery = dtoInstance;
        return originalMethod.apply(this, [req, res, next]);
      } catch (err) {
        next(err);
      }
    };
  };
}

// Décorateur de validation pour les path params
export function ValidateParams(dtoClass: ClassConstructor<any>): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (req: Request, res: Response, next: NextFunction) {
      try {
        const dtoInstance = plainToClass(dtoClass, req.params);
        const errors = await validate(dtoInstance);
        
        if (errors.length > 0) {
          return res.status(400).json({
            statusCode: 400,
            message: 'Path params validation failed',
            errors: errors.map(error => ({
              property: error.property,
              constraints: error.constraints
            }))
          });
        }
        
        req.validatedParams = dtoInstance;
        return originalMethod.apply(this, [req, res, next]);
      } catch (err) {
        next(err);
      }
    };
  };
}

// Décorateurs d'injection de paramètres
export function Body(): ParameterDecorator {
  return function (target: any, propertyKey: string | symbol, parameterIndex: number) {
    Reflect.defineMetadata('bodyParam', parameterIndex, target, propertyKey);
  };
}

export function Query(): ParameterDecorator {
  return function (target: any, propertyKey: string | symbol, parameterIndex: number) {
    Reflect.defineMetadata('queryParam', parameterIndex, target, propertyKey);
  };
}

export function Param(paramName?: string): ParameterDecorator {
  return function (target: any, propertyKey: string | symbol, parameterIndex: number) {
    const params = Reflect.getMetadata('pathParams', target, propertyKey) || [];
    params.push({ index: parameterIndex, name: paramName });
    Reflect.defineMetadata('pathParams', params, target, propertyKey);
  };
}
