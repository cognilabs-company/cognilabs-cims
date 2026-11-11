import {
  CalendarBlankIcon,
  CalendarDotsIcon,
  CaretCircleDownIcon,
  CheckSquareIcon,
  EnvelopeSimpleIcon,
  HashIcon,
  ImageIcon,
  ListChecksIcon,
  PaperclipIcon,
  PasswordIcon,
  PhoneIcon,
  RadioButtonIcon,
  TextAlignLeftIcon,
  TextTIcon,
  type Icon,
} from '@phosphor-icons/react'
import {
  REGISTRATION_BASE_FIELDS,
  REGISTRATION_MAX_FILE_BYTES,
  REGISTRATION_MAX_TOTAL_BYTES,
  type RegistrationField,
  type RegistrationFieldType,
  type RegistrationStatus,
} from '../../../shared/api/services/registrations.service'
import type { TranslationParams } from '../../../shared/i18n/translations'
import type { FieldIssue } from './fields'
import { formatBytes, type ValueIssue } from './values'

/* Translated labels for types, statuses and validation messages (literal keys, so they can be extracted). */

export type Translate = (key: string, fallback?: string, params?: TranslationParams) => string

export const FIELD_TYPE_ICONS: Record<RegistrationFieldType, Icon> = {
  text: TextTIcon,
  textarea: TextAlignLeftIcon,
  email: EnvelopeSimpleIcon,
  phone: PhoneIcon,
  number: HashIcon,
  date: CalendarBlankIcon,
  datetime: CalendarDotsIcon,
  select: CaretCircleDownIcon,
  multi_select: ListChecksIcon,
  radio: RadioButtonIcon,
  checkbox: CheckSquareIcon,
  file: PaperclipIcon,
  image: ImageIcon,
  password: PasswordIcon,
}

export function typeLabel(t: Translate, type: RegistrationFieldType) {
  switch (type) {
    case 'text': return t('registrations.type.text', 'Short text')
    case 'textarea': return t('registrations.type.textarea', 'Long text')
    case 'email': return t('registrations.type.email', 'Email')
    case 'phone': return t('registrations.type.phone', 'Phone')
    case 'number': return t('registrations.type.number', 'Number')
    case 'date': return t('registrations.type.date', 'Date')
    case 'datetime': return t('registrations.type.datetime', 'Date and time')
    case 'select': return t('registrations.type.select', 'Dropdown')
    case 'multi_select': return t('registrations.type.multi_select', 'Multiple choice')
    case 'radio': return t('registrations.type.radio', 'Single choice')
    case 'checkbox': return t('registrations.type.checkbox', 'Checkbox')
    case 'file': return t('registrations.type.file', 'File')
    case 'image': return t('registrations.type.image', 'Image')
    case 'password': return t('registrations.type.password', 'Password')
  }
}

export function typeHint(t: Translate, type: RegistrationFieldType) {
  switch (type) {
    case 'text': return t('registrations.type_hint.text', 'One line')
    case 'textarea': return t('registrations.type_hint.textarea', 'Several lines')
    case 'email': return t('registrations.type_hint.email', 'Checked format')
    case 'phone': return t('registrations.type_hint.phone', 'Phone keypad')
    case 'number': return t('registrations.type_hint.number', 'Digits only')
    case 'date': return t('registrations.type_hint.date', 'Calendar')
    case 'datetime': return t('registrations.type_hint.datetime', 'Calendar + time')
    case 'select': return t('registrations.type_hint.select', 'One from a list')
    case 'multi_select': return t('registrations.type_hint.multi_select', 'Several from a list')
    case 'radio': return t('registrations.type_hint.radio', 'One, all visible')
    case 'checkbox': return t('registrations.type_hint.checkbox', 'Yes / no, consent')
    case 'file': return t('registrations.type_hint.file', 'Documents')
    case 'image': return t('registrations.type_hint.image', 'Photos with preview')
    case 'password': return t('registrations.type_hint.password', 'Hidden input')
  }
}

export function statusLabel(t: Translate, status: RegistrationStatus) {
  switch (status) {
    case 'pending': return t('registrations.status.pending', 'Pending')
    case 'approved': return t('registrations.status.approved', 'Approved')
    case 'rejected': return t('registrations.status.rejected', 'Rejected')
  }
}

const BASE_DEFAULT_LABELS = new Map<string, string>(REGISTRATION_BASE_FIELDS.map((field) => [field.key, field.label]))

/** The four required fields keep their default English label → shown in the current language. */
export function fieldLabel(t: Translate, field: Pick<RegistrationField, 'key' | 'label'>) {
  const isDefault = BASE_DEFAULT_LABELS.get(field.key)?.toLowerCase() === field.label.trim().toLowerCase()
  if (!isDefault) return field.label
  switch (field.key) {
    case 'email': return t('registrations.base.email', 'Email')
    case 'name': return t('registrations.base.name', 'Name')
    case 'surname': return t('registrations.base.surname', 'Surname')
    case 'password': return t('registrations.base.password', 'Password')
    default: return field.label
  }
}

export function fieldIssueMessage(t: Translate, issue: FieldIssue) {
  switch (issue) {
    case 'label_required': return t('registrations.builder.error.label_required', 'Enter a label')
    case 'key_invalid': return t('registrations.builder.error.key_invalid', 'Latin lower-case letters, digits and "_"; starts with a letter (max 64)')
    case 'key_duplicate': return t('registrations.builder.error.key_duplicate', 'Another field already uses this key')
    case 'options_required': return t('registrations.builder.error.options_required', 'Add at least one option')
    case 'option_empty': return t('registrations.builder.error.option_empty', 'Options cannot be empty')
    case 'option_duplicate': return t('registrations.builder.error.option_duplicate', 'Options must be different')
  }
}

export function valueIssueMessage(t: Translate, issue: ValueIssue) {
  switch (issue.code) {
    case 'required': return t('registrations.form.error.required', 'This field is required')
    case 'email': return t('registrations.form.error.email', 'Enter a valid email address')
    case 'phone': return t('registrations.form.error.phone', 'Enter a valid phone number')
    case 'number': return t('registrations.form.error.number', 'Enter a number')
    case 'option': return t('registrations.form.error.option', 'Choose one of the options')
    case 'accept': return t('registrations.form.error.accept', '“{{name}}” is not an allowed file type', { name: issue.name })
    case 'file_size': return t('registrations.form.error.file_size', '“{{name}}” is larger than {{size}}', { name: issue.name, size: formatBytes(REGISTRATION_MAX_FILE_BYTES) })
    case 'server': return issue.message
  }
}

export function totalLimitMessage(t: Translate) {
  return t('registrations.form.error.total_size', 'All files together must be under {{size}}', { size: formatBytes(REGISTRATION_MAX_TOTAL_BYTES) })
}
