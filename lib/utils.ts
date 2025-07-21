import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));


import { Knex } from 'knex';

export class DynamicRepository {
    constructor(
        protected readonly knex: Knex,
        protected readonly tableName: string,
        protected readonly idColumn: string = 'id'
    ) {}

    // === Basic CRUD Operations ===

    /**
     * Retrieves all records from the table
     * @param columns - Optional array of columns to select (defaults to all columns)
     */
    async getAll(columns: string[] = ['*']): Promise<Record<string, any>[]> {
        return this.knex(this.tableName).select(columns);
    }

    /**
     * Finds a single record by its primary key
     * @param id - The ID value to search for
     * @param columns - Optional array of columns to select
     */
    async getById(id: number | string, columns: string[] = ['*']): Promise<Record<string, any> | null> {
        return this.knex(this.tableName)
            .select(columns)
            .where(this.idColumn, id)
            .first();
    }

    /**
     * Inserts a new record into the table
     * @param data - Key-value pairs of data to insert
     * @returns The created record
     */
    async create(data: Record<string, any>): Promise<Record<string, any>> {
        const [record] = await this.knex(this.tableName)
            .insert(data)
            .returning('*');
        return record;
    }

    /**
     * Updates records matching the criteria
     * @param criteria - Key-value pairs for the WHERE clause
     * @param updates - Key-value pairs of data to update
     * @returns Number of affected rows
     */
    async update(criteria: Record<string, any>, updates: Record<string, any>): Promise<number> {
        return this.knex(this.tableName)
            .where(criteria)
            .update(updates);
    }

    /**
     * Deletes records matching the criteria
     * @param criteria - Key-value pairs for the WHERE clause
     * @returns Number of deleted rows
     */
    async delete(criteria: Record<string, any>): Promise<number> {
        return this.knex(this.tableName)
            .where(criteria)
            .del();
    }

    // === Advanced Query Methods ===

    /**
     * Performs a filtered search with sorting and pagination
     * @param options - Configuration object for the query
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
        let query = this.knex(this.tableName)
            .where(where)
            .select(columns);

        orderBy.forEach(({ column, direction }) => {
            query = query.orderBy(column, direction);
        });

        if (limit) query = query.limit(limit);
        if (offset) query = query.offset(offset);

        return query;
    }

    /**
     * Counts records matching the criteria
     * @param where - Optional filter conditions
     * @returns Total count of matching records
     */
    async count(where: Record<string, any> = {}): Promise<number> {
        const result = await this.knex(this.tableName)
            .where(where)
            .count('* as total')
            .first();
        
        return Number(result?.total) || 0;
    }

    // === Utility Methods ===

    /**
     * Checks if the table exists in the database
     */
    async tableExists(): Promise<boolean> {
        return this.knex.schema.hasTable(this.tableName);
    }

    /**
     * Retrieves the table structure/columns from database metadata
     * @returns Object mapping column names to their data types
     */
    async getTableStructure(): Promise<Record<string, string>> {
        // Database-specific implementation
        // PostgreSQL version:
        return this.knex
            .select('column_name', 'data_type')
            .from('information_schema.columns')
            .where('table_name', this.tableName)
            .then(rows => 
                rows.reduce((acc, row) => ({
                    ...acc,
                    [row.column_name]: row.data_type
                }), {})
            );
    }
}
