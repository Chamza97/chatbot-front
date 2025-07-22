import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));


import { Knex } from 'knex';
import { decryptObject } from './encryption-utils'; // Assuming this is your custom decryption method
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-32-byte-long-encryption-key-aa';
const IV_LENGTH = 16;
const ALGORITHM = 'aes-256-cbc';

/**
 * A dynamic repository class that provides encrypted CRUD operations for database tables
 * using AES-256-CBC encryption. All data is automatically encrypted before storage
 * and decrypted when retrieved using the provided decryptObject method.
 */
export class DynamicRepository {
    /**
     * Creates a new DynamicRepository instance
     * @param {Knex} knex - Initialized Knex instance
     * @param {string} tableName - Name of the database table to manage
     * @param {string} [idColumn='id'] - Name of the primary key column
     */
    constructor(
        protected readonly knex: Knex,
        protected readonly tableName: string,
        protected readonly idColumn: string = 'id'
    ) {}

    // === Encryption Helpers ===

    /**
     * Encrypts a string using AES-256-CBC
     * @private
     * @param {string} text - The string to encrypt
     * @returns {string} Encrypted string in format 'iv:encryptedData' (both hex encoded)
     */
    private encrypt(text: string): string {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
    }

    /**
     * Recursively encrypts all string values in an object/array
     * @private
     * @param {any} data - Data to encrypt
     * @returns {any} Data with all strings encrypted
     */
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

    // === CRUD Operations ===

    /**
     * Retrieves all records from the table with automatic decryption using decryptObject
     * @param {string[]} [columns=['*']] - Columns to select
     * @returns {Promise<Record<string, any>[]>} Array of decrypted records
     */
    async getAll(columns: string[] = ['*']): Promise<Record<string, any>[]> {
        const results = await this.knex(this.tableName).select(columns);
        return decryptObject(results); // Using your decryptObject method
    }

    /**
     * Finds a single record by ID with automatic decryption using decryptObject
     * @param {number|string} id - The ID value to search for
     * @param {string[]} [columns=['*']] - Columns to select
     * @returns {Promise<Record<string, any>|null} Decrypted record or null if not found
     */
    async getById(id: number | string, columns: string[] = ['*']): Promise<Record<string, any> | null> {
        const result = await this.knex(this.tableName)
            .select(columns)
            .where(this.idColumn, id)
            .first();
        return result ? decryptObject(result) : null; // Using your decryptObject method
    }

    /**
     * Creates a new record with automatic encryption of all string values
     * @param {Record<string, any>} data - Data to insert
     * @returns {Promise<Record<string, any>>} The created record (decrypted using decryptObject)
     */
    async create(data: Record<string, any>): Promise<Record<string, any>> {
        const encryptedData = this.encryptData(data);
        const [record] = await this.knex(this.tableName)
            .insert(encryptedData)
            .returning('*');
        return decryptObject(record); // Using your decryptObject method
    }

    /**
     * Updates records matching the criteria (with automatic encryption/decryption)
     * Note: For MySQL, this performs a find-then-update due to encryption limitations
     * @param {Record<string, any>} criteria - Filter criteria (applied to decrypted data)
     * @param {Record<string, any>} updates - Values to update (will be encrypted)
     * @returns {Promise<number>} Number of affected rows
     */
    async update(criteria: Record<string, any>, updates: Record<string, any>): Promise<number> {
        const records = await this.find({ where: criteria });
        if (records.length === 0) return 0;
        
        const encryptedUpdates = this.encryptData(updates);
        return this.knex(this.tableName)
            .whereIn(this.idColumn, records.map(r => r[this.idColumn]))
            .update(encryptedUpdates);
    }

    /**
     * Deletes records matching the criteria (with automatic decryption for criteria)
     * Note: For MySQL, this performs a find-then-delete due to encryption limitations
     * @param {Record<string, any>} criteria - Filter criteria (applied to decrypted data)
     * @returns {Promise<number>} Number of deleted rows
     */
    async delete(criteria: Record<string, any>): Promise<number> {
        const records = await this.find({ where: criteria });
        if (records.length === 0) return 0;
        
        return this.knex(this.tableName)
            .whereIn(this.idColumn, records.map(r => r[this.idColumn]))
            .del();
    }

    // === Query Methods ===

    /**
     * Finds records with filtering, sorting and pagination (with automatic decryption)
     * Note: For MySQL, WHERE clauses are applied in-memory after decryption
     * @param {Object} options - Query options
     * @param {Record<string, any>} [options.where={}] - Filter criteria
     * @param {Array<{column: string, direction: 'asc'|'desc'}>} [options.orderBy=[]] - Sorting criteria
     * @param {number} [options.limit] - Maximum records to return
     * @param {number} [options.offset] - Records to skip
     * @param {string[]} [options.columns=['*']] - Columns to select
     * @returns {Promise<Record<string, any>[]>} Array of decrypted records (using decryptObject)
     */
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

        orderBy.forEach(({ column, direction }) => {
            query = query.orderBy(column, direction);
        });

        if (limit) query = query.limit(limit);
        if (offset) query = query.offset(offset);

        const results = await query;
        const decryptedResults = decryptObject(results); // Using your decryptObject method
        
        return decryptedResults.filter(item => {
            for (const [key, value] of Object.entries(where)) {
                if (item[key] !== value) return false;
            }
            return true;
        });
    }

    /**
     * Counts records matching the criteria (with automatic decryption for criteria)
     * @param {Record<string, any>} [where={}] - Filter criteria
     * @returns {Promise<number>} Count of matching records
     */
    async count(where: Record<string, any> = {}): Promise<number> {
        const results = await this.find({ where });
        return results.length;
    }

    // === Utility Methods ===

    /**
     * Checks if the table exists in the database
     * @returns {Promise<boolean>} True if table exists
     */
    async tableExists(): Promise<boolean> {
        return this.knex.schema.hasTable(this.tableName);
    }
}
