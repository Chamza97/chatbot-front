import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));

import { Request, Response, NextFunction, Router, RequestHandler } from 'express';
import { ClassConstructor, plainToClass, validate } from 'class-validator';
import 'reflect-metadata';

declare global {
  namespace Express {
    interface Request {
      validatedBody?: unknown;
      validatedQuery?: unknown;
      validatedParams?: unknown;
    }
  }
}

// Types utilitaires
type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';
type RouteDefinition = {
  method: HttpMethod;
  path: string;
  handlerName: string;
  middlewares: RequestHandler[];
};
type PathParamMetadata = { index: number; name?: string };

// Décorateur de contrôleur
export function Controller(prefix: string = '') {
  return function <T extends new (...args: unknown[]) => unknown>(TargetClass: T) {
    return class extends (TargetClass as new (...args: unknown[]) => any) {
      private _router = Router();

      constructor(...args: unknown[]) {
        super(...args);
        this._registerRoutes();
      }

      private _registerRoutes() {
        const routes: RouteDefinition[] = Reflect.getMetadata('routes', this) || [];

        routes.forEach(route => {
          const fullPath = prefix + route.path;
          this._router[route.method](
            fullPath,
            ...route.middlewares,
            (req: Request, res: Response, next: NextFunction) => {
              const handler = this[route.handlerName].bind(this) as RequestHandler;
              return handler(req, res, next);
            }
          );
        });
      }

      get router(): Router {
        return this._router;
      }
    };
  };
}

// Décorateurs HTTP
export function Get(path: string = '') {
  return (target: object, propertyKey: string) => {
    addRoute('get', path, target, propertyKey);
  };
}

export function Post(path: string = '') {
  return (target: object, propertyKey: string) => {
    addRoute('post', path, target, propertyKey);
  };
}

function addRoute(method: HttpMethod, path: string, target: object, propertyKey: string) {
  const routes: RouteDefinition[] = Reflect.getMetadata('routes', target) || [];
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
  return (target: object, propertyKey: string) => {
    Reflect.defineMetadata('middlewares', middlewares, target, propertyKey);
  };
}

// Décorateurs de validation
export function ValidateBody(dtoClass: ClassConstructor<unknown>): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value as RequestHandler;
    
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
        return originalMethod.call(this, req, res, next);
      } catch (error) {
        next(error);
      }
    };
  };
}

export function ValidateQuery(dtoClass: ClassConstructor<unknown>): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value as RequestHandler;
    
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
        return originalMethod.call(this, req, res, next);
      } catch (error) {
        next(error);
      }
    };
  };
}

export function ValidateParams(dtoClass: ClassConstructor<unknown>): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value as RequestHandler;
    
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
        return originalMethod.call(this, req, res, next);
      } catch (error) {
        next(error);
      }
    };
  };
}

// Décorateurs d'injection
export function Body(): ParameterDecorator {
  return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (!propertyKey) throw new Error('@Body must be used on a method parameter');
    Reflect.defineMetadata('bodyParam', parameterIndex, target, propertyKey);
  };
}

export function Query(): ParameterDecorator {
  return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (!propertyKey) throw new Error('@Query must be used on a method parameter');
    Reflect.defineMetadata('queryParam', parameterIndex, target, propertyKey);
  };
}

export function Param(paramName?: string): ParameterDecorator {
  return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (!propertyKey) throw new Error('@Param must be used on a method parameter');
    const params: PathParamMetadata[] = Reflect.getMetadata('pathParams', target, propertyKey) || [];
    params.push({ index: parameterIndex, name: paramName });
    Reflect.defineMetadata('pathParams', params, target, propertyKey);
  };
}
