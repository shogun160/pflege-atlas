import { getPayload } from 'payload'
import config from '@/payload.config'
import { getSession } from '@/lib/auth'
import { EditorialDashboard } from './EditorialDashboard'

export async function EditorialDashboardServer() {
  const session = await getSession()
  const payload = await getPayload({ config })
  const [pending, inReview, readyToPublish, myStack, recentSubmissions, recentArticles] =
    await Promise.all([
      payload.count({
        collection: 'submissions',
        where: { reviewStatus: { equals: 'pending' } },
      }),
      payload.count({
        collection: 'submissions',
        where: { reviewStatus: { equals: 'in_review' } },
      }),
      payload.count({
        collection: 'articles',
        where: { status: { equals: 'ready_to_publish' } },
      }),
      session
        ? payload.count({
            collection: 'articles',
            where: {
              and: [
                { status: { in: ['in_review', 'ready_to_publish'] } },
                { currentReviewer: { equals: session.id } },
              ],
            },
          })
        : Promise.resolve({ totalDocs: 0 }),
      payload.find({
        collection: 'submissions',
        sort: '-createdAt',
        limit: 5,
        depth: 0,
      }),
      payload.find({
        collection: 'articles',
        where: { status: { not_equals: 'published' } },
        sort: '-updatedAt',
        limit: 5,
        depth: 0,
      }),
    ])
  return (
    <EditorialDashboard
      stats={{
        pending: pending.totalDocs,
        inReview: inReview.totalDocs,
        readyToPublish: readyToPublish.totalDocs,
        myStack: myStack.totalDocs,
      }}
      recentSubmissions={recentSubmissions.docs as never}
      recentArticles={recentArticles.docs as never}
    />
  )
}
