// Notificador de Telegram para cambios en documentación
// Envía mensajes detallados con URL específica, sección y diff

import axios from 'axios';
import { getDocUrl } from './doc-pages.js';

const MAX_MESSAGE_LENGTH = 4096; // Límite de Telegram

/**
 * Enviar notificación a Telegram sobre cambios en la documentación
 * @param {object} pageInfo - Información de la página
 * @param {object} comparison - Resultado de la comparación
 * @returns {object} - Resultado del envío
 */
export async function sendTelegramNotification(pageInfo, comparison) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured');
  }

  const messages = formatChangesForTelegram(pageInfo, comparison);

  const results = [];
  for (const message of messages) {
    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: false
        }
      );
      results.push({ success: true, messageId: response.data.result?.message_id });
    } catch (error) {
      console.error('Telegram error:', error.response?.data || error.message);
      results.push({ success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Formatear cambios para Telegram con HTML
 * @param {object} pageInfo - Información de la página
 * @param {object} comparison - Resultado de la comparación
 * @returns {Array<string>} - Array de mensajes formateados
 */
function formatChangesForTelegram(pageInfo, comparison) {
  const messages = [];

  // Mensaje principal con resumen
  let mainMessage = `🔔 <b>Cambio detectado en la documentación de Claude Code</b>\n\n`;
  mainMessage += `📄 <b>Página:</b> ${escapeHtml(pageInfo.pageTitle)}\n`;
  mainMessage += `🔗 <b>URL:</b> ${pageInfo.url}\n`;
  mainMessage += `📅 <b>Fecha:</b> ${new Date().toLocaleString('es-ES', { timeZone: 'America/Santiago' })}\n\n`;

  if (comparison.isNew) {
    mainMessage += `🆕 <b>Nueva página detectada</b>\n`;
    messages.push(mainMessage);
    return messages;
  }

  mainMessage += `📊 <b>Resumen de cambios:</b>\n`;
  mainMessage += `  • Secciones añadidas: ${comparison.summary.added}\n`;
  mainMessage += `  • Secciones modificadas: ${comparison.summary.modified}\n`;
  mainMessage += `  • Secciones eliminadas: ${comparison.summary.removed}\n`;

  messages.push(mainMessage);

  // Mensajes detallados por cada cambio
  for (const change of comparison.changes) {
    const changeMessage = formatSingleChange(pageInfo, change);

    // Si el mensaje es muy largo, dividirlo
    if (changeMessage.length > MAX_MESSAGE_LENGTH) {
      const chunks = splitMessage(changeMessage);
      messages.push(...chunks);
    } else {
      messages.push(changeMessage);
    }
  }

  return messages;
}

/**
 * Formatear un cambio individual
 * @param {object} pageInfo - Información de la página
 * @param {object} change - Cambio individual
 * @returns {string} - Mensaje formateado
 */
function formatSingleChange(pageInfo, change) {
  const sectionUrl = `${pageInfo.url}#${change.anchor}`;
  const typeEmoji = {
    added: '🟢',
    modified: '🟡',
    removed: '🔴'
  };
  const typeLabel = {
    added: 'AÑADIDA',
    modified: 'MODIFICADA',
    removed: 'ELIMINADA'
  };

  let message = `\n${typeEmoji[change.type]} <b>Sección ${typeLabel[change.type]}</b>\n`;
  message += `📍 <b>Sección:</b> ${escapeHtml(change.sectionTitle)}\n`;
  message += `🔗 <a href="${sectionUrl}">Ver sección →</a>\n\n`;

  if (change.type === 'added') {
    message += `<b>Nuevo contenido:</b>\n`;
    message += `<pre>${escapeHtml(truncate(change.newContent, 1500))}</pre>\n`;
  } else if (change.type === 'removed') {
    message += `<b>Contenido eliminado:</b>\n`;
    message += `<pre>${escapeHtml(truncate(change.oldContent, 1500))}</pre>\n`;
  } else if (change.type === 'modified') {
    // Mostrar diff
    if (change.diff.removed.length > 0) {
      message += `<b>❌ Texto eliminado:</b>\n`;
      message += `<pre>${escapeHtml(truncate(change.diff.removed.join('\n'), 800))}</pre>\n\n`;
    }
    if (change.diff.added.length > 0) {
      message += `<b>✅ Texto añadido:</b>\n`;
      message += `<pre>${escapeHtml(truncate(change.diff.added.join('\n'), 800))}</pre>\n`;
    }
  }

  return message;
}

/**
 * Escapar caracteres HTML
 * @param {string} text - Texto a escapar
 * @returns {string} - Texto escapado
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Truncar texto a una longitud máxima
 * @param {string} text - Texto a truncar
 * @param {number} maxLength - Longitud máxima
 * @returns {string} - Texto truncado
 */
function truncate(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '\n... [truncado]';
}

/**
 * Dividir un mensaje largo en chunks
 * @param {string} message - Mensaje largo
 * @returns {Array<string>} - Array de chunks
 */
function splitMessage(message) {
  const chunks = [];
  let remaining = message;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_MESSAGE_LENGTH) {
      chunks.push(remaining);
      break;
    }

    // Buscar un buen punto para cortar (nueva línea)
    let cutIndex = remaining.lastIndexOf('\n', MAX_MESSAGE_LENGTH);
    if (cutIndex === -1 || cutIndex < MAX_MESSAGE_LENGTH / 2) {
      cutIndex = MAX_MESSAGE_LENGTH;
    }

    chunks.push(remaining.substring(0, cutIndex));
    remaining = remaining.substring(cutIndex);
  }

  return chunks;
}

/**
 * Enviar mensaje de resumen diario
 * @param {Array} changes - Lista de todos los cambios del día
 * @returns {object} - Resultado del envío
 */
export async function sendDailySummary(changes) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured');
  }

  let message = `📊 <b>Resumen diario de documentación de Claude Code</b>\n\n`;
  message += `📅 ${new Date().toLocaleDateString('es-ES')}\n\n`;

  if (changes.length === 0) {
    message += `✅ No se detectaron cambios en la documentación.`;
  } else {
    message += `🔄 <b>${changes.length} página(s) con cambios:</b>\n\n`;

    for (const change of changes) {
      message += `• <a href="${change.url}">${escapeHtml(change.pageTitle)}</a>\n`;
      message += `  ${change.summary.added} añadidas, ${change.summary.modified} modificadas, ${change.summary.removed} eliminadas\n\n`;
    }
  }

  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }
    );
    return { success: true, messageId: response.data.result?.message_id };
  } catch (error) {
    console.error('Telegram error:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}
