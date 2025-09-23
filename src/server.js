const fastify = require('fastify')({ logger: true });
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const { registerWebhookRoutes } = require('./webhook');
const { getHLSDuration, validateHLSUrl } = require('./hlsUtils');
const { calculateBackToBackSchedule, rebalanceSchedule, updateChannelScheduleStart } = require('./schedulingUtils');
const { seedDatabase } = require('./seedData');
const { OSCClient } = require('./oscClient');

const prisma = new PrismaClient();
const oscClient = new OSCClient();

// Utility function to get the public URL
function getPublicUrl() {
  const publicUrl = process.env.PUBLIC_URL;
  if (publicUrl) {
    return publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
  }
  return 'http://localhost:3000';
}

fastify.register(require('@fastify/cors'), {
  origin: true
});

fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, '../public'),
  prefix: '/'
});

// Register webhook routes
registerWebhookRoutes(fastify);

// Channels endpoints
fastify.get('/api/channels', async (request, reply) => {
  try {
    const channels = await prisma.channel.findMany({
      include: { _count: { select: { schedules: true } } }
    });
    return channels;
  } catch (error) {
    reply.code(500).send({ error: 'Failed to fetch channels' });
  }
});

fastify.post('/api/channels', async (request, reply) => {
  try {
    const { name, description, scheduleStart, autoSchedule } = request.body;
    
    // Automatically generate webhook URL
    const publicUrl = getPublicUrl();
    const webhookUrl = `${publicUrl}/webhook/nextVod`;
    
    const channel = await prisma.channel.create({
      data: { 
        name, 
        description, 
        webhookUrl,
        scheduleStart: scheduleStart ? new Date(scheduleStart) : null,
        autoSchedule: autoSchedule !== undefined ? autoSchedule : true
      }
    });
    return channel;
  } catch (error) {
    reply.code(500).send({ error: 'Failed to create channel' });
  }
});

fastify.get('/api/channels/:id', async (request, reply) => {
  try {
    const channel = await prisma.channel.findUnique({
      where: { id: request.params.id },
      include: { schedules: { include: { vod: true }, orderBy: { position: 'asc' } } }
    });
    if (!channel) {
      return reply.code(404).send({ error: 'Channel not found' });
    }
    return channel;
  } catch (error) {
    reply.code(500).send({ error: 'Failed to fetch channel' });
  }
});

fastify.put('/api/channels/:id', async (request, reply) => {
  try {
    const { name, description, scheduleStart, autoSchedule } = request.body;
    
    // Automatically generate webhook URL (in case PUBLIC_URL changed)
    const publicUrl = getPublicUrl();
    const webhookUrl = `${publicUrl}/webhook/nextVod`;
    
    const channel = await prisma.channel.update({
      where: { id: request.params.id },
      data: { 
        name, 
        description, 
        webhookUrl,
        scheduleStart: scheduleStart ? new Date(scheduleStart) : null,
        autoSchedule: autoSchedule !== undefined ? autoSchedule : undefined
      }
    });
    return channel;
  } catch (error) {
    reply.code(500).send({ error: 'Failed to update channel' });
  }
});

fastify.delete('/api/channels/:id', async (request, reply) => {
  try {
    await prisma.channel.delete({
      where: { id: request.params.id }
    });
    return { success: true };
  } catch (error) {
    reply.code(500).send({ error: 'Failed to delete channel' });
  }
});

// Get webhook URL for a channel
fastify.get('/api/channels/:id/webhook-url', async (request, reply) => {
  try {
    const { id } = request.params;
    const channel = await prisma.channel.findUnique({
      where: { id }
    });
    
    if (!channel) {
      return reply.code(404).send({ error: 'Channel not found' });
    }
    
    const publicUrl = getPublicUrl();
    // Channel Engine will automatically append ?channelId=<instanceName> parameter
    const webhookUrl = `${publicUrl}/webhook/nextVod`;
    
    return { webhookUrl };
  } catch (error) {
    reply.code(500).send({ error: 'Failed to get webhook URL' });
  }
});

// Global webhook URL endpoint (same for all channels)
fastify.get('/api/webhook-url', async (request, reply) => {
  try {
    const publicUrl = getPublicUrl();
    // Channel Engine will automatically append ?channelId=<instanceName> parameter
    const webhookUrl = `${publicUrl}/webhook/nextVod`;
    
    return { webhookUrl };
  } catch (error) {
    reply.code(500).send({ error: 'Failed to get webhook URL' });
  }
});

// VODs endpoints
fastify.get('/api/vods', async (request, reply) => {
  try {
    const vods = await prisma.vOD.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return vods;
  } catch (error) {
    reply.code(500).send({ error: 'Failed to fetch VODs' });
  }
});

