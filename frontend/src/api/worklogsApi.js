import client from './client'

export const worklogsApi = {
  getProjectWorklogs: (projectId, weeks = 4) =>
    client.get(`/projects/${projectId}/worklogs`, { params: { weeks } }),
}
