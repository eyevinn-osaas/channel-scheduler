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

    // If still no item, we're looping back to the beginning
    if (!schedule) {
      console.log(`No upcoming schedule items found for channel ${channelId}, looping back to beginning and updating schedule times`);
      
      // Get the first item by position
      schedule = await prisma.schedule.findFirst({
        where: {
          channelId,
          isActive: true
        },
        include: { vod: true },
        orderBy: { position: 'asc' }
      });

      if (schedule) {
        // Update the entire schedule to start from now
        const { rebalanceSchedule } = require('./schedulingUtils');
        
        // Update the channel's schedule start to current time
        await prisma.channel.update({
          where: { id: channelId },
          data: { scheduleStart: now }
        });
        
        // Rebalance all schedule times starting from position 1
        await rebalanceSchedule(channelId, 1);
        
        // Fetch the updated schedule item
        schedule = await prisma.schedule.findFirst({
          where: {
            channelId,
            isActive: true,
            position: schedule.position
          },
          include: { vod: true }
        });
        
        console.log(`Schedule updated for channel ${channelId} - restarted from position 1 at ${now}`);
      }
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

      const now = new Date();

      // Check if this is the first time the engine is fetching content and sync schedule
      if (!channel.scheduleSynced && channel.scheduleStart) {
        console.log(`First VOD fetch detected for channel ${channelId}, syncing schedule start time`);

        // Update the schedule start time to current time and sync all schedules
        const { updateChannelScheduleStart } = require('./schedulingUtils');
        await updateChannelScheduleStart(actualChannelId, now, false);

        // Mark the channel as synced
        await prisma.channel.update({
          where: { id: actualChannelId },
          data: {
            lastWebhookCall: now,
            scheduleSynced: true
          }
        });

        console.log(`Schedule synced for channel ${channelId} - adjusted start time from ${channel.scheduleStart} to ${now}`);
      } else {
        // Update the channel's last webhook call time to track "online" status
        await prisma.channel.update({
          where: { id: actualChannelId },
          data: { lastWebhookCall: now }
        });
      }
      
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