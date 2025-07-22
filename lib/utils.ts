import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));


import { Knex } from 'knex';
import { decryptObject } from './encryption-utils';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-32-byte-long-encryption-key-aa';
const IV_LENGTH = 16;
const ALGORITHM = 'aes-256-cbc';

/**
 * A repository class that provides encrypted CRUD operations for MySQL databases.
 * All data is encrypted before storage and can be compared directly in its encrypted form.
 * @class
 */
export class DynamicRepository {
    /**
     * Creates a new DynamicRepository instance
     * @constructor
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
     * Encrypts a string using AES-256-CBC algorithm
     * @private
     * @param {string} text - Plain text to encrypt
     * @returns {string} Encrypted string in 'iv:encryptedData' format
     */
    private encrypt(text: string): string {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return `${iv.toString('hex')}:${encrypted}`;
    }

    /**
     * Encrypts data consistently for database comparison operations
     * @private
     * @param {any} data - Data to encrypt (will be stringified)
     * @returns {string} Consistently encrypted string for comparison
     */
    private encryptForComparison(data: any): string {
        if (data === null || data === undefined) return data;
        return this.encrypt(String(data));
    }

    /**
     * Recursively encrypts all data in an object/array
     * @private
     * @param {any} data - Data structure to encrypt
     * @returns {any} Encrypted data structure
     */
    private encryptData(data: any): any {
        if (data === null || data === undefined) return data;
        if (typeof data === 'string') return this.encrypt(data);
        if (typeof data === 'number') return this.encrypt(data.toString());
        if (typeof data === 'boolean') return this.encrypt(data.toString());
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
     * Retrieves all records from the table with automatic decryption
     * @async
     * @param {string[]} [columns=['*']] - Columns to select
     * @returns {Promise<Record<string, any>[]>} Array of decrypted records
     */
    async getAll(columns: string[] = ['*']): Promise<Record<string, any>[]> {
        const results = await this.knex(this.tableName).select(columns);
        return decryptObject(results);
    }

    /**
     * Finds a single record by ID with automatic decryption
     * @async
     * @param {number|string} id - Record ID to find
     * @param {string[]} [columns=['*']] - Columns to select
     * @returns {Promise<Record<string, any>|null>} Decrypted record or null if not found
     */
    async getById(id: number | string, columns: string[] = ['*']): Promise<Record<string, any> | null> {
        const result = await this.knex(this.tableName)
            .select(columns)
            .where(this.idColumn, id)
            .first();
        return result ? decryptObject(result) : null;
    }

    /**
     * Creates a new record with automatic encryption
     * @async
     * @param {Record<string, any>} data - Data to insert
     * @returns {Promise<Record<string, any>>} The created and decrypted record
     */
    async create(data: Record<string, any>): Promise<Record<string, any>> {
        const encryptedData = this.encryptData(data);
        const [record] = await this.knex(this.tableName)
            .insert(encryptedData)
            .returning('*');
        return decryptObject(record);
    }

    /**
     * Updates records matching encrypted criteria with encrypted updates
     * @async
     * @param {Record<string, any>} criteria - Filter criteria (will be encrypted)
     * @param {Record<string, any>} updates - Values to update (will be encrypted)
     * @returns {Promise<number>} Number of affected rows
     */
    async update(criteria: Record<string, any>, updates: Record<string, any>): Promise<number> {
        const encryptedCriteria = this.encryptData(criteria);
        const encryptedUpdates = this.encryptData(updates);
        return this.knex(this.tableName)
            .where(encryptedCriteria)
            .update(encryptedUpdates);
    }

    /**
     * Deletes records matching encrypted criteria
     * @async
     * @param {Record<string, any>} criteria - Filter criteria (will be encrypted)
     * @returns {Promise<number>} Number of deleted rows
     */
    async delete(criteria: Record<string, any>): Promise<number> {
        const encryptedCriteria = this.encryptData(criteria);
        return this.knex(this.tableName)
            .where(encryptedCriteria)
            .del();
    }

    // === Query Methods ===

    /**
     * Finds records with encrypted comparison in database
     * @async
     * @param {Object} options - Query options
     * @param {Record<string, any>} [options.where={}] - Filter criteria
     * @param {Array<{column: string, direction: 'asc'|'desc'}>} [options.orderBy=[]] - Sorting criteria
     * @param {number} [options.limit] - Maximum records to return
     * @param {number} [options.offset] - Records to skip
     * @param {string[]} [options.columns=['*']] - Columns to select
     * @returns {Promise<Record<string, any>[]>} Array of decrypted records
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

        // Apply encrypted WHERE conditions
        for (const [column, value] of Object.entries(where)) {
            if (value === null) {
                query = query.whereNull(column);
            } else if (typeof value === 'object') {
                for (const [operator, opValue] of Object.entries(value)) {
                    const encryptedValue = this.encryptForComparison(opValue);
                    query = query.where(column, operator, encryptedValue);
                }
            } else {
                const encryptedValue = this.encryptForComparison(value);
                query = query.where(column, encryptedValue);
            }
        }

        orderBy.forEach(({ column, direction }) => {
            query = query.orderBy(column, direction);
        });

        if (limit) query = query.limit(limit);
        if (offset) query = query.offset(offset);

        const results = await query;
        return decryptObject(results);
    }

    /**
     * Counts records matching encrypted criteria
     * @async
     * @param {Record<string, any>} [where={}] - Filter criteria
     * @returns {Promise<number>} Count of matching records
     */
    async count(where: Record<string, any> = {}): Promise<number> {
        let query = this.knex(this.tableName);

        for (const [column, value] of Object.entries(where)) {
            if (value === null) {
                query = query.whereNull(column);
            } else {
                const encryptedValue = this.encryptForComparison(value);
                query = query.where(column, encryptedValue);
            }
        }

        const result = await query.count('* as total').first();
        return Number(result?.total) || 0;
    }

    // === Utility Methods ===

    /**
     * Checks if the managed table exists in the database
     * @async
     * @returns {Promise<boolean>} True if table exists
     */
    async tableExists(): Promise<boolean> {
        return this.knex.schema.hasTable(this.tableName);
    }
}
