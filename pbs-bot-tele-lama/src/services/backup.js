// src/services/backup.js
// Backup and restore data

import fs from 'fs';
import path from 'path';
import { createWriteStream, createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip, createGunzip } from 'zlib';
import { Readable } from 'stream';
import { logger } from '../utils/logger.js';

const BACKUP_DIR = path.join(process.cwd(), 'backups');

class BackupManager {
  constructor() {
    this.ensureBackupDir();
  }

  /**
   * Ensure backup directory exists
   */
  ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      logger.info('Backup directory created');
    }
  }

  /**
   * Create full backup
   */
  async createBackup(options = {}) {
    const {
      includeProducts = true,
      includePayments = true,
      includeSettings = true,
      includeState = true,
      compress = true
    } = options;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup-${timestamp}`;
    const backupData = {
      version: '2.0',
      createdAt: new Date().toISOString(),
      metadata: {
        includeProducts,
        includePayments,
        includeSettings,
        includeState
      },
      data: {}
    };

    try {
      // Backup products
      if (includeProducts) {
        const productsFile = path.join(process.cwd(), 'data', 'products.json');
        if (fs.existsSync(productsFile)) {
          backupData.data.products = JSON.parse(fs.readFileSync(productsFile, 'utf8'));
          logger.debug('Products backed up');
        }
      }

      // Backup payments
      if (includePayments) {
        const paymentsFile = path.join(process.cwd(), 'data', 'payments.json');
        if (fs.existsSync(paymentsFile)) {
          backupData.data.payments = JSON.parse(fs.readFileSync(paymentsFile, 'utf8'));
          logger.debug('Payments backed up');
        }
      }

      // Backup settings
      if (includeSettings) {
        const settingsFile = path.join(process.cwd(), 'data', 'settings.json');
        if (fs.existsSync(settingsFile)) {
          backupData.data.settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
          logger.debug('Settings backed up');
        }
      }

      // Backup bot state (users, favorites, history, analytics)
      if (includeState) {
        const stateFile = path.join(process.cwd(), 'data', 'bot-state.json');
        if (fs.existsSync(stateFile)) {
          backupData.data.state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
          logger.debug('Bot state backed up');
        }
      }

      // Save backup
      const backupContent = JSON.stringify(backupData, null, 2);
      const backupFile = path.join(BACKUP_DIR, `${backupName}.json`);

      if (compress) {
        const gzipFile = `${backupFile}.gz`;
        const readable = Readable.from([backupContent]);
        
        await pipeline(
          readable,
          createGzip(),
          createWriteStream(gzipFile)
        );
        
        logger.info(`Backup created: ${path.basename(gzipFile)}`, {
          size: fs.statSync(gzipFile).size
        });
        
        return {
          success: true,
          filename: path.basename(gzipFile),
          path: gzipFile,
          size: fs.statSync(gzipFile).size
        };
      } else {
        fs.writeFileSync(backupFile, backupContent);
        
        logger.info(`Backup created: ${path.basename(backupFile)}`, {
          size: fs.statSync(backupFile).size
        });
        
        return {
          success: true,
          filename: path.basename(backupFile),
          path: backupFile,
          size: fs.statSync(backupFile).size
        };
      }
    } catch (error) {
      logger.error(`Backup failed: ${error.message}`, { error: error.stack });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(filename, options = {}) {
    const {
      restoreProducts = true,
      restorePayments = true,
      restoreSettings = true,
      restoreState = true
    } = options;

    const backupFile = path.join(BACKUP_DIR, filename);

    if (!fs.existsSync(backupFile)) {
      throw new Error('Backup file not found');
    }

    try {
      let backupContent;

      // Decompress if needed
      if (filename.endsWith('.gz')) {
        const chunks = [];
        await pipeline(
          createReadStream(backupFile),
          createGunzip(),
          async function* (source) {
            for await (const chunk of source) {
              chunks.push(chunk);
            }
          }
        );
        backupContent = Buffer.concat(chunks).toString('utf8');
      } else {
        backupContent = fs.readFileSync(backupFile, 'utf8');
      }

      const backupData = JSON.parse(backupContent);

      // Validate backup format
      if (!backupData.version || !backupData.data) {
        throw new Error('Invalid backup format');
      }

      const restored = [];

      // Restore products
      if (restoreProducts && backupData.data.products) {
        const productsFile = path.join(process.cwd(), 'data', 'products.json');
        fs.writeFileSync(productsFile, JSON.stringify(backupData.data.products, null, 2));
        restored.push('products');
        logger.info('Products restored');
      }

      // Restore payments
      if (restorePayments && backupData.data.payments) {
        const paymentsFile = path.join(process.cwd(), 'data', 'payments.json');
        fs.writeFileSync(paymentsFile, JSON.stringify(backupData.data.payments, null, 2));
        restored.push('payments');
        logger.info('Payments restored');
      }

      // Restore settings
      if (restoreSettings && backupData.data.settings) {
        const settingsFile = path.join(process.cwd(), 'data', 'settings.json');
        fs.writeFileSync(settingsFile, JSON.stringify(backupData.data.settings, null, 2));
        restored.push('settings');
        logger.info('Settings restored');
      }

      // Restore state
      if (restoreState && backupData.data.state) {
        const stateFile = path.join(process.cwd(), 'data', 'bot-state.json');
        fs.writeFileSync(stateFile, JSON.stringify(backupData.data.state, null, 2));
        restored.push('state');
        logger.info('Bot state restored (restart required)');
      }

      logger.info(`Restore completed: ${restored.join(', ')}`);

      return {
        success: true,
        restored,
        backupDate: backupData.createdAt
      };
    } catch (error) {
      logger.error(`Restore failed: ${error.message}`, { error: error.stack });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List all backups
   */
  listBackups() {
    try {
      const files = fs.readdirSync(BACKUP_DIR);
      const backups = files
        .filter(f => f.startsWith('backup-') && (f.endsWith('.json') || f.endsWith('.json.gz')))
        .map(f => {
          const filepath = path.join(BACKUP_DIR, f);
          const stats = fs.statSync(filepath);
          
          return {
            filename: f,
            size: stats.size,
            created: stats.mtime,
            compressed: f.endsWith('.gz')
          };
        })
        .sort((a, b) => b.created - a.created);

      return backups;
    } catch (error) {
      logger.error(`Failed to list backups: ${error.message}`);
      return [];
    }
  }

  /**
   * Delete a backup
   */
  deleteBackup(filename) {
    try {
      const backupFile = path.join(BACKUP_DIR, filename);
      
      if (!fs.existsSync(backupFile)) {
        return { success: false, error: 'Backup not found' };
      }

      fs.unlinkSync(backupFile);
      logger.info(`Backup deleted: ${filename}`);
      
      return { success: true };
    } catch (error) {
      logger.error(`Failed to delete backup: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get backup info
   */
  getBackupInfo(filename) {
    try {
      const backupFile = path.join(BACKUP_DIR, filename);
      
      if (!fs.existsSync(backupFile)) {
        return null;
      }

      const stats = fs.statSync(backupFile);
      
      return {
        filename,
        size: stats.size,
        created: stats.mtime,
        compressed: filename.endsWith('.gz'),
        path: backupFile
      };
    } catch (error) {
      logger.error(`Failed to get backup info: ${error.message}`);
      return null;
    }
  }

  /**
   * Auto cleanup old backups (keep last N)
   */
  cleanupOldBackups(keepCount = 10) {
    try {
      const backups = this.listBackups();
      
      if (backups.length <= keepCount) {
        return { deleted: 0 };
      }

      const toDelete = backups.slice(keepCount);
      let deleted = 0;

      for (const backup of toDelete) {
        const result = this.deleteBackup(backup.filename);
        if (result.success) deleted++;
      }

      logger.info(`Cleanup completed: deleted ${deleted} old backups`);
      
      return { deleted };
    } catch (error) {
      logger.error(`Cleanup failed: ${error.message}`);
      return { deleted: 0, error: error.message };
    }
  }

  /**
   * Format backup list for display
   */
  formatBackupList() {
    const backups = this.listBackups();
    
    if (backups.length === 0) {
      return 'Tidak ada backup tersedia.';
    }

    const lines = ['📦 *Daftar Backup*\n'];
    
    for (let i = 0; i < backups.length && i < 20; i++) {
      const backup = backups[i];
      const size = (backup.size / 1024).toFixed(2);
      const date = backup.created.toLocaleString('id-ID');
      const icon = backup.compressed ? '🗜️' : '📄';
      
      lines.push(`${i + 1}. ${icon} ${backup.filename}`);
      lines.push(`   Size: ${size} KB | ${date}`);
    }

    if (backups.length > 20) {
      lines.push(`\n_... dan ${backups.length - 20} backup lainnya_`);
    }

    return lines.join('\n');
  }
}

// Create singleton instance
export const backup = new BackupManager();

export default BackupManager;
