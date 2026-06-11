import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import { resolve, join, sep as pathSep } from 'node:path';

export const GET: APIRoute = async ({ params }) => {
  const { teamSlug, path } = params;
  
  if (!teamSlug || !path) {
    return new Response('Missing parameters', { status: 400 });
  }

  try {
    // Security check FIRST: validate paths before any filesystem operations
    const templatesPath = resolve('../cli-tool/templates') + pathSep;
    const componentsPath = resolve('../cli-tool/components/agents/development-tools') + pathSep;
    
    // Try templates path first
    let basePath = resolve('../cli-tool/templates');
    let filePath = join(basePath, teamSlug, path);
    let normalizedPath = filePath + pathSep;
    
    // Validate templates path
    let isValid = normalizedPath.startsWith(templatesPath);
    
    if (!isValid) {
      return new Response('Invalid path', { status: 403 });
    }

    // Try to read from templates first
    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch (error: any) {
      // If file not found in templates, try components path as fallback
      if (error.code === 'ENOENT') {
        basePath = resolve('../cli-tool/components/agents/development-tools');
        filePath = join(basePath, teamSlug, path);
        normalizedPath = filePath + pathSep;
        
        // Validate components path
        isValid = normalizedPath.startsWith(componentsPath);
        
        if (!isValid) {
          return new Response('Invalid path', { status: 403 });
        }
        
        // Try reading from components
        content = await readFile(filePath, 'utf-8');
      } else {
        throw error;
      }
    }
    
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
