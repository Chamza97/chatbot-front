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

// Simulation de l’injection de paramètres décorés (tu peux l'adapter ensuite)
function injectParams(
  handler: (...args: any[]) => any,
  context: unknown,
  handlerName: string
): (...args: [Request, Response, NextFunction]) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction) => {
    return handler(req, res, next);
  };
}

// Interface à implémenter pour exposer le router
export interface IController {
  readonly router: Router;
}

// Décorateur @Controller
export function Controller(prefix = ''): ClassDecorator {
  return function <T extends new (...args: any[]) => {}>(TargetClass: T): T {
    return class extends TargetClass implements IController {
      private readonly _router: Router = Router();

      constructor(...args: any[]) {
        super(...args);
        this.registerRoutes();
      }

      private registerRoutes(): void {
        const routes: RouteDefinition[] = Reflect.getMetadata('routes', TargetClass) || [];

        routes.forEach(({ method, path, handlerName, middlewares }) => {
          const handler = (this as any)[handlerName].bind(this);
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



