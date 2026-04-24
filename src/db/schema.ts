import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  primaryKey,
  uniqueIndex,
  index,
  date,
  jsonb,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { AdapterAccountType } from 'next-auth/adapters';

/* -------------------------------------------------------------------------- */
/* Auth.js tables (shape required by @auth/drizzle-adapter)                    */
/* -------------------------------------------------------------------------- */

export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
  // Lookahead addition: nullable for Google-only accounts.
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const accounts = pgTable(
  'accounts',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable('sessions', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* -------------------------------------------------------------------------- */
/* Business tables                                                             */
/* -------------------------------------------------------------------------- */

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const organizationMembers = pgTable(
  'organization_members',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['owner', 'pm', 'member'] })
      .notNull()
      .default('member'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.organizationId] }),
    index('org_members_org_idx').on(t.organizationId),
  ],
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    client: text('client'),
    description: text('description'),
    startDate: date('start_date'),
    endDate: date('end_date'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('projects_org_idx').on(t.organizationId)],
);

/* -------------------------------------------------------------------------- */
/* Programmes (uploaded PDFs + extracted rows)                                 */
/* -------------------------------------------------------------------------- */

export type ExtractedRow = Record<string, string | null>;

export const programmes = pgTable(
  'programmes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    fileSha256: text('file_sha256').notNull(),
    sourceFileUrl: text('source_file_url').notNull(),
    sourceFormat: text('source_format', {
      enum: ['pdf', 'xlsx', 'mpp', 'xer', 'xml'],
    })
      .notNull()
      .default('pdf'),
    sourceToolDetected: text('source_tool_detected', {
      enum: ['ms_project', 'primavera_p6', 'other'],
    }),
    status: text('status', {
      enum: ['uploaded', 'extracting', 'extracted', 'failed'],
    })
      .notNull()
      .default('uploaded'),
    detectedColumns: jsonb('detected_columns').$type<string[]>(),
    rawRows: jsonb('raw_rows').$type<ExtractedRow[]>(),
    extractionError: text('extraction_error'),
    uploadedBy: text('uploaded_by')
      .notNull()
      .references(() => users.id),
    uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
    extractedAt: timestamp('extracted_at'),
  },
  (t) => [
    index('programmes_project_idx').on(t.projectId),
    index('programmes_sha_idx').on(t.fileSha256),
  ],
);

/* -------------------------------------------------------------------------- */
/* Invitations                                                                 */
/* -------------------------------------------------------------------------- */

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    roleOnAccept: text('role_on_accept', { enum: ['owner', 'pm', 'member'] })
      .notNull()
      .default('member'),
    tokenHash: text('token_hash').notNull(),
    inviterId: text('inviter_id')
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp('expires_at').notNull(),
    acceptedAt: timestamp('accepted_at'),
    acceptedBy: text('accepted_by').references(() => users.id),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('invitations_token_unique').on(t.tokenHash),
    uniqueIndex('invitations_pending_unique')
      .on(t.organizationId, t.email)
      .where(sql`accepted_at is null and revoked_at is null`),
    index('invitations_email_idx').on(t.email),
  ],
);
