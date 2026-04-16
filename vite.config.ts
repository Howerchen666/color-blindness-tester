import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? ''
const isGitHubPagesUserSite = repoName.toLowerCase().endsWith('.github.io')
const githubPagesBase =
  repoName && !isGitHubPagesUserSite ? `/${repoName}/` : '/'

// https://vite.dev/config/
export default defineConfig({
  // In GitHub Actions, build with repo-aware base for project pages.
  base: process.env.GITHUB_ACTIONS === 'true' ? githubPagesBase : '/',
  plugins: [react()],
  test: {
    environment: 'node',
  },
})
