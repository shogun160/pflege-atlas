import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Articles } from './collections/Articles'
import { Submissions } from './collections/Submissions'
import { Media } from './collections/Media'
import { buildEmailConfig } from './lib/email-config'
import { assertGithubConfigInProduction } from './lib/env'
import { buildStorageConfig } from './lib/storage-config'

assertGithubConfigInProduction()

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    // B3: Force Payload's built-in default avatar in the admin shell.
    // Without this, Payload reads our `Users.avatar` field (a media-relationship)
    // and tries to render it as the Admin-Header-Avatar Component, which
    // crashes with "Cannot read properties of undefined (reading 'stack')".
    avatar: 'default',
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      views: {
        dashboard: {
          Component:
            'src/components/admin/EditorialDashboard.server.tsx#EditorialDashboardServer',
        },
      },
    },
  },
  collections: [Users, Articles, Submissions, Media],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
    // Migrations sind Source-of-Truth — kein interaktiver Dev-Schema-Push.
    // Verhindert Vercel-Build-Hänger bei Code-vs-DB-Schema-Drift (z.B. `media.uploaded_by_id` FK-Naming).
    push: false,
  }),
  sharp,
  email: buildEmailConfig(),
  plugins: (() => {
    const storage = buildStorageConfig()
    if (!storage) return []
    return [
      s3Storage({
        collections: {
          media: true,
        },
        bucket: storage.bucket,
        config: storage.config,
      }),
    ]
  })(),
})