fastify.post('/api/vods', async (request, reply) => {
  try {
    const { title, description, hlsUrl, durationMs, prerollUrl, prerollDurationMs, metadata } = request.body;
    
    // Auto-detect duration if not provided
    let finalDurationMs = durationMs;
    if (!finalDurationMs && hlsUrl) {
      console.log(`Auto-detecting duration for VOD: ${title}`);
      finalDurationMs = await getHLSDuration(hlsUrl);
    }
    
    const vod = await prisma.vOD.create({
      data: {
        title,
        description,
        hlsUrl,
        durationMs: finalDurationMs,
        prerollUrl,
        prerollDurationMs,
        metadata: metadata ? JSON.stringify(metadata) : null
      }
    });
    return vod;
  } catch (error) {
    reply.code(500).send({ error: 'Failed to create VOD' });
  }
});

fastify.get('/api/vods/:id', async (request, reply) => {
  try {
    const vod = await prisma.vOD.findUnique({
      where: { id: request.params.id }
    });
    if (!vod) {
      return reply.code(404).send({ error: 'VOD not found' });
    }
    if (vod.metadata) {
      vod.metadata = JSON.parse(vod.metadata);
    }
    return vod;
  } catch (error) {
    reply.code(500).send({ error: 'Failed to fetch VOD' });
  }
});

fastify.put('/api/vods/:id', async (request, reply) => {
  try {
    const { title, description, hlsUrl, durationMs, prerollUrl, prerollDurationMs, metadata } = request.body;
    const vod = await prisma.vOD.update({
      where: { id: request.params.id },
      data: {
        title,
        description,
        hlsUrl,
        durationMs,
        prerollUrl,
        prerollDurationMs,
        metadata: metadata ? JSON.stringify(metadata) : null
      }
    });
    return vod;
  } catch (error) {
    reply.code(500).send({ error: 'Failed to update VOD' });
  }
});

fastify.delete('/api/vods/:id', async (request, reply) => {
  try {
    await prisma.vOD.delete({
      where: { id: request.params.id }
    });
    return { success: true };
  } catch (error) {
    reply.code(500).send({ error: 'Failed to delete VOD' });
  }
});

// Schedule endpoints
fastify.get('/api/channels/:channelId/schedule', async (request, reply) => {
  try {
    const schedules = await prisma.schedule.findMany({
      where: { channelId: request.params.channelId },
      include: { vod: true },
      orderBy: { position: 'asc' }
    });
    return schedules;
  } catch (error) {
    reply.code(500).send({ error: 'Failed to fetch schedule' });
  }
});

// Get currently playing item using webhook logic
fastify.get('/api/channels/:channelId/current', async (request, reply) => {
  try {
    const { getNextVod } = require('./webhook');
    const currentVod = await getNextVod(request.params.channelId);
    return currentVod;
  } catch (error) {
    console.error('Error getting current item:', error);
    reply.code(500).send({ error: 'Failed to get current item' });
  }
});

fastify.post('/api/channels/:channelId/schedule', async (request, reply) => {
  try {
    const { vodId, scheduledStart, scheduledEnd, position, repeatPattern, useBackToBack } = request.body;
    const channelId = request.params.channelId;
    
    let finalScheduledStart, finalScheduledEnd, finalPosition;
    
    if (useBackToBack !== false) {
      // Use back-to-back scheduling by default
      const backToBackData = await calculateBackToBackSchedule(channelId, vodId, scheduledStart);
      finalScheduledStart = backToBackData.scheduledStart;
      finalScheduledEnd = backToBackData.scheduledEnd;
      finalPosition = position || backToBackData.position;
    } else {
      // Use manual scheduling
      const maxPosition = await prisma.schedule.aggregate({
        where: { channelId },
        _max: { position: true }
      });
      
      finalScheduledStart = new Date(scheduledStart);
      finalScheduledEnd = new Date(scheduledEnd);
      finalPosition = position || (maxPosition._max.position || 0) + 1;
    }
    
    const schedule = await prisma.schedule.create({
      data: {
        channelId,
        vodId,
        scheduledStart: finalScheduledStart,
        scheduledEnd: finalScheduledEnd,
        position: finalPosition,
        repeatPattern
      },
      include: { vod: true }
    });
    return schedule;
  } catch (error) {
    console.error('Error creating schedule entry:', error);
    reply.code(500).send({ error: 'Failed to create schedule entry' });
  }
});

fastify.put('/api/schedule/:id', async (request, reply) => {
  try {
    const { vodId, scheduledStart, scheduledEnd, position, repeatPattern, isActive } = request.body;
    const schedule = await prisma.schedule.update({
      where: { id: request.params.id },
      data: {
        vodId,
        scheduledStart: scheduledStart ? new Date(scheduledStart) : undefined,
        scheduledEnd: scheduledEnd ? new Date(scheduledEnd) : undefined,
        position,
        repeatPattern,
        isActive
      },
      include: { vod: true }
    });
    return schedule;
  } catch (error) {
    reply.code(500).send({ error: 'Failed to update schedule entry' });
  }
});

