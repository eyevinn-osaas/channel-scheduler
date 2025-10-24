require('dotenv').config();
const { Context, createInstance, listInstances, removeInstance } = require('@osaas/client-core');

class OSCClient {
    constructor() {
        this.accessToken = process.env.OSC_ACCESS_TOKEN;
        this.context = null;
        
        if (this.accessToken) {
            this.context = new Context({
                personalAccessToken: this.accessToken
            });
        }
    }

    isConfigured() {
        return !!this.accessToken && !!this.context;
    }

    async createChannelEngineInstance(instanceName, webhookUrl) {
        if (!this.isConfigured()) {
            throw new Error('OSC_ACCESS_TOKEN environment variable is not configured');
        }

        try {
            console.log(`Creating Channel Engine instance: ${instanceName}`);
            console.log(`Webhook URL: ${webhookUrl}`);

            // Get service access token
            const serviceAccessToken = await this.context.getServiceAccessToken('channel-engine');

            // Create Channel Engine instance using the correct type: "WebHook"
            const instance = await createInstance(
                this.context,
                'channel-engine',
                serviceAccessToken,
                {
                    name: instanceName,
                    type: 'WebHook',
                    url: webhookUrl
                }
            );

            console.log(`Channel Engine instance created successfully:`, instance);

            // Use the URL from the response or construct fallback
            const channelEngineUrl = instance.url || `https://${instanceName}.ce.prod.osaas.io/channels/${instanceName}/master.m3u8`;

            return {
                instanceName,
                channelEngineUrl,
                webhookUrl,
                oscResponse: instance
            };
        } catch (error) {
            console.error('Failed to create Channel Engine via OSC API:', error);
            throw error;
        }
    }

    async deleteChannelEngineInstance(instanceName) {
        if (!this.isConfigured()) {
            throw new Error('OSC_ACCESS_TOKEN environment variable is not configured');
        }

        try {
            console.log(`Deleting Channel Engine instance: ${instanceName}`);

            // Get service access token
            const serviceAccessToken = await this.context.getServiceAccessToken('channel-engine');

            // Delete the Channel Engine instance using the OSC API
            const result = await removeInstance(this.context, 'channel-engine', instanceName, serviceAccessToken);

            console.log(`Channel Engine instance deleted successfully: ${instanceName}`);
            return { 
                success: true, 
                instanceName, 
                result: result,
                simulated: false 
            };
        } catch (error) {
            console.error('Failed to delete Channel Engine via OSC API:', error);
            throw error;
        }
    }

    async listChannelEngineInstances() {
        if (!this.isConfigured()) {
            throw new Error('OSC_ACCESS_TOKEN environment variable is not configured');
        }

        try {
            console.log('Listing Channel Engine instances via OSC API...');

            // Get service access token
            const serviceAccessToken = await this.context.getServiceAccessToken('channel-engine');

            // List all Channel Engine instances
            const instances = await listInstances(this.context, 'channel-engine', serviceAccessToken);

            console.log(`Found ${instances.length} Channel Engine instances`);

            // Filter for WebHook type instances only
            const webhookInstances = instances.filter(instance => 
                (instance.type || 'WebHook') === 'WebHook'
            );

            console.log(`Filtered to ${webhookInstances.length} WebHook instances`);

            // Get this application's webhook URL for comparison
            const publicUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
            const appWebhookUrl = `${publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl}/webhook/nextVod`;

            return webhookInstances.map(instance => {
                // Check if this instance's webhook URL matches our application's webhook
                const isConnected = instance.opts?.url && 
                    instance.opts.url.startsWith(appWebhookUrl);

                return {
                    name: instance.name,
                    status: instance.status,
                    url: instance.url,
                    created: instance.created,
                    lastModified: instance.lastModified,
                    type: instance.type || 'WebHook',
                    webhookUrl: instance.opts?.webhook,
                    isConnected: isConnected
                };
            });
        } catch (error) {
            console.error('Failed to list Channel Engine instances:', error);
            throw error;
        }
    }

    async getChannelEngineStatus(instanceName) {
        if (!this.isConfigured()) {
            return { error: 'OSC not configured' };
        }

        try {
            const result = await getChannelEngineInstance(this.context, {
                name: instanceName
            });
            return { 
                isRunning: result.status === 'running',
                status: result.status,
                details: result
            };
        } catch (error) {
            console.error('Failed to get Channel Engine status:', error);
            return { error: error.message };
        }
    }

}

module.exports = { OSCClient };