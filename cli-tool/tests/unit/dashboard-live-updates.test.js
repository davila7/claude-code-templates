/**
 * The analytics page subscribes with { channels: [...] } and routes messages by
 * their `channel`. Until 1.31.0 the server read only { channel } and sent no
 * channel, so the page never received a live update.
 */
const http = require('http');
const WebSocket = require('ws');
const WebSocketServer = require('../../src/analytics/notifications/WebSocketServer');

describe('dashboard live updates', () => {
  let server;
  let wss;
  let port;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    server = http.createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
    wss = new WebSocketServer(server, { path: '/ws' });
    await wss.initialize();
  });

  afterAll(async () => {
    await wss.close();
    await new Promise(resolve => server.close(resolve));
    console.log.mockRestore();
  });

  function client(subscribeMessage) {
    return new Promise((resolve) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      const received = [];
      socket.on('message', (raw) => {
        const msg = JSON.parse(raw);
        received.push(msg);
        if (msg.type === 'subscription_confirmed' && !socket.ready) {
          socket.ready = true;
          resolve({ socket, received });
        }
      });
      socket.on('open', () => socket.send(JSON.stringify(subscribeMessage)));
    });
  }

  const waitFor = (received, type) => new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const found = received.find(m => m.type === type);
      if (found) return resolve(found);
      if (Date.now() - started > 2000) return reject(new Error(`no ${type}`));
      setTimeout(tick, 20);
    };
    tick();
  });

  it('subscribes the analytics page to every channel it lists and labels the broadcast', async () => {
    const { socket, received } = await client({ type: 'subscribe', channels: ['data_updates', 'conversation_updates'] });
    wss.notifyDataRefresh({ conversations: 1 });
    const msg = await waitFor(received, 'data_refresh');
    expect(msg.channel).toBe('data_updates');
    socket.close();
  });

  it('keeps the single-channel form the chats page sends', async () => {
    const { socket, received } = await client({ type: 'subscribe', channel: 'conversation_updates' });
    wss.notifyConversationStateChange('abc', 'active');
    const msg = await waitFor(received, 'conversation_state_change');
    expect(msg.channel).toBe('conversation_updates');
    expect(msg.data.conversationId).toBe('abc');
    socket.close();
  });
});
