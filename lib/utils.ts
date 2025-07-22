import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));

import { Request, Response, NextFunction, Router, RequestHandler } from 'express';
import { ClassConstructor, plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import 'reflect-metadata';

// Ajout des types pour les données validées
declare global {
  namespace Express {
    interface Request {
      validatedBody?: unknown;
      validatedQuery?: unknown;
      validatedParams?: unknown;
    }
  }
}

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';

interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handlerName: string;
  middlewares: RequestHandler[];
}

interface PathParamMetadata {
  index: number;
  name?: string;
}

// Contrôleur principal
export function Controller(prefix: string = ''): ClassDecorator {
  return <TFunction extends Function>(TargetClass: TFunction) => {
    return class extends (TargetClass as any) {
      private readonly _router: Router = Router();

      constructor(...args: any[]) {
        super(...args);
        this.registerRoutes();
      }

      private registerRoutes(): void {
        const routes: RouteDefinition[] = Reflect.getMetadata('routes', this.constructor) || [];

        routes.forEach(({ method, path, handlerName, middlewares }) => {
          const handler = this[handlerName].bind(this);
          const handlerWithParams = injectParams(handler, this, handlerName);
          this._router[method](
            `${prefix}${path}`,
            ...middlewares,
            async (req: Request, res: Response, next: NextFunction) => {
              try {
                await handlerWithParams(req, res, next);
              } catch (error) {
                next(error);
              }
            }
          );
        });
      }

      public get router(): Router {
        return this._router;
      }
    };
  };
}

// Injection des paramètres décorés
const injectParams = (
  handler: Function,
  target: any,
  propertyKey: string
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const bodyParams: PathParamMetadata[] = Reflect.getMetadata('bodyParams', target, propertyKey) || [];
    const queryParams: PathParamMetadata[] = Reflect.getMetadata('queryParams', target, propertyKey) || [];
    const pathParams: PathParamMetadata[] = Reflect.getMetadata('pathParams', target, propertyKey) || [];

    const args: any[] = [];

    for (const { index, name } of [...bodyParams, ...queryParams, ...pathParams]) {
      const source =
        bodyParams.find(p => p.index === index) ? 'body' :
        queryParams.find(p => p.index === index) ? 'query' : 'params';

      const value = name ? req[source][name] : req[source];
      args[index] = value;
    }

    return handler(...args, req, res, next);
  };
};

// Création décorateurs HTTP
const createHttpDecorator = (method: HttpMethod) => {
  return (path: string = ''): MethodDecorator => {
    return (target, propertyKey) => {
      const routes: RouteDefinition[] = Reflect.getMetadata('routes', target.constructor) || [];
      routes.push({
        method,
        path,
        handlerName: propertyKey.toString(),
        middlewares: Reflect.getMetadata('middlewares', target, propertyKey) || []
      });
      Reflect.defineMetadata('routes', routes, target.constructor);
    };
  };
};

export const Get = createHttpDecorator('get');
export const Post = createHttpDecorator('post');
export const Put = createHttpDecorator('put');
export const Delete = createHttpDecorator('delete');
export const Patch = createHttpDecorator('patch');

// Middleware
export function Use(...middlewares: RequestHandler[]): MethodDecorator {
  return (target, propertyKey) => {
    Reflect.defineMetadata('middlewares', middlewares, target, propertyKey);
  };
}

// Validation
const createValidateDecorator = <T extends 'body' | 'query' | 'params'>(
  target: T,
  skipMissing = false
) => {
  return (dtoClass: ClassConstructor<unknown>): MethodDecorator => {
    return (targetObj, propertyKey, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function (req: Request, res: Response, next: NextFunction) {
        try {
          const dtoInstance = plainToClass(dtoClass, req[target] as object);
          const errors = await validate(dtoInstance, { skipMissingProperties: skipMissing });

          if (errors.length > 0) {
            return res.status(400).json({
              statusCode: 400,
              message: `${target} validation failed`,
              errors: errors.map(error => ({
                property: error.property,
                constraints: error.constraints
              }))
            });
          }

          (req as any)[`validated${target.charAt(0).toUpperCase() + target.slice(1)}`] = dtoInstance;
          return originalMethod.call(this, req, res, next);
        } catch (error) {
          next(error);
        }
      };
    };
  };
};

export const ValidateBody = createValidateDecorator('body');
export const ValidateQuery = createValidateDecorator('query', true);
export const ValidateParams = createValidateDecorator('params');

// Décorateurs de paramètres
const createParamDecorator = (type: 'body' | 'query' | 'path') => {
  return (name?: string): ParameterDecorator => {
    return (target, propertyKey, parameterIndex) => {
      if (!propertyKey) {
        throw new Error(`@${type.charAt(0).toUpperCase() + type.slice(1)} must be used on a method parameter`);
      }

      const metadataKey = `${type}Params`;
      const params: PathParamMetadata[] = Reflect.getMetadata(metadataKey, target, propertyKey) || [];
      params.push({ index: parameterIndex, name });
      Reflect.defineMetadata(metadataKey, params, target, propertyKey);
    };
  };
};

export const Body = createParamDecorator('body');
export const Query = createParamDecorator('query');
export const Param = createParamDecorator('path');

