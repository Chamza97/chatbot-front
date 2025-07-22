import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));


import { Knex } from 'knex';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-32-byte-long-encryption-key-aa';
const IV_LENGTH = 16;
const ALGORITHM = 'aes-256-cbc';

export class DynamicRepository {
    constructor(
        protected readonly knex: Knex,
        protected readonly tableName: string,
        protected readonly idColumn: string = 'id'
    ) {}

    // === Encryption Helpers ===
    private encrypt(text: string): string {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
    }

    private decrypt(text: string): string {
        const [ivPart, encryptedPart] = text.split(':');
        if (!ivPart || !encryptedPart) return text;
        
        const iv = Buffer.from(ivPart, 'hex');
        const encryptedText = Buffer.from(encryptedPart, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    }

    private encryptData(data: any): any {
        if (data === null || data === undefined) return data;
        if (typeof data === 'string') return this.encrypt(data);
        if (typeof data === 'number') return data.toString();
        if (typeof data === 'boolean') return data;
        if (Array.isArray(data)) return data.map(item => this.encryptData(item));
        if (typeof data === 'object') {
            return Object.fromEntries(
                Object.entries(data).map(([key, value]) => [key, this.encryptData(value)])
            );
        }
        return data;
    }

    private decryptData(data: any): any {
        if (data === null || data === undefined) return data;
        if (typeof data === 'string' && data.includes(':')) {
            try {
                return this.decrypt(data);
            } catch {
                return data;
            }
        }
        if (typeof data === 'number') return data;
        if (typeof data === 'boolean') return data;
        if (Array.isArray(data)) return data.map(item => this.decryptData(item));
        if (typeof data === 'object') {
            return Object.fromEntries(
                Object.entries(data).map(([key, value]) => [key, this.decryptData(value)])
            );
        }
        return data;
    }

    // === CRUD Operations ===
    async getAll(columns: string[] = ['*']): Promise<Record<string, any>[]> {
        const results = await this.knex(this.tableName).select(columns);
        return results.map(item => this.decryptData(item));
    }

    async getById(id: number | string, columns: string[] = ['*']): Promise<Record<string, any> | null> {
        const result = await this.knex(this.tableName)
            .select(columns)
            .where(this.idColumn, id)
            .first();
        return result ? this.decryptData(result) : null;
    }

    async create(data: Record<string, any>): Promise<Record<string, any>> {
        const encryptedData = this.encryptData(data);
        const [record] = await this.knex(this.tableName)
            .insert(encryptedData)
            .returning('*');
        return this.decryptData(record);
    }

    async update(criteria: Record<string, any>, updates: Record<string, any>): Promise<number> {
        // MySQL doesn't support comparing encrypted data easily
        // So we need to fetch first, decrypt and compare
        const records = await this.find({ where: criteria });
        if (records.length === 0) return 0;
        
        const encryptedUpdates = this.encryptData(updates);
        return this.knex(this.tableName)
            .whereIn(this.idColumn, records.map(r => r[this.idColumn]))
            .update(encryptedUpdates);
    }

    async delete(criteria: Record<string, any>): Promise<number> {
        // Similar approach to update for MySQL
        const records = await this.find({ where: criteria });
        if (records.length === 0) return 0;
        
        return this.knex(this.tableName)
            .whereIn(this.idColumn, records.map(r => r[this.idColumn]))
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
        // For MySQL, we need to fetch all and filter in memory
        // Not efficient for large datasets but necessary for encrypted data
        let query = this.knex(this.tableName).select(columns);

        // Apply sorting if specified
        orderBy.forEach(({ column, direction }) => {
            query = query.orderBy(column, direction);
        });

        if (limit) query = query.limit(limit);
        if (offset) query = query.offset(offset);

        const results = await query;
        const decryptedResults = results.map(item => this.decryptData(item));
        
        // Apply where filters in memory
        return decryptedResults.filter(item => {
            for (const [key, value] of Object.entries(where)) {
                if (item[key] !== value) return false;
            }
            return true;
        });
    }

    async count(where: Record<string, any> = {}): Promise<number> {
        const results = await this.find({ where });
        return results.length;
    }

    // === Utility Methods ===
    async tableExists(): Promise<boolean> {
        return this.knex.schema.hasTable(this.tableName);
    }
}
