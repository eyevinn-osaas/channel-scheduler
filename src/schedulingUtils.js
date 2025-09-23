const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function calculateBackToBackSchedule(channelId, vodId, customStartTime = null) {
  try {
    // Get the VOD details
    const vod = await prisma.vOD.findUnique({
      where: { id: vodId }
    });

    if (!vod) {
      throw new Error('VOD not found');
    }

    // Get channel details
    const channel = await prisma.channel.findUnique({
      where: { id: channelId }
    });

    if (!channel) {
      throw new Error('Channel not found');
    }

    // Find the last scheduled item for this channel
    const lastScheduleItem = await prisma.schedule.findFirst({
      where: { channelId },
      orderBy: [
        { scheduledEnd: 'desc' },
        { position: 'desc' }
      ]
    });

    let scheduledStart;
    
    if (customStartTime) {
      // Use custom start time if provided
      scheduledStart = new Date(customStartTime);
    } else if (lastScheduleItem) {
      // Schedule back-to-back after the last item
      scheduledStart = new Date(lastScheduleItem.scheduledEnd);
    } else if (channel.scheduleStart) {
      // Use channel's schedule start time for first item
      scheduledStart = new Date(channel.scheduleStart);
    } else {
      // Default to current time if no schedule start is set
      scheduledStart = new Date();
    }

    // Calculate end time based on VOD duration
    const scheduledEnd = new Date(scheduledStart.getTime() + vod.durationMs);

    // Get the next position number
    const maxPosition = await prisma.schedule.aggregate({
      where: { channelId },
      _max: { position: true }
    });

    const position = (maxPosition._max.position || 0) + 1;

    return {
      scheduledStart,
      scheduledEnd,
      position,
      vodDuration: vod.durationMs
    };
  } catch (error) {
    console.error('Error calculating back-to-back schedule:', error);
    throw error;
  }
}

async function rebalanceSchedule(channelId, startFromPosition = 1) {
  try {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId }
    });

    if (!channel) {
      throw new Error('Channel not found');
    }

    // Get all schedule items for this channel, ordered by position
    const scheduleItems = await prisma.schedule.findMany({
      where: { channelId, position: { gte: startFromPosition } },
      include: { vod: true },
      orderBy: { position: 'asc' }
    });

    if (scheduleItems.length === 0) {
      return;
    }

    // Determine start time for rebalancing
    let currentTime;
    
    if (startFromPosition === 1) {
      // Starting from the beginning
      currentTime = channel.scheduleStart ? new Date(channel.scheduleStart) : new Date();
    } else {
      // Get the end time of the previous item
      const previousItem = await prisma.schedule.findFirst({
        where: { channelId, position: startFromPosition - 1 }
      });
      currentTime = previousItem ? new Date(previousItem.scheduledEnd) : new Date();
    }

    // Update each schedule item with back-to-back timing
    const updates = [];
    
    for (const item of scheduleItems) {
      const scheduledStart = new Date(currentTime);
      const scheduledEnd = new Date(currentTime.getTime() + item.vod.durationMs);
      
      updates.push(
        prisma.schedule.update({
          where: { id: item.id },
          data: {
            scheduledStart,
            scheduledEnd
          }
        })
      );
      
      // Move current time to the end of this item
      currentTime = scheduledEnd;
    }

    await Promise.all(updates);
    console.log(`Rebalanced ${scheduleItems.length} schedule items for channel ${channelId}`);
  } catch (error) {
    console.error('Error rebalancing schedule:', error);
    throw error;
  }
}

async function updateChannelScheduleStart(channelId, newStartTime) {
  try {
    // Update the channel's schedule start time
    await prisma.channel.update({
      where: { id: channelId },
      data: { scheduleStart: new Date(newStartTime) }
    });

    // Rebalance the entire schedule
    await rebalanceSchedule(channelId, 1);
    
    console.log(`Updated schedule start time and rebalanced channel ${channelId}`);
  } catch (error) {
    console.error('Error updating channel schedule start:', error);
    throw error;
  }
}

module.exports = {
  calculateBackToBackSchedule,
  rebalanceSchedule,
  updateChannelScheduleStart
};