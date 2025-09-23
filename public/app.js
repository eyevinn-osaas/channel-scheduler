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
        document.getElementById('back-to-channels').addEventListener('click', () => {
            this.showView('channels');
        });

        // Modal events
        document.getElementById('add-channel-btn').addEventListener('click', () => this.showChannelModal());
        document.getElementById('add-vod-btn').addEventListener('click', () => this.showVODModal());
        document.getElementById('add-schedule-btn').addEventListener('click', () => this.showScheduleModal());
        
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

    async viewSchedule(channelId, channelName) {
        this.currentChannelId = channelId;
        document.getElementById('schedule-title').textContent = `${channelName} - Schedule`;
        this.showView('schedule');
        await this.loadSchedule(channelId);
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