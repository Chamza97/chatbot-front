import { Response } from 'express';

/**
 * Convertit un tableau d'objets en Buffer CSV (optimisé pour larges volumes)
 */
export function arrayToCSV<T extends Record<string, any>>(
  data: T[],
  options?: {
    headers?: string[];
    separator?: string;
    includeHeaders?: boolean;
  }
): Buffer {
  if (data.length === 0) {
    return Buffer.from('');
  }

  const separator = options?.separator || ',';
  const includeHeaders = options?.includeHeaders !== false;
  const headers = options?.headers || Object.keys(data[0]);

  // Estimation de la taille du buffer (optimisation mémoire)
  const estimatedRowSize = headers.length * 20; // ~20 chars par colonne en moyenne
  const estimatedSize = data.length * estimatedRowSize;
  
  // Utiliser un tableau de buffers pour éviter les réallocations
  const buffers: Buffer[] = [];
  const NEWLINE = Buffer.from('\n');
  const SEPARATOR = Buffer.from(separator);
  const QUOTE = Buffer.from('"');
  const DOUBLE_QUOTE = Buffer.from('""');

  // Fonction optimisée pour échapper les valeurs
  const escapeCSVValue = (value: any): Buffer => {
    if (value === null || value === undefined) {
      return Buffer.from('');
    }

    const stringValue = String(value);
    const needsQuoting =
      stringValue.includes(separator) ||
      stringValue.includes('"') ||
      stringValue.includes('\n') ||
      stringValue.includes('\r');

    if (!needsQuoting) {
      return Buffer.from(stringValue, 'utf8');
    }

    // Échapper les guillemets et entourer de guillemets
    const escaped = stringValue.replace(/"/g, '""');
    return Buffer.from(`"${escaped}"`, 'utf8');
  };

  // BOM UTF-8 pour Excel
  buffers.push(Buffer.from('\uFEFF', 'utf8'));

  // Ajouter les en-têtes
  if (includeHeaders) {
    for (let i = 0; i < headers.length; i++) {
      if (i > 0) buffers.push(SEPARATOR);
      buffers.push(escapeCSVValue(headers[i]));
    }
    buffers.push(NEWLINE);
  }

  // Traiter les données par batch pour optimiser la mémoire
  const BATCH_SIZE = 1000;
  
  for (let batchStart = 0; batchStart < data.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, data.length);
    
    for (let i = batchStart; i < batchEnd; i++) {
      const item = data[i];
      
      for (let j = 0; j < headers.length; j++) {
        if (j > 0) buffers.push(SEPARATOR);
        buffers.push(escapeCSVValue(item[headers[j]]));
      }
      
      buffers.push(NEWLINE);
    }
  }

  // Concaténer tous les buffers en un seul
  return Buffer.concat(buffers);
}

/**
 * Version streaming optimisée pour très larges volumes
 */
export function arrayToCSVStream<T extends Record<string, any>>(
  data: T[],
  options?: {
    headers?: string[];
    separator?: string;
    includeHeaders?: boolean;
  }
): NodeJS.ReadableStream {
  const { Readable } = require('stream');
  
  const separator = options?.separator || ',';
  const includeHeaders = options?.includeHeaders !== false;
  const headers = options?.headers || (data.length > 0 ? Object.keys(data[0]) : []);
  
  let index = 0;
  let headersSent = false;

  const escapeCSVValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (
      stringValue.includes(separator) ||
      stringValue.includes('"') ||
      stringValue.includes('\n') ||
      stringValue.includes('\r')
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  return new Readable({
    read() {
      try {
        // Envoyer le BOM UTF-8
        if (!headersSent && includeHeaders) {
          this.push('\uFEFF');
          const headerLine = headers.map(escapeCSVValue).join(separator) + '\n';
          this.push(Buffer.from(headerLine, 'utf8'));
          headersSent = true;
        } else if (!headersSent) {
          this.push('\uFEFF');
          headersSent = true;
        }

        // Traiter par batch de 100 lignes pour de meilleures performances
        const BATCH_SIZE = 100;
        let batch = '';
        
        for (let i = 0; i < BATCH_SIZE && index < data.length; i++, index++) {
          const item = data[index];
          const values = headers.map((header) => escapeCSVValue(item[header]));
          batch += values.join(separator) + '\n';
        }

        if (batch) {
          this.push(Buffer.from(batch, 'utf8'));
        }

        // Terminer le stream
        if (index >= data.length) {
          this.push(null);
        }
      } catch (error) {
        this.destroy(error as Error);
      }
    },
  });
}

/**
 * Envoie un CSV comme téléchargement (version Buffer optimisée)
 */
export function sendCSVDownload<T extends Record<string, any>>(
  res: Response,
  data: T[],
  filename: string,
  options?: {
    headers?: string[];
    separator?: string;
    includeHeaders?: boolean;
    useStream?: boolean; // Nouvelle option pour streaming
  }
): void {
  // Pour de très larges tableaux (>10000 lignes), utiliser le streaming
  if (options?.useStream || data.length > 10000) {
    sendCSVStreamDownload(res, data, filename, options);
    return;
  }

  const csv = arrayToCSV(data, options);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', csv.length);

  res.end(csv);
}

/**
 * Envoie un CSV en streaming
 */
export function sendCSVStreamDownload<T extends Record<string, any>>(
  res: Response,
  data: T[],
  filename: string,
  options?: {
    headers?: string[];
    separator?: string;
    includeHeaders?: boolean;
  }
): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Transfer-Encoding', 'chunked');

  const stream = arrayToCSVStream(data, options);
  
  stream.on('error', (error: Error) => {
    console.error('Stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erreur lors de la génération du CSV' });
    }
  });

  stream.pipe(res);
}

/**
 * Version async pour traiter depuis une source de données (BDD, API, etc.)
 */
export async function generateCSVFromAsyncSource<T extends Record<string, any>>(
  res: Response,
  filename: string,
  headers: string[],
  dataSource: AsyncGenerator<T[], void, unknown>,
  options?: {
    separator?: string;
  }
): Promise<void> {
  const separator = options?.separator || ',';

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Transfer-Encoding', 'chunked');

  const escapeCSVValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (
      stringValue.includes(separator) ||
      stringValue.includes('"') ||
      stringValue.includes('\n')
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  try {
    // BOM UTF-8 + Headers
    res.write('\uFEFF');
    res.write(headers.map(escapeCSVValue).join(separator) + '\n');

    // Traiter les données par batch depuis la source
    for await (const batch of dataSource) {
      const lines = batch.map((item) => {
        const values = headers.map((header) => escapeCSVValue(item[header]));
        return values.join(separator);
      });
      res.write(lines.join('\n') + '\n');
    }

    res.end();
  } catch (error) {
    console.error('Erreur lors de la génération du CSV:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erreur lors de la génération du CSV' });
    } else {
      res.end();
    }
  }
}


export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  
  keys.forEach((key) => {
    delete result[key];
  });
  
  return result as Omit<T, K>;
}
