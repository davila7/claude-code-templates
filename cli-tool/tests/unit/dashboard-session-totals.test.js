/**
 * The dashboard's Sessions cards read sessionData.totalSessions and
 * sessionData.avgSessionLength from /api/data. SessionAnalyzer never returned
 * them, so the cards showed "—", "0" and "No session data yet" next to the
 * sessions it had listed.
 */
const SessionAnalyzer = require('../../src/analytics/core/SessionAnalyzer');

const HOUR = 60 * 60 * 1000;

function conversation(id, startHoursAgo, endHoursAgo, messageCount) {
  return {
    id,
    messageCount,
    created: new Date(Date.now() - startHoursAgo * HOUR),
    lastModified: new Date(Date.now() - endHoursAgo * HOUR),
    tokenUsage: null
  };
}

describe('dashboard session totals', () => {
  const analyzer = new SessionAnalyzer();

  it('counts the sessions it lists and averages their length', () => {
    // A day apart, so they fall in two separate five-hour windows
    const sessionData = analyzer.analyzeSessionData([
      conversation('yesterday', 30, 29, 4),
      conversation('today', 2, 1, 2)
    ]);

    expect(sessionData.sessions).toHaveLength(2);
    expect(sessionData.totalSessions).toBe(2);
    expect(sessionData.avgSessionLength).toBe(5 * HOUR);
  });

  it('reports no sessions without an average when there is no history', () => {
    const sessionData = analyzer.analyzeSessionData([]);

    expect(sessionData.totalSessions).toBe(0);
    expect(sessionData.avgSessionLength).toBeNull();
  });
});
