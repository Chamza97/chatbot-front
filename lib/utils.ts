import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs)


                 
import 'reflect-metadata';

export function Param(name?: string): ParameterDecorator {
  return (target: any, propertyKey: string | symbol, parameterIndex: number) => {
    const metadataKey = 'pathParams';
    const existing = Reflect.getMetadata(metadataKey, target, propertyKey) || [];
    existing.push({ index: parameterIndex, name });
    Reflect.defineMetadata(metadataKey, existing, target, propertyKey);
  };
}

export function ValidateParams(dtoClass: any): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (req: any, res: any, next: any) {
      try {
        const dtoInstance = plainToClass(dtoClass, req.params);
        const errors = await validate(dtoInstance);
        
        if (errors.length > 0) {
          return res.status(400).json({
            message: 'Path params validation failed',
            errors: errors.map(err => ({
              property: err.property,
              constraints: err.constraints
            }))
          });
        }
        
        req.validatedParams = dtoInstance;
        return originalMethod.apply(this, [req, res, next]);
      } catch (err) {
        next(err);
      }
    };
  };
}
import 'reflect-metadata';

export function Query(name?: string): ParameterDecorator {
  return (target: any, propertyKey: string | symbol, parameterIndex: number) => {
    const metadataKey = 'queryParams';
    const existing = Reflect.getMetadata(metadataKey, target, propertyKey) || [];
    existing.push({ index: parameterIndex, name });
    Reflect.defineMetadata(metadataKey, existing, target, propertyKey);
  };
}

export function ValidateQuery(dtoClass: any, skipMissing = true): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (req: any, res: any, next: any) {
      try {
        const dtoInstance = plainToClass(dtoClass, req.query);
        const errors = await validate(dtoInstance, { skipMissingProperties: skipMissing });
        
        if (errors.length > 0) {
          return res.status(400).json({
            message: 'Query params validation failed',
            errors: errors.map(err => ({
              property: err.property,
              constraints: err.constraints
            }))
          });
        }
        
        req.validatedQuery = dtoInstance;
        return originalMethod.apply(this, [req, res, next]);
      } catch (err) {
        next(err);
      }
    };
  };
}
 function injectParams(handler: Function, context: any, handlerName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const args = new Array(handler.length);

    // Gestion combinée pour tous les types
    ['body', 'query', 'params'].forEach(source => {
      const params: { index: number; name?: string }[] = 
        Reflect.getMetadata(`${source}Params`, context, handlerName) || [];
      
      params.forEach(({ index, name }) => {
        const validatedData = req[`validated${source.charAt(0).toUpperCase() + source.slice(1)}`];
        const rawData = req[source as keyof Request];
        
        args[index] = validatedData 
          ? (name ? validatedData[name] : validatedData)
          : (name ? rawData[name] : rawData);
      });
    });

    // Injection standard req/res/next
    args[args.length - 3] = req;
    args[args.length - 2] = res;
    args[args.length - 1] = next;

    try {
      const result = await handler.apply(context, args);
      if (result !== undefined) res.json(result);
    } catch (err) {
      next(err);
    }
  };
} 
