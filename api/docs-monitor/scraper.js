// Scraper para documentación de Claude Code
// Extrae contenido y lo divide en secciones por headers

import axios from 'axios';
import * as cheerio from 'cheerio';
import { getDocUrl } from './doc-pages.js';

/**
 * Scrape una página de documentación y extrae su contenido
 * @param {string} slug - Slug de la página (ej: 'overview')
 * @returns {object} - Contenido estructurado de la página
 */
export async function scrapePage(slug) {
  const url = getDocUrl(slug);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Claude-Code-Templates-Monitor/1.0 (Documentation Change Tracker)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 30000,
    });

    const $ = cheerio.load(response.data);

    // Extraer el contenido principal (ajustar selector según estructura del sitio)
    const mainContent = $('main').first() || $('article').first() || $('[role="main"]').first();

    if (!mainContent.length) {
      throw new Error(`Could not find main content for ${slug}`);
    }

    // Extraer título de la página
    const pageTitle = $('h1').first().text().trim() || slug;

    // Extraer secciones por headers
    const sections = extractSections($, mainContent);

    // Calcular hash del contenido completo para detección rápida de cambios
    const fullContent = mainContent.text().trim();
    const contentHash = simpleHash(fullContent);

    return {
      slug,
      url,
      pageTitle,
      sections,
      fullContent,
      contentHash,
      scrapedAt: new Date().toISOString(),
      success: true
    };

  } catch (error) {
    console.error(`Error scraping ${slug}:`, error.message);
    return {
      slug,
      url,
      error: error.message,
      success: false,
      scrapedAt: new Date().toISOString()
    };
  }
}

/**
 * Extrae secciones del contenido basándose en headers h2/h3
 * @param {CheerioAPI} $ - Instancia de Cheerio
 * @param {Cheerio} container - Contenedor del contenido
 * @returns {Array} - Array de secciones
 */
function extractSections($, container) {
  const sections = [];
  let currentSection = {
    id: 'intro',
    title: 'Introduction',
    level: 1,
    content: [],
    anchor: ''
  };

  // Obtener todos los elementos hijos del contenedor
  container.children().each((_, element) => {
    const $el = $(element);
    const tagName = element.tagName?.toLowerCase() || '';

    // Si es un header, crear nueva sección
    if (tagName === 'h2' || tagName === 'h3') {
      // Guardar sección anterior si tiene contenido
      if (currentSection.content.length > 0) {
        currentSection.text = currentSection.content.join('\n').trim();
        currentSection.hash = simpleHash(currentSection.text);
        delete currentSection.content;
        sections.push(currentSection);
      }

      // Crear nueva sección
      const title = $el.text().trim();
      const anchor = $el.attr('id') || slugify(title);

      currentSection = {
        id: anchor,
        title,
        level: tagName === 'h2' ? 2 : 3,
        anchor,
        content: []
      };
    } else {
      // Agregar contenido a la sección actual
      const text = $el.text().trim();
      if (text) {
        currentSection.content.push(text);
      }

      // También extraer código
      $el.find('pre, code').each((_, codeEl) => {
        const code = $(codeEl).text().trim();
        if (code && code.length > 10) {
          currentSection.content.push(`[CODE]: ${code.substring(0, 500)}`);
        }
      });
    }
  });

  // No olvidar la última sección
  if (currentSection.content.length > 0) {
    currentSection.text = currentSection.content.join('\n').trim();
    currentSection.hash = simpleHash(currentSection.text);
    delete currentSection.content;
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Hash simple para comparación rápida
 * @param {string} str - String a hashear
 * @returns {string} - Hash
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

/**
 * Convertir título a slug
 * @param {string} text - Texto a convertir
 * @returns {string} - Slug
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Comparar dos snapshots de una página y encontrar diferencias
 * @param {object} oldSnapshot - Snapshot anterior
 * @param {object} newSnapshot - Snapshot nuevo
 * @returns {object} - Diferencias encontradas
 */
export function compareSnapshots(oldSnapshot, newSnapshot) {
  if (!oldSnapshot || !newSnapshot) {
    return { hasChanges: true, isNew: !oldSnapshot, changes: [] };
  }

  // Si el hash completo es igual, no hay cambios
  if (oldSnapshot.contentHash === newSnapshot.contentHash) {
    return { hasChanges: false, changes: [] };
  }

  const changes = [];
  const oldSections = new Map(oldSnapshot.sections.map(s => [s.id, s]));
  const newSections = new Map(newSnapshot.sections.map(s => [s.id, s]));

  // Buscar secciones nuevas o modificadas
  for (const [id, newSection] of newSections) {
    const oldSection = oldSections.get(id);

    if (!oldSection) {
      // Sección nueva
      changes.push({
        type: 'added',
        sectionId: id,
        sectionTitle: newSection.title,
        anchor: newSection.anchor,
        newContent: newSection.text,
        oldContent: null
      });
    } else if (oldSection.hash !== newSection.hash) {
      // Sección modificada
      changes.push({
        type: 'modified',
        sectionId: id,
        sectionTitle: newSection.title,
        anchor: newSection.anchor,
        oldContent: oldSection.text,
        newContent: newSection.text,
        diff: generateDiff(oldSection.text, newSection.text)
      });
    }
  }

  // Buscar secciones eliminadas
  for (const [id, oldSection] of oldSections) {
    if (!newSections.has(id)) {
      changes.push({
        type: 'removed',
        sectionId: id,
        sectionTitle: oldSection.title,
        anchor: oldSection.anchor,
        oldContent: oldSection.text,
        newContent: null
      });
    }
  }

  return {
    hasChanges: changes.length > 0,
    changes,
    summary: {
      added: changes.filter(c => c.type === 'added').length,
      modified: changes.filter(c => c.type === 'modified').length,
      removed: changes.filter(c => c.type === 'removed').length
    }
  };
}

/**
 * Generar un diff simple entre dos textos
 * @param {string} oldText - Texto anterior
 * @param {string} newText - Texto nuevo
 * @returns {object} - Diff con líneas añadidas y eliminadas
 */
function generateDiff(oldText, newText) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const added = [];
  const removed = [];

  // Algoritmo simple de diff línea por línea
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  for (const line of newLines) {
    if (!oldSet.has(line) && line.trim()) {
      added.push(line);
    }
  }

  for (const line of oldLines) {
    if (!newSet.has(line) && line.trim()) {
      removed.push(line);
    }
  }

  return { added, removed };
}
