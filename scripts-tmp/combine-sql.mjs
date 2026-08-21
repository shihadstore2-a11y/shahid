import fs from 'fs';
import path from 'path';

function combineMigrations(migrationsDir, outputFile, isStore = false) {
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let combinedSql = `-- Consolidated Supabase Schema Migration Script\n-- Generated for fresh Supabase database initialization\n\n`;

  for (const file of files) {
    if (file.includes('aeb6992c-e209-445a-8142-f4313c12f14e')) {
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Safely wrap cron.unschedule
    content = content.replace(
      /SELECT\s+cron\.unschedule\('([^']+)'\);/g,
      (match, p1) => `DO $$ BEGIN PERFORM cron.unschedule('${p1}'); EXCEPTION WHEN OTHERS THEN NULL; END $$;`
    );
    content = content.replace(
      /PERFORM\s+cron\.unschedule\('([^']+)'\);/g,
      (match, p1) => `BEGIN PERFORM cron.unschedule('${p1}'); EXCEPTION WHEN OTHERS THEN NULL; END;`
    );

    if (isStore) {
      // Handle profiles table collision if profiles already exists from main app
      content = content.replace(
        /CREATE TABLE public\.profiles \([\s\S]*?\);\n/g,
        `-- Profiles table already created by main platform; ensuring additional store columns exist:
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
`
      );

      // Make all CREATE TABLE safe with IF NOT EXISTS
      content = content.replace(/CREATE TABLE public\.(\w+)/g, 'CREATE TABLE IF NOT EXISTS public.$1');

      // Make CREATE TYPE safe
      content = content.replace(
        /CREATE TYPE public\.(\w+) AS ENUM \(([^)]+)\);/g,
        (match, name, values) => `DO $$ BEGIN CREATE TYPE public.${name} AS ENUM (${values}); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
      );

      // Make CREATE POLICY safe with preceding DROP POLICY IF EXISTS
      content = content.replace(
        /CREATE POLICY "([^"]+)"\s+ON\s+public\.(\w+)/g,
        (match, policyName, tableName) => `DROP POLICY IF EXISTS "${policyName}" ON public.${tableName};\nCREATE POLICY "${policyName}" ON public.${tableName}`
      );

      // Make CREATE TRIGGER safe with preceding DROP TRIGGER IF EXISTS
      content = content.replace(
        /CREATE TRIGGER\s+(\w+)\s+([\s\S]*?)\s+ON\s+public\.(\w+)/g,
        (match, triggerName, timing, tableName) => `DROP TRIGGER IF EXISTS ${triggerName} ON public.${tableName};\nCREATE TRIGGER ${triggerName} ${timing} ON public.${tableName}`
      );
    }

    combinedSql += `-- ==========================================\n`;
    combinedSql += `-- Migration File: ${file}\n`;
    combinedSql += `-- ==========================================\n\n`;
    combinedSql += content + `\n\n`;
  }

  fs.writeFileSync(outputFile, combinedSql, 'utf8');
  console.log(`Successfully combined ${files.length} migrations into ${outputFile}`);
}

combineMigrations('supabase/migrations', 'full_database_schema.sql', false);
combineMigrations('shahid-store-main/supabase/migrations', 'full_store_database_schema.sql', true);
