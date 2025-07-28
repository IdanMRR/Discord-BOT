import React, { useState, useEffect, useCallback } from 'react';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PermissionGuard from '../components/common/PermissionGuard';

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
  // Mock server selection - replace with actual server selector
  const selectedServerId = "123456789";
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'ended' | 'cancelled'>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);

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
    if (!selectedServerId) return;
    
    setLoading(true);
    try {
      // Mock data for now - replace with actual API call
      const mockGiveaways: Giveaway[] = [
        {
          id: 1,
          title: "Gaming PC Giveaway",
          prize: "Custom Gaming PC worth $2000",
          status: 'active',
          winner_count: 1,
          host_user_id: "123456789",
          end_time: new Date(Date.now() + 3600000).toISOString(),
          created_at: new Date().toISOString(),
          entryCount: 156,
          winners: [],
          timeRemaining: 3600000
        },
        {
          id: 2,
          title: "Discord Nitro Giveaway",
          prize: "Discord Nitro (1 Year)",
          status: 'ended',
          winner_count: 3,
          host_user_id: "123456789",
          end_time: new Date(Date.now() - 3600000).toISOString(),
          created_at: new Date(Date.now() - 86400000).toISOString(),
          entryCount: 89,
          winners: [
            { user_id: "user1", selected_at: new Date().toISOString() },
            { user_id: "user2", selected_at: new Date().toISOString() },
            { user_id: "user3", selected_at: new Date().toISOString() }
          ],
          timeRemaining: 0
        }
      ];

      const filteredGiveaways = filter === 'all' 
        ? mockGiveaways 
        : mockGiveaways.filter(g => g.status === filter);

      setGiveaways(filteredGiveaways);
    } catch (error) {
      console.error('Error fetching giveaways:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedServerId, filter]);

  useEffect(() => {
    if (selectedServerId) {
      fetchGiveaways();
    }
  }, [selectedServerId, fetchGiveaways]);

  const handleCreateGiveaway = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      // Mock creation - replace with actual API call
      console.log('Creating giveaway:', createForm);
      
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
    } catch (error) {
      console.error('Error creating giveaway:', error);
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

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'ended': return 'text-gray-600 bg-gray-100';
      case 'cancelled': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (!selectedServerId) {
    return (
      <div className="p-6">
        <Card>
          <div className="text-center py-8">
            <p className="text-gray-500">Please select a server to manage giveaways.</p>
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
            <h1 className="text-2xl font-bold text-gray-900">Giveaways</h1>
            <p className="text-gray-600">Manage server giveaways and contests</p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            🎉 Create Giveaway
          </button>
        </div>

        {/* Filters */}
        <div className="flex space-x-4">
          {['all', 'active', 'ended', 'cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status as any)}
              className={`px-4 py-2 rounded-lg capitalize transition-colors ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                  <p className="text-gray-500">No giveaways found.</p>
                </div>
              </Card>
            ) : (
              giveaways.map((giveaway) => (
                <Card key={giveaway.id}>
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          🎉 {giveaway.title}
                        </h3>
                        <p className="text-gray-600">🏆 {giveaway.prize}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(giveaway.status)}`}>
                        {giveaway.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Entries</p>
                        <p className="font-medium">📊 {giveaway.entryCount || 0}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Winners</p>
                        <p className="font-medium">👑 {giveaway.winner_count}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Time Remaining</p>
                        <p className="font-medium">
                          ⏰ {formatTimeRemaining(giveaway.timeRemaining || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Created</p>
                        <p className="font-medium">
                          📅 {new Date(giveaway.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {giveaway.status === 'ended' && giveaway.winners && giveaway.winners.length > 0 && (
                      <div className="mt-4 p-3 bg-green-50 rounded-lg">
                        <p className="text-sm font-medium text-green-800 mb-1">
                          🎊 Winners Selected
                        </p>
                        <p className="text-sm text-green-700">
                          {giveaway.winners.length} winner{giveaway.winners.length !== 1 ? 's' : ''} selected
                        </p>
                      </div>
                    )}

                    {giveaway.status === 'active' && (
                      <div className="mt-4 flex space-x-2">
                        <button className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition-colors">
                          End Now
                        </button>
                        <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 transition-colors">
                          Cancel
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.title}
                    onChange={(e) => setCreateForm({...createForm, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Amazing Prize Giveaway"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prize *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.prize}
                    onChange={(e) => setCreateForm({...createForm, prize: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="$100 Discord Nitro"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration (minutes) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="43200"
                      value={createForm.duration}
                      onChange={(e) => setCreateForm({...createForm, duration: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Winners *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="20"
                      value={createForm.winnerCount}
                      onChange={(e) => setCreateForm({...createForm, winnerCount: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Additional details about the giveaway..."
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
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