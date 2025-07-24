import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));

const createValidateDecorator = <T extends 'body' | 'query' | 'params'>(target: T, skipMissing = false) => {
    return (dtoClass: ClassConstructor<unknown>): MethodDecorator => {
        return (targetObj: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
            const originalMethod = descriptor.value;
            descriptor.value = async function (req: Request, res: Response, next: NextFunction) {
                try {
                    const source = req[target];
                    if (typeof source !== 'object' || source === null) {
                        return res.status(400).json({ message: `${target} should be a valid object` });
                    }

                    const dtoInstance = plainToClass(dtoClass, source);
                    const errors = await validate(dtoInstance as object, { skipMissingProperties: skipMissing });

                    if (errors.length > 0) {
                        return res.status(400).json({
                            statusCode: 400,
                            message: `${target} validation failed`,
                            errors: errors.map(error => ({
                                property: error.property,
                                constraints: { ...error.constraints }
                            }))
                        });
                    }

                    (req as any)[`validated${target.charAt(0).toUpperCase() + target.slice(1)}`] = dtoInstance;

                    return originalMethod.call(this, req, res, next);
                } catch (error) {
                    next(error);
                }
            };
            return descriptor;
        };
    };
};
