import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));

import { Knex } from 'knex';
import { encryptData, decryptData, decryptObject, EncryptionOptions } from './encryption-utils';

import { Knex } from 'knex';
import { encryptData, decryptData, decryptObject, EncryptionOptions } from './encryption-utils';

/**
 * Default encryption options for the repository
 * @constant
 * @type {EncryptionOptions}
 */
const ENCRYPTION_DEFAULT_OPTIONS: EncryptionOptions = {
    algorithm: 'aes-256-cbc',
    key: process.env.ENCRYPTION_KEY || 'default-32-byte-long-encryption-key-aa',
    iv: crypto.randomBytes(16)
};

/**
 * A repository class that provides encrypted CRUD operations for database tables.
 * Automatically encrypts data before storage and decrypts when retrieving.
 * @class
 */
export class DynamicRepository {
    /**
     * Creates a new DynamicRepository instance
     * @constructor
     * @param {Knex} knex - Initialized Knex instance
     * @param {string} tableName - Name of the database table to manage
     * @param {string} [idColumn='id'] - Name of the primary key column (default: 'id')
     */
    constructor(
        protected readonly knex: Knex,
        protected readonly tableName: string,
        protected readonly idColumn: string = 'id'
    ) {}

    // === CRUD Operations ===

    /**
     * Retrieves all records from the table with automatic decryption
     * @async
     * @param {string[]} [columns=['*']] - Columns to select (default: all columns)
     * @returns {Promise<Record<string, any>[]>} Array of decrypted records
     */
    async getAll(columns: string[] = ['*']): Promise<Record<string, any>[]> {
        const results = await this.knex(this.tableName).select(columns);
        return decryptObject(results, ENCRYPTION_DEFAULT_OPTIONS);
    }

    /**
     * Finds a single record by ID with automatic decryption
     * @async
     * @param {number|string} id - Record ID to find
     * @param {string[]} [columns=['*']] - Columns to select (default: all columns)
     * @returns {Promise<Record<string, any>|null>} Decrypted record or null if not found
     */
    async getById(id: number | string, columns: string[] = ['*']): Promise<Record<string, any> | null> {
        const result = await this.knex(this.tableName)
            .select(columns)
            .where(this.idColumn, id)
            .first();
        return result ? decryptObject(result, ENCRYPTION_DEFAULT_OPTIONS) : null;
    }

    /**
     * Creates a new record with automatic encryption
     * @async
     * @param {Record<string, any>} data - Data to insert
     * @returns {Promise<Record<string, any>>} The created record (decrypted)
     * @throws {Error} If insertion fails
     */
    async create(data: Record<string, any>): Promise<Record<string, any>> {
        const encryptedData = encryptData(data, ENCRYPTION_DEFAULT_OPTIONS);
        const [record] = await this.knex(this.tableName)
            .insert(encryptedData)
            .returning('*');
        return decryptObject(record, ENCRYPTION_DEFAULT_OPTIONS);
    }

    /**
     * Updates records matching encrypted criteria with encrypted updates
     * @async
     * @param {Record<string, any>} criteria - Filter criteria (will be encrypted)
     * @param {Record<string, any>} updates - Values to update (will be encrypted)
     * @returns {Promise<number>} Number of affected rows
     * @throws {Error} If update fails
     */
    async update(criteria: Record<string, any>, updates: Record<string, any>): Promise<number> {
        const encryptedCriteria = encryptData(criteria, ENCRYPTION_DEFAULT_OPTIONS);
        const encryptedUpdates = encryptData(updates, ENCRYPTION_DEFAULT_OPTIONS);
        return this.knex(this.tableName)
            .where(encryptedCriteria)
            .update(encryptedUpdates);
    }

    /**
     * Deletes records matching encrypted criteria
     * @async
     * @param {Record<string, any>} criteria - Filter criteria (will be encrypted)
     * @returns {Promise<number>} Number of deleted rows
     * @throws {Error} If deletion fails
     */
    async delete(criteria: Record<string, any>): Promise<number> {
        const encryptedCriteria = encryptData(criteria, ENCRYPTION_DEFAULT_OPTIONS);
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
                const encryptedValue = encryptData(value, ENCRYPTION_DEFAULT_OPTIONS);
                query = query.where(column, encryptedValue);
            }
        }

        const result = await query.count('* as total').first();
        return Number(result?.total) || 0;
    }

    /**
     * Retrieves paginated records with metadata
     * @async
     * @param {Object} options - Pagination options
     * @param {number} [options.page=1] - Page number (1-based)
     * @param {number} [options.pageSize=10] - Number of items per page
     * @param {Record<string, any>} [options.where={}] - Filter criteria
     * @param {Array<{column: string, direction: 'asc'|'desc'}>} [options.orderBy=[]] - Sorting criteria
     * @param {string[]} [options.columns=['*']] - Columns to select
     * @returns {Promise<Object>} Paginated result with metadata
     * @property {Record<string, any>[]} data - Array of decrypted records
     * @property {number} total - Total count of matching records
     * @property {number} page - Current page number
     * @property {number} pageSize - Number of items per page
     * @property {number} totalPages - Total number of pages
     */
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

    /**
     * Checks if the managed table exists in the database
     * @async
     * @returns {Promise<boolean>} True if table exists
     */
    async tableExists(): Promise<boolean> {
        return this.knex.schema.hasTable(this.tableName);
    }
}
