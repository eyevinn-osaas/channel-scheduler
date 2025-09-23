const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getNextVod(channelId) {
  try {
    const now = new Date();
    
    // Find the current or next scheduled item
    let schedule = await prisma.schedule.findFirst({
      where: {
        channelId,
        isActive: true,
        scheduledStart: { lte: now },
        scheduledEnd: { gte: now }
      },
      include: { vod: true },
      orderBy: { scheduledStart: 'asc' }
    });

    // If no current item, get the next one
    if (!schedule) {
      schedule = await prisma.schedule.findFirst({
        where: {
          channelId,
          isActive: true,
          scheduledStart: { gt: now }
        },
        include: { vod: true },
        orderBy: { scheduledStart: 'asc' }
      });
    }

    // If still no item, get by position (for continuous playback)
    if (!schedule) {
      schedule = await prisma.schedule.findFirst({
        where: {
          channelId,
          isActive: true
        },
        include: { vod: true },
        orderBy: { position: 'asc' }
      });
    }

    if (!schedule) {
      throw new Error('No schedule found for channel');
    }

    const response = {
      id: schedule.vod.id,
      title: schedule.vod.title,
      hlsUrl: schedule.vod.hlsUrl
    };

    // Add preroll if available
    if (schedule.vod.prerollUrl && schedule.vod.prerollDurationMs) {
      response.prerollUrl = schedule.vod.prerollUrl;
      response.prerollDurationMs = schedule.vod.prerollDurationMs;
    }

    return response;
  } catch (error) {
    console.error('Error getting next VOD:', error);
    throw error;
  }
}

function registerWebhookRoutes(fastify) {
  // Channel Engine webhook endpoint
  fastify.get('/webhook/nextVod', async (request, reply) => {
    try {
      const channelId = request.query.channelId;
      
      if (!channelId) {
        return reply.code(400).send({ error: 'channelId parameter is required' });
      }

      // Verify channel exists - try by ID first, then by name, then by sanitized name
      let channel = await prisma.channel.findUnique({
        where: { id: channelId }
      });

      if (!channel) {
        // Try finding by exact name match (for OSC instance names)
        channel = await prisma.channel.findFirst({
          where: { name: channelId }
        });
      }

      if (!channel) {
        // Try finding by sanitized name - check if any channel's sanitized name matches
        const allChannels = await prisma.channel.findMany();
        channel = allChannels.find(ch => {
          const sanitizedName = ch.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          return sanitizedName === channelId;
        });
      }

      if (!channel) {
        return reply.code(404).send({ error: 'Channel not found' });
      }

      // Use the actual channel ID for schedule lookup
      const actualChannelId = channel.id;

      console.log(`Requesting next VOD for channel ${channelId} (actual ID: ${actualChannelId})`);
      
      // Update the channel's last webhook call time to track "online" status
      await prisma.channel.update({
        where: { id: actualChannelId },
        data: { lastWebhookCall: new Date() }
      });
      
      const vodResponse = await getNextVod(actualChannelId);
      return vodResponse;
    } catch (error) {
      console.error('Webhook error:', error);
      return reply.code(500).send({ error: 'Failed to get next VOD' });
    }
  });

  // Health check endpoint
  fastify.get('/webhook/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });
}

module.exports = { registerWebhookRoutes, getNextVod };