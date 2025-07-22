import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));


export function Controller(prefix: string = '') {
  return function <T extends new (...args: any[]) => {}>(TargetClass: T): 
    new (...args: ConstructorParameters<T>) => InstanceType<T> & WithRouter {
    return class extends TargetClass {
      private readonly _router = Router();

      constructor(...args: any[]) {
        super(...args);
        this.registerRoutes();
      }

      private registerRoutes(): void {
        const routes = Reflect.getMetadata('routes', TargetClass) || [];
        routes.forEach(({ method, path, handlerName, middlewares }) => {
          const handler = (this as any)[handlerName].bind(this);
          const handlerWithParams = injectParams(handler, this, handlerName);
          this._router[method](
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
        });
      }

      public get router() {
        return this._router;
      }
    };
  };
}



