import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs)


                 
import type { PathParamMetadata } from './types/decorators.type';

import 'reflect-metadata';
import { Request } from 'express';

export function Body(name?: string): ParameterDecorator {
  return (target: any, propertyKey: string | symbol, parameterIndex: number) => {
    const metadataKey = `bodyParams`;
    const existing: { index: number; name?: string }[] = 
      Reflect.getMetadata(metadataKey, target, propertyKey) || [];
    
    existing.push({ index: parameterIndex, name });
    Reflect.defineMetadata(metadataKey, existing, target, propertyKey);
  };
}

import { plainToClass, ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import { RequestHandler } from 'express';

export function ValidateBody<T extends object>(dtoClass: ClassConstructor<T>): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (req: any, res: any, next: any) {
      try {
        const dtoInstance = plainToClass(dtoClass, req.body);
        const errors = await validate(dtoInstance);
        
        if (errors.length > 0) {
          return res.status(400).json({
            message: 'Validation failed',
            errors: errors.map(err => ({
              property: err.property,
              constraints: err.constraints
            }))
          });
        }
        
        req.validatedBody = dtoInstance;
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
    const bodyParams: { index: number; name?: string }[] = 
      Reflect.getMetadata('bodyParams', context, handlerName) || [];

    // Injection pour @Body()
    bodyParams.forEach(({ index, name }) => {
      args[index] = name ? req.body[name] : req.body;
    });

    // Injection pour req.validatedBody (venant de @ValidateBody)
    if (req.validatedBody) {
      const validateIndex = bodyParams.find(p => !p.name)?.index;
      if (validateIndex !== undefined) {
        args[validateIndex] = req.validatedBody;
      }
    }

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
