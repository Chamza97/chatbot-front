import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs)


                 
import 'reflect-metadata';

import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { Request, Response, NextFunction, RequestHandler } from 'express';

type SourceType = 'body' | 'query' | 'params';

const createValidator = <T extends object>(
  source: SourceType,
  dtoClass: new () => T,
  skipMissing = false
): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // 1. Vérification du type source
    const data = req[source];
    if (typeof data !== 'object' || data === null) {
      return res.status(400).json({ 
        message: `${source} should be a valid object` 
      });
    }

    // 2. Transformation et validation
    try {
      const dtoInstance = plainToInstance(dtoClass, data);
      const errors: ValidationError[] = await validate(dtoInstance, { 
        skipMissingProperties: skipMissing 
      });

      // 3. Gestion des erreurs
      if (errors.length > 0) {
        return res.status(400).json({
          statusCode: 400,
          message: `${source} validation failed`,
          errors: errors.map((error) => ({
            property: error.property,
            constraints: error.constraints
          }))
        });
      }

      // 4. Stockage des données validées
      req[`validated${source.charAt(0).toUpperCase() + source.slice(1)}`] = dtoInstance;
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Décorateurs Méthodes
export function ValidateBody<T extends object>(dtoClass: new () => T): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const original = descriptor.value as RequestHandler;
    descriptor.value = createValidator('body', dtoClass) as any;
    return descriptor;
  };
}

export function ValidateQuery<T extends object>(dtoClass: new () => T, skipMissing = true): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const original = descriptor.value as RequestHandler;
    descriptor.value = createValidator('query', dtoClass, skipMissing) as any;
    return descriptor;
  };
}

export function ValidateParams<T extends object>(dtoClass: new () => T): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const original = descriptor.value as RequestHandler;
    descriptor.value = createValidator('params', dtoClass) as any;
    return descriptor;
  };
}
import 'reflect-metadata';

export function Body(): ParameterDecorator;
export function Body<K extends string>(name: K): ParameterDecorator;
export function Body(name?: string) {
  return registerParam('body', name);
}

export function Query(): ParameterDecorator;
export function Query<K extends string>(name: K): ParameterDecorator;
export function Query(name?: string) {
  return registerParam('query', name);
}

export function Param(): ParameterDecorator;
export function Param<K extends string>(name: K): ParameterDecorator;
export function Param(name?: string) {
  return registerParam('params', name);
}

function registerParam(source: 'body' | 'query' | 'params', name?: string): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    const metadataKey = `${source}Params`;
    const params = Reflect.getMetadata(metadataKey, target, propertyKey) || [];
    params.push({ index: parameterIndex, name });
    Reflect.defineMetadata(metadataKey, params, target, propertyKey);
  };
}  
