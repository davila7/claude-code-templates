// Endpoint principal: Verifica cambios en la documentación de Claude Code
// Envía notificaciones detalladas a Telegram con URL específica, sección y diff

import { neon } from '@neondatabase/serverless';
import { DOC_PAGES, getDocUrl } from './doc-pages.js';
import { scrapePage, compareSnapshots } from './scraper.js';
import { sendTelegramNotification, sendDailySummary } from './telegram-notifier.js';

/**
 * Handler principal del endpoint
 */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  try {
    const sql = neon(process.env.NEON_DATABASE_URL);

    // Parámetros opcionales
    const {
      slug,           // Verificar solo una página específica
      notify = true,  // Enviar notificaciones a Telegram
      summary = false // Solo enviar resumen diario
    } = req.query;

    console.log('🔍 Iniciando verificación de documentación de Claude Code...');

    // Si solo quieren resumen diario
    if (summary === 'true') {
      return await handleDailySummary(sql, res);
    }

    // Determinar qué páginas verificar
    const pagesToCheck = slug
      ? DOC_PAGES.filter(p => p.slug === slug)
      : DOC_PAGES;

    if (pagesToCheck.length === 0) {
      return res.status(400).json({
        error: 'Invalid slug',
        message: `Page "${slug}" not found in monitored pages`
      });
    }

    console.log(`📄 Verificando ${pagesToCheck.length} página(s)...`);

    const results = {
      checked: [],
      changesDetected: [],
      errors: [],
      notifications: []
    };

    // Verificar cada página
    for (const page of pagesToCheck) {
      try {
        console.log(`  📝 Scraping: ${page.slug}...`);

        // 1. Obtener snapshot actual de la DB
        const existingSnapshot = await getLatestSnapshot(sql, page.slug);

        // 2. Scrapear la página
        const newSnapshot = await scrapePage(page.slug);

        if (!newSnapshot.success) {
          results.errors.push({
            slug: page.slug,
            error: newSnapshot.error
          });
          continue;
        }

        // 3. Comparar snapshots
        const comparison = compareSnapshots(existingSnapshot, newSnapshot);

        // 4. Guardar nuevo snapshot
        const snapshotId = await saveSnapshot(sql, newSnapshot);

        results.checked.push({
          slug: page.slug,
          title: newSnapshot.pageTitle,
          url: newSnapshot.url,
          hasChanges: comparison.hasChanges,
          isNew: comparison.isNew
        });

        // 5. Si hay cambios, procesarlos
        if (comparison.hasChanges) {
          console.log(`  🔄 Cambios detectados en ${page.slug}!`);

          // Guardar cambios en DB
          const changeIds = await saveChanges(sql, snapshotId, newSnapshot, comparison);

          results.changesDetected.push({
            slug: page.slug,
            pageTitle: newSnapshot.pageTitle,
            url: newSnapshot.url,
            summary: comparison.summary,
            changes: comparison.changes.map(c => ({
              type: c.type,
              section: c.sectionTitle,
              anchor: c.anchor
            }))
          });

          // 6. Enviar notificación a Telegram
          if (notify === true || notify === 'true') {
            console.log(`  📱 Enviando notificación a Telegram...`);

            const notificationResult = await sendTelegramNotification(
              {
                slug: page.slug,
                pageTitle: newSnapshot.pageTitle,
                url: newSnapshot.url
              },
              comparison
            );

            results.notifications.push({
              slug: page.slug,
              results: notificationResult
            });

            // Marcar cambios como notificados
            await markChangesNotified(sql, changeIds);
          }
        }
      } catch (pageError) {
        console.error(`  ❌ Error en ${page.slug}:`, pageError.message);
        results.errors.push({
          slug: page.slug,
          error: pageError.message
        });
      }
    }

    // Actualizar metadata
    await updateMetadata(sql, results);

    console.log('✅ Verificación completada');

    return res.status(200).json({
      status: 'success',
      timestamp: new Date().toISOString(),
      summary: {
        pagesChecked: results.checked.length,
        changesDetected: results.changesDetected.length,
        notificationsSent: results.notifications.length,
        errors: results.errors.length
      },
      changes: results.changesDetected,
      errors: results.errors.length > 0 ? results.errors : undefined
    });

  } catch (error) {
    console.error('❌ Error general:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

/**
 * Obtener el último snapshot de una página
 */
async function getLatestSnapshot(sql, slug) {
  const result = await sql`
    SELECT
      slug,
      url,
      page_title as "pageTitle",
      content_hash as "contentHash",
      sections,
      scraped_at as "scrapedAt"
    FROM doc_page_snapshots
    WHERE slug = ${slug} AND is_latest = true
    LIMIT 1
  `;

  return result[0] || null;
}

/**
 * Guardar un nuevo snapshot
 */
async function saveSnapshot(sql, snapshot) {
  // Marcar snapshots anteriores como no-latest
  await sql`
    UPDATE doc_page_snapshots
    SET is_latest = false
    WHERE slug = ${snapshot.slug} AND is_latest = true
  `;

  // Insertar nuevo snapshot
  const result = await sql`
    INSERT INTO doc_page_snapshots (
      slug,
      url,
      page_title,
      content_hash,
      full_content,
      sections,
      scraped_at
    ) VALUES (
      ${snapshot.slug},
      ${snapshot.url},
      ${snapshot.pageTitle},
      ${snapshot.contentHash},
      ${snapshot.fullContent},
      ${JSON.stringify(snapshot.sections)},
      ${snapshot.scrapedAt}
    )
    RETURNING id
  `;

  return result[0].id;
}

/**
 * Guardar cambios detectados
 */
async function saveChanges(sql, snapshotId, snapshot, comparison) {
  const changeIds = [];

  for (const change of comparison.changes) {
    const result = await sql`
      INSERT INTO doc_changes (
        snapshot_id,
        slug,
        page_title,
        url,
        change_type,
        section_id,
        section_title,
        section_anchor,
        old_content,
        new_content,
        diff_added,
        diff_removed
      ) VALUES (
        ${snapshotId},
        ${snapshot.slug},
        ${snapshot.pageTitle},
        ${snapshot.url},
        ${change.type},
        ${change.sectionId},
        ${change.sectionTitle},
        ${change.anchor},
        ${change.oldContent},
        ${change.newContent},
        ${change.diff?.added || []},
        ${change.diff?.removed || []}
      )
      RETURNING id
    `;

    changeIds.push(result[0].id);
  }

  return changeIds;
}

/**
 * Marcar cambios como notificados
 */
async function markChangesNotified(sql, changeIds) {
  if (changeIds.length === 0) return;

  await sql`
    UPDATE doc_changes
    SET telegram_notified = true, telegram_notified_at = NOW()
    WHERE id = ANY(${changeIds})
  `;
}

/**
 * Actualizar metadata del monitoreo
 */
async function updateMetadata(sql, results) {
  await sql`
    UPDATE doc_monitoring_metadata
    SET
      last_full_scan_at = NOW(),
      total_scans = total_scans + 1,
      total_changes_detected = total_changes_detected + ${results.changesDetected.length},
      total_notifications_sent = total_notifications_sent + ${results.notifications.length},
      pages_monitored = ${DOC_PAGES.length}
    WHERE id = 1
  `;

  if (results.changesDetected.length > 0) {
    await sql`
      UPDATE doc_monitoring_metadata
      SET last_change_detected_at = NOW()
      WHERE id = 1
    `;
  }

  if (results.errors.length > 0) {
    await sql`
      UPDATE doc_monitoring_metadata
      SET
        error_count = error_count + ${results.errors.length},
        last_error = ${results.errors[0].error}
      WHERE id = 1
    `;
  }
}

/**
 * Manejar solicitud de resumen diario
 */
async function handleDailySummary(sql, res) {
  // Obtener cambios de las últimas 24 horas
  const recentChanges = await sql`
    SELECT
      slug,
      page_title as "pageTitle",
      url,
      change_type as "changeType",
      section_title as "sectionTitle",
      detected_at as "detectedAt"
    FROM doc_changes
    WHERE detected_at > NOW() - INTERVAL '24 hours'
    ORDER BY detected_at DESC
  `;

  // Agrupar por página
  const changesByPage = {};
  for (const change of recentChanges) {
    if (!changesByPage[change.slug]) {
      changesByPage[change.slug] = {
        slug: change.slug,
        pageTitle: change.pageTitle,
        url: change.url,
        summary: { added: 0, modified: 0, removed: 0 },
        changes: []
      };
    }
    changesByPage[change.slug].summary[change.changeType]++;
    changesByPage[change.slug].changes.push({
      type: change.changeType,
      section: change.sectionTitle,
      time: change.detectedAt
    });
  }

  const summaryData = Object.values(changesByPage);

  // Enviar resumen a Telegram
  const result = await sendDailySummary(summaryData);

  return res.status(200).json({
    status: 'success',
    type: 'daily_summary',
    pagesWithChanges: summaryData.length,
    totalChanges: recentChanges.length,
    telegram: result
  });
}
