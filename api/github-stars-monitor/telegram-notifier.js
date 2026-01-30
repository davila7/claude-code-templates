// Notificador de Telegram para GitHub Stars
// Envía un resumen semanal de estrellas cada viernes

import axios from 'axios';

const TELEGRAM_API = 'https://api.telegram.org/bot';

/**
 * Envía notificación a Telegram con el resumen semanal de estrellas
 * @param {object} data - Datos del reporte semanal
 * @returns {object} - Resultado del envío
 */
export async function sendTelegramStarsNotification(data) {
  const { totalStars, weeklyStars, recentStargazers, repoUrl, repoName, forks, openIssues, watchers, previousTotal } = data;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required');
  }

  const message = buildStarsMessage(data);

  try {
    const response = await axios.post(`${TELEGRAM_API}${botToken}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });

    return {
      success: true,
      status: response.status,
      messageId: response.data.result?.message_id
    };
  } catch (error) {
    console.error('Telegram notification error:', error.response?.data || error.message);
    throw new Error(`Telegram notification failed: ${error.message}`);
  }
}

/**
 * Construye el mensaje HTML para Telegram
 */
function buildStarsMessage(data) {
  const { totalStars, weeklyStars, recentStargazers, repoUrl, repoName, forks, openIssues, watchers, previousTotal } = data;

  const now = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const dateRange = `${formatDate(weekAgo)} - ${formatDate(now)}`;

  // Trend indicator
  let trend = '';
  if (weeklyStars > 10) {
    trend = ' 🔥';
  } else if (weeklyStars > 5) {
    trend = ' 📈';
  } else if (weeklyStars > 0) {
    trend = ' ⭐';
  } else {
    trend = ' 📊';
  }

  let message = `<b>⭐ GitHub Stars Weekly Report${trend}</b>\n`;
  message += `<b>${repoName}</b>\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Stats principales
  message += `📅 <b>Period:</b> ${dateRange}\n\n`;
  message += `⭐ <b>Total Stars:</b> ${totalStars.toLocaleString()}\n`;
  message += `🆕 <b>New this week:</b> +${weeklyStars}\n`;

  if (previousTotal !== null && previousTotal !== undefined) {
    const diff = totalStars - previousTotal;
    message += `📊 <b>Delta vs last check:</b> ${diff >= 0 ? '+' : ''}${diff}\n`;
  }

  message += `\n`;

  // Repo stats
  message += `🍴 <b>Forks:</b> ${forks.toLocaleString()}\n`;
  message += `👀 <b>Watchers:</b> ${watchers.toLocaleString()}\n`;
  message += `📋 <b>Open Issues:</b> ${openIssues}\n\n`;

  // Stargazers recientes
  if (recentStargazers && recentStargazers.length > 0) {
    message += `<b>🙌 New Stargazers (${recentStargazers.length}):</b>\n`;

    const maxShow = Math.min(recentStargazers.length, 15);
    for (let i = 0; i < maxShow; i++) {
      const sg = recentStargazers[i];
      message += `  • <a href="${sg.profileUrl}">${sg.user}</a>\n`;
    }

    if (recentStargazers.length > maxShow) {
      message += `  ... and ${recentStargazers.length - maxShow} more\n`;
    }
    message += `\n`;
  } else {
    message += `<i>No new stargazers this week</i>\n\n`;
  }

  // Link
  message += `🔗 <a href="${repoUrl}">View Repository</a>\n`;
  message += `\n<i>GitHub Stars Monitor • Every Friday at noon</i>`;

  return message;
}

/**
 * Formatea una fecha en formato legible
 */
function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}
