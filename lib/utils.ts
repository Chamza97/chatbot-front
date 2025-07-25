import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs)


                 
import type { PathParamMetadata } from './types/decorators.type';

const createParamDecorator = (type: 'body' | 'query' | 'path') => {
  return (name?: string): ParameterDecorator => {
    return (target: Object, propertyKey: string | symbol, parameterIndex: number) => {
      if (!propertyKey) {
        throw new Error(`@${type.charAt(0).toUpperCase() + type.slice(1)} must be used on a method parameter`);
      }

      const metadataKey = `${type}Params`;
      const existingParams: PathParamMetadata[] = 
        Reflect.getMetadata(metadataKey, target, propertyKey) || [];

      existingParams.push({ 
        index: parameterIndex, 
        name: name || null // null = tout l'objet
      });

      Reflect.defineMetadata(metadataKey, existingParams, target, propertyKey);
    };
  };
};

export const Body = createParamDecorator('body');
export const Query = createParamDecorator('query');
export const Param = createParamDecorator('path');
 function injectParams(
  handler: Function, 
  context: any, 
  handlerName: string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const bodyParams: PathParamMetadata[] = Reflect.getMetadata('bodyParams', context, handlerName) || [];
    const queryParams: PathParamMetadata[] = Reflect.getMetadata('queryParams', context, handlerName) || [];
    const pathParams: PathParamMetadata[] = Reflect.getMetadata('pathParams', context, handlerName) || [];
    
    const args = new Array(handler.length);

    // Injection des paramètres
    [...bodyParams, ...queryParams, ...pathParams].forEach(({ index, name }) => {
      const source = 
        bodyParams.some(p => p.index === index) ? req.body :
        queryParams.some(p => p.index === index) ? req.query :
        req.params;

      args[index] = name ? source[name] : source; // Si pas de nom, on prend tout l'objet
    });

    // Injection de req/res/next aux 3 dernières positions si manquants
    if (!args.includes(req)) args[args.length - 3] = req;
    if (!args.includes(res)) args[args.length - 2] = res;
    if (!args.includes(next)) args[args.length - 1] = next;

    try {
      const result = await handler.apply(context, args);
      if (result !== undefined) res.json(result);
    } catch (err) {
      next(err);
    }
  };
} 

 export function createController(ControllerClass: new () => any): Router {
  const instance = new ControllerClass();
  const router = Router();

  const prefix: string = Reflect.getMetadata('prefix', ControllerClass) || '';
  const routes: RouteDefinition[] = Reflect.getMetadata('routes', ControllerClass) || [];

  for (const { method, path, handlerName, middlewares } of routes) {
    const handler = instance[handlerName].bind(instance);
    const injectedHandler = injectParams(handler, instance, handlerName); // ⭐ Ici

    router[method](
      `${prefix}${path}`,
      ...middlewares,
      injectedHandler // ← Handler avec paramètres injectés
    );
  }

  return router;
} 


