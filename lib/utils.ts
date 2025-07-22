import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));

import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import 'reflect-metadata';

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';

interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handlerName: string;
  middlewares: RequestHandler[];
}

function injectParams(
  handler: (...args: any[]) => any,
  context: unknown,
  handlerName: string
): (...args: [Request, Response, NextFunction]) => Promise<void> {
  return async (req, res, next) => {
    return handler(req, res, next);
  };
}

// Fonction utilitaire pour instancier un contrôleur avec son Router
export function createController(ControllerClass: new () => any): Router {
  const instance = new ControllerClass();
  const router = Router();

  const prefix: string = Reflect.getMetadata('prefix', ControllerClass) || '';
  const routes: RouteDefinition[] = Reflect.getMetadata('routes', ControllerClass) || [];

  for (const { method, path, handlerName, middlewares } of routes) {
    const handler = instance[handlerName].bind(instance);
    const handlerWithParams = injectParams(handler, instance, handlerName);

    router[method](
      `${prefix}${path}`,
      ...middlewares,
      async (req, res, next) => {
        try {
          await handlerWithParams(req, res, next);
        } catch (err) {
          next(err);
        }
      }
    );
  }

  return router;
}
export function Controller(prefix: string = ''): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata('prefix', prefix, target);
  };
}

function injectParams(
  handler: (...args: any[]) => any,
  context: unknown,
  handlerName: string
): (...args: [Request, Response, NextFunction]) => Promise<void> {
  return async (req, res, next) => {
    const bodyParams: PathParamMetadata[] = Reflect.getMetadata('bodyParams', context, handlerName) || [];
    const queryParams: PathParamMetadata[] = Reflect.getMetadata('queryParams', context, handlerName) || [];
    const pathParams: PathParamMetadata[] = Reflect.getMetadata('pathParams', context, handlerName) || [];

    const totalArgs = handler.length;
    const args: any[] = new Array(totalArgs);

    // Inject parameters
    for (const { index, name } of [...bodyParams, ...queryParams, ...pathParams]) {
      const source =
        bodyParams.find(p => p.index === index) ? 'body' :
        queryParams.find(p => p.index === index) ? 'query' : 'params';

      args[index] = name ? req[source][name] : req[source];
    }

    // Fallback: inject req, res, next at the end if not already decorated
    if (!args.includes(req)) args[totalArgs - 3] = req;
    if (!args.includes(res)) args[totalArgs - 2] = res;
    if (!args.includes(next)) args[totalArgs - 1] = next;

    try {
      const result = await handler.apply(context, args);
      if (res.headersSent) return;
      if (result !== undefined) {
        res.json(result);
      }
    } catch (err) {
      next(err);
    }
  };
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

// ✅ Factory pour les décorateurs HTTP
const createHttpDecorator = (method: HttpMethod) => {
  return (path: string = ''): MethodDecorator => {
    return (target, propertyKey) => {
      const routes: RouteDefinition[] =
        Reflect.getMetadata('routes', target.constructor) || [];

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

// ✅ Décorateur middleware
export function Use(...middlewares: RequestHandler[]): MethodDecorator {
  return (target, propertyKey) => {
    Reflect.defineMetadata('middlewares', middlewares, target, propertyKey);
  };
}

// ✅ Factory pour les décorateurs de validation
const createValidateDecorator = <T extends 'body' | 'query' | 'params'>(
  target: T,
  skipMissing = false
) => {
  return (dtoClass: ClassConstructor<unknown>): MethodDecorator => {
    return (targetObj, propertyKey, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function (req: Request, res: Response, next: NextFunction) {
        try {
          const dtoInstance = plainToClass(dtoClass, req[target]);
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

          // ex: validatedBody, validatedQuery, validatedParams
          const key = `validated${target.charAt(0).toUpperCase() + target.slice(1)}` as
            | 'validatedBody'
            | 'validatedQuery'
            | 'validatedParams';

          (req as any)[key] = dtoInstance;
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

// ✅ Factory pour les décorateurs de paramètres
const createParamDecorator = (type: 'body' | 'query' | 'path') => {
  return (name?: string): ParameterDecorator => {
    return (target, propertyKey, parameterIndex) => {
      if (!propertyKey) {
        throw new Error(`@${type.charAt(0).toUpperCase() + type.slice(1)} must be used on a method parameter`);
      }

      const metadataKey = `${type}Params`;
      const existingParams: PathParamMetadata[] =
        Reflect.getMetadata(metadataKey, target, propertyKey) || [];

      existingParams.push({ index: parameterIndex, name });
      Reflect.defineMetadata(metadataKey, existingParams, target, propertyKey);
    };
  };
};

export const Body = createParamDecorator('body');
export const Query = createParamDecorator('query');
export const Param = createParamDecorator('path');



  const createValidateDecorator = <T extends 'body' | 'query' | 'params'>(
  target: T,
  skipMissing = false
) => {
  return (dtoClass: ClassConstructor<unknown>): MethodDecorator => {
    return (targetObj: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function (req: Request, res: Response, next: NextFunction) {
        try {
          const source = req[target];
          if (typeof source !== 'object' || source === null) {
            return res.status(400).json({ message: `${target} should be a valid object` });
          }

          const dtoInstance = plainToClass(dtoClass, source);
          const errors = await validate(dtoInstance, { skipMissingProperties: skipMissing });

          if (errors.length > 0) {
            return res.status(400).json({
              statusCode: 400,
              message: `${target} validation failed`,
              errors: errors.map(error => ({
                property: error.property,
                constraints: { ...error.constraints }
              }))
            });
          }

          // Assign validated data back on req
          (req as any)[
            `validated${target.charAt(0).toUpperCase() + target.slice(1)}`
          ] = dtoInstance;

          return originalMethod.call(this, req, res, next);
        } catch (error) {
          next(error);
        }
      };
    };
  };
};

