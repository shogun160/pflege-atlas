import { getPayload } from 'payload'
import config from '@/payload.config'
import { getSession } from '@/lib/auth'
import { EditorialDashboard } from './EditorialDashboard'

export async function EditorialDashboardServer() {
  const session = await getSession()
  const payload = await getPayload({ config })
  const pending = await payload.count({
    collection: 'submissions',
    where: { reviewStatus: { equals: 'pending' } },
  })
  const inReview = await payload.count({
    collection: 'submissions',
    where: { reviewStatus: { equals: 'in_review' } },
  })
  const readyToPublish = await payload.count({
    collection: 'articles',
    where: { status: { equals: 'ready_to_publish' } },
  })
  const myStack = session
    ? await payload.count({
        collection: 'articles',
        where: {
          and: [
            { status: { in: ['in_review', 'ready_to_publish'] } },
            { currentReviewer: { equals: session.id } },
          ],
        },
      })
    : { totalDocs: 0 }
  const recentSubmissions = await payload.find({
    collection: 'submissions',
    sort: '-createdAt',
    limit: 5,
    depth: 0,
  })
  const recentArticles = await payload.find({
    collection: 'articles',
    where: { status: { not_equals: 'published' } },
    sort: '-updatedAt',
    limit: 5,
    depth: 0,
  })
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
