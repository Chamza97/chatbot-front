import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));

import { Knex } from 'knex';
import { encryptData, decryptData, decryptObject, EncryptionOptions } from './encryption-utils';

const ENCRYPTION_DEFAULT_OPTIONS: EncryptionOptions = {
    algorithm: 'aes-256-cbc',
    key: process.env.ENCRYPTION_KEY || 'default-32-byte-long-encryption-key-aa',
    iv: crypto.randomBytes(16)
};

export class DynamicRepository {
    constructor(
        protected readonly knex: Knex,
        protected readonly tableName: string,
        protected readonly idColumn: string = 'id'
    ) {}

    // === CRUD Operations ===

    async getAll(columns: string[] = ['*']): Promise<Record<string, any>[]> {
        const results = await this.knex(this.tableName).select(columns);
        return decryptObject(results, ENCRYPTION_DEFAULT_OPTIONS);
    }

    async getById(id: number | string, columns: string[] = ['*']): Promise<Record<string, any> | null> {
        const result = await this.knex(this.tableName)
            .select(columns)
            .where(this.idColumn, id)
            .first();
        return result ? decryptObject(result, ENCRYPTION_DEFAULT_OPTIONS) : null;
    }

    async create(data: Record<string, any>): Promise<Record<string, any>> {
        const encryptedData = encryptData(data, ENCRYPTION_DEFAULT_OPTIONS);
        const [record] = await this.knex(this.tableName)
            .insert(encryptedData)
            .returning('*');
        return decryptObject(record, ENCRYPTION_DEFAULT_OPTIONS);
    }

    async update(criteria: Record<string, any>, updates: Record<string, any>): Promise<number> {
        const encryptedCriteria = encryptData(criteria, ENCRYPTION_DEFAULT_OPTIONS);
        const encryptedUpdates = encryptData(updates, ENCRYPTION_DEFAULT_OPTIONS);
        return this.knex(this.tableName)
            .where(encryptedCriteria)
            .update(encryptedUpdates);
    }

    async delete(criteria: Record<string, any>): Promise<number> {
        const encryptedCriteria = encryptData(criteria, ENCRYPTION_DEFAULT_OPTIONS);
        return this.knex(this.tableName)
            .where(encryptedCriteria)
            .del();
    }

    // === Query Methods ===

    async find({
        where = {},
        orderBy = [],
        limit,
        offset,
        columns = ['*']
    }: {
        where?: Record<string, any>;
        orderBy?: Array<{ column: string; direction: 'asc' | 'desc' }>;
        limit?: number;
        offset?: number;
        columns?: string[];
    }): Promise<Record<string, any>[]> {
        let query = this.knex(this.tableName).select(columns);

        for (const [column, value] of Object.entries(where)) {
            if (value === null) {
                query = query.whereNull(column);
            } else if (typeof value === 'object') {
                for (const [operator, opValue] of Object.entries(value)) {
                    const encryptedValue = encryptData(opValue, ENCRYPTION_DEFAULT_OPTIONS);
                    query = query.where(column, operator, encryptedValue);
                }
            } else {
                const encryptedValue = encryptData(value, ENCRYPTION_DEFAULT_OPTIONS);
                query = query.where(column, encryptedValue);
            }
        }

        orderBy.forEach(({ column, direction }) => {
            query = query.orderBy(column, direction);
        });

        if (limit) query = query.limit(limit);
        if (offset) query = query.offset(offset);

        const results = await query;
        return decryptObject(results, ENCRYPTION_DEFAULT_OPTIONS);
    }

    async count(where: Record<string, any> = {}): Promise<number> {
        let query = this.knex(this.tableName);

        for (const [column, value] of Object.entries(where)) {
            if (value === null) {
                query = query.whereNull(column);
            } else {
                const encryptedValue = encryptData(value, ENCRYPTION_DEFAULT_OPTIONS);
                query = query.where(column, encryptedValue);
            }
        }

        const result = await query.count('* as total').first();
        return Number(result?.total) || 0;
    }

    async getPaginated({
        page = 1,
        pageSize = 10,
        where = {},
        orderBy = [],
        columns = ['*']
    }: {
        page?: number;
        pageSize?: number;
        where?: Record<string, any>;
        orderBy?: Array<{ column: string; direction: 'asc' | 'desc' }>;
        columns?: string[];
    }): Promise<{
        data: Record<string, any>[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }> {
        const offset = (page - 1) * pageSize;
        const total = await this.count(where);
        const data = await this.find({
            where,
            orderBy,
            limit: pageSize,
            offset,
            columns
        });

        return {
            data,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
        };
    }

    async tableExists(): Promise<boolean> {
        return this.knex.schema.hasTable(this.tableName);
    }
}
