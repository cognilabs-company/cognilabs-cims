import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useCrmScope } from '../lib/crmScope'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { Button } from '../../../shared/ui/button'
import { ErrorStateBlock, LoadingStateBlock } from '../../../shared/ui/state-block'
import { CustomerDetailContent } from '../components/CustomerDetailDrawer'
import { resolveCustomerAudioUrl } from '../lib/customerAudio'

export function CustomerDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { service: crmService, apiBasePath, routeBasePath, title } = useCrmScope()
  const params = useParams()
  const customerId = Number(params.customerId)

  const detailQuery = useAsyncData(
    () => crmService.detail(customerId),
    [customerId],
    { enabled: Number.isFinite(customerId) && customerId > 0 },
  )

  const audioSource = useMemo(
    () => resolveCustomerAudioUrl(detailQuery.data?.audio_file_id, detailQuery.data?.audio_url, apiBasePath),
    [apiBasePath, detailQuery.data?.audio_file_id, detailQuery.data?.audio_url],
  )

  if (!Number.isFinite(customerId) || customerId <= 0) {
    return (
      <ErrorStateBlock
        eyebrow={t('customers.detail', 'Customer detail')}
        title={t('customers.errors.invalid_id.title', 'Invalid customer ID')}
        description={t('customers.errors.invalid_id.description', 'The customer identifier in the route is invalid.')}
        actionLabel={t('customers.detail.back_to', 'Back to {{title}}', { title })}
        onAction={() => navigate(routeBasePath)}
      />
    )
  }

  if (detailQuery.isLoading && !detailQuery.data) {
    return (
      <LoadingStateBlock
        eyebrow={t('customers.detail', 'Customer detail')}
        title={t('customers.loading.profile.title', 'Customer profile loading')}
        description={t('customers.loading.profile.description', 'Retrieving comprehensive customer details.')}
      />
    )
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <ErrorStateBlock
        eyebrow={t('customers.detail', 'Customer detail')}
        title={t('customers.errors.not_found.title', 'Customer not found')}
        description={t('customers.errors.not_found.description', 'Could not retrieve details for this customer.')}
        actionLabel={t('customers.detail.back_to', 'Back to {{title}}', { title })}
        onAction={() => navigate(routeBasePath)}
      />
    )
  }

  return (
    <section className="space-y-4 page-enter">
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(routeBasePath)}
          className="min-h-8 rounded-xl border border-white/8 bg-white/[0.03] px-3 text-[11px] text-white/78 hover:border-white/12 hover:bg-white/[0.05] hover:text-white"
        >
          <svg viewBox="0 0 16 16" className="mr-1.5 h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 3.5 5.5 8 10 12.5" />
          </svg>
          {t('customers.detail.back_to', 'Back to {{title}}', { title })}
        </Button>
      </div>

      <CustomerDetailContent customer={detailQuery.data} audioSource={audioSource} />
    </section>
  )
}
