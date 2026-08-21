import fs from 'fs';
import path from 'path';

function combineMigrations(migrationsDir, outputFile) {
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let combinedSql = `-- Consolidated Supabase Schema Migration Script\n-- Generated for fresh Supabase database initialization\n\n`;

  for (const file of files) {
    // Skip QA test assertion migration files meant only for CI test runners on existing data
    if (file.includes('aeb6992c-e209-445a-8142-f4313c12f14e')) {
      console.log(`Skipping QA test migration file: ${file}`);
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Safely wrap raw SELECT cron.unschedule('job-name'); calls so fresh DBs don't crash
    content = content.replace(
      /SELECT\s+cron\.unschedule\('([^']+)'\);/g,
      (match, p1) => `DO $$ BEGIN PERFORM cron.unschedule('${p1}'); EXCEPTION WHEN OTHERS THEN NULL; END $$;`
    );

    // Safely wrap PERFORM cron.unschedule('job-name'); inside functions/blocks
    content = content.replace(
      /PERFORM\s+cron\.unschedule\('([^']+)'\);/g,
      (match, p1) => `BEGIN PERFORM cron.unschedule('${p1}'); EXCEPTION WHEN OTHERS THEN NULL; END;`
    );

    combinedSql += `-- ==========================================\n`;
    combinedSql += `-- Migration File: ${file}\n`;
    combinedSql += `-- ==========================================\n\n`;
    combinedSql += content + `\n\n`;
  }

  fs.writeFileSync(outputFile, combinedSql, 'utf8');
  console.log(`Successfully combined ${files.length} migrations into ${outputFile}`);
}

combineMigrations('supabase/migrations', 'full_database_schema.sql');
combineMigrations('shahid-store-main/supabase/migrations', 'full_store_database_schema.sql');
