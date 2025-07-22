import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));


import { Knex } from 'knex';

/**
 * A dynamic repository class for performing CRUD operations on database tables
 * without requiring predefined TypeScript models or schemas.
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

  // === Basic CRUD Operations ===

  /**
   * Retrieves all records from the table
   * @param {string[]} [columns=['*']] - Array of columns to select
   * @returns {Promise<Record<string, any>[]>} Array of all records
   */
  async getAll(columns: string[] = ['*']): Promise<Record<string, any>[]> {
    return this.knex(this.tableName).select(columns);
  }

  /**
   * Finds a single record by its primary key
   * @param {string|number} id - The ID value to search for
   * @param {string[]} [columns=['*']] - Array of columns to select
   * @returns {Promise<Record<string, any>|null} The found record or null
   */
  async getById(id: number | string, columns: string[] = ['*']): Promise<Record<string, any> | null> {
    return this.knex(this.tableName)
      .select(columns)
      .where(this.idColumn, id)
      .first();
  }

  /**
   * Inserts a new record into the table
   * @param {Record<string, any>} data - Key-value pairs to insert
   * @returns {Promise<Record<string, any>>} The created record
   */
  async create(data: Record<string, any>): Promise<Record<string, any>> {
    const [record] = await this.knex(this.tableName)
      .insert(data)
      .returning('*');
    return record;
  }

  /**
   * Updates records matching the criteria
   * @param {Record<string, any>} criteria - Key-value pairs for WHERE clause
   * @param {Record<string, any>} updates - Key-value pairs to update
   * @returns {Promise<number>} Number of affected rows
   */
  async update(criteria: Record<string, any>, updates: Record<string, any>): Promise<number> {
    return this.knex(this.tableName)
      .where(criteria)
      .update(updates);
  }

  /**
   * Deletes records matching the criteria
   * @param {Record<string, any>} criteria - Key-value pairs for WHERE clause
   * @returns {Promise<number>} Number of deleted rows
   */
  async delete(criteria: Record<string, any>): Promise<number> {
    return this.knex(this.tableName)
      .where(criteria)
      .del();
  }

  // === Advanced Query Methods ===

  /**
   * Performs a filtered search with sorting and pagination
   * @param {Object} options - Query options
   * @param {Record<string, any>} [options.where={}] - Filter conditions
   * @param {Array<{column: string, direction: 'asc'|'desc'}>} [options.orderBy=[]] - Sorting criteria
   * @param {number} [options.limit] - Maximum number of records to return
   * @param {number} [options.offset] - Number of records to skip
   * @param {string[]} [options.columns=['*']] - Columns to select
   * @returns {Promise<Record<string, any>[]>} Array of matching records
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
   * @param {Record<string, any>} [where={}] - Filter conditions
   * @returns {Promise<number>} Total count of matching records
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
   * @returns {Promise<boolean>} True if table exists
   */
  async tableExists(): Promise<boolean> {
    return this.knex.schema.hasTable(this.tableName);
  }

  /**
   * Retrieves the table structure/columns from database metadata
   * @returns {Promise<Record<string, string>>} Object mapping column names to data types
   */
  async getTableStructure(): Promise<Record<string, string>> {
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
