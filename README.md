# Channel Scheduler

A web-based interface for scheduling and managing video content for [Eyevinn Channel Engine](https://www.osaas.io/services/channel-engine) instances. This application provides a professional broadcast-style rundown interface for creating and managing linear TV channel schedules.

## Features

- **Professional Rundown Interface**: Compact, broadcast-style schedule view with start times and current playing indicators
- **Real-time Status**: Live webhook-based status monitoring of channel engines
- **Channel Management**: Create and manage multiple TV channels
- **VOD Library**: Maintain a library of video on demand content
- **Schedule Management**: Add, reorder, and time content for automatic playback
- **Webhook Integration**: Seamless integration with Channel Engine webhook system

## Prerequisites

- Node.js 16+ and npm
- PostgreSQL database
- [Eyevinn Channel Engine](https://www.osaas.io/services/channel-engine) instance(s)

## Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd channel-scheduler
npm install
```

### 2. Database Setup

```bash
# Set up your PostgreSQL database
npx prisma migrate dev
```

### 3. Environment Configuration

Create a `.env` file:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/channel_scheduler"
PORT=3000
PUBLIC_URL="http://localhost:3000"
```

For webhook functionality, you'll need a publicly accessible URL. Use ngrok for development:

```bash
# Install ngrok if you haven't already
npm install -g ngrok

# Start ngrok tunnel
ngrok http 3000

# Update your .env file with the ngrok URL
PUBLIC_URL="https://your-ngrok-url.ngrok-free.app"
```

### 4. Start the Application

```bash
npm start
```

The application will be available at `http://localhost:3000`

## Channel Engine Setup

### Creating a Channel Engine Instance

1. Go to [OSC (Open Source Cloud)](https://www.osaas.io/)
2. Create a new **Channel Engine** instance
3. **CRITICAL**: The instance name must exactly match your channel name in the scheduler

### Instance Name Matching Requirement

⚠️ **IMPORTANT**: The Channel Engine instance name in OSC must exactly match the channel name you create in the Channel Scheduler. This is how the webhook system identifies which channel to serve content for.

**Example:**
- Channel Scheduler channel name: `my-awesome-channel`
- OSC Channel Engine instance name: `my-awesome-channel`

### Webhook Configuration

The Channel Scheduler automatically provides webhook URLs for your channels. The webhook endpoint follows this format:

```
https://your-domain.com/webhook/nextVod?channelId=CHANNEL_NAME
```

**Channel Engine Configuration:**
1. Set the webhook URL in your Channel Engine instance configuration
2. The Channel Engine will call this webhook to get the next video to play
3. The scheduler responds with the appropriate content based on the current schedule

### Channel Engine Environment Variables

When creating your Channel Engine instance, you may need to configure:

- `WEBHOOK_URL`: Set this to your Channel Scheduler webhook URL
- `PRESET`: Choose appropriate channel preset (e.g., `tv`, `radio`)
- Other settings as needed for your specific use case

## Usage

### 1. Create a Channel

1. Click **"Add Channel"** in the Channels view
2. Enter channel name (must match your OSC instance name exactly)
3. Set description and webhook URL
4. Configure schedule start time
5. Enable automatic back-to-back scheduling if desired

### 2. Add VOD Content

1. Switch to the **VODs** tab
2. Click **"Add VOD"**
3. Enter title, description, and HLS URL
4. Use **"Detect"** to automatically determine duration from HLS manifest
5. Optionally add preroll content

### 3. Schedule Content

1. Select a channel to view its schedule
2. Click **"Add VOD"** to add content to the schedule
3. Choose back-to-back scheduling or set specific times
4. Use **"Rebalance"** to redistribute timing across all scheduled content
5. Monitor the **"ON AIR"** indicator to see what's currently playing

### 4. Monitor Status

- **Online/Offline Status**: Shows if the Channel Engine is actively requesting content
- **Current Playing**: Red border and "ON AIR" indicator show what's currently broadcasting
- **Webhook Activity**: Status updates automatically based on webhook calls from Channel Engine

## API Endpoints

### Webhook Endpoints

- `GET /webhook/nextVod?channelId=CHANNEL_ID` - Returns next scheduled content
- `GET /webhook/health` - Health check endpoint

### Management API

- `GET /api/channels` - List all channels
- `POST /api/channels` - Create new channel
- `GET /api/channels/:id/schedule` - Get channel schedule
- `GET /api/channels/:id/current` - Get currently playing content
- `GET /api/vods` - List all VODs
- `POST /api/vods` - Create new VOD

## Development

### Database Management

```bash
# Generate Prisma client
npx prisma generate

# View database in browser
npx prisma studio

# Reset database
npx prisma migrate reset
```

### Project Structure

```
├── src/
│   ├── server.js         # Main server and API routes
│   └── webhook.js        # Webhook handling logic
├── public/
│   ├── index.html        # Main UI
│   └── app.js           # Frontend JavaScript
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── migrations/       # Database migrations
└── package.json
```

## Troubleshooting

### Channel Engine Not Responding

1. Verify the instance name exactly matches your channel name
2. Check that the webhook URL is publicly accessible
3. Ensure the Channel Engine instance is running and properly configured
4. Check the application logs for webhook request errors

### Content Not Playing

1. Verify VOD URLs are accessible and valid HLS streams
2. Check that content is properly scheduled with valid start/end times
3. Ensure the channel has a schedule start time set
4. Verify the Channel Engine is calling the webhook (check Online/Offline status)

### Database Issues

```bash
# Reset and recreate database
npx prisma migrate reset
npx prisma migrate dev
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

Copyright (c) 2025 Eyevinn Technology AB