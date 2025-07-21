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


  import knex from 'knex';
import { DynamicRepository } from './DynamicRepository';

// Mock database configuration
const testDB = knex({
  client: 'sqlite3',
  connection: ':memory:',
  useNullAsDefault: true
});

describe('DynamicRepository', () => {
  let repo: DynamicRepository;
  const testTable = 'test_table';

  beforeAll(async () => {
    // Create test table
    await testDB.schema.createTable(testTable, table => {
      table.increments('id').primary();
      table.string('name');
      table.integer('value');
      table.boolean('is_active');
      table.timestamps(true, true);
    });

    repo = new DynamicRepository(testDB, testTable);
  });

  afterAll(async () => {
    await testDB.destroy();
  });

  beforeEach(async () => {
    // Clear data before each test
    await testDB(testTable).truncate();
  });

  describe('Basic CRUD Operations', () => {
    test('create() should insert a new record', async () => {
      const data = { name: 'Test', value: 100, is_active: true };
      const result = await repo.create(data);
      
      expect(result).toMatchObject(data);
      expect(result.id).toBeDefined();
    });

    test('getById() should retrieve a record', async () => {
      const inserted = await repo.create({ name: 'GetById' });
      const result = await repo.getById(inserted.id);
      
      expect(result).toEqual(inserted);
    });

    test('update() should modify existing records', async () => {
      const inserted = await repo.create({ name: 'Before Update' });
      const updatedCount = await repo.update(
        { id: inserted.id }, 
        { name: 'After Update' }
      );
      
      expect(updatedCount).toBe(1);
      const updated = await repo.getById(inserted.id);
      expect(updated?.name).toBe('After Update');
    });

    test('delete() should remove records', async () => {
      const inserted = await repo.create({ name: 'To Delete' });
      const deletedCount = await repo.delete({ id: inserted.id });
      
      expect(deletedCount).toBe(1);
      const result = await repo.getById(inserted.id);
      expect(result).toBeNull();
    });
  });

  describe('Query Methods', () => {
    beforeEach(async () => {
      // Seed test data
      await repo.create({ name: 'Item 1', value: 10, is_active: true });
      await repo.create({ name: 'Item 2', value: 20, is_active: true });
      await repo.create({ name: 'Item 3', value: 30, is_active: false });
    });

    test('getAll() should return all records', async () => {
      const results = await repo.getAll();
      expect(results.length).toBe(3);
    });

    test('find() with filters should return matching records', async () => {
      const results = await repo.find({
        where: { is_active: true }
      });
      
      expect(results.length).toBe(2);
      expect(results.every(item => item.is_active)).toBe(true);
    });

    test('find() with sorting should order results', async () => {
      const results = await repo.find({
        orderBy: [{ column: 'value', direction: 'desc' }]
      });
      
      expect(results[0].value).toBe(30);
      expect(results[2].value).toBe(10);
    });

    test('find() with pagination should limit results', async () => {
      const page1 = await repo.find({ limit: 2 });
      expect(page1.length).toBe(2);
      
      const page2 = await repo.find({ limit: 2, offset: 2 });
      expect(page2.length).toBe(1);
    });

    test('count() should return correct record count', async () => {
      const allCount = await repo.count();
      expect(allCount).toBe(3);
      
      const activeCount = await repo.count({ is_active: true });
      expect(activeCount).toBe(2);
    });
  });

  describe('Utility Methods', () => {
    test('tableExists() should return true for existing tables', async () => {
      const exists = await repo.tableExists();
      expect(exists).toBe(true);
    });

    test('getTableStructure() should return column information', async () => {
      const structure = await repo.getTableStructure();
      
      expect(structure).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        value: expect.any(String),
        is_active: expect.any(String)
      });
    });
  });

  describe('Error Handling', () => {
    test('should throw when operating on non-existent table', async () => {
      const badRepo = new DynamicRepository(testDB, 'non_existent_table');
      await expect(badRepo.getAll()).rejects.toThrow();
    });

    test('should return null when record not found', async () => {
      const result = await repo.getById(999);
      expect(result).toBeNull();
    });
  });
});
