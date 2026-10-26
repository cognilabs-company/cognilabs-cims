import { request } from '../http'
import type {
  ManagementImageCategory,
  ManagementImageBulkDeletePayload,
  ManagementImageCleanupResponse,
  ManagementImageRecord,
  ManagementImagesListResponse,
  ManagementPageCreatePayload,
  ManagementPageRecord,
  ManagementPageUpdatePayload,
  ManagementRoleCreatePayload,
  ManagementRoleRecord,
  ManagementRoleUpdatePayload,
  ManagementStatusCreatePayload,
  ManagementStatusRecord,
  ManagementStatusUpdatePayload,
} from '../types'

export const managementService = {
  listPages() {
    return request<ManagementPageRecord[]>({
      path: '/management/pages',
    })
  },

  createPage(payload: ManagementPageCreatePayload) {
    return request<ManagementPageRecord>({
      path: '/management/pages',
      method: 'POST',
      body: payload,
    })
  },

  updatePage(pageId: number, payload: ManagementPageUpdatePayload) {
    return request<ManagementPageRecord>({
      path: `/management/pages/${pageId}`,
      method: 'PATCH',
      body: payload,
    })
  },

  deletePage(pageId: number) {
    return request<string>({
      path: `/management/pages/${pageId}`,
      method: 'DELETE',
    })
  },

  listImages(filters?: {
    category?: ManagementImageCategory
    referenced_only?: boolean
    unreferenced_only?: boolean
  }) {
    return request<ManagementImagesListResponse>({
      path: '/management/images',
      query: {
        category: filters?.category,
        referenced_only: filters?.referenced_only ?? false,
        unreferenced_only: filters?.unreferenced_only ?? false,
      },
    })
  },

  getImageDetail(imagePath: string) {
    return request<ManagementImageRecord>({
      path: '/management/images/detail',
      query: {
        image_path: imagePath,
      },
    })
  },

  deleteImage(imagePath: string) {
    return request<ManagementImageCleanupResponse>({
      path: '/management/images',
      method: 'DELETE',
      query: {
        image_path: imagePath,
      },
    })
  },

  bulkDeleteImages(payload: ManagementImageBulkDeletePayload) {
    return request<ManagementImageCleanupResponse>({
      path: '/management/images/bulk-delete',
      method: 'POST',
      body: payload,
    })
  },

  listStatuses() {
    return request<ManagementStatusRecord[]>({
      path: '/management/statuses',
    })
  },

  createStatus(payload: ManagementStatusCreatePayload) {
    return request<ManagementStatusRecord>({
      path: '/management/statuses',
      method: 'POST',
      body: payload,
    })
  },

  updateStatus(statusId: number, payload: ManagementStatusUpdatePayload) {
    return request<ManagementStatusRecord>({
      path: `/management/statuses/${statusId}`,
      method: 'PATCH',
      body: payload,
    })
  },

  deleteStatus(statusId: number) {
    return request<string>({
      path: `/management/statuses/${statusId}`,
      method: 'DELETE',
    })
  },

  listRoles() {
    return request<ManagementRoleRecord[]>({
      path: '/management/roles',
    })
  },

  createRole(payload: ManagementRoleCreatePayload) {
    return request<ManagementRoleRecord>({
      path: '/management/roles',
      method: 'POST',
      body: payload,
    })
  },

  updateRole(roleId: number, payload: ManagementRoleUpdatePayload) {
    return request<ManagementRoleRecord>({
      path: `/management/roles/${roleId}`,
      method: 'PATCH',
      body: payload,
    })
  },

  deleteRole(roleId: number) {
    return request<string>({
      path: `/management/roles/${roleId}`,
      method: 'DELETE',
    })
  },
}
