class ChannelScheduler {
    constructor() {
        this.currentChannelId = null;
        this.editingChannelId = null;
        this.editingVodId = null;
        this.editingScheduleId = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.showView('channels');
        this.loadChannels();
        this.loadVODs();
        this.loadGlobalWebhookUrl();
    }

    bindEvents() {
        // Tab navigation
        document.getElementById('channels-tab').addEventListener('click', () => {
            this.showView('channels');
            this.loadChannels();
        });
        document.getElementById('vods-tab').addEventListener('click', () => {
            this.showView('vods');
            this.loadVODs();
        });
        document.getElementById('channel-engines-tab').addEventListener('click', () => {
            this.showView('channel-engines');
            this.loadChannelEngines();
        });
        document.getElementById('back-to-channels').addEventListener('click', () => {
            this.showView('channels');
        });

        // Modal events
        document.getElementById('add-channel-btn').addEventListener('click', () => this.showChannelModal());
        document.getElementById('add-vod-btn').addEventListener('click', () => this.showVODModal());
        document.getElementById('refresh-engines-btn').addEventListener('click', () => this.loadChannelEngines());
        
        // Sidebar events
        document.getElementById('toggle-vod-sidebar-btn').addEventListener('click', () => this.toggleVODSidebar());
        document.getElementById('close-vod-sidebar').addEventListener('click', () => this.hideVODSidebar());
        document.getElementById('sidebar-overlay').addEventListener('click', () => this.hideVODSidebar());
        document.getElementById('vod-search').addEventListener('input', (e) => this.searchVODs(e.target.value));
        
        // Schedule management events
        document.getElementById('set-schedule-start-btn').addEventListener('click', () => this.showSetScheduleStartModal());
        document.getElementById('rebalance-schedule-btn').addEventListener('click', () => this.rebalanceSchedule());
        document.getElementById('detect-duration-btn').addEventListener('click', () => this.detectVODDuration());
        
        // Toggle manual schedule fields
        document.getElementById('schedule-back-to-back').addEventListener('change', (e) => {
            const manualFields = document.getElementById('manual-schedule-fields');
            if (e.target.checked) {
                manualFields.classList.add('hidden');
            } else {
                manualFields.classList.remove('hidden');
            }
        });

        // Form events
        document.getElementById('channel-form').addEventListener('submit', (e) => this.handleChannelSubmit(e));
        document.getElementById('vod-form').addEventListener('submit', (e) => this.handleVODSubmit(e));
        document.getElementById('schedule-form').addEventListener('submit', (e) => this.handleScheduleSubmit(e));
        document.getElementById('set-start-time-form').addEventListener('submit', (e) => this.handleSetStartTimeSubmit(e));
        
        // Set Start Time modal events
        document.getElementById('set-now-btn').addEventListener('click', () => this.setCurrentTime());

        // Modal close events
        document.getElementById('cancel-channel').addEventListener('click', () => this.hideChannelModal());
        document.getElementById('cancel-vod').addEventListener('click', () => this.hideVODModal());
        document.getElementById('cancel-schedule').addEventListener('click', () => this.hideScheduleModal());
        document.getElementById('cancel-set-start-time').addEventListener('click', () => this.hideSetStartTimeModal());

        // Global webhook URL events
        document.getElementById('copy-global-webhook').addEventListener('click', () => this.copyGlobalWebhookUrl());
        document.getElementById('global-webhook-url').addEventListener('click', () => this.copyGlobalWebhookUrl());

        // Click outside modal to close
        document.getElementById('channel-modal').addEventListener('click', (e) => {
            if (e.target.id === 'channel-modal') this.hideChannelModal();
        });
        document.getElementById('vod-modal').addEventListener('click', (e) => {
            if (e.target.id === 'vod-modal') this.hideVODModal();
        });
        document.getElementById('schedule-modal').addEventListener('click', (e) => {
            if (e.target.id === 'schedule-modal') this.hideScheduleModal();
        });
        document.getElementById('set-start-time-modal').addEventListener('click', (e) => {
            if (e.target.id === 'set-start-time-modal') this.hideSetStartTimeModal();
        });
    }

    showView(viewName) {
        document.querySelectorAll('.view').forEach(view => view.classList.add('hidden'));
        document.getElementById(`${viewName}-view`).classList.remove('hidden');
        
        // Update active tab
        document.querySelectorAll('nav button').forEach(btn => {
            btn.classList.remove('bg-blue-500');
            btn.classList.add('bg-blue-700');
        });
        if (viewName !== 'schedule') {
            document.getElementById(`${viewName}-tab`).classList.add('bg-blue-500');
            document.getElementById(`${viewName}-tab`).classList.remove('bg-blue-700');
        }
    }

    async loadChannels() {
        try {
            const response = await fetch('/api/channels');
            const channels = await response.json();
            this.renderChannels(channels);
        } catch (error) {
            console.error('Error loading channels:', error);
        }
    }

