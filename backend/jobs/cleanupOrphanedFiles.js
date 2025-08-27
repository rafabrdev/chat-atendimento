/**
 * Job de limpeza de arquivos órfãos
 * Remove arquivos do S3 que não têm mais referência no banco de dados
 * 
 * Este job deve ser executado periodicamente (ex: diariamente às 3AM)
 */

const File = require('../models/File');
const s3Service = require('../services/s3Service');
const { ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');

class OrphanedFilesCleaner {
  constructor() {
    this.dryRun = process.env.CLEANUP_DRY_RUN === 'true';
    this.batchSize = parseInt(process.env.CLEANUP_BATCH_SIZE) || 100;
    this.maxAge = parseInt(process.env.CLEANUP_MAX_AGE_DAYS) || 7; // Dias
    
    this.stats = {
      scanned: 0,
      orphaned: 0,
      deleted: 0,
      errors: 0,
      totalSize: 0
    };
  }

  /**
   * Verifica se um arquivo é órfão
   */
  async isOrphaned(s3Key) {
    try {
      const fileExists = await File.findOne({ s3Key: s3Key });
      return !fileExists;
    } catch (error) {
      console.error(`Error checking file ${s3Key}:`, error);
      return false; // Em caso de erro, não deletar
    }
  }

  /**
   * Verifica se o arquivo é antigo o suficiente para ser deletado
   */
  isOldEnough(lastModified) {
    const ageInDays = (Date.now() - new Date(lastModified)) / (1000 * 60 * 60 * 24);
    return ageInDays > this.maxAge;
  }

  /**
   * Extrai o tenantId da S3 key
   */
  extractTenantId(s3Key) {
    // Formato: tenants/{tenantId}/...
    const match = s3Key.match(/^tenants\/([^\/]+)\//);
    return match ? match[1] : null;
  }

  /**
   * Deleta um arquivo órfão do S3
   */
  async deleteOrphanedFile(s3Key) {
    if (this.dryRun) {
      console.log(`[DRY-RUN] Would delete: ${s3Key}`);
      return true;
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Key
      });
      
      await s3Service.client.send(command);
      console.log(`✅ Deleted orphaned file: ${s3Key}`);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting ${s3Key}:`, error.message);
      return false;
    }
  }

  /**
   * Processa um lote de objetos S3
   */
  async processBatch(objects) {
    const orphanedFiles = [];
    
    for (const object of objects) {
      this.stats.scanned++;
      
      // Verificar se é órfão
      if (await this.isOrphaned(object.Key)) {
        // Verificar idade do arquivo
        if (this.isOldEnough(object.LastModified)) {
          orphanedFiles.push({
            key: object.Key,
            size: object.Size,
            lastModified: object.LastModified,
            tenantId: this.extractTenantId(object.Key)
          });
          
          this.stats.orphaned++;
          this.stats.totalSize += object.Size;
          
          // Deletar arquivo
          if (await this.deleteOrphanedFile(object.Key)) {
            this.stats.deleted++;
          } else {
            this.stats.errors++;
          }
        }
      }
      
      // Log de progresso a cada 100 arquivos
      if (this.stats.scanned % 100 === 0) {
        console.log(`Progress: ${this.stats.scanned} files scanned, ${this.stats.orphaned} orphaned found`);
      }
    }
    
    return orphanedFiles;
  }

  /**
   * Executa a limpeza
   */
  async execute() {
    console.log('🧹 Starting orphaned files cleanup...');
    console.log(`Settings: DryRun=${this.dryRun}, MaxAge=${this.maxAge} days`);
    
    if (!s3Service.isEnabled) {
      console.log('⚠️  S3 is not enabled, skipping cleanup');
      return this.stats;
    }

    const startTime = Date.now();
    let continuationToken = null;
    const allOrphaned = [];

    try {
      do {
        // Listar objetos do S3
        const command = new ListObjectsV2Command({
          Bucket: process.env.S3_BUCKET_NAME,
          MaxKeys: this.batchSize,
          ContinuationToken: continuationToken,
          // Só processar arquivos na estrutura de tenants
          Prefix: 'tenants/'
        });

        const response = await s3Service.client.send(command);
        
        if (response.Contents && response.Contents.length > 0) {
          const orphaned = await this.processBatch(response.Contents);
          allOrphaned.push(...orphaned);
        }
        
        continuationToken = response.NextContinuationToken;
        
      } while (continuationToken);

      // Gerar relatório
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log('\n' + '='.repeat(60));
      console.log('📊 CLEANUP SUMMARY');
      console.log('='.repeat(60));
      console.log(`Duration: ${duration}s`);
      console.log(`Files scanned: ${this.stats.scanned}`);
      console.log(`Orphaned files found: ${this.stats.orphaned}`);
      console.log(`Files deleted: ${this.stats.deleted}`);
      console.log(`Errors: ${this.stats.errors}`);
      console.log(`Total space freed: ${(this.stats.totalSize / (1024 * 1024)).toFixed(2)} MB`);
      
      if (this.dryRun) {
        console.log('\n⚠️  This was a DRY-RUN. No files were actually deleted.');
      }

      // Agrupar por tenant para relatório
      const byTenant = {};
      allOrphaned.forEach(file => {
        const tenantId = file.tenantId || 'unknown';
        if (!byTenant[tenantId]) {
          byTenant[tenantId] = { count: 0, size: 0 };
        }
        byTenant[tenantId].count++;
        byTenant[tenantId].size += file.size;
      });

      if (Object.keys(byTenant).length > 0) {
        console.log('\n📁 Orphaned files by tenant:');
        Object.entries(byTenant).forEach(([tenantId, data]) => {
          console.log(`  ${tenantId}: ${data.count} files, ${(data.size / (1024 * 1024)).toFixed(2)} MB`);
        });
      }

      // Salvar relatório se houver arquivos órfãos
      if (this.stats.orphaned > 0 && !this.dryRun) {
        await this.saveReport(allOrphaned);
      }

    } catch (error) {
      console.error('❌ Cleanup error:', error);
      this.stats.errors++;
    }

    return this.stats;
  }

  /**
   * Salva relatório da limpeza
   */
  async saveReport(orphanedFiles) {
    const report = {
      timestamp: new Date().toISOString(),
      stats: this.stats,
      dryRun: this.dryRun,
      settings: {
        maxAgeDays: this.maxAge,
        batchSize: this.batchSize
      },
      files: orphanedFiles.slice(0, 100) // Limitar para não ficar muito grande
    };

    // Salvar no banco de dados para auditoria
    try {
      const CleanupLog = require('../models/CleanupLog');
      await CleanupLog.create({
        type: 'orphaned_files',
        stats: this.stats,
        details: report,
        executedAt: new Date()
      });
      console.log('✅ Cleanup report saved to database');
    } catch (error) {
      console.error('Error saving cleanup report:', error);
      
      // Fallback: salvar em arquivo
      const fs = require('fs');
      const path = require('path');
      const reportsDir = path.join(__dirname, '..', 'reports');
      
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      
      const reportPath = path.join(reportsDir, `cleanup-${Date.now()}.json`);
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`📄 Report saved to: ${reportPath}`);
    }
  }
}

/**
 * Função para ser chamada pelo scheduler
 */
async function runCleanup(options = {}) {
  const cleaner = new OrphanedFilesCleaner();
  
  // Permitir sobrescrever configurações
  if (options.dryRun !== undefined) cleaner.dryRun = options.dryRun;
  if (options.maxAge !== undefined) cleaner.maxAge = options.maxAge;
  if (options.batchSize !== undefined) cleaner.batchSize = options.batchSize;
  
  return await cleaner.execute();
}

// Se executado diretamente
if (require.main === module) {
  require('dotenv').config();
  const mongoose = require('mongoose');
  
  // Parse argumentos
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    maxAge: parseInt(args.find(arg => arg.startsWith('--max-age='))?.split('=')[1]) || undefined
  };
  
  // Conectar ao banco e executar
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      console.log('✅ Connected to MongoDB');
      return runCleanup(options);
    })
    .then(() => {
      console.log('✅ Cleanup completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = {
  OrphanedFilesCleaner,
  runCleanup
};
