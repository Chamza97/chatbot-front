import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));

export function Controller(prefix: string = ''): ClassDecorator {
  return function <T extends { new (...args: any[]): {} }>(TargetClass: T) {
    return class extends TargetClass {
      private readonly _router: Router = Router();

      constructor(...args: any[]) {
        super(...args);
        this.registerRoutes();
      }

      private registerRoutes(): void {
        const routes: RouteDefinition[] = Reflect.getMetadata('routes', TargetClass) || [];

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




