import type { RegisterPayload } from '../../../shared/api/services/auth.service'
import { translateCurrent } from '../../../shared/i18n/translations'
import type { FieldErrors } from './formErrors'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function requireValue(value: string, message: string) {
  return value.trim() ? '' : message
}

function validateEmail(email: string) {
  if (!email.trim()) {
    return translateCurrent('auth.validation.email_required', 'Email is required.')
  }

  if (!emailRegex.test(email.trim())) {
    return translateCurrent('auth.validation.email_invalid', 'Email format is invalid.')
  }

  return ''
}

function validatePassword(password: string) {
  if (!password.trim()) {
    return translateCurrent('auth.validation.password_required', 'Password is required.')
  }

  if (password.length < 6) {
    return translateCurrent('auth.validation.password_short', 'Password must be at least 6 characters.')
  }

  return ''
}

export function validateLogin(values: { username: string; password: string }) {
  const errors: FieldErrors = {}

  const emailError = validateEmail(values.username)
  const passwordError = validatePassword(values.password)

  if (emailError) {
    errors.username = emailError
  }

  if (passwordError) {
    errors.password = passwordError
  }

  return errors
}

export function validateRegister(values: RegisterPayload) {
  const errors: FieldErrors = {}

  const emailError = validateEmail(values.email)
  const nameError = requireValue(values.name, translateCurrent('auth.validation.name_required', 'Name is required.'))
  const surnameError = requireValue(values.surname, translateCurrent('auth.validation.surname_required', 'Surname is required.'))
  const passwordError = validatePassword(values.password)
  const companyCodeError = requireValue(values.company_code, translateCurrent('auth.validation.company_code_required', 'Company code is required.'))

  if (emailError) {
    errors.email = emailError
  }

  if (nameError) {
    errors.name = nameError
  }

  if (surnameError) {
    errors.surname = surnameError
  }

  if (passwordError) {
    errors.password = passwordError
  }

  if (companyCodeError) {
    errors.company_code = companyCodeError
  }

  return errors
}

export function validateVerification(values: { email: string; code: string }) {
  const errors: FieldErrors = {}

  const emailError = validateEmail(values.email)
  const codeError = requireValue(values.code, translateCurrent('auth.validation.verification_code_required', 'Verification code is required.'))

  if (emailError) {
    errors.email = emailError
  }

  if (codeError) {
    errors.code = codeError
  }

  return errors
}

export function validateEmailOnly(email: string) {
  const emailError = validateEmail(email)
  const errors: FieldErrors = {}

  if (emailError) {
    errors.email = emailError
  }

  return errors
}

export function validateResetPassword(values: {
  email: string
  code: string
  new_password: string
  confirm_password: string
}) {
  const errors: FieldErrors = {}

  const emailError = validateEmail(values.email)
  const codeError = requireValue(values.code, translateCurrent('auth.validation.reset_code_required', 'Reset code is required.'))
  const passwordError = validatePassword(values.new_password)

  if (emailError) {
    errors.email = emailError
  }

  if (codeError) {
    errors.code = codeError
  }

  if (passwordError) {
    errors.new_password = passwordError
  }

  if (!values.confirm_password.trim()) {
    errors.confirm_password = translateCurrent('auth.validation.confirm_password_required', 'Password confirmation is required.')
  } else if (values.confirm_password !== values.new_password) {
    errors.confirm_password = translateCurrent('auth.validation.passwords_mismatch', 'Passwords do not match.')
  }

  return errors
}
