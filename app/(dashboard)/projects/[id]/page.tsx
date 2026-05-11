import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { projectBriefCacheFingerprint } from '@/lib/utils/project-brief-fingerprint'
import { ProjectDetailClient } from './project-detail-client'
import type { Clip } from '@/components/chat/chat-content'

interface PageProps { params: Promise<{ id: string }> }

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Use * so we don’t fail if optional columns (e.g. user_budget) are missing before migration runs
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (projErr || !project) {
    redirect('/projects')
  }

  const { data: clips } = await supabase
    .from('clips')
    .select('id, product_name, brand, price, currency, image_url, source_domain, rating, review_count')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order('clipped_at', { ascending: false })

  const products: Clip[] = (clips || []).map(c => ({
    id: c.id,
    product_name: c.product_name,
    brand: c.brand ?? null,
    price: c.price != null ? Number(c.price) : null,
    currency: c.currency || 'EUR',
    image_url: c.image_url ?? null,
    source_domain: c.source_domain || '',
    rating: c.rating ?? null,
    review_count: c.review_count ?? null,
  }))

  const currency = products.find(p => p.currency)?.currency || 'EUR'
  const totalSpent = products.reduce((sum, p) => sum + (p.price ?? 0), 0)
  const createdAt = new Date(project.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })

  const rawBudget = (project as { user_budget?: unknown }).user_budget
  const userBudget =
    rawBudget != null && Number.isFinite(Number(rawBudget))
      ? Number(rawBudget)
      : null

  const briefFingerprint = projectBriefCacheFingerprint(products, userBudget)

  // Serve cached brief if fingerprint matches (products + user budget)
  const cachedBrief =
    project.ai_brief &&
    project.ai_brief_fingerprint === briefFingerprint &&
    String(project.ai_brief).trim() !== ''
      ? (project.ai_brief as string)
      : ''

  return (
    <ProjectDetailClient
      project={project}
      products={products}
      aiBrief={cachedBrief}
      briefFingerprint={briefFingerprint}
      initialUserBudget={userBudget}
      createdAt={createdAt}
      totalSpent={totalSpent}
      currency={currency}
    />
  )
}
