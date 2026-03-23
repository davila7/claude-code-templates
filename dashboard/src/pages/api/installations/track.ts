import type { APIRoute } from 'astro';
import { neon } from '@neondatabase/serverless';

export const POST: APIRoute = async ({ request }) => {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.substring(7);
    // TODO: Verify Clerk token and get user ID
    // For now, extract from token or use a placeholder
    const clerkUserId = 'user_placeholder'; // Replace with actual Clerk verification

    const body = await request.json();
    const { components, installCommand, source = 'cli' } = body;

    if (!components || !Array.isArray(components) || components.length === 0) {
      return new Response(JSON.stringify({ error: 'Components array required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const sql = neon(import.meta.env.DATABASE_URL);

    // Track each component installation
    let tracked = 0;
    for (const comp of components) {
      const { type, path, name, category } = comp;
      
      // Generate version hash (simple timestamp for now)
      const version = Date.now().toString(36);

      await sql`
        INSERT INTO component_installations (
          clerk_user_id,
          component_type,
          component_path,
          component_name,
          component_category,
          installed_version,
          current_version,
          install_source,
          install_command
        ) VALUES (
          ${clerkUserId},
          ${type},
          ${path},
          ${name},
          ${category || null},
          ${version},
          ${version},
          ${source},
          ${installCommand || null}
        )
        ON CONFLICT (clerk_user_id, component_path)
        DO UPDATE SET
          updated_at = NOW(),
          install_command = ${installCommand || null}
      `;
      
      tracked++;
    }

    // Auto-create "Installed" collection if it doesn't exist
    const existingCollection = await sql`
      SELECT id FROM collections
      WHERE clerk_user_id = ${clerkUserId}
      AND name = 'Installed Components'
      LIMIT 1
    `;

    let collectionId;
    if (existingCollection.length === 0) {
      const newCollection = await sql`
        INSERT INTO collections (clerk_user_id, name, description, is_public)
        VALUES (
          ${clerkUserId},
          'Installed Components',
          'Components installed via CLI',
          false
        )
        RETURNING id
      `;
      collectionId = newCollection[0].id;
    } else {
      collectionId = existingCollection[0].id;
    }

    // Add components to collection
    for (const comp of components) {
      await sql`
        INSERT INTO collection_items (
          collection_id,
          component_type,
          component_path,
          component_name,
          component_category
        ) VALUES (
          ${collectionId},
          ${comp.type},
          ${comp.path},
          ${comp.name},
          ${comp.category || null}
        )
        ON CONFLICT (collection_id, component_path) DO NOTHING
      `;
    }

    return new Response(JSON.stringify({
      success: true,
      tracked,
      collectionId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Track installation error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to track installation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
