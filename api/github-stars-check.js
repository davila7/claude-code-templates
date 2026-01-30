// Endpoint principal: Verifica estrellas de GitHub y envía resumen semanal por Telegram
// Cron: Cada viernes a mediodía (0 12 * * 5)

import { neon } from '@neondatabase/serverless';
import { getRepoStars, getRecentStargazers } from './github-stars-monitor/check-stars.js';
import { sendTelegramStarsNotification } from './github-stars-monitor/telegram-notifier.js';

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

    console.log('⭐ Checking GitHub stars...');

    // 1. Obtener datos del repositorio
    const repoData = await getRepoStars();
    console.log(`📊 Total stars: ${repoData.totalStars}`);

    // 2. Obtener el último registro guardado para comparar
    const lastRecord = await sql`
      SELECT total_stars, checked_at
      FROM github_stars_history
      ORDER BY checked_at DESC
      LIMIT 1
    `;

    const previousTotal = lastRecord.length > 0 ? lastRecord[0].total_stars : null;

    // 3. Obtener stargazers de la última semana
    console.log('🔍 Fetching recent stargazers...');
    const recentData = await getRecentStargazers(7);
    console.log(`🆕 New stargazers this week: ${recentData.count}`);

    // 4. Guardar en la base de datos
    const insertResult = await sql`
      INSERT INTO github_stars_history (
        total_stars,
        weekly_new_stars,
        forks,
        watchers,
        open_issues,
        stargazers_data
      ) VALUES (
        ${repoData.totalStars},
        ${recentData.count},
        ${repoData.forks},
        ${repoData.watchers},
        ${repoData.openIssues},
        ${JSON.stringify(recentData.recentStargazers.slice(0, 50))}
      )
      RETURNING id
    `;
    const recordId = insertResult[0].id;
    console.log(`💾 Stars record saved (ID: ${recordId})`);

    // 5. Enviar notificación por Telegram
    console.log('📢 Sending Telegram notification...');
    const telegramResult = await sendTelegramStarsNotification({
      totalStars: repoData.totalStars,
      weeklyStars: recentData.count,
      recentStargazers: recentData.recentStargazers,
      repoUrl: repoData.repoUrl,
      repoName: repoData.repoName,
      forks: repoData.forks,
      openIssues: repoData.openIssues,
      watchers: repoData.watchers,
      previousTotal
    });
    console.log('✅ Telegram notification sent!');

    // 6. Marcar como notificado
    await sql`
      UPDATE github_stars_history
      SET telegram_notified = true, telegram_notified_at = NOW()
      WHERE id = ${recordId}
    `;

    // 7. Guardar log de notificación
    await sql`
      INSERT INTO telegram_notifications_log (
        record_id,
        notification_type,
        payload_summary,
        response_status,
        success
      ) VALUES (
        ${recordId},
        ${'weekly_stars'},
        ${JSON.stringify({ totalStars: repoData.totalStars, weeklyStars: recentData.count })},
        ${telegramResult.status},
        ${telegramResult.success}
      )
    `;

    console.log('🎉 Weekly stars report completed!');

    return res.status(200).json({
      status: 'success',
      totalStars: repoData.totalStars,
      weeklyStars: recentData.count,
      previousTotal,
      recordId,
      telegram: {
        sent: true,
        messageId: telegramResult.messageId
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);

    // Intentar loguear el error en la base de datos
    try {
      const sql = neon(process.env.NEON_DATABASE_URL);
      await sql`
        INSERT INTO telegram_notifications_log (
          notification_type,
          error_message,
          success
        ) VALUES (
          ${'weekly_stars'},
          ${error.message},
          ${false}
        )
      `;
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
