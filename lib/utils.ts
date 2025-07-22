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
