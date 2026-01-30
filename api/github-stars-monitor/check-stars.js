// Módulo para consultar estrellas de GitHub
// Usa la API de GitHub para obtener el conteo de estrellas y stargazers recientes

import axios from 'axios';

const GITHUB_OWNER = 'davila7';
const GITHUB_REPO = 'claude-code-templates';
const GITHUB_API = 'https://api.github.com';

/**
 * Obtiene el total de estrellas del repositorio
 * @returns {object} - { totalStars, repoUrl, repoName }
 */
export async function getRepoStars() {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'claude-code-templates-monitor'
  };

  // Usar token si está disponible (para mayor rate limit)
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await axios.get(
    `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}`,
    { headers }
  );

  return {
    totalStars: response.data.stargazers_count,
    repoUrl: response.data.html_url,
    repoName: response.data.full_name,
    description: response.data.description,
    forks: response.data.forks_count,
    openIssues: response.data.open_issues_count,
    watchers: response.data.subscribers_count
  };
}

/**
 * Obtiene los stargazers recientes con timestamp
 * Requiere header Accept especial para obtener starred_at
 * @param {number} days - Número de días hacia atrás para buscar
 * @returns {object} - { recentStargazers, count }
 */
export async function getRecentStargazers(days = 7) {
  const headers = {
    'Accept': 'application/vnd.github.v3.star+json',
    'User-Agent': 'claude-code-templates-monitor'
  };

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const since = new Date();
  since.setDate(since.getDate() - days);

  // Obtener las últimas páginas de stargazers (ordenados por fecha)
  // GitHub devuelve los más antiguos primero, así que necesitamos paginar desde el final
  const recentStargazers = [];
  let page = 1;
  const perPage = 100;
  let keepFetching = true;

  // Primero obtener el total para saber cuántas páginas hay
  const repoData = await getRepoStars();
  const totalPages = Math.ceil(repoData.totalStars / perPage);

  // Empezar desde la última página e ir hacia atrás
  page = totalPages;

  while (keepFetching && page > 0) {
    try {
      const response = await axios.get(
        `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/stargazers`,
        {
          headers,
          params: { per_page: perPage, page }
        }
      );

      if (response.data.length === 0) {
        break;
      }

      for (const stargazer of response.data) {
        const starredAt = new Date(stargazer.starred_at);
        if (starredAt >= since) {
          recentStargazers.push({
            user: stargazer.user.login,
            avatarUrl: stargazer.user.avatar_url,
            profileUrl: stargazer.user.html_url,
            starredAt: stargazer.starred_at
          });
        } else {
          // Si encontramos uno más antiguo que el rango, dejamos de buscar
          keepFetching = false;
        }
      }

      page--;
    } catch (error) {
      // Si hay rate limit, dejar de paginar
      if (error.response?.status === 403) {
        console.warn('GitHub API rate limit reached, returning partial results');
        break;
      }
      throw error;
    }
  }

  return {
    recentStargazers,
    count: recentStargazers.length,
    since: since.toISOString(),
    days
  };
}
