import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import { resolve, join, sep as pathSep } from 'node:path';

export const GET: APIRoute = async ({ params }) => {
  const { teamSlug, path } = params;
  
  if (!teamSlug || !path) {
    return new Response('Missing parameters', { status: 400 });
  }

  try {
    // Construct the file path - check both templates and components/agents folders
    let basePath = resolve('../cli-tool/templates');
    let filePath = join(basePath, teamSlug, path);
    
    // If not found in templates, try components/agents
    try {
      await readFile(filePath, 'utf-8');
    } catch (error: any) {
      // Only fallback on ENOENT (file not found), surface other errors
      if (error.code !== 'ENOENT') {
        throw error;
      }
      basePath = resolve('../cli-tool/components/agents/development-tools');
      filePath = join(basePath, teamSlug, path);
    }
    
    // Security check: ensure the path is within the allowed directory
    // Use path.sep to enforce directory boundaries and prevent sibling path attacks
    const templatesPath = resolve('../cli-tool/templates') + pathSep;
    const componentsPath = resolve('../cli-tool/components/agents/development-tools') + pathSep;
    const normalizedPath = filePath + pathSep;
    if (!normalizedPath.startsWith(templatesPath) && !normalizedPath.startsWith(componentsPath)) {
      return new Response('Invalid path', { status: 403 });
    }

    // Read the file
    const content = await readFile(filePath, 'utf-8');
    
    // Determine content type
    let contentType = 'text/plain';
    if (path.endsWith('.md')) {
      contentType = 'text/markdown';
    } else if (path.endsWith('.yaml') || path.endsWith('.yml')) {
      contentType = 'text/yaml';
    } else if (path.endsWith('.json')) {
      contentType = 'application/json';
    } else if (path.endsWith('.ts') || path.endsWith('.js')) {
      contentType = 'text/javascript';
    } else if (path.endsWith('.sql')) {
      contentType = 'text/sql';
    }

    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error reading file:', error);
    return new Response('File not found', { status: 404 });
  }
};

export const prerender = false;
