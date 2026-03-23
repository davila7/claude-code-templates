import type { APIRoute } from 'astro';

// Mock featured showcase
const MOCK_FEATURED = {
  id: '1',
  title: 'Automated Testing Workflow with Vitest',
  description: 'A comprehensive testing workflow that integrates Vitest with GitHub Actions',
  submissionType: 'workflow',
  category: 'testing',
  tags: ['testing', 'automation', 'vitest'],
  viewCount: 245,
  likeCount: 32,
  tryCount: 45,
  authorName: 'John Doe',
  authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
  featuredAt: new Date().toISOString(),
  createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
};

// Mock Component of the Week
const MOCK_COTW = {
  id: 'cotw-1',
  componentType: 'agent',
  componentPath: '.claude/agents/frontend-developer.md',
  componentName: 'Frontend Developer Agent',
  weekStartDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  weekEndDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  spotlightTitle: 'Frontend Developer Agent: Your AI Pair Programmer',
  spotlightDescription: 'Discover how the Frontend Developer Agent can accelerate your development workflow',
  spotlightContent: '# Deep Dive: Frontend Developer Agent\n\nThe Frontend Developer Agent is designed to help you build modern web applications faster...',
  featuredShowcaseIds: ['1'],
  usageStats: { downloads: 150, installations: 89, stars: 45 },
  publishedAt: new Date().toISOString(),
};

export const GET: APIRoute = async () => {
  try {
    return new Response(
      JSON.stringify({
        featured: [MOCK_FEATURED],
        componentOfWeek: MOCK_COTW,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in featured API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
