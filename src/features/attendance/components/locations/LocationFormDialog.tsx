import { useState, type ReactNode } from 'react'
import { CrosshairIcon, MapPinIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../../app/hooks/useLocale'
import { attendanceLocationsService, type AttendanceLocation } from '../../../../shared/api/services/attendanceLocations.service'
import { getApiErrorMessage } from '../../../../shared/lib/api-error'
import { cn } from '../../../../shared/lib/cn'
import { useToast } from '../../../../shared/toast/useToast'
import { Button } from '../../../../shared/ui/button'
import { Dialog } from '../../../../shared/ui/dialog'
import { Input } from '../../../../shared/ui/input'
import { Label } from '../../../../shared/ui/label'
import { Switch } from '../../../../shared/ui/switch'
import {
  changedFields,
  geolocationErrorMessage,
  MAX_RADIUS,
  MIN_RADIUS,
  parseNumber,
  roundCoordinate,
  toFormValues,
  validateLocationForm,
  type LocationFormField,
  type LocationFormValues,
} from '../../lib/locations'
import { LocationPickerMap } from './LocationPickerMap'

type LocationFormDialogProps = {
  /** null → create. */
  location: AttendanceLocation | null
  onClose: () => void
  onSaved: () => void
}

/** Create / edit one location. Mount it only while open, so the form starts from `location` every time. */
export function LocationFormDialog({ location, onClose, onSaved }: LocationFormDialogProps) {
  const { t } = useLocale()
  const { showToast } = useToast()
  const [values, setValues] = useState<LocationFormValues>(() => toFormValues(location))
  const [touched, setTouched] = useState<Partial<Record<LocationFormField, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)

  const { errors, payload } = validateLocationForm(values, t)
  const errorFor = (field: LocationFormField) => (submitted || touched[field] ? errors[field] : undefined)
  const latitude = parseNumber(values.latitude)
  const longitude = parseNumber(values.longitude)
  const radius = parseNumber(values.radius)

  function update<K extends keyof LocationFormValues>(key: K, value: LocationFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function setPoint(nextLatitude: number, nextLongitude: number) {
    setValues((current) => ({ ...current, latitude: String(nextLatitude), longitude: String(nextLongitude) }))
    setTouched((current) => ({ ...current, latitude: true, longitude: true }))
  }

  function close() {
    if (!saving) onClose()
  }

  function locateMe() {
    if (!('geolocation' in navigator)) {
      showToast({ title: t('attendance.loc.geo_unsupported', 'This browser cannot share your location.'), tone: 'error' })
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false)
        setPoint(roundCoordinate(position.coords.latitude), roundCoordinate(position.coords.longitude))
        showToast({
          title: t('attendance.loc.geo_found', 'Point set to your location'),
          description: t('attendance.loc.geo_accuracy', 'Accuracy about {{meters}} m.', { meters: Math.round(position.coords.accuracy) }),
          tone: 'info',
        })
      },
      (error) => {
        setLocating(false)
        showToast({ title: geolocationErrorMessage(error, t), tone: 'error' })
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    )
  }

  async function submit() {
    setSubmitted(true)
    if (!payload) return
    setSaving(true)
    try {
      if (location) {
        const patch = changedFields(location, payload)
        if (Object.keys(patch).length > 0) {
          await attendanceLocationsService.updateLocation(location.id, patch)
          showToast({ title: t('attendance.loc.toast_updated', 'Location updated'), tone: 'success' })
        }
      } else {
        await attendanceLocationsService.createLocation(payload)
        showToast({ title: t('attendance.loc.toast_created', 'Location added'), tone: 'success' })
      }
      setSaving(false)
      onSaved()
    } catch (error) {
      setSaving(false)
      showToast({ title: t('attendance.loc.toast_save_failed', 'Could not save the location'), description: getApiErrorMessage(error), tone: 'error' })
    }
  }

  return (
    <Dialog
      open
      onClose={close}
      size="lg"
      headerIcon={<MapPinIcon weight="duotone" />}
      title={location ? t('attendance.loc.edit_title', 'Edit location') : t('attendance.loc.add_title', 'Add location')}
      description={t('attendance.loc.form_description', 'Employees can check in only inside this circle.')}
      footer={(
        <>
          <Button variant="ghost" onClick={close} disabled={saving}>{t('attendance.loc.cancel', 'Cancel')}</Button>
          <Button onClick={() => void submit()} loading={saving}>{location ? t('attendance.loc.save', 'Save') : t('attendance.loc.add', 'Add location')}</Button>
        </>
      )}
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <Field label={t('attendance.loc.field_name', 'Name')} htmlFor="location-name" error={errorFor('name')}>
          <Input
            id="location-name"
            value={values.name}
            maxLength={255}
            onChange={(event) => update('name', event.target.value)}
            onBlur={() => setTouched((current) => ({ ...current, name: true }))}
            placeholder={t('attendance.loc.name_placeholder', 'Cognilabs Office')}
            aria-invalid={Boolean(errorFor('name'))}
            className={cn(errorFor('name') && 'ring-1 ring-[var(--danger-text)]/50')}
          />
        </Field>

        <Field label={t('attendance.loc.field_address', 'Address')} htmlFor="location-address" optional={t('attendance.loc.optional', 'optional')}>
          <Input
            id="location-address"
            value={values.address}
            maxLength={1000}
            onChange={(event) => update('address', event.target.value)}
            placeholder={t('attendance.loc.address_placeholder', 'Street, building')}
          />
        </Field>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12.5px] text-[var(--muted)]">{t('attendance.loc.map_hint', 'Click the map or drag the pin to set the point.')}</p>
            <Button type="button" variant="secondary" size="sm" loading={locating} leftIcon={<CrosshairIcon size={15} weight="duotone" />} onClick={locateMe}>
              {t('attendance.loc.use_my_location', 'Use my location')}
            </Button>
          </div>
          <LocationPickerMap
            latitude={latitude}
            longitude={longitude}
            radius={radius}
            onPick={setPoint}
            ariaLabel={t('attendance.loc.picker_label', 'Map: click to set the location point')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('attendance.loc.field_latitude', 'Latitude')} htmlFor="location-latitude" error={errorFor('latitude')}>
            <Input
              id="location-latitude"
              inputMode="decimal"
              value={values.latitude}
              onChange={(event) => update('latitude', event.target.value)}
              onBlur={() => setTouched((current) => ({ ...current, latitude: true }))}
              placeholder="41.311081"
              aria-invalid={Boolean(errorFor('latitude'))}
              className={cn('tabular-nums', errorFor('latitude') && 'ring-1 ring-[var(--danger-text)]/50')}
            />
          </Field>
          <Field label={t('attendance.loc.field_longitude', 'Longitude')} htmlFor="location-longitude" error={errorFor('longitude')}>
            <Input
              id="location-longitude"
              inputMode="decimal"
              value={values.longitude}
              onChange={(event) => update('longitude', event.target.value)}
              onBlur={() => setTouched((current) => ({ ...current, longitude: true }))}
              placeholder="69.240562"
              aria-invalid={Boolean(errorFor('longitude'))}
              className={cn('tabular-nums', errorFor('longitude') && 'ring-1 ring-[var(--danger-text)]/50')}
            />
          </Field>
          <Field label={t('attendance.loc.field_radius', 'Radius (m)')} htmlFor="location-radius" error={errorFor('radius')}>
            <Input
              id="location-radius"
              type="number"
              inputMode="numeric"
              min={MIN_RADIUS}
              max={MAX_RADIUS}
              step={5}
              value={values.radius}
              onChange={(event) => update('radius', event.target.value)}
              onBlur={() => setTouched((current) => ({ ...current, radius: true }))}
              aria-invalid={Boolean(errorFor('radius'))}
              className={cn('tabular-nums', errorFor('radius') && 'ring-1 ring-[var(--danger-text)]/50')}
            />
          </Field>
          <div className="flex flex-col gap-2">
            <Label>{t('attendance.loc.field_active', 'Status')}</Label>
            <div className="flex min-h-10 items-center justify-between gap-3 rounded-[10px] bg-[var(--input-surface)] px-3">
              <span className="text-[13.5px] text-[var(--foreground)]">
                {values.isActive ? t('attendance.loc.active', 'Active') : t('attendance.loc.inactive', 'Inactive')}
              </span>
              <Switch checked={values.isActive} onChange={(checked) => update('isActive', checked)} label={t('attendance.loc.field_active_label', 'Location is active')} />
            </div>
          </div>
        </div>
        {/* Enter in a field submits the form. */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Dialog>
  )
}

function Field({ label, htmlFor, error, optional, children }: { label: string; htmlFor: string; error?: string; optional?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>
        {label}
        {optional ? <span className="ml-1 font-normal text-[var(--caption)]">({optional})</span> : null}
      </Label>
      {children}
      {error ? <p className="text-[12px] leading-snug text-[var(--danger-text)]">{error}</p> : null}
    </div>
  )
}
