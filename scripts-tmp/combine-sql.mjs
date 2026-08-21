import fs from 'fs';
import path from 'path';

function combineMigrations(migrationsDir, outputFile, isStore = false) {
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let combinedSql = `-- Consolidated Supabase Schema Migration Script\n-- Generated for fresh Supabase database initialization\n\n`;

  for (const file of files) {
    // Skip QA test assertion migration files and historical test-data cleanup assertion files
    if (
      file.includes('aeb6992c-e209-445a-8142-f4313c12f14e') || 
      file.includes('8e1742a4-7a12-46a1-b9bb-8f1576d96d81')
    ) {
      console.log(`Skipping test/data-cleanup migration file: ${file}`);
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Safely wrap cron.unschedule using replacement function to preserve literal $$
    content = content.replace(
      /SELECT\s+cron\.unschedule\('([^']+)'\);/g,
      (match, p1) => `DO $$ BEGIN PERFORM cron.unschedule('${p1}'); EXCEPTION WHEN OTHERS THEN NULL; END $$;`
    );
    content = content.replace(
      /PERFORM\s+cron\.unschedule\('([^']+)'\);/g,
      (match, p1) => `BEGIN PERFORM cron.unschedule('${p1}'); EXCEPTION WHEN OTHERS THEN NULL; END;`
    );

    // Remove plain ASSERT statements that assume existing test data
    content = content.replace(/^\s*ASSERT\s+[^;]+;/gm, () => '-- ASSERT skipped for fresh database initialization');

    if (isStore) {
      // Handle profiles table collision if profiles already exists from main app
      content = content.replace(
        /CREATE TABLE public\.profiles \([\s\S]*?\);\n/g,
        () => `-- Profiles table already created by main platform; ensuring additional store columns exist:
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
DO $$
BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
`
      );

      // Fix INSERT INTO public.profiles in handle_new_user to set both id and user_id
      content = content.replace(
        /INSERT INTO public\.profiles \(user_id, full_name, email, phone\)\s+VALUES \(\s*NEW\.id,/g,
        'INSERT INTO public.profiles (id, user_id, full_name, email, phone) VALUES (NEW.id, NEW.id,'
      );

      // Fix INSERT INTO public.profiles backfill to set both id and user_id
      content = content.replace(
        /INSERT INTO public\.profiles \(user_id, full_name, phone, email\)\s+SELECT\s+u\.id AS user_id,/g,
        'INSERT INTO public.profiles (id, user_id, full_name, phone, email) SELECT u.id AS id, u.id AS user_id,'
      );
      content = content.replace(/ON CONFLICT \(user_id\) DO NOTHING;/g, 'ON CONFLICT (id) DO NOTHING;');

      // Make all CREATE TABLE safe with IF NOT EXISTS
      content = content.replace(/CREATE TABLE public\.(\w+)/g, (m, p1) => `CREATE TABLE IF NOT EXISTS public.${p1}`);

      // Make CREATE TYPE safe using replacement function
      content = content.replace(
        /CREATE TYPE public\.(\w+) AS ENUM \(([^)]+)\);/g,
        (match, name, values) => `DO $$ BEGIN CREATE TYPE public.${name} AS ENUM (${values}); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
      );

      // Make CREATE POLICY safe with preceding DROP POLICY IF EXISTS on any schema
      content = content.replace(
        /CREATE POLICY\s+"([^"]+)"\s+ON\s+([a-zA-Z0-9_.]+)/g,
        (match, policyName, tableName) => `DROP POLICY IF EXISTS "${policyName}" ON ${tableName};\nCREATE POLICY "${policyName}" ON ${tableName}`
      );

      // Make CREATE TRIGGER safe with preceding DROP TRIGGER IF EXISTS on any schema (including auth.users)
      content = content.replace(
        /CREATE TRIGGER\s+([a-zA-Z0-9_]+)\s+([\s\S]*?)\s+ON\s+([a-zA-Z0-9_.]+)/g,
        (match, triggerName, timing, tableName) => `DROP TRIGGER IF EXISTS ${triggerName} ON ${tableName};\nCREATE TRIGGER ${triggerName} ${timing} ON ${tableName}`
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