fastify.delete('/api/schedule/:id', async (request, reply) => {
  try {
    await prisma.schedule.delete({
      where: { id: request.params.id }
    });
    return { success: true };
  } catch (error) {
    reply.code(500).send({ error: 'Failed to delete schedule entry' });
  }
});

// Reorder schedule
fastify.put('/api/channels/:channelId/schedule/reorder', async (request, reply) => {
  try {
    const { scheduleIds } = request.body;
    
    const updates = scheduleIds.map((id, index) =>
      prisma.schedule.update({
        where: { id },
        data: { position: index + 1 }
      })
    );
    
    await Promise.all(updates);
    return { success: true };
  } catch (error) {
    reply.code(500).send({ error: 'Failed to reorder schedule' });
  }
});

// Rebalance schedule with back-to-back timing
fastify.put('/api/channels/:channelId/schedule/rebalance', async (request, reply) => {
  try {
    const { startFromPosition } = request.body;
    await rebalanceSchedule(request.params.channelId, startFromPosition || 1);
    return { success: true };
  } catch (error) {
    reply.code(500).send({ error: 'Failed to rebalance schedule' });
  }
});

// Update channel schedule start time
fastify.put('/api/channels/:channelId/schedule-start', async (request, reply) => {
  try {
    const { scheduleStart } = request.body;
    await updateChannelScheduleStart(request.params.channelId, scheduleStart);
    return { success: true };
  } catch (error) {
    reply.code(500).send({ error: 'Failed to update schedule start time' });
  }
});

// Auto-detect VOD duration endpoint
fastify.post('/api/vods/detect-duration', async (request, reply) => {
  try {
    const { hlsUrl } = request.body;
    if (!hlsUrl) {
      return reply.code(400).send({ error: 'hlsUrl is required' });
    }
    
    const durationMs = await getHLSDuration(hlsUrl);
    return { durationMs, durationSeconds: Math.round(durationMs / 1000) };
  } catch (error) {
    reply.code(500).send({ error: 'Failed to detect duration' });
  }
});

// Channel Engine management endpoints
fastify.post('/api/channels/:id/channel-engine', async (request, reply) => {
  try {
    const { id } = request.params;
    const { schedulerUrl } = request.body;
    
    if (!schedulerUrl) {
      return reply.code(400).send({ error: 'schedulerUrl is required' });
    }
    
    const channel = await prisma.channel.findUnique({ where: { id } });
    if (!channel) {
      return reply.code(404).send({ error: 'Channel not found' });
    }
    
    // Create Channel Engine instance name from channel name (alphanumeric only)
    const instanceName = channel.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const webhookUrl = `${schedulerUrl}/webhook/nextVod?channelId=${instanceName}`;
    
    // Create Channel Engine instance via OSC API
    let result;
    try {
      if (oscClient.isConfigured()) {
        console.log('Creating Channel Engine instance via OSC API...');
        result = await oscClient.createChannelEngineInstance(instanceName, webhookUrl);
      } else {
        console.log('OSC_ACCESS_TOKEN not configured, using simulation mode...');
        result = await oscClient.simulateChannelEngineCreation(instanceName, webhookUrl);
      }
    } catch (oscError) {
      console.error('Failed to create Channel Engine via OSC API:', oscError);
      throw new Error(`Failed to create Channel Engine instance: ${oscError.message}`);
    }
    
    await prisma.channel.update({
      where: { id },
      data: {
        channelEngineInstance: result.instanceName,
        channelEngineUrl: result.channelEngineUrl,
        webhookUrl: result.webhookUrl,
        lastStatusCheck: new Date()
      }
    });
    
    return { 
      instanceName: result.instanceName, 
      channelEngineUrl: result.channelEngineUrl, 
      webhookUrl: result.webhookUrl,
      message: result.simulated ? 'Channel Engine instance created successfully (simulated)' : 'Channel Engine instance created successfully',
      simulated: result.simulated || false
    };
  } catch (error) {
    console.error('Error creating Channel Engine:', error);
    reply.code(500).send({ error: 'Failed to create Channel Engine instance' });
  }
});

