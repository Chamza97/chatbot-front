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
  return async (req: Request, res: Response, next: NextFunction) => {
    return handler(req, res, next);
  };
}

// Interface pour exposer le router
export interface IController {
  router: Router;
}

// Décorateur @Controller
export function Controller(prefix = '') {
  return function <T extends { new (...args: any[]): {} }>(OriginalClass: T): T {
    return class extends OriginalClass implements IController {
      private readonly _router: Router;

      constructor(...args: any[]) {
        super(...args);
        this._router = Router();
        this.registerRoutes();
      }

      private registerRoutes(): void {
        const routes: RouteDefinition[] = Reflect.getMetadata('routes', OriginalClass) || [];

        for (const { method, path, handlerName, middlewares } of routes) {
          const handler = (this as any)[handlerName].bind(this);
          const handlerWithParams = injectParams(handler, this, handlerName);

          this._router[method](
            `${prefix}${path}`,
            ...middlewares,
            async (req: Request, res: Response, next: NextFunction) => {
              try {
                await handlerWithParams(req, res, next);
              } catch (err) {
                next(err);
              }
            }
          );
        }
      }

      public get router(): Router {
        return this._router;
      }
    };
  };
}


