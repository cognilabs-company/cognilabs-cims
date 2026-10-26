import { request } from '../http'
import type { CurrentUser, SuccessResponse, TokenResponse, UserRole } from '../types'

export type RegisterPayload = {
  email: string
  name: string
  surname: string
  password: string
  company_code: string
  telegram_id?: string
  role: UserRole
  job_title?: string
}

export type VerifyEmailPayload = {
  email: string
  code: string
}

export type LoginPayload = {
  username: string
  password: string
  scope?: string
  client_id?: string
  client_secret?: string
}

export type ResetPasswordPayload = {
  email: string
  code: string
  new_password: string
}

export type UpdateMyProfileInfoPayload = {
  name: string
  surname: string
}

export type UpdateMyPasswordPayload = {
  current_password: string
  new_password: string
}

export type UpdateMyProfilePayload = {
  name?: string | null
  surname?: string | null
  current_password?: string | null
  new_password?: string | null
  image?: File | null
}

export const authService = {
  register(payload: RegisterPayload) {
    return request<SuccessResponse>({
      path: '/auth/register',
      method: 'POST',
      body: payload,
      auth: false,
    })
  },

  verifyEmail(payload: VerifyEmailPayload) {
    return request<TokenResponse>({
      path: '/auth/verify-email',
      method: 'POST',
      body: payload,
      auth: false,
    })
  },

  resendVerification(email: string) {
    return request<SuccessResponse>({
      path: '/auth/resend-verification',
      method: 'POST',
      body: { email },
      auth: false,
    })
  },

  login(payload: LoginPayload) {
    const body = new URLSearchParams({
      username: payload.username,
      password: payload.password,
      grant_type: 'password',
      scope: payload.scope ?? '',
      client_id: payload.client_id ?? '',
      client_secret: payload.client_secret ?? '',
    })

    return request<TokenResponse>({
      path: '/auth/login',
      method: 'POST',
      body: body.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      auth: false,
    })
  },

  forgotPassword(email: string) {
    return request<SuccessResponse>({
      path: '/auth/forgot-password',
      method: 'POST',
      body: { email },
      auth: false,
    })
  },

  resetPassword(payload: ResetPasswordPayload) {
    return request<SuccessResponse>({
      path: '/auth/reset-password',
      method: 'POST',
      body: payload,
      auth: false,
    })
  },

  me() {
    return request<CurrentUser>({
      path: '/auth/me',
    })
  },

  updateProfileImage(image: File) {
    const formData = new FormData()
    formData.append('image', image)

    return request<SuccessResponse>({
      path: '/auth/me/profile-image',
      method: 'POST',
      body: formData,
    })
  },

  updateProfileInfo(payload: UpdateMyProfileInfoPayload) {
    return request<SuccessResponse>({
      path: '/auth/me/profile-info',
      method: 'PATCH',
      body: payload,
    })
  },

  updatePassword(payload: UpdateMyPasswordPayload) {
    return request<SuccessResponse>({
      path: '/auth/me/password',
      method: 'PATCH',
      body: payload,
    })
  },

  updateProfile(payload: UpdateMyProfilePayload) {
    const formData = new FormData()

    if (typeof payload.name === 'string') {
      formData.append('name', payload.name)
    }

    if (typeof payload.surname === 'string') {
      formData.append('surname', payload.surname)
    }

    if (typeof payload.current_password === 'string' && payload.current_password.length > 0) {
      formData.append('current_password', payload.current_password)
    }

    if (typeof payload.new_password === 'string' && payload.new_password.length > 0) {
      formData.append('new_password', payload.new_password)
    }

    if (payload.image instanceof File) {
      formData.append('image', payload.image)
    }

    return request<SuccessResponse>({
      path: '/auth/me/profile',
      method: 'PATCH',
      body: formData,
    })
  },

  refresh(refreshToken: string) {
    return request<TokenResponse>({
      path: '/auth/refresh',
      method: 'POST',
      body: { refresh_token: refreshToken },
      auth: false,
    })
  },

  logout(refreshToken: string) {
    return request<SuccessResponse>({
      path: '/auth/logout',
      method: 'POST',
      body: { refresh_token: refreshToken },
    })
  },

  logoutAll() {
    return request<SuccessResponse>({
      path: '/auth/logout-all',
      method: 'POST',
    })
  },

  dashboardRedirect() {
    return request<{ redirect_url: string }>({
      path: '/auth/dashboard-redirect',
    })
  },
}
