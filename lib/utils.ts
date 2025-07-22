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

