const axios = require('axios');
const HLS = require('hls-parser');

async function getHLSDuration(hlsUrl) {
  try {
    console.log(`Fetching HLS manifest from: ${hlsUrl}`);
    
    const response = await axios.get(hlsUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Channel-Scheduler/1.0'
      }
    });

    const manifest = HLS.parse(response.data);
    
    if (manifest.isMasterPlaylist) {
      // If it's a master playlist, get the first variant and fetch its media playlist
      if (manifest.variants && manifest.variants.length > 0) {
        const variantUrl = new URL(manifest.variants[0].uri, hlsUrl).href;
        return await getHLSDuration(variantUrl);
      }
      throw new Error('Master playlist has no variants');
    }

    // Calculate total duration from media playlist
    let totalDuration = 0;
    
    if (manifest.segments && manifest.segments.length > 0) {
      // Sum up all segment durations
      for (const segment of manifest.segments) {
        totalDuration += segment.duration || 0;
      }
    } else if (manifest.targetDuration) {
      // Fallback: estimate based on target duration and segment count
      const estimatedSegments = 10; // Default estimation
      totalDuration = manifest.targetDuration * estimatedSegments;
      console.warn(`No segments found, estimating duration: ${totalDuration}s`);
    }

    const durationMs = Math.round(totalDuration * 1000);
    console.log(`Detected HLS duration: ${totalDuration}s (${durationMs}ms)`);
    
    return durationMs;
  } catch (error) {
    console.error('Error detecting HLS duration:', error.message);
    
    // Return a default duration if detection fails
    const defaultDurationMs = 300000; // 5 minutes
    console.warn(`Using default duration: ${defaultDurationMs}ms`);
    return defaultDurationMs;
  }
}

async function validateHLSUrl(hlsUrl) {
  try {
    const response = await axios.head(hlsUrl, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Channel-Scheduler/1.0'
      }
    });
    
    const contentType = response.headers['content-type'] || '';
    return contentType.includes('application/vnd.apple.mpegurl') || 
           contentType.includes('application/x-mpegURL') ||
           hlsUrl.endsWith('.m3u8');
  } catch (error) {
    console.error('Error validating HLS URL:', error.message);
    return false;
  }
}

module.exports = {
  getHLSDuration,
  validateHLSUrl
};