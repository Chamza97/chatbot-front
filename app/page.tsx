// ============================================
// src/services/cron-database.service.ts
// ============================================
import { dynamicModelService } from '../modules/dynamic-module/dynamic-model.service';
import { referentielsService } from '../modules/referentiels-module/referentiels.service';
import { Logger } from './logger.service';

interface CronExecution {
  id?: number;
  cron_name: string;
  schedule: string;
  last_execution_at: string | null;
  next_expected_at: string | null;
  status: 'success' | 'failed' | 'running' | 'missed' | 'pending';
  duration_ms: number | null;
  error_message: string | null;
  created_at?: string;
  updated_at?: string;
}

interface CronHistory {
  id?: number;
  cron_name: string;
  executed_at: string;
  status: 'success' | 'failed' | 'missed';
  duration_ms: number | null;
  error_message: string | null;
  created_at?: string;
}

export class CronDatabaseService {
  private readonly EXECUTIONS_TABLE = 'cron_executions';
  private readonly HISTORY_TABLE = 'cron_history';

  /**
   * Vérifie et crée les tables si nécessaire
   */
  async ensureTablesExist(): Promise<void> {
    try {
      Logger.info('🔍 Vérification des tables cron...');

      // Vérifier si la table cron_executions existe
      const executionsExists = await this.tableExists(this.EXECUTIONS_TABLE);
      if (!executionsExists) {
        await this.createExecutionsTable();
        Logger.info(`✅ Table ${this.EXECUTIONS_TABLE} créée`);
      }

      // Vérifier si la table cron_history existe
      const historyExists = await this.tableExists(this.HISTORY_TABLE);
      if (!historyExists) {
        await this.createHistoryTable();
        Logger.info(`✅ Table ${this.HISTORY_TABLE} créée`);
      }

      Logger.info('✅ Tables cron vérifiées et prêtes');
    } catch (error) {
      Logger.error('❌ Erreur lors de la création des tables', error as Error);
      throw error;
    }
  }

  /**
   * Vérifie si une table existe
   */
  private async tableExists(tableName: string): Promise<boolean> {
    try {
      const result = await referentielsService.getAll(
        'information_schema.TABLES',
        {
          where: [
            { field: 'TABLE_SCHEMA', operator: '=', value: process.env.DB_NAME || 'your_database' },
            { field: 'TABLE_NAME', operator: '=', value: tableName }
          ]
        },
        { id: '1', name: 'system' } as any
      );

      return result.length > 0;
    } catch (error) {
      Logger.error(`Erreur vérification table ${tableName}`, error as Error);
      return false;
    }
  }

  /**
   * Crée la table cron_executions
   */
  private async createExecutionsTable(): Promise<void> {
    const createTableDto = {
      code: 'create_cron_executions',
      name: 'Create Cron Executions Table',
      description: 'Table pour stocker l\'état actuel des cron jobs',
      fields: `
        id INT AUTO_INCREMENT PRIMARY KEY,
        cron_name VARCHAR(255) NOT NULL UNIQUE,
        schedule VARCHAR(100) NOT NULL,
        last_execution_at DATETIME NULL,
        next_expected_at DATETIME NULL,
        status ENUM('success', 'failed', 'running', 'missed', 'pending') DEFAULT 'pending',
        duration_ms INT NULL,
        error_message TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_cron_name (cron_name),
        INDEX idx_status (status),
        INDEX idx_next_expected (next_expected_at)
      `,
      scope: 'system',
      flag: 'active',
      diffusion: 'internal',
      reference: this.EXECUTIONS_TABLE,
      team: 'backend'
    };

    await dynamicModelService.create(createTableDto);
  }

  /**
   * Crée la table cron_history
   */
  private async createHistoryTable(): Promise<void> {
    const createTableDto = {
      code: 'create_cron_history',
      name: 'Create Cron History Table',
      description: 'Table pour l\'historique des exécutions de cron jobs',
      fields: `
        id INT AUTO_INCREMENT PRIMARY KEY,
        cron_name VARCHAR(255) NOT NULL,
        executed_at DATETIME NOT NULL,
        status ENUM('success', 'failed', 'missed') NOT NULL,
        duration_ms INT NULL,
        error_message TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cron_name (cron_name),
        INDEX idx_executed_at (executed_at),
        INDEX idx_status (status)
      `,
      scope: 'system',
      flag: 'active',
      diffusion: 'internal',
      reference: this.HISTORY_TABLE,
      team: 'backend'
    };

    await dynamicModelService.create(createTableDto);
  }

  /**
   * Récupère tous les crons depuis la DB
   */
  async getAllCronExecutions(): Promise<CronExecution[]> {
    try {
      const results = await referentielsService.getAll(
        this.EXECUTIONS_TABLE,
        {},
        { id: '1', name: 'system' } as any
      );

      return results as CronExecution[];
    } catch (error) {
      Logger.error('Erreur récupération cron executions', error as Error);
      return [];
    }
  }