    renderChannels(channels) {
        const container = document.getElementById('channels-list');
        container.innerHTML = channels.map(channel => `
            <div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div class="flex justify-between items-start mb-4">
                    <div class="flex items-center space-x-3">
                        <h3 class="text-xl font-semibold text-gray-800">${channel.name}</h3>
                        <div id="status-${channel.id}" class="status-indicator">
                            ${this.getStatusBadge(channel)}
                        </div>
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="app.editChannel('${channel.id}')" class="text-blue-500 hover:text-blue-700">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="app.deleteChannel('${channel.id}')" class="text-red-500 hover:text-red-700">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <p class="text-gray-600 mb-4">${channel.description || 'No description'}</p>
                
                <!-- Channel Engine Status -->
                ${channel.channelEngineInstance ? `
                    <div class="mb-4 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                        <div>
                            <p class="text-sm font-medium text-blue-800">Channel Engine: ${channel.channelEngineInstance}</p>
                            ${channel.channelEngineUrl ? `
                                <a href="${channel.channelEngineUrl}" target="_blank" class="text-xs text-blue-600 hover:text-blue-800">
                                    <i class="fas fa-external-link-alt mr-1"></i>View Stream
                                </a>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}
                
                
                <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-500">
                        <i class="fas fa-calendar mr-1"></i>
                        ${channel._count?.schedules || 0} scheduled items
                    </span>
                    <button onclick="app.viewSchedule('${channel.id}', '${channel.name}')" 
                            class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">
                        <i class="fas fa-calendar-alt mr-1"></i>View Schedule
                    </button>
                </div>
                
                ${channel.webhookUrl ? `
                    <div class="mt-3 p-2 bg-green-50 rounded border-l-4 border-green-400">
                        <p class="text-sm text-green-700">
                            <i class="fas fa-link mr-1"></i>Webhook configured
                        </p>
                    </div>
                ` : ''}
            </div>
        `).join('');
        
        // Load status for each channel
        channels.forEach(channel => {
            if (channel.channelEngineInstance) {
                this.loadChannelStatus(channel.id);
            }
        });
    }


    async loadGlobalWebhookUrl() {
        try {
            // Try to load from the server first
            const response = await fetch('/api/webhook-url');
            const data = await response.json();
            
            const webhookElement = document.getElementById('global-webhook-url');
            if (webhookElement) {
                webhookElement.value = data.webhookUrl;
            }
        } catch (error) {
            console.error('Failed to load global webhook URL from server, using fallback:', error);
            // Fallback: construct it from current location
            const webhookElement = document.getElementById('global-webhook-url');
            if (webhookElement) {
                // Check if we're using ngrok from .env
                if (window.location.hostname === 'localhost') {
                    // Use the same pattern as the server would generate
                    webhookElement.value = `https://d2fbed686dbc.ngrok-free.app/webhook/nextVod`;
                } else {
                    webhookElement.value = `${window.location.origin}/webhook/nextVod`;
                }
            }
        }
    }

    async copyGlobalWebhookUrl() {
        try {
            const webhookElement = document.getElementById('global-webhook-url');
            if (!webhookElement) return;
            
            const webhookUrl = webhookElement.value;
            if (!webhookUrl || webhookUrl === 'Loading...') {
                return;
            }
            
            await navigator.clipboard.writeText(webhookUrl);
            
            // Show feedback on the button
            const button = document.getElementById('copy-global-webhook');
            const originalContent = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check"></i>';
            button.classList.add('text-green-300');
            
            setTimeout(() => {
                button.innerHTML = originalContent;
                button.classList.remove('text-green-300');
            }, 2000);
        } catch (error) {
            console.error('Failed to copy global webhook URL:', error);
            alert('Failed to copy webhook URL to clipboard');
        }
    }

    async loadVODs() {
        try {
            const response = await fetch('/api/vods');
            const vods = await response.json();
            this.renderVODs(vods);
        } catch (error) {
            console.error('Error loading VODs:', error);
        }
    }

    renderVODs(vods) {
        const container = document.getElementById('vods-list');
        container.innerHTML = vods.map(vod => `
            <div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <h3 class="text-xl font-semibold text-gray-800 mb-2">${vod.title}</h3>
                        <p class="text-gray-600 mb-3">${vod.description || 'No description'}</p>
                        <div class="flex flex-wrap gap-4 text-sm text-gray-500">
                            <span><i class="fas fa-clock mr-1"></i>${this.formatDuration(vod.durationMs)}</span>
                            <span><i class="fas fa-link mr-1"></i><a href="${vod.hlsUrl}" target="_blank" class="text-blue-500 hover:text-blue-700">HLS URL</a></span>
                            ${vod.prerollUrl ? '<span><i class="fas fa-play-circle mr-1 text-green-500"></i>Has Preroll</span>' : ''}
                        </div>
                    </div>
                    <div class="flex space-x-2 ml-4">
                        <button onclick="app.editVOD('${vod.id}')" class="text-blue-500 hover:text-blue-700">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="app.deleteVOD('${vod.id}')" class="text-red-500 hover:text-red-700">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async loadChannelEngines() {
        try {
            const container = document.getElementById('channel-engines-list');
            container.innerHTML = '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-blue-500"></i><p class="mt-2 text-gray-600">Loading Channel Engine instances...</p></div>';
            
            const response = await fetch('/api/channel-engines');
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to load Channel Engine instances');
            }
            const engines = await response.json();
            this.renderChannelEngines(engines);
        } catch (error) {
            console.error('Error loading Channel Engines:', error);
            const container = document.getElementById('channel-engines-list');
            if (error.message.includes('OSC not configured')) {
                container.innerHTML = `
                    <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                        <div class="flex">
                            <div class="flex-shrink-0">
                                <i class="fas fa-exclamation-triangle text-yellow-400"></i>
                            </div>
                            <div class="ml-3">
                                <p class="text-sm text-yellow-700">
                                    <strong>OSC not configured:</strong> Please set the OSC_ACCESS_TOKEN environment variable to list Channel Engine instances.
                                </p>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="bg-red-50 border-l-4 border-red-400 p-4">
                        <div class="flex">
                            <div class="flex-shrink-0">
                                <i class="fas fa-exclamation-circle text-red-400"></i>
                            </div>
                            <div class="ml-3">
                                <p class="text-sm text-red-700">
                                    <strong>Error:</strong> ${error.message}
                                </p>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
    }

    renderChannelEngines(engines) {
        const container = document.getElementById('channel-engines-list');
        
        if (engines.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <i class="fas fa-server text-6xl text-gray-300 mb-4"></i>
                    <h3 class="text-xl font-medium text-gray-500 mb-2">No Channel Engine instances found</h3>
                    <p class="text-gray-400">Create Channel Engine instances from the Channels view</p>
                </div>
            `;
            return;
        }

        container.innerHTML = engines.map(engine => `
            <div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow ${engine.isConnected ? 'ring-2 ring-green-200' : ''}">
                <div class="flex gap-6">
                    <div class="flex-1">
                        <div class="flex items-center space-x-3 mb-3">
                            <h3 class="text-xl font-semibold text-gray-800">${engine.name}</h3>
                            ${engine.isConnected ? `
                                <div class="status-badge bg-green-100 text-green-800">
                                    <i class="fas fa-plug mr-1"></i>
                                    Connected
                                </div>
                            ` : ''}
                        </div>
                        <div class="space-y-2 text-sm text-gray-600">
                            <div><i class="fas fa-cog mr-2"></i><strong>Type:</strong> ${engine.type}</div>
                            ${engine.url ? `<div><i class="fas fa-link mr-2"></i><strong>Stream URL:</strong> <a href="${engine.url}" target="_blank" class="text-blue-500 hover:text-blue-700">${engine.url}</a></div>` : ''}
                            ${engine.webhookUrl ? `<div><i class="fas fa-webhook mr-2"></i><strong>Webhook URL:</strong> <span class="text-xs font-mono ${engine.isConnected ? 'text-green-600' : 'text-gray-500'}">${engine.webhookUrl}</span></div>` : ''}
                            ${engine.created ? `<div><i class="fas fa-calendar mr-2"></i><strong>Created:</strong> ${new Date(engine.created).toLocaleString()}</div>` : ''}
                            ${engine.lastModified ? `<div><i class="fas fa-clock mr-2"></i><strong>Last Modified:</strong> ${new Date(engine.lastModified).toLocaleString()}</div>` : ''}
                        </div>
                        ${engine.isConnected ? `
                            <div class="mt-3 p-2 bg-green-50 rounded border-l-4 border-green-400">
                                <p class="text-sm text-green-700">
                                    <i class="fas fa-check-circle mr-1"></i>
                                    This Channel Engine is connected to this scheduler application
                                </p>
                            </div>
                        ` : ''}
                    </div>
                    ${engine.url ? `
                        <div class="flex-shrink-0 w-80">
                            <div class="relative bg-black rounded-lg overflow-hidden">
                                <video 
                                    id="player-${engine.name}" 
                                    class="w-full h-44 object-contain cursor-pointer"
                                    controls
                                    preload="none"
                                    poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 225'%3E%3Crect width='400' height='225' fill='%23000'/%3E%3Cg fill='%23fff' opacity='0.7'%3E%3Ccircle cx='200' cy='112.5' r='30'/%3E%3Cpolygon points='190,97.5 190,127.5 215,112.5'/%3E%3C/g%3E%3Ctext x='200' y='180' text-anchor='middle' fill='%23fff' font-family='Arial' font-size='14' opacity='0.7'%3EClick to play stream%3C/text%3E%3C/svg%3E"
                                    onclick="app.playStream('${engine.name}', '${engine.url}')"
                                >
                                    <source src="${engine.url}" type="application/x-mpegURL">
                                    Your browser does not support HLS video playback.
                                </video>
                                <div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 pointer-events-none" id="overlay-${engine.name}" data-url="${engine.url}">
                                    <div class="text-white text-center">
                                        <i class="fas fa-play-circle text-3xl mb-1"></i>
                                        <p class="text-xs">Click to play</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    getEngineStatusClass(status) {
        switch (status?.toLowerCase()) {
            case 'running':
                return 'bg-green-100 text-green-800';
            case 'stopped':
                return 'bg-red-100 text-red-800';
            case 'starting':
                return 'bg-yellow-100 text-yellow-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    }

    getEngineStatusIcon(status) {
        switch (status?.toLowerCase()) {
            case 'running':
                return 'fa-play';
            case 'stopped':
                return 'fa-stop';
            case 'starting':
                return 'fa-spinner fa-spin';
            default:
                return 'fa-question';
        }
    }

    playStream(engineName, streamUrl) {
        const player = document.getElementById(`player-${engineName}`);
        const overlay = document.getElementById(`overlay-${engineName}`);
        
        if (player) {
            // Hide the overlay
            if (overlay) {
                overlay.style.display = 'none';
            }
            
            // Check if HLS.js is available and supported
            if (typeof Hls !== 'undefined' && Hls.isSupported()) {
                // Use HLS.js for browsers without native HLS support (Chrome, Firefox, Edge, etc.)
                const hls = new Hls({
                    enableWorker: true,
                    lowLatencyMode: false,
                    backBufferLength: 90
                });
                
                hls.loadSource(streamUrl);
                hls.attachMedia(player);
                
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    console.log(`HLS manifest loaded for ${engineName}`);
                    player.play().catch(error => {
                        console.error('Error playing stream:', error);
                        this.showStreamError(engineName, 'Failed to start playback');
                    });
                });
                
                hls.on(Hls.Events.ERROR, (event, data) => {
                    console.error('HLS error:', data);
                    if (data.fatal) {
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                this.showStreamError(engineName, 'Network error loading stream');
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                this.showStreamError(engineName, 'Media error during playback');
                                break;
                            default:
                                this.showStreamError(engineName, `Stream error: ${data.details}`);
                                break;
                        }
                    }
                });

                // Store HLS instance for cleanup if needed
                player._hlsInstance = hls;
                
            } else if (player.canPlayType('application/vnd.apple.mpegurl')) {
                // Native HLS support (Safari, iOS)
                console.log(`Using native HLS support for ${engineName}`);
                player.src = streamUrl;
                player.play().catch(error => {
                    console.error('Error playing stream:', error);
                    this.showStreamError(engineName, 'Failed to start playback');
                });
            } else {
                // This should rarely happen since HLS.js covers most modern browsers
                console.error('No HLS support available');
                this.showStreamError(engineName, 'HLS playback not supported in this browser');
            }

            // Add event listeners for better UX
            player.addEventListener('loadstart', () => {
                console.log(`Loading stream for ${engineName}`);
            });

            player.addEventListener('canplay', () => {
                console.log(`Stream ready for ${engineName}`);
            });

            player.addEventListener('error', (e) => {
                console.error(`Stream error for ${engineName}:`, e);
                this.showStreamError(engineName, 'Stream playback failed');
            });
        }
    }

    showStreamError(engineName, message) {
        const overlay = document.getElementById(`overlay-${engineName}`);
        if (overlay) {
            const streamUrl = overlay.getAttribute('data-url');
            overlay.innerHTML = `
                <div class="text-white text-center">
                    <i class="fas fa-exclamation-triangle text-4xl mb-2 text-red-400"></i>
                    <p class="text-sm">${message}</p>
                    <button class="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 pointer-events-auto" onclick="app.playStream('${engineName}', '${streamUrl}')">
                        Retry
                    </button>
                </div>
            `;
            overlay.style.display = 'flex';
        }
    }

    // VOD Sidebar Management
    toggleVODSidebar() {
        const sidebar = document.getElementById('vod-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (sidebar.classList.contains('hidden')) {
            this.showVODSidebar();
        } else {
            this.hideVODSidebar();
        }
    }

    async showVODSidebar() {
        const sidebar = document.getElementById('vod-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        const toggleBtn = document.getElementById('toggle-vod-sidebar-btn');
        
        // Load VODs for sidebar if not already loaded
        await this.loadVODsForSidebar();
        
        // Show sidebar and overlay
        sidebar.classList.remove('hidden');
        overlay.classList.remove('hidden');
        
        // Animate sidebar in
        setTimeout(() => {
            sidebar.style.transform = 'translateX(0)';
        }, 10);
        
        // Update button text
        toggleBtn.innerHTML = '<i class="fas fa-times mr-1"></i>Close VODs';
        toggleBtn.classList.remove('bg-green-500', 'hover:bg-green-600');
        toggleBtn.classList.add('bg-red-500', 'hover:bg-red-600');
    }

    hideVODSidebar() {
        const sidebar = document.getElementById('vod-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        const toggleBtn = document.getElementById('toggle-vod-sidebar-btn');
        
        // Animate sidebar out
        sidebar.style.transform = 'translateX(100%)';
        
        // Hide overlay and sidebar after animation
        setTimeout(() => {
            sidebar.classList.add('hidden');
            overlay.classList.add('hidden');
        }, 300);
        
        // Reset button text
        toggleBtn.innerHTML = '<i class="fas fa-plus mr-1"></i>Add VODs';
        toggleBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
        toggleBtn.classList.add('bg-green-500', 'hover:bg-green-600');
        
        // Clear search
        document.getElementById('vod-search').value = '';
    }

    async loadVODsForSidebar() {
        try {
            const response = await fetch('/api/vods');
            const vods = await response.json();
            this.allVODs = vods; // Store for search functionality
            this.renderSidebarVODs(vods);
        } catch (error) {
            console.error('Error loading VODs for sidebar:', error);
        }
    }

    renderSidebarVODs(vods) {
        const container = document.getElementById('sidebar-vods-list');
        
        if (vods.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-video text-4xl text-gray-300 mb-2"></i>
                    <p class="text-gray-500">No VODs found</p>
                </div>
            `;
            return;
        }

        container.innerHTML = vods.map(vod => `
            <div class="bg-gray-50 rounded-lg p-3 hover:bg-blue-50 cursor-pointer transition-colors border border-gray-200 hover:border-blue-300" 
                 onclick="app.addVODToSchedule('${vod.id}')">
                <div class="flex items-start space-x-3">
                    <div class="flex-shrink-0 w-12 h-8 bg-gray-800 rounded flex items-center justify-center">
                        <i class="fas fa-play text-white text-xs"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="text-sm font-medium text-gray-900 truncate">${vod.title}</h4>
                        <p class="text-xs text-gray-500 mt-1">${this.formatDuration(vod.durationMs)}</p>
                        ${vod.description ? `<p class="text-xs text-gray-400 mt-1 line-clamp-2">${vod.description}</p>` : ''}
                    </div>
                    <div class="flex-shrink-0">
                        <i class="fas fa-plus text-green-500 hover:text-green-600"></i>
                    </div>
                </div>
            </div>
        `).join('');
    }

    searchVODs(query) {
        if (!this.allVODs) return;
        
        const filteredVODs = this.allVODs.filter(vod => 
            vod.title.toLowerCase().includes(query.toLowerCase()) ||
            (vod.description && vod.description.toLowerCase().includes(query.toLowerCase()))
        );
        
        this.renderSidebarVODs(filteredVODs);
    }

    async addVODToSchedule(vodId) {
        try {
            if (!this.currentChannelId) {
                alert('No channel selected');
                return;
            }

            // Use back-to-back scheduling by default
            const response = await fetch(`/api/channels/${this.currentChannelId}/schedule`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    vodId: vodId,
                    useBackToBack: true
                })
            });

            if (!response.ok) {
                throw new Error('Failed to add VOD to schedule');
            }

            // Reload the schedule to show the new item
            await this.loadSchedule(this.currentChannelId);
            
            // Show success feedback
            this.showTemporaryMessage('VOD added to schedule successfully!', 'success');
            
        } catch (error) {
            console.error('Error adding VOD to schedule:', error);
            this.showTemporaryMessage('Failed to add VOD to schedule', 'error');
        }
    }

    showTemporaryMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-500 text-white' : 
            type === 'error' ? 'bg-red-500 text-white' : 
            'bg-blue-500 text-white'
        }`;
        messageDiv.textContent = message;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }

    async viewSchedule(channelId, channelName) {
        this.currentChannelId = channelId;
        document.getElementById('schedule-title').textContent = `${channelName} - Schedule`;
        this.showView('schedule');
        await this.loadSchedule(channelId);
        // Hide sidebar when switching to schedule view
        this.hideVODSidebar();
    }

    async loadSchedule(channelId) {
        try {
            const [scheduleResponse, currentResponse] = await Promise.all([
                fetch(`/api/channels/${channelId}/schedule`),
                fetch(`/api/channels/${channelId}/current`)
            ]);
            
            const schedule = await scheduleResponse.json();
            let currentItem = null;
            
            try {
                currentItem = await currentResponse.json();
            } catch (e) {
                console.log('No current item found');
            }
            
            this.renderSchedule(schedule, currentItem);
        } catch (error) {
            console.error('Error loading schedule:', error);
        }
    }

    renderSchedule(schedule, currentItem = null) {
        const container = document.getElementById('schedule-list');
        if (schedule.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12 text-gray-500">
                    <i class="fas fa-calendar-times text-4xl mb-4"></i>
                    <p class="text-lg">No items scheduled</p>
                    <p>Click "Add to Schedule" to get started</p>
                </div>
            `;
            return;
        }

        const now = new Date();
        
        container.innerHTML = schedule.map((item, index) => {
            const startTime = new Date(item.scheduledStart);
            const endTime = new Date(item.scheduledEnd);
            
            // Check if this item is currently playing based on webhook response
            const isCurrentlyPlaying = currentItem && currentItem.id === item.vod.id;
            
            // Fallback to time-based detection if no webhook current item
            const isScheduledNow = !currentItem && (now >= startTime && now <= endTime);
            const isActuallyPlaying = isCurrentlyPlaying || isScheduledNow;
            
            const isUpcoming = now < startTime;
            const hasPlayed = now > endTime;
            
            const statusClass = isActuallyPlaying ? 'bg-red-50 border-l-4 border-red-500' : 
                               isUpcoming ? 'bg-white hover:bg-gray-50' : 
                               'bg-gray-50 opacity-75';
            
            const timeColor = isActuallyPlaying ? 'text-red-600 font-semibold' : 
                             isUpcoming ? 'text-gray-900' : 
                             'text-gray-500';
            
            const playingIndicator = isActuallyPlaying ? '<i class="fas fa-play text-red-500 mr-2 animate-pulse"></i>' : '';
            
            return `
                <div class="${statusClass} border-b border-gray-200 py-3 px-4 transition-colors">
                    <div class="flex items-center">
                        <!-- Time Column (Left) -->
                        <div class="w-20 flex-shrink-0 ${timeColor} text-sm font-mono">
                            ${startTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                        </div>
                        
                        <!-- Position -->
                        <div class="w-12 flex-shrink-0 text-center">
                            <span class="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                                ${item.position}
                            </span>
                        </div>
                        
                        <!-- Content -->
                        <div class="flex-1 min-w-0 mx-4">
                            <div class="flex items-center">
                                ${playingIndicator}
                                <h4 class="text-sm font-medium text-gray-900 truncate">
                                    ${item.vod.title}
                                </h4>
                                ${isActuallyPlaying ? '<span class="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full uppercase font-semibold">ON AIR</span>' : ''}
                            </div>
                            ${item.vod.description ? `<p class="text-xs text-gray-600 mt-1 truncate">${item.vod.description}</p>` : ''}
                        </div>
                        
                        <!-- Duration -->
                        <div class="w-16 flex-shrink-0 text-xs text-gray-500 text-right">
                            ${this.formatDuration(item.vod.durationMs)}
                        </div>
                        
                        <!-- End Time -->
                        <div class="w-20 flex-shrink-0 ${timeColor} text-sm font-mono text-right">
                            ${endTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                        </div>
                        
                        <!-- Actions -->
                        <div class="w-24 flex-shrink-0 flex justify-end space-x-1 ml-3">
                            <button onclick="app.moveScheduleUp('${item.id}', ${index})" 
                                    class="text-gray-400 hover:text-gray-600 p-1 ${index === 0 ? 'opacity-30 cursor-not-allowed' : ''}" 
                                    ${index === 0 ? 'disabled' : ''} title="Move up">
                                <i class="fas fa-chevron-up text-xs"></i>
                            </button>
                            <button onclick="app.moveScheduleDown('${item.id}', ${index})" 
                                    class="text-gray-400 hover:text-gray-600 p-1 ${index === schedule.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}"
                                    ${index === schedule.length - 1 ? 'disabled' : ''} title="Move down">
                                <i class="fas fa-chevron-down text-xs"></i>
                            </button>
                            <button onclick="app.deleteSchedule('${item.id}')" 
                                    class="text-red-400 hover:text-red-600 p-1" title="Delete">
                                <i class="fas fa-trash text-xs"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    formatDuration(ms) {
        const minutes = Math.floor(ms / 60000);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        }
        return `${minutes}m`;
    }

    // Modal functions
    showChannelModal(channelId = null) {
        this.editingChannelId = channelId;
        const modal = document.getElementById('channel-modal');
        const title = document.getElementById('channel-modal-title');
        
        if (channelId) {
            title.textContent = 'Edit Channel';
            this.loadChannelForEdit(channelId);
        } else {
            title.textContent = 'Add Channel';
            document.getElementById('channel-form').reset();
        }
        
        modal.classList.remove('hidden');
    }

    hideChannelModal() {
        document.getElementById('channel-modal').classList.add('hidden');
        this.editingChannelId = null;
    }

    async loadChannelForEdit(channelId) {
        try {
            const response = await fetch(`/api/channels/${channelId}`);
            const channel = await response.json();
            
            document.getElementById('channel-name').value = channel.name;
            document.getElementById('channel-description').value = channel.description || '';
            document.getElementById('channel-auto-schedule').checked = channel.autoSchedule !== false;
            
            if (channel.scheduleStart) {
                const date = new Date(channel.scheduleStart);
                document.getElementById('channel-schedule-start').value = date.toISOString().slice(0, 16);
            } else {
                document.getElementById('channel-schedule-start').value = '';
            }
        } catch (error) {
            console.error('Error loading channel for edit:', error);
        }
    }

    async handleChannelSubmit(e) {
        e.preventDefault();
        const formData = {
            name: document.getElementById('channel-name').value,
            description: document.getElementById('channel-description').value,
            scheduleStart: document.getElementById('channel-schedule-start').value || null,
            autoSchedule: document.getElementById('channel-auto-schedule').checked
        };

        try {
            const url = this.editingChannelId ? `/api/channels/${this.editingChannelId}` : '/api/channels';
            const method = this.editingChannelId ? 'PUT' : 'POST';
            
            await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            this.hideChannelModal();
            this.loadChannels();
        } catch (error) {
            console.error('Error saving channel:', error);
        }
    }

    showVODModal(vodId = null) {
        this.editingVodId = vodId;
        const modal = document.getElementById('vod-modal');
        const title = document.getElementById('vod-modal-title');
        
        if (vodId) {
            title.textContent = 'Edit VOD';
            this.loadVODForEdit(vodId);
        } else {
            title.textContent = 'Add VOD';
            document.getElementById('vod-form').reset();
        }
        
        modal.classList.remove('hidden');
    }

    hideVODModal() {
        document.getElementById('vod-modal').classList.add('hidden');
        this.editingVodId = null;
    }

    async loadVODForEdit(vodId) {
        try {
            const response = await fetch(`/api/vods/${vodId}`);
            const vod = await response.json();
            
            document.getElementById('vod-title').value = vod.title;
            document.getElementById('vod-description').value = vod.description || '';
            document.getElementById('vod-hls-url').value = vod.hlsUrl;
            document.getElementById('vod-duration').value = vod.durationMs;
            document.getElementById('vod-preroll-url').value = vod.prerollUrl || '';
            document.getElementById('vod-preroll-duration').value = vod.prerollDurationMs || '';
        } catch (error) {
            console.error('Error loading VOD for edit:', error);
        }
    }

    async handleVODSubmit(e) {
        e.preventDefault();
        const formData = {
            title: document.getElementById('vod-title').value,
            description: document.getElementById('vod-description').value,
            hlsUrl: document.getElementById('vod-hls-url').value,
            durationMs: parseInt(document.getElementById('vod-duration').value),
            prerollUrl: document.getElementById('vod-preroll-url').value || null,
            prerollDurationMs: parseInt(document.getElementById('vod-preroll-duration').value) || null
        };

        try {
            const url = this.editingVodId ? `/api/vods/${this.editingVodId}` : '/api/vods';
            const method = this.editingVodId ? 'PUT' : 'POST';
            
            await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            this.hideVODModal();
            this.loadVODs();
        } catch (error) {
            console.error('Error saving VOD:', error);
        }
    }

    async showScheduleModal() {
        const modal = document.getElementById('schedule-modal');
        await this.loadVODsForSchedule();
        modal.classList.remove('hidden');
    }

    hideScheduleModal() {
        document.getElementById('schedule-modal').classList.add('hidden');
    }

    async loadVODsForSchedule() {
        try {
            const response = await fetch('/api/vods');
            const vods = await response.json();
            const select = document.getElementById('schedule-vod');
            select.innerHTML = '<option value="">Choose a VOD...</option>' +
                vods.map(vod => `<option value="${vod.id}">${vod.title}</option>`).join('');
        } catch (error) {
            console.error('Error loading VODs for schedule:', error);
        }
    }

    async handleScheduleSubmit(e) {
        e.preventDefault();
        const useBackToBack = document.getElementById('schedule-back-to-back').checked;
        
        const formData = {
            vodId: document.getElementById('schedule-vod').value,
            useBackToBack: useBackToBack
        };

        if (!useBackToBack) {
            formData.scheduledStart = document.getElementById('schedule-start').value;
            formData.scheduledEnd = document.getElementById('schedule-end').value;
        }

        try {
            await fetch(`/api/channels/${this.currentChannelId}/schedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            this.hideScheduleModal();
            this.loadSchedule(this.currentChannelId);
        } catch (error) {
            console.error('Error saving schedule:', error);
        }
    }

    async detectVODDuration() {
        const hlsUrl = document.getElementById('vod-hls-url').value;
        if (!hlsUrl) {
            alert('Please enter an HLS URL first');
            return;
        }

        const button = document.getElementById('detect-duration-btn');
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Detecting...';
        button.disabled = true;

        try {
            const response = await fetch('/api/vods/detect-duration', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hlsUrl })
            });

            const data = await response.json();
            if (response.ok) {
                document.getElementById('vod-duration').value = data.durationMs;
                document.getElementById('duration-display').textContent = `${this.formatDuration(data.durationMs)} (${data.durationSeconds}s)`;
            } else {
                alert('Failed to detect duration: ' + data.error);
            }
        } catch (error) {
            console.error('Error detecting duration:', error);
            alert('Failed to detect duration');
        } finally {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }

    async rebalanceSchedule() {
        if (!confirm('This will recalculate all schedule times based on back-to-back timing. Continue?')) {
            return;
        }

        try {
            await fetch(`/api/channels/${this.currentChannelId}/schedule/rebalance`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            
            this.loadSchedule(this.currentChannelId);
        } catch (error) {
            console.error('Error rebalancing schedule:', error);
            alert('Failed to rebalance schedule');
        }
    }

    showSetScheduleStartModal() {
        document.getElementById('set-start-time-modal').classList.remove('hidden');
        
        // Set current time as default
        const now = new Date();
        const timeString = now.toISOString().slice(0, 16);
        document.getElementById('schedule-start-time').value = timeString;
    }

    hideSetStartTimeModal() {
        document.getElementById('set-start-time-modal').classList.add('hidden');
        document.getElementById('set-start-time-form').reset();
    }

    setCurrentTime() {
        const now = new Date();
        const timeString = now.toISOString().slice(0, 16);
        document.getElementById('schedule-start-time').value = timeString;
    }

    async handleSetStartTimeSubmit(e) {
        e.preventDefault();
        const startTime = document.getElementById('schedule-start-time').value;
        
        if (startTime) {
            await this.updateScheduleStartTime(startTime);
            this.hideSetStartTimeModal();
        }
    }

    async updateScheduleStartTime(startTime) {
        try {
            await fetch(`/api/channels/${this.currentChannelId}/schedule-start`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheduleStart: startTime })
            });
            
            this.loadSchedule(this.currentChannelId);
        } catch (error) {
            console.error('Error updating schedule start time:', error);
            alert('Failed to update schedule start time');
        }
    }

    // CRUD operations
    editChannel(channelId) {
        this.showChannelModal(channelId);
    }

    async deleteChannel(channelId) {
        if (confirm('Are you sure you want to delete this channel?')) {
            try {
                await fetch(`/api/channels/${channelId}`, { method: 'DELETE' });
                this.loadChannels();
            } catch (error) {
                console.error('Error deleting channel:', error);
            }
        }
    }

    editVOD(vodId) {
        this.showVODModal(vodId);
    }

    async deleteVOD(vodId) {
        if (confirm('Are you sure you want to delete this VOD?')) {
            try {
                await fetch(`/api/vods/${vodId}`, { method: 'DELETE' });
                this.loadVODs();
            } catch (error) {
                console.error('Error deleting VOD:', error);
            }
        }
    }

    async deleteSchedule(scheduleId) {
        if (confirm('Are you sure you want to remove this item from the schedule?')) {
            try {
                await fetch(`/api/schedule/${scheduleId}`, { method: 'DELETE' });
                this.loadSchedule(this.currentChannelId);
            } catch (error) {
                console.error('Error deleting schedule:', error);
            }
        }
    }

    // Channel Engine Management Methods
    getStatusBadge(channel) {
        const now = new Date();
        const webhookOnlineThreshold = 5 * 60 * 1000; // 5 minutes

        // Check webhook-based status first
        if (channel.lastWebhookCall) {
            const timeSinceLastWebhook = now - new Date(channel.lastWebhookCall);
            const isWebhookOnline = timeSinceLastWebhook <= webhookOnlineThreshold;
            
            if (isWebhookOnline) {
                return '<span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-600"><i class="fas fa-circle mr-1"></i>Online</span>';
            } else {
                return '<span class="px-2 py-1 text-xs rounded-full bg-red-100 text-red-600">Offline</span>';
            }
        }

        // Fallback to channel engine instance check
        if (!channel.channelEngineInstance) {
            return '<span class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">No Engine</span>';
        }
        
        if (channel.isOnAir) {
            return '<span class="px-2 py-1 text-xs rounded-full bg-red-100 text-red-600 animate-pulse"><i class="fas fa-circle mr-1"></i>ON AIR</span>';
        } else {
            return '<span class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">Offline</span>';
        }
    }

    async loadChannelStatus(channelId) {
        try {
            const response = await fetch(`/api/channels/${channelId}/status`);
            const status = await response.json();
            
            const statusElement = document.getElementById(`status-${channelId}`);
            if (statusElement) {
                if (status.isOnAir) {
                    if (status.status === 'online_webhook') {
                        // Show green for webhook-based online status
                        statusElement.innerHTML = '<span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-600"><i class="fas fa-circle mr-1"></i>ONLINE</span>';
                    } else {
                        // Show red for confirmed on-air status
                        statusElement.innerHTML = '<span class="px-2 py-1 text-xs rounded-full bg-red-100 text-red-600 animate-pulse"><i class="fas fa-circle mr-1"></i>ON AIR</span>';
                    }
                } else {
                    statusElement.innerHTML = '<span class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">Offline</span>';
                }
            }
        } catch (error) {
            console.error('Error loading channel status:', error);
        }
    }

}

// Initialize the app
const app = new ChannelScheduler();