fastify.delete('/api/channels/:id/channel-engine', async (request, reply) => {
  try {
    const { id } = request.params;
    
    const channel = await prisma.channel.findUnique({ where: { id } });
    if (!channel) {
      return reply.code(404).send({ error: 'Channel not found' });
    }
    
    if (!channel.channelEngineInstance) {
      return reply.code(400).send({ error: 'No Channel Engine instance found for this channel' });
    }
    
    // Delete Channel Engine instance via OSC API
    const instanceName = channel.channelEngineInstance;
    let result;
    try {
      if (oscClient.isConfigured()) {
        console.log('Deleting Channel Engine instance via OSC API...');
        result = await oscClient.deleteChannelEngineInstance(instanceName);
      } else {
        console.log('OSC_ACCESS_TOKEN not configured, using simulation mode...');
        result = await oscClient.simulateChannelEngineDeletion(instanceName);
      }
    } catch (oscError) {
      console.error('Failed to delete Channel Engine via OSC API:', oscError);
      // Continue with database cleanup even if OSC API fails
      console.log('Proceeding with database cleanup...');
    }

    // Update database to remove Channel Engine references
    await prisma.channel.update({
      where: { id },
      data: {
        channelEngineInstance: null,
        channelEngineUrl: null,
        webhookUrl: null,
        isOnAir: false,
        lastStatusCheck: null
      }
    });
    
    return { 
      message: result && result.simulated ? 
        'Channel Engine instance deleted successfully (simulated)' : 
        'Channel Engine instance deleted successfully',
      simulated: result ? result.simulated || false : false
    };
  } catch (error) {
    console.error('Error deleting Channel Engine:', error);
    reply.code(500).send({ error: 'Failed to delete Channel Engine instance' });
  }
});

fastify.get('/api/channels/:id/status', async (request, reply) => {
  try {
    const { id } = request.params;
    
    const channel = await prisma.channel.findUnique({ where: { id } });
    if (!channel) {
      return reply.code(404).send({ error: 'Channel not found' });
    }
    
    if (!channel.channelEngineInstance) {
      return { isOnAir: false, status: 'no_engine' };
    }
    
    let isOnAir = false;
    let status = 'offline';
    let statusDetails = {};
    
    // Check if Channel Engine is "online" based on recent webhook calls
    // Consider online if webhook was called within last 2 minutes
    const webhookOnlineThreshold = 2 * 60 * 1000; // 2 minutes in milliseconds
    const now = new Date();
    let isWebhookOnline = false;
    
    if (channel.lastWebhookCall) {
      const timeSinceLastWebhook = now - new Date(channel.lastWebhookCall);
      isWebhookOnline = timeSinceLastWebhook <= webhookOnlineThreshold;
      statusDetails.lastWebhookCall = channel.lastWebhookCall;
      statusDetails.timeSinceLastWebhook = timeSinceLastWebhook;
      statusDetails.isWebhookOnline = isWebhookOnline;
    }
    
    // Check Channel Engine status via OSC API first
    if (oscClient.isConfigured()) {
      try {
        const oscStatus = await oscClient.getChannelEngineStatus(channel.channelEngineInstance);
        if (!oscStatus.error) {
          isOnAir = oscStatus.isRunning || false;
          status = oscStatus.status || 'unknown';
          statusDetails = { oscStatus: oscStatus.details };
        }
      } catch (oscError) {
        console.error('Failed to get OSC status:', oscError);
      }
    }
    
    // Fallback: Check if Channel Engine stream is accessible
    if (channel.channelEngineUrl && (!oscClient.isConfigured() || status === 'unknown')) {
      try {
        const response = await fetch(channel.channelEngineUrl, { method: 'HEAD' });
        const streamAccessible = response.ok;
        
        if (!oscClient.isConfigured()) {
          isOnAir = streamAccessible;
          status = streamAccessible ? 'on_air' : 'offline';
        }
        
        statusDetails.streamAccessible = streamAccessible;
      } catch (error) {
        statusDetails.streamError = error.message;
        if (!oscClient.isConfigured()) {
          status = 'error';
        }
      }
    }
    
    // Use webhook status as fallback or if no other method worked
    if (isWebhookOnline && (status === 'offline' || status === 'unknown')) {
      status = 'online_webhook';
      isOnAir = true;
    } else if (status === 'offline' && isWebhookOnline) {
      // Prefer webhook status for "online" indication
      status = 'online_webhook';
      isOnAir = true;
    }
    
    // Update status in database
    await prisma.channel.update({
      where: { id },
      data: {
        isOnAir,
        lastStatusCheck: new Date()
      }
    });
    
    return { 
      isOnAir, 
      status,
      lastCheck: new Date().toISOString(),
      streamUrl: channel.channelEngineUrl,
      instanceName: channel.channelEngineInstance,
      ...statusDetails
    };
  } catch (error) {
    console.error('Error checking channel status:', error);
    reply.code(500).send({ error: 'Failed to check channel status' });
  }
});

const start = async () => {
  try {
    // Seed database with sample VODs if empty
    await seedDatabase();
    
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Server listening on http://localhost:3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = { fastify, start };