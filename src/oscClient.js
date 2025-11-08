require('dotenv').config();
const { Context, createInstance, listInstances, removeInstance, getInstance } = require('@osaas/client-core');
const { createMinioMinioInstance, getMinioMinioInstance, removeMinioMinioInstance } = require('@osaas/client-services');

// Try to import FFmpeg S3 functions (may not exist in current version)
let createTranscodeEyevinnFfmpegS3Instance, getTranscodeEyevinnFfmpegS3Instance, removeTranscodeEyevinnFfmpegS3Instance;
try {
    const transcodeServices = require('@osaas/client-services');
    createTranscodeEyevinnFfmpegS3Instance = transcodeServices.createTranscodeEyevinnFfmpegS3Instance;
    getTranscodeEyevinnFfmpegS3Instance = transcodeServices.getTranscodeEyevinnFfmpegS3Instance;
    removeTranscodeEyevinnFfmpegS3Instance = transcodeServices.removeTranscodeEyevinnFfmpegS3Instance;
} catch (error) {
    console.log('FFmpeg S3 transcoding functions not available in current client-services version');
}

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

    generateSecurePassword(length = 16) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return password;
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

    async createMinioInstance(instanceName, username = 'admin', password = null) {
        if (!this.isConfigured()) {
            throw new Error('OSC_ACCESS_TOKEN environment variable is not configured');
        }

        try {
            console.log(`Creating MinIO instance: ${instanceName}`);

            // Generate a random password if not provided
            const rootPassword = password || this.generateSecurePassword();

            const instance = await createMinioMinioInstance(this.context, {
                name: instanceName,
                RootUser: username,
                RootPassword: rootPassword
            });

            console.log(`MinIO instance created successfully:`, instance);

            // Wait for instance to be ready and get credentials
            let retries = 0;
            const maxRetries = 30;
            let instanceDetails;

            while (retries < maxRetries) {
                try {
                    instanceDetails = await getMinioMinioInstance(this.context, instanceName);
                    if (instanceDetails && instanceDetails.url && instanceDetails.RootUser) {
                        console.log(`MinIO instance ready with URL: ${instanceDetails.url}`);
                        break;
                    }
                    console.log(`MinIO instance not ready yet, waiting... (${retries + 1}/${maxRetries})`);
                } catch (error) {
                    console.log(`Waiting for MinIO instance to be ready... (${retries + 1}/${maxRetries})`);
                }
                
                await new Promise(resolve => setTimeout(resolve, 2000));
                retries++;
            }

            if (!instanceDetails) {
                throw new Error('MinIO instance not found or not accessible after creation');
            }

            if (!instanceDetails.url || !instanceDetails.RootUser) {
                throw new Error('MinIO instance created but not ready yet');
            }

            return {
                instanceName,
                endpoint: instanceDetails.url,
                rootUser: instanceDetails.RootUser,
                rootPassword: instanceDetails.RootPassword,
                region: instanceDetails.region || 'us-east-1',
                oscResponse: instanceDetails
            };
        } catch (error) {
            console.error('Failed to create MinIO instance via OSC API:', error);
            throw error;
        }
    }

    async getMinioInstance(instanceName) {
        if (!this.isConfigured()) {
            throw new Error('OSC_ACCESS_TOKEN environment variable is not configured');
        }

        try {
            const instance = await getMinioMinioInstance(this.context, instanceName);
            
            // Handle case where instance exists but is not running
            if (!instance) {
                throw new Error(`MinIO instance '${instanceName}' not found or not accessible`);
            }

            return {
                instanceName,
                endpoint: instance.url,
                rootUser: instance.RootUser,
                rootPassword: instance.RootPassword,
                region: instance.region || 'us-east-1',
                oscResponse: instance
            };
        } catch (error) {
            console.error('Failed to get MinIO instance:', error);
            throw error;
        }
    }

    async deleteMinioInstance(instanceName) {
        if (!this.isConfigured()) {
            throw new Error('OSC_ACCESS_TOKEN environment variable is not configured');
        }

        try {
            console.log(`Deleting MinIO instance: ${instanceName}`);

            await removeMinioMinioInstance(this.context, instanceName);

            console.log(`MinIO instance deleted successfully: ${instanceName}`);
            return { 
                success: true, 
                instanceName
            };
        } catch (error) {
            console.error('Failed to delete MinIO instance via OSC API:', error);
            throw error;
        }
    }

    async createMinioBuckets(minioConfig, bucketNames = ['input', 'output'], makeOutputPublic = true) {
        const AWS = require('aws-sdk');
        
        const s3 = new AWS.S3({
            endpoint: minioConfig.endpoint,
            accessKeyId: minioConfig.rootUser,
            secretAccessKey: minioConfig.rootPassword,
            region: minioConfig.region,
            s3ForcePathStyle: true,
            signatureVersion: 'v4'
        });

        const results = [];

        for (const bucketName of bucketNames) {
            try {
                // Check if bucket already exists
                let bucketExists = false;
                try {
                    await s3.headBucket({ Bucket: bucketName }).promise();
                    bucketExists = true;
                    console.log(`Bucket '${bucketName}' already exists`);
                } catch (headError) {
                    // Bucket doesn't exist, we'll create it
                    console.log(`Creating bucket: ${bucketName}`);
                    await s3.createBucket({ Bucket: bucketName }).promise();
                    console.log(`Successfully created bucket: ${bucketName}`);
                }
                
                // If this is the output bucket and makeOutputPublic is true, set public read policy
                if (bucketName === 'output' && makeOutputPublic) {
                    const publicReadPolicy = {
                        Version: '2012-10-17',
                        Statement: [
                            {
                                Sid: 'PublicReadGetObject',
                                Effect: 'Allow',
                                Principal: '*',
                                Action: 's3:GetObject',
                                Resource: `arn:aws:s3:::${bucketName}/*`
                            }
                        ]
                    };

                    try {
                        await s3.putBucketPolicy({
                            Bucket: bucketName,
                            Policy: JSON.stringify(publicReadPolicy)
                        }).promise();
                        
                        console.log(`Set public read policy for bucket: ${bucketName}`);
                    } catch (policyError) {
                        console.warn(`Failed to set public policy for bucket ${bucketName}:`, policyError.message);
                    }
                }

                results.push({
                    bucket: bucketName,
                    success: true,
                    existed: bucketExists,
                    isPublic: bucketName === 'output' && makeOutputPublic
                });
            } catch (error) {
                console.error(`Failed to handle bucket ${bucketName}:`, error);
                results.push({
                    bucket: bucketName,
                    success: false,
                    error: error.message
                });
            }
        }

        return results;
    }

    async createTranscodingJob(jobName, inputS3Path, outputS3Path, minioConfig) {
        if (!this.isConfigured()) {
            throw new Error('OSC_ACCESS_TOKEN environment variable is not configured');
        }

        try {
            console.log(`Creating transcoding job: ${jobName}`);

            // FFmpeg command to transcode to HLS
            const cmdLineArgs = [
                `-i s3://input/${inputS3Path}`,
                '-c:v libx264',
                '-preset medium',
                '-crf 23',
                '-c:a aac',
                '-ar 48000',
                '-b:a 128k',
                '-f hls',
                '-hls_time 6',
                '-hls_list_size 0',
                '-hls_flags independent_segments',
                `-hls_segment_filename s3://output/${outputS3Path}/segment_%03d.ts`,
                `s3://output/${outputS3Path}/master.m3u8`
            ].join(' ');

            // Try using the dedicated FFmpeg S3 service if available
            if (createTranscodeEyevinnFfmpegS3Instance) {
                const instance = await createTranscodeEyevinnFfmpegS3Instance(this.context, {
                    name: jobName,
                    cmdLineArgs: cmdLineArgs,
                    awsAccessKeyId: minioConfig.rootUser,
                    awsSecretAccessKey: minioConfig.rootPassword,
                    s3EndpointUrl: minioConfig.endpoint,
                    awsRegion: minioConfig.region || 'us-east-1'
                });

                console.log(`Transcoding job created successfully:`, instance);
                return {
                    jobId: instance.name,
                    status: 'pending',
                    inputPath: inputS3Path,
                    outputPath: outputS3Path,
                    oscResponse: instance
                };
            } else {
                // Fallback: Use generic createInstance method
                const serviceAccessToken = await this.context.getServiceAccessToken('eyevinn-ffmpeg-s3');
                const instance = await createInstance(
                    this.context,
                    'eyevinn-ffmpeg-s3',
                    serviceAccessToken,
                    {
                        name: jobName,
                        cmdLineArgs: cmdLineArgs,
                        awsAccessKeyId: minioConfig.rootUser,
                        awsSecretAccessKey: minioConfig.rootPassword,
                        s3EndpointUrl: minioConfig.endpoint,
                        awsRegion: minioConfig.region || 'us-east-1'
                    }
                );

                console.log(`Transcoding job created successfully (fallback):`, instance);
                return {
                    jobId: instance.name,
                    status: 'pending', 
                    inputPath: inputS3Path,
                    outputPath: outputS3Path,
                    oscResponse: instance
                };
            }
        } catch (error) {
            console.error('Failed to create transcoding job:', error);
            throw error;
        }
    }

    async getTranscodingJobStatus(jobName) {
        if (!this.isConfigured()) {
            throw new Error('OSC_ACCESS_TOKEN environment variable is not configured');
        }

        try {
            let jobDetails;
            
            if (getTranscodeEyevinnFfmpegS3Instance) {
                jobDetails = await getTranscodeEyevinnFfmpegS3Instance(this.context, jobName);
            } else {
                // Fallback: Use generic getInstance approach
                const serviceAccessToken = await this.context.getServiceAccessToken('eyevinn-ffmpeg-s3');
                jobDetails = await getInstance(this.context, 'eyevinn-ffmpeg-s3', jobName, serviceAccessToken);
            }

            if (!jobDetails) {
                throw new Error(`Transcoding job '${jobName}' not found`);
            }

            // Map OSC status to our status
            let status = 'unknown';
            if (jobDetails.status === 'Running') {
                status = 'processing';
            } else if (jobDetails.status === 'Complete' || jobDetails.status === 'SuccessCriteriaMet') {
                status = 'completed';
            } else if (jobDetails.status === 'Failed' || jobDetails.status === 'Error') {
                status = 'failed';
            } else if (jobDetails.status === 'Suspended') {
                status = 'suspended';
            } else {
                status = 'pending';
            }

            return {
                jobId: jobName,
                status: status,
                oscStatus: jobDetails.status,
                details: jobDetails
            };
        } catch (error) {
            console.error('Failed to get transcoding job status:', error);
            throw error;
        }
    }

    async deleteTranscodingJob(jobName) {
        if (!this.isConfigured()) {
            throw new Error('OSC_ACCESS_TOKEN environment variable is not configured');
        }

        try {
            console.log(`Deleting transcoding job: ${jobName}`);

            if (removeTranscodeEyevinnFfmpegS3Instance) {
                await removeTranscodeEyevinnFfmpegS3Instance(this.context, jobName);
            } else {
                // Fallback: Use generic removeInstance
                const serviceAccessToken = await this.context.getServiceAccessToken('eyevinn-ffmpeg-s3');
                await removeInstance(this.context, 'eyevinn-ffmpeg-s3', jobName, serviceAccessToken);
            }

            console.log(`Transcoding job deleted successfully: ${jobName}`);
            return { success: true, jobId: jobName };
        } catch (error) {
            console.error('Failed to delete transcoding job:', error);
            throw error;
        }
    }

}

module.exports = { OSCClient };