  /**
   * Récupère un cron par son nom
   */
  async getCronByName(cronName: string): Promise<CronExecution | null> {
    try {
      const result = await referentielsService.getAll(
        this.EXECUTIONS_TABLE,
        {
          where: [{ field: 'cron_name', operator: '=', value: cronName }]
        },
        { id: '1', name: 'system' } as any
      );

      return result.length > 0 ? (result[0] as CronExecution) : null;
    } catch (error) {
      Logger.error(`Erreur récupération cron ${cronName}`, error as Error);
      return null;
    }
  }

  /**
   * Crée ou met à jour un cron
   */
  async upsertCronExecution(cron: Partial<CronExecution>): Promise<void> {
    try {
      const existing = await this.getCronByName(cron.cron_name!);

      if (existing) {
        // Mise à jour
        await referentielsService.update(
          String(existing.id),
          cron as Record<string, any>,
          this.EXECUTIONS_TABLE,
          { id: '1', name: 'system' } as any
        );
      } else {
        // Création
        await referentielsService.create(
          this.EXECUTIONS_TABLE,
          cron as Record<string, string>,
          { id: '1', name: 'system' } as any
        );
      }
    } catch (error) {
      Logger.error(`Erreur upsert cron ${cron.cron_name}`, error as Error);
      throw error;
    }
  }

  /**
   * Ajoute une entrée dans l'historique
   */
  async addToHistory(history: Omit<CronHistory, 'id' | 'created_at'>): Promise<void> {
    try {
      await referentielsService.create(
        this.HISTORY_TABLE,
        history as Record<string, string>,
        { id: '1', name: 'system' } as any
      );
    } catch (error) {
      Logger.error(`Erreur ajout historique ${history.cron_name}`, error as Error);
      throw error;
    }
  }

  /**
   * Calcule la prochaine exécution attendue
   */
  calculateNextExecution(schedule: string): Date {
    // Utiliser une bibliothèque comme cron-parser pour calculer précisément
    // Pour l'instant, approximation simple
    const now = new Date();
    
    // Exemples simples
    if (schedule === '* * * * *') {
      // Toutes les minutes
      now.setMinutes(now.getMinutes() + 1);
    } else if (schedule === '0 0 * * *') {
      // Tous les jours à minuit
      now.setDate(now.getDate() + 1);
      now.setHours(0, 0, 0, 0);
    } else if (schedule === '0 9 * * *') {
      // Tous les jours à 9h
      now.setDate(now.getDate() + 1);
      now.setHours(9, 0, 0, 0);
    } else if (schedule.startsWith('*/')) {
      // Toutes les X minutes
      const minutes = parseInt(schedule.split('/')[1].split(' ')[0]);
      now.setMinutes(now.getMinutes() + minutes);
    }

    return now;
  }

  /**
   * Détecte les crons qui ont manqué leur exécution
   */
  async detectMissedCrons(): Promise<CronExecution[]> {
    try {
      const allCrons = await this.getAllCronExecutions();
      const now = new Date();
      const missedCrons: CronExecution[] = [];

      for (const cron of allCrons) {
        if (cron.next_expected_at) {
          const nextExpected = new Date(cron.next_expected_at);
          
          // Si la prochaine exécution attendue est dans le passé
          if (nextExpected < now && cron.status !== 'running') {
            missedCrons.push(cron);
          }
        }
      }

      return missedCrons;
    } catch (error) {
      Logger.error('Erreur détection crons manqués', error as Error);
      return [];
    }
  }

  /**
   * Marque un cron comme en cours d'exécution
   */
  async markAsRunning(cronName: string): Promise<void> {
    await this.upsertCronExecution({
      cron_name: cronName,
      status: 'running',
      last_execution_at: new Date().toISOString()
    });
  }

  /**
   * Marque un cron comme terminé avec succès
   */
  async markAsSuccess(cronName: string, durationMs: number, schedule: string): Promise<void> {
    const nextExpected = this.calculateNextExecution(schedule);

    await this.upsertCronExecution({
      cron_name: cronName,
      status: 'success',
      duration_ms: durationMs,
      error_message: null,
      next_expected_at: nextExpected.toISOString()
    });

    await this.addToHistory({
      cron_name: cronName,
      executed_at: new Date().toISOString(),
      status: 'success',
      duration_ms: durationMs,
      error_message: null
    });
  }

  /**
   * Marque un cron comme échoué
   */
  async markAsFailed(cronName: string, error: Error, durationMs: number, schedule: string): Promise<void> {
    const nextExpected = this.calculateNextExecution(schedule);

    await this.upsertCronExecution({
      cron_name: cronName,
      status: 'failed',
      duration_ms: durationMs,
      error_message: error.message,
      next_expected_at: nextExpected.toISOString()
    });

    await this.addToHistory({
      cron_name: cronName,
      executed_at: new Date().toISOString(),
      status: 'failed',
      duration_ms: durationMs,
      error_message: error.message
    });
  }

  /**
   * Marque un cron comme manqué
   */
  async markAsMissed(cronName: string): Promise<void> {
    await this.addToHistory({
      cron_name: cronName,
      executed_at: new Date().toISOString(),
      status: 'missed',
      duration_ms: null,
      error_message: 'Exécution manquée pendant le downtime'
    });
  }
}

export const cronDatabaseService = new CronDatabaseService();
