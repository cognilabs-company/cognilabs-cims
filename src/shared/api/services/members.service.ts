import { request } from '../http'
import type {
  MemberCompensationPolicyResponse,
  MemberDeliveryBonusPayload,
  MemberMistakePayload,
  SimpleBonusPayload,
  SimplePenaltyPayload,
} from '../types'

function serializeEmployeeIds(employeeIds?: number[]) {
  if (!employeeIds || employeeIds.length === 0) {
    return undefined
  }

  return employeeIds.join(',')
}

export type MemberSalaryEstimateParams = {
  year: number
  month: number
  employeeIds?: number[]
}

export type MemberMistakeListParams = {
  year?: number
  month?: number
  employeeId?: number
  reviewerId?: number
}

export type MemberDeliveryBonusListParams = {
  year?: number
  month?: number
  employeeId?: number
}

export type MemberCompensationPolicyParams = {
  employeeIds?: number[]
}

export type SimpleBonusPenaltyListParams = {
  user_id?: number
  year?: number
  month?: number
}

export type AddMemberUpdatePayload = {
  userId: number
  year: number
  month: string
  updatePercentage: number
  salaryAmount: number
  nextPaymentDate: string
  note: string
}

export type PutMemberUpdatePayload = {
  year: number
  month: string
  updatePercentage: number
  salaryAmount: number
  nextPaymentDate: string
  note: string
}

export type PatchMemberUpdatePayload = {
  updatePercentage?: number
  salaryAmount?: number
  nextPaymentDate?: string
  note?: string
}

export const membersService = {
  salaryEstimate(userId: number, year: number, month: number) {
    return request<unknown>({
      path: '/members/member/salary-estimate',
      query: {
        employee_id: userId,
        year,
        month,
      },
    })
  },

  mySalaryEstimate(year: number, month: number) {
    return request<unknown>({
      path: '/members/member/my-salary-estimate',
      query: {
        year,
        month,
      },
    })
  },

  salaryEstimates({ year, month, employeeIds }: MemberSalaryEstimateParams) {
    return request<unknown>({
      path: '/members/member/salary-estimates',
      query: {
        year,
        month,
        employee_ids: serializeEmployeeIds(employeeIds),
      },
    })
  },

  compensationPolicy(params?: MemberCompensationPolicyParams) {
    return request<MemberCompensationPolicyResponse>({
      path: '/members/compensation/policy',
      query: {
        employee_ids: serializeEmployeeIds(params?.employeeIds),
      },
    })
  },

  listMistakes(params?: MemberMistakeListParams) {
    return request<unknown>({
      path: '/members/member/mistakes',
      query: {
        year: params?.year,
        month: params?.month,
        employee_id: params?.employeeId,
        reviewer_id: params?.reviewerId,
      },
    })
  },

  createMistake(payload: MemberMistakePayload) {
    return request<unknown>({
      path: '/members/member/mistakes',
      method: 'POST',
      body: payload,
    })
  },

  updateMistake(mistakeId: number, payload: MemberMistakePayload) {
    return request<unknown>({
      path: `/members/member/mistakes/${mistakeId}`,
      method: 'PATCH',
      body: payload,
    })
  },

  deleteMistake(mistakeId: number) {
    return request<unknown>({
      path: `/members/member/mistakes/${mistakeId}`,
      method: 'DELETE',
    })
  },

  listDeliveryBonuses(params?: MemberDeliveryBonusListParams) {
    return request<unknown>({
      path: '/members/member/delivery-bonuses',
      query: {
        year: params?.year,
        month: params?.month,
        employee_id: params?.employeeId,
      },
    })
  },

  createDeliveryBonus(payload: MemberDeliveryBonusPayload) {
    return request<unknown>({
      path: '/members/member/delivery-bonuses',
      method: 'POST',
      body: payload,
    })
  },

  updateDeliveryBonus(bonusId: number, payload: MemberDeliveryBonusPayload) {
    return request<unknown>({
      path: `/members/member/delivery-bonuses/${bonusId}`,
      method: 'PATCH',
      body: payload,
    })
  },

  deleteDeliveryBonus(bonusId: number) {
    return request<unknown>({
      path: `/members/member/delivery-bonuses/${bonusId}`,
      method: 'DELETE',
    })
  },

  updatesStatistics(params?: {
    year?: number
    month?: number
    employeeIds?: number[]
  }) {
    return request<unknown>({
      path: '/members/member/updates/statistics',
      query: {
        year: params?.year,
        month: params?.month,
        employee_ids: serializeEmployeeIds(params?.employeeIds),
      },
    })
  },

  updatesAll(params?: {
    year?: number
    month?: number
    employeeIds?: number[]
  }) {
    return request<unknown>({
      path: '/members/member/updates/all',
      query: {
        year: params?.year,
        month: params?.month,
        employee_ids: serializeEmployeeIds(params?.employeeIds),
      },
    })
  },

  addMemberUpdate({ userId, year, month, updatePercentage, salaryAmount, nextPaymentDate, note }: AddMemberUpdatePayload) {
    return request<unknown>({
      path: '/members/member/update',
      method: 'POST',
      query: {
        user_id: userId,
        year,
        month,
        update_percentage: updatePercentage,
        salary_amount: salaryAmount,
        next_payment_date: nextPaymentDate,
        note,
      },
    })
  },

  getMyUpdates() {
    return request<unknown>({
      path: '/members/member/updates',
    })
  },

  putMemberUpdate(updateId: number, { year, month, updatePercentage, salaryAmount, nextPaymentDate, note }: PutMemberUpdatePayload) {
    return request<unknown>({
      path: `/members/member/update/${updateId}`,
      method: 'PATCH',
      query: {
        year,
        month,
        update_percentage: updatePercentage,
        salary_amount: salaryAmount,
        next_payment_date: nextPaymentDate,
        note,
      },
    })
  },

  patchMemberUpdate(updateId: number, payload: PatchMemberUpdatePayload) {
    return request<unknown>({
      path: `/members/member/update/${updateId}`,
      method: 'PATCH',
      query: {
        update_percentage: payload.updatePercentage,
        salary_amount: payload.salaryAmount,
        next_payment_date: payload.nextPaymentDate,
        note: payload.note,
      },
    })
  },

  deleteMemberUpdate(updateId: number) {
    return request<unknown>({
      path: `/members/member/update/${updateId}`,
      method: 'DELETE',
    })
  },

  listSimpleBonuses(params?: SimpleBonusPenaltyListParams) {
    return request<unknown>({
      path: '/members/member/simple-bonuses',
      query: {
        user_id: params?.user_id,
        year: params?.year,
        month: params?.month,
      },
    })
  },

  createSimpleBonus(payload: SimpleBonusPayload) {
    return request<unknown>({
      path: '/members/member/simple-bonus',
      method: 'POST',
      body: payload,
    })
  },

  deleteSimpleBonus(bonusId: number) {
    return request<unknown>({
      path: `/members/member/simple-bonus/${bonusId}`,
      method: 'DELETE',
    })
  },

  listSimplePenalties(params?: SimpleBonusPenaltyListParams) {
    return request<unknown>({
      path: '/members/member/simple-penalties',
      query: {
        user_id: params?.user_id,
        year: params?.year,
        month: params?.month,
      },
    })
  },

  createSimplePenalty(payload: SimplePenaltyPayload) {
    return request<unknown>({
      path: '/members/member/simple-penalty',
      method: 'POST',
      body: payload,
    })
  },

  deleteSimplePenalty(penaltyId: number) {
    return request<unknown>({
      path: `/members/member/simple-penalty/${penaltyId}`,
      method: 'DELETE',
    })
  },
}
