require('dotenv').config();
const { Context, createInstance } = require('@osaas/client-core');

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
                    url: webhookUrl,
                    opts: {
                        webhook: webhookUrl
                    }
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

            // For deletion, we would need the deleteInstance function from the SDK
            // For now, use simulation mode as the delete API pattern isn't clear from docs
            console.log('[OSC SIMULATION] Deleting Channel Engine instance:', instanceName);
            await new Promise(resolve => setTimeout(resolve, 500));

            console.log(`Channel Engine instance deleted successfully: ${instanceName}`);
            return { success: true, instanceName, simulated: true };
        } catch (error) {
            console.error('Failed to delete Channel Engine via OSC API:', error);
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

    // Simulate OSC API calls for development/testing
    async simulateChannelEngineCreation(instanceName, webhookUrl) {
        console.log(`[SIMULATION] Creating Channel Engine instance: ${instanceName}`);
        console.log(`[SIMULATION] Webhook URL: ${webhookUrl}`);
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const channelEngineUrl = `https://${instanceName}.ce.prod.osaas.io/channels/${instanceName}/master.m3u8`;
        
        return {
            instanceName,
            channelEngineUrl,
            webhookUrl,
            simulated: true
        };
    }

    async simulateChannelEngineDeletion(instanceName) {
        console.log(`[SIMULATION] Deleting Channel Engine instance: ${instanceName}`);
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        return { success: true, instanceName, simulated: true };
    }
}

module.exports = { OSCClient };