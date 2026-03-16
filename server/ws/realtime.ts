import type { ServerWebSocket } from 'hono/ws';

interface Client {
  ws: ServerWebSocket;
  userId: string;
  orgId: string | null;
  channels: Set<string>;
  authenticated: boolean;
}

const clients = new Map<ServerWebSocket, Client>();

export function addClient(ws: ServerWebSocket) {
  clients.set(ws, { ws, userId: '', orgId: null, channels: new Set(), authenticated: false });
}

export function authenticateClient(ws: ServerWebSocket, userId: string, orgId: string | null) {
  const client = clients.get(ws);
  if (client) {
    client.userId = userId;
    client.orgId = orgId;
    client.authenticated = true;
  }
}

export function getClient(ws: ServerWebSocket): Client | undefined {
  return clients.get(ws);
}

export function removeClient(ws: ServerWebSocket) {
  clients.delete(ws);
}

export function subscribe(ws: ServerWebSocket, channel: string) {
  const client = clients.get(ws);
  if (!client || !client.authenticated) return;
  // For org-scoped channels (format: "org:<orgId>:..."), verify membership
  if (channel.startsWith('org:')) {
    const channelOrgId = channel.split(':')[1];
    if (channelOrgId && client.orgId !== channelOrgId) return;
  }
  client.channels.add(channel);
}

export function unsubscribe(ws: ServerWebSocket, channel: string) {
  const client = clients.get(ws);
  if (client) client.channels.delete(channel);
}

export function broadcast(channel: string, data: unknown) {
  const message = JSON.stringify({ channel, data });
  for (const client of clients.values()) {
    if (client.channels.has(channel)) {
      try {
        client.ws.send(message);
      } catch {
        // Client disconnected
        clients.delete(client.ws);
      }
    }
  }
}

export function sendToUser(userId: string, data: unknown) {
  const message = JSON.stringify(data);
  for (const client of clients.values()) {
    if (client.userId === userId) {
      try {
        client.ws.send(message);
      } catch {
        clients.delete(client.ws);
      }
    }
  }
}
