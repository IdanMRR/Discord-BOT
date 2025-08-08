import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PermissionGuard from '../components/common/PermissionGuard';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

interface Giveaway {
  id: number;
  title: string;
  prize: string;
  status: 'active' | 'ended' | 'cancelled';
  winner_count: number;
  host_user_id: string;
  end_time: string;
  created_at: string;
  entryCount?: number;
  winners?: any[];
  timeRemaining?: number;
}

const Giveaways: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>();
  const selectedServerId = serverId;
  const { user } = useAuth();
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'ended' | 'cancelled'>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [channels, setChannels] = useState<Array<{id: string, name: string, type: string, position?: number}>>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);

  const [createForm, setCreateForm] = useState({
    title: '',
    prize: '',
    duration: 60, // minutes
    winnerCount: 1,
    description: '',
    channelId: '',
    requireRole: '',
    requireBoost: false
  });

  const fetchGiveaways = useCallback(async () => {
    if (!selectedServerId || !user?.id) return;
    
    setLoading(true);
    try {
      // Fetch real giveaways from API
      const response = await fetch(`/api/servers/${selectedServerId}/giveaways`, {
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || 'f8e7d6c5b4a3928170615243cba98765',
          'x-user-id': user?.id || '',
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[GIVEAWAY DEBUG] Fetched giveaways response:', data);
        const allGiveaways = data.data?.giveaways || [];
        
        // Filter giveaways based on current filter
        const filteredGiveaways = filter === 'all' 
          ? allGiveaways 
          : allGiveaways.filter((g: Giveaway) => g.status === filter);

        setGiveaways(filteredGiveaways);
      } else {
        console.error('Failed to fetch giveaways:', response.statusText);
        setGiveaways([]);
      }
    } catch (error) {
      console.error('Error fetching giveaways:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedServerId, filter, user?.id]);

  const fetchChannels = useCallback(async () => {
    if (!selectedServerId || !user?.id) return;
    
    setChannelsLoading(true);
    try {
      const response = await fetch(`/api/servers/${selectedServerId}/channels?type=text`, {
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || 'f8e7d6c5b4a3928170615243cba98765',
          'x-user-id': user?.id || '',
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // Sort channels by position
          const sortedChannels = data.data.sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
          setChannels(sortedChannels);
        } else {
          console.error('Failed to fetch channels:', data.error);
          setChannels([]);
        }
      } else {
        console.error('Failed to fetch channels:', response.statusText);
        setChannels([]);
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
      setChannels([]);
    } finally {
      setChannelsLoading(false);
    }
  }, [selectedServerId, user?.id]);

  useEffect(() => {
    if (selectedServerId) {
      fetchGiveaways();
      fetchChannels();
    }
  }, [selectedServerId, fetchGiveaways, fetchChannels]);

  const handleCreateGiveaway = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast.error('User not authenticated. Please refresh the page and try again.');
      return;
    }

    // Frontend validation
    if (!createForm.title.trim()) {
      toast.error('Please enter a title for the giveaway.');
      return;
    }
    
    if (!createForm.prize.trim()) {
      toast.error('Please enter a prize for the giveaway.');
      return;
    }
    
    if (!createForm.channelId) {
      toast.error('Please select a channel for the giveaway.');
      return;
    }
    
    if (createForm.duration < 1 || createForm.duration > 43200) {
      toast.error('Duration must be between 1 minute and 30 days (43200 minutes).');
      return;
    }
    
    if (createForm.winnerCount < 1 || createForm.winnerCount > 20) {
      toast.error('Winner count must be between 1 and 20.');
      return;
    }
    
    try {
      setLoading(true);
      
      console.log('[GIVEAWAY DEBUG] Creating giveaway with data:', createForm);
      console.log('[GIVEAWAY DEBUG] User ID:', user?.id);
      console.log('[GIVEAWAY DEBUG] Server ID:', selectedServerId);
      
      // Create giveaway via API
      const response = await fetch(`/api/servers/${selectedServerId}/giveaways`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_API_KEY || 'f8e7d6c5b4a3928170615243cba98765',
          'x-user-id': user?.id || ''
        },
        body: JSON.stringify(createForm)
      });

      console.log('[GIVEAWAY DEBUG] Response status:', response.status);
      console.log('[GIVEAWAY DEBUG] Response ok:', response.ok);

      if (response.ok) {
        await response.json(); // Parse response but don't need the data
        
        // Reset form and close modal
        setCreateForm({
          title: '',
          prize: '',
          duration: 60,
          winnerCount: 1,
          description: '',
          channelId: '',
          requireRole: '',
          requireBoost: false
        });
        setShowCreateForm(false);
        
        // Refresh giveaways
        await fetchGiveaways();
        
        // Show success message
        toast.success('🎉 Giveaway created successfully!');
      } else {
        // Get error details from response
        let errorMessage = 'Failed to create giveaway';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = response.statusText || errorMessage;
        }
        
        console.error('Failed to create giveaway:', errorMessage);
        toast.error(`Error: ${errorMessage}`);
        
        // Don't close the modal on error so user can fix issues
        return;
      }
    } catch (error) {
      console.error('Error creating giveaway:', error);
      toast.error('Network error: Unable to create giveaway. Please try again.');
      
      // Don't close the modal on error
      return;
    } finally {
      setLoading(false);
    }
  };

  const formatTimeRemaining = (timeMs: number): string => {
    if (timeMs <= 0) return 'Ended';
    
    const days = Math.floor(timeMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatDate = (dateString: string) => {
    // Create a date object from the input string
    const date = new Date(dateString);
    
    // Force the date to be interpreted as UTC
    const utcYear = date.getUTCFullYear();
    const utcMonth = date.getUTCMonth();
    const utcDay = date.getUTCDate();
    const utcHours = date.getUTCHours();
    const utcMinutes = date.getUTCMinutes();
    const utcSeconds = date.getUTCSeconds();
    
    // Create a new date object with the UTC values
    const utcDate = new Date(Date.UTC(utcYear, utcMonth, utcDay, utcHours, utcMinutes, utcSeconds));
    
    // Add 3 hours for Israeli time (UTC+3)
    const israeliTime = new Date(utcDate.getTime() + (3 * 60 * 60 * 1000));
    
    // Format the date in Israeli style (DD.MM.YYYY, HH:MM)
    const day = israeliTime.getDate().toString().padStart(2, '0');
    const month = (israeliTime.getMonth() + 1).toString().padStart(2, '0');
    const year = israeliTime.getFullYear();
    const hours = israeliTime.getHours().toString().padStart(2, '0');
    const minutes = israeliTime.getMinutes().toString().padStart(2, '0');
    
    return `${day}.${month}.${year}, ${hours}:${minutes}`;
  };

  const handleEndGiveaway = async (giveawayId: number) => {
    if (!user?.id || !selectedServerId) {
      toast.error('User not authenticated. Please refresh the page and try again.');
      return;
    }

    if (!window.confirm('Are you sure you want to end this giveaway? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch(`/api/servers/${selectedServerId}/giveaways/${giveawayId}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_API_KEY || 'f8e7d6c5b4a3928170615243cba98765',
          'x-user-id': user?.id || ''
        },
        body: JSON.stringify({ serverId: selectedServerId })
      });

      if (response.ok) {
        toast.success('🏁 Giveaway ended successfully!');
        await fetchGiveaways(); // Refresh the list
      } else {
        let errorMessage = 'Failed to end giveaway';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = response.statusText || errorMessage;
        }
        
        console.error('Failed to end giveaway:', errorMessage);
        toast.error(`Error: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error ending giveaway:', error);
      toast.error('Network error: Unable to end giveaway. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelGiveaway = async (giveawayId: number) => {
    if (!user?.id || !selectedServerId) {
      toast.error('User not authenticated. Please refresh the page and try again.');
      return;
    }

    if (!window.confirm('Are you sure you want to cancel this giveaway? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch(`/api/servers/${selectedServerId}/giveaways/${giveawayId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_API_KEY || 'f8e7d6c5b4a3928170615243cba98765',
          'x-user-id': user?.id || ''
        },
        body: JSON.stringify({ serverId: selectedServerId })
      });

      if (response.ok) {
        toast.success('❌ Giveaway cancelled successfully!');
        await fetchGiveaways(); // Refresh the list
      } else {
        let errorMessage = 'Failed to cancel giveaway';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = response.statusText || errorMessage;
        }
        
        console.error('Failed to cancel giveaway:', errorMessage);
        toast.error(`Error: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error cancelling giveaway:', error);
      toast.error('Network error: Unable to cancel giveaway. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return 'text-green-900 bg-green-100 border border-green-200';
      case 'ended': return 'text-gray-800 bg-gray-100 border border-gray-200';
      case 'cancelled': return 'text-red-900 bg-red-100 border border-red-200';
      default: return 'text-gray-800 bg-gray-100 border border-gray-200';
    }
  };

  if (!selectedServerId) {
    return (
      <div className="p-6">
        <Card>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Please select a server to manage giveaways.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <PermissionGuard requiredPermission="giveaway_manage">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Giveaways</h1>
            <p className="text-gray-600">Manage server giveaways and contests</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={fetchGiveaways}
              disabled={loading}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors shadow-sm disabled:opacity-50"
            >
              🔄 Refresh
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              🎉 Create Giveaway
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex space-x-2">
          {['all', 'active', 'ended', 'cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors shadow-sm ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Giveaways List */}
        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="grid gap-4">
            {giveaways.length === 0 ? (
              <Card>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No giveaways found.</p>
                </div>
              </Card>
            ) : (
              giveaways.map((giveaway) => (
                <Card key={giveaway.id}>
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-base font-semibold text-foreground">
                          🎉 {giveaway.title}
                        </h3>
                        <p className="text-sm text-gray-600">🏆 {giveaway.prize}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(giveaway.status)}`}>
                        {giveaway.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Entries</p>
                        <p className="font-medium text-sm">📊 {giveaway.entryCount || 0}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Winners</p>
                        <p className="font-medium text-sm">👑 {giveaway.winner_count}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{giveaway.status === 'active' ? 'Time Left' : 'Status'}</p>
                        <p className="font-medium text-sm">
                          ⏰ {giveaway.status === 'active' ? formatTimeRemaining(giveaway.timeRemaining || 0) : 'Ended'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Created</p>
                        <p className="font-medium text-sm">
                          📅 {formatDate(giveaway.created_at)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Ends At</p>
                        <p className="font-medium text-sm">
                          🏁 {formatDate(giveaway.end_time)}
                        </p>
                      </div>
                    </div>

                    {giveaway.status === 'ended' && (
                      <div className="mt-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        {giveaway.winners && giveaway.winners.length > 0 ? (
                          <>
                            <p className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2">
                              🎊 Winners Selected
                            </p>
                            <div className="space-y-1">
                              {giveaway.winners.map((winner: any, index: number) => (
                                <div key={winner.id || index} className="flex items-center justify-between text-xs bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded border border-green-200 dark:border-green-700">
                                  <span className="font-medium text-green-800 dark:text-green-200">
                                    👤 Winner #{index + 1}
                                  </span>
                                  <span className="text-green-700 dark:text-green-300 font-semibold">
                                    {winner.nickname || winner.displayName || winner.username || 'Unknown User'}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-green-700 dark:text-green-300 mt-2">
                              🏆 {giveaway.winners.length} winner{giveaway.winners.length !== 1 ? 's' : ''} selected
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                              🏁 Giveaway Ended
                            </p>
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              {giveaway.entryCount === 0 
                                ? 'No participants joined this giveaway' 
                                : 'No winners could be selected'}
                            </p>
                          </>
                        )}
                      </div>
                    )}

                    {giveaway.status === 'active' && (
                      <div className="mt-3 flex space-x-2">
                        <button 
                          onClick={() => handleEndGiveaway(giveaway.id)}
                          disabled={loading}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
                        >
                          🏁 End Now
                        </button>
                        <button 
                          onClick={() => handleCancelGiveaway(giveaway.id)}
                          disabled={loading}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors shadow-sm disabled:opacity-50"
                        >
                          ❌ Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Create Giveaway Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h2 className="text-xl font-bold mb-4">🎉 Create New Giveaway</h2>
              <form onSubmit={handleCreateGiveaway} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.title}
                    onChange={(e) => setCreateForm({...createForm, title: e.target.value})}
                    className="w-full px-3 py-2 input-field rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Amazing Prize Giveaway"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Prize *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.prize}
                    onChange={(e) => setCreateForm({...createForm, prize: e.target.value})}
                    className="w-full px-3 py-2 input-field rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="$100 Discord Nitro"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Duration (minutes) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="43200"
                      value={createForm.duration}
                      onChange={(e) => setCreateForm({...createForm, duration: parseInt(e.target.value) || 1})}
                      className="w-full px-3 py-2 input-field rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Winners *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="20"
                      value={createForm.winnerCount}
                      onChange={(e) => setCreateForm({...createForm, winnerCount: parseInt(e.target.value) || 1})}
                      className="w-full px-3 py-2 input-field rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Description
                  </label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                    className="w-full px-3 py-2 input-field rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Additional details about the giveaway..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Channel *
                  </label>
                  <select
                    required
                    value={createForm.channelId}
                    onChange={(e) => setCreateForm({...createForm, channelId: e.target.value})}
                    className="w-full px-3 py-2 input-field rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={channelsLoading}
                  >
                    <option value="">
                      {channelsLoading 
                        ? 'Loading channels...' 
                        : channels.length === 0 
                          ? 'No text channels available' 
                          : 'Select a channel...'
                      }
                    </option>
                    {channels.map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        #{channel.name}
                      </option>
                    ))}
                  </select>
                  {channels.length === 0 && !channelsLoading && (
                    <p className="text-xs text-red-500 mt-1">
                      No text channels found. Make sure the bot has access to view channels.
                    </p>
                  )}
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create Giveaway'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
};

export default Giveaways; 