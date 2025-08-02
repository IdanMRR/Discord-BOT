import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  UserIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  NoSymbolIcon,
  EyeIcon,
  ChevronLeftIcon,
  UserGroupIcon,
  CalendarIcon,
  AtSymbolIcon,
  ChatBubbleOvalLeftIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Pagination from '../components/common/Pagination';
import DMModal from '../components/modals/DMModal';
import toast from 'react-hot-toast';
import { useTheme } from '../contexts/ThemeContext';
import { apiService } from '../services/api';

function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface Member {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  displayName: string;
  nickname: string | null;
  joinedAt: string | null;
  roles: Array<{
    id: string;
    name: string;
    color: number;
    position: number;
  }>;
  permissions: string[];
  isBot: boolean;
  status: 'online' | 'offline' | 'idle' | 'dnd' | 'invisible';
  warningCount: number;
  lastActivity: string | null;
}

interface ModerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, extra?: any) => void;
  member: Member | null;
  action: 'kick' | 'ban' | 'timeout' | 'warn';
  loading: boolean;
}

const ModerationModal: React.FC<ModerationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  member,
  action,
  loading
}) => {
  const { darkMode } = useTheme();
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState(600000); // 10 minutes in ms
  const [deleteMessageDays, setDeleteMessageDays] = useState(0);

  if (!isOpen || !member) return null;

  const getAvatarUrl = (member: Member) => {
    if (member.avatar) {
      return `https://cdn.discordapp.com/avatars/${member.id}/${member.avatar}.png?size=128`;
    }
    return `https://cdn.discordapp.com/embed/avatars/${parseInt(member.discriminator) % 5}.png`;
  };

  const handleConfirm = () => {
    if (action === 'timeout') {
      onConfirm(reason, { duration });
    } else if (action === 'ban') {
      onConfirm(reason, { deleteMessageDays });
    } else {
      onConfirm(reason);
    }
  };

  const actionTitles = {
    kick: 'Kick Member',
    ban: 'Ban Member',
    timeout: 'Timeout Member',
    warn: 'Warn Member'
  };

  const actionEmojis = {
    kick: '👢',
    ban: '🔨',
    timeout: '⏰',
    warn: '⚠️'
  };

  const actionColors = {
    kick: 'yellow',
    ban: 'red',
    timeout: 'orange',
    warn: 'blue'
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 text-center">
        <div 
          className={classNames(
            "fixed inset-0 bg-black/60 backdrop-blur-sm",
            "bg-background/80"
          )}
          onClick={onClose}
        />

        <div className={classNames(
          "w-full max-w-3xl transform overflow-hidden rounded-2xl p-8 text-left align-middle shadow-2xl transition-all",
          "bg-card ring-1 ring-border"
        )}>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className={classNames(
                "w-16 h-16 rounded-full flex items-center justify-center mr-6",
                actionColors[action] === 'red' && (darkMode ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-600"),
                actionColors[action] === 'yellow' && (darkMode ? "bg-yellow-900/30 text-yellow-400" : "bg-yellow-100 text-yellow-600"),
                actionColors[action] === 'orange' && (darkMode ? "bg-orange-900/30 text-orange-400" : "bg-orange-100 text-orange-600"),
                actionColors[action] === 'blue' && (darkMode ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-600")
              )}>
                <span className="text-3xl">{actionEmojis[action]}</span>
              </div>
              <div>
                <h3 className={classNames(
                  "text-2xl font-bold",
                  "text-foreground"
                )}>
                  {actionTitles[action]}
                </h3>
                <p className={classNames(
                  "text-sm mt-1",
                  "text-muted-foreground"
                )}>
                  Are you sure you want to {action} {member.displayName}?
                  {action === 'ban' && ' This action cannot be easily undone.'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={classNames(
                "w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200",
                darkMode 
                  ? "text-muted-foreground hover:text-foreground hover:bg-muted" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Member Info */}
          <div className={classNames(
            "p-6 rounded-xl mb-6",
            "bg-muted/30"
          )}>
            <div className="flex items-center space-x-4">
              <img
                src={getAvatarUrl(member)}
                alt={member.displayName}
                className="w-16 h-16 rounded-full ring-4 ring-purple-500/20"
              />
              <div>
                <h4 className={classNames(
                  "text-xl font-semibold",
                  "text-foreground"
                )}>
                  {member.displayName}
                </h4>
                <p className={classNames(
                  "text-sm",
                  darkMode ? "text-gray-400" : "text-gray-500"
                )}>
                  @{member.username}
                </p>
                <p className={classNames(
                  "text-xs mt-1",
                  "text-muted-foreground/70"
                )}>
                  ID: {member.id}
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className={classNames(
            "p-6 rounded-xl mb-6",
            "bg-muted/30"
          )}>
            <p className={classNames(
              "text-base leading-relaxed mb-6",
              darkMode ? "text-gray-300" : "text-gray-700"
            )}>
              Please provide a reason for this moderation action. This will be logged for audit purposes and may be visible to the member.
            </p>

            <div className="space-y-4">
              {/* Reason input */}
              <div>
                <label className={classNames(
                  "block text-sm font-medium mb-2",
                  darkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Reason (required)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={`Reason for ${action}...`}
                  rows={3}
                  className={classNames(
                    "w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none",
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" 
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                  )}
                />
              </div>

              {/* Duration selector for timeout */}
              {action === 'timeout' && (
                <div>
                  <label className={classNames(
                    "block text-sm font-medium mb-2",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    Duration
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    className={classNames(
                      "w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all",
                      darkMode 
                        ? "bg-gray-700 border-gray-600 text-white" 
                        : "bg-white border-gray-300 text-gray-900"
                    )}
                  >
                    <option value={60000}>1 minute</option>
                    <option value={300000}>5 minutes</option>
                    <option value={600000}>10 minutes</option>
                    <option value={1800000}>30 minutes</option>
                    <option value={3600000}>1 hour</option>
                    <option value={21600000}>6 hours</option>
                    <option value={86400000}>24 hours</option>
                    <option value={604800000}>7 days</option>
                  </select>
                </div>
              )}

              {/* Message deletion for ban */}
              {action === 'ban' && (
                <div>
                  <label className={classNames(
                    "block text-sm font-medium mb-2",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    Delete Messages (days)
                  </label>
                  <select
                    value={deleteMessageDays}
                    onChange={(e) => setDeleteMessageDays(parseInt(e.target.value))}
                    className={classNames(
                      "w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all",
                      darkMode 
                        ? "bg-gray-700 border-gray-600 text-white" 
                        : "bg-white border-gray-300 text-gray-900"
                    )}
                  >
                    <option value={0}>Don't delete any</option>
                    <option value={1}>Previous 24 hours</option>
                    <option value={3}>Previous 3 days</option>
                    <option value={7}>Previous 7 days</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-3 sm:space-y-0">
            <button
              onClick={onClose}
              disabled={loading}
              className={classNames(
                "flex-1 px-8 py-4 border-2 text-base font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-3 focus:ring-gray-500/30",
                darkMode 
                  ? "border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500 disabled:opacity-50" 
                  : "border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50"
              )}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || !reason.trim()}
              className={classNames(
                "flex-1 px-8 py-4 border border-transparent text-base font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
                loading || !reason.trim() 
                  ? "bg-gray-400 text-white cursor-not-allowed" 
                  : actionColors[action] === 'red' 
                    ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white focus:ring-red-500/30"
                    : actionColors[action] === 'yellow'
                      ? "bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white focus:ring-yellow-500/30"
                      : actionColors[action] === 'orange'
                        ? "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white focus:ring-orange-500/30"
                        : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white focus:ring-blue-500/30"
              )}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Processing...
                </>
              ) : (
                `${actionEmojis[action]} ${actionTitles[action]}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Members: React.FC = () => {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const { serverId } = useParams<{ serverId: string }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [serverInfo, setServerInfo] = useState<{
    name: string;
    memberCount: number;
    icon: string | null;
  } | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMembers, setTotalMembers] = useState(0);
  const itemsPerPage = 20;

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Moderation modal
  const [moderationModal, setModerationModal] = useState<{
    isOpen: boolean;
    member: Member | null;
    action: 'kick' | 'ban' | 'timeout' | 'warn';
  }>({
    isOpen: false,
    member: null,
    action: 'warn'
  });

  // DM modal
  const [dmModal, setDmModal] = useState<{
    isOpen: boolean;
    member: Member | null;
  }>({
    isOpen: false,
    member: null
  });

  const [dmLoading, setDmLoading] = useState(false);

  const fetchMembers = useCallback(async (page: number = 1) => {
    if (!serverId) return;
    
    try {
      setLoading(true);
      const response = await apiService.getServerMembers(serverId, {
        page,
        limit: itemsPerPage,
        search: searchTerm,
        role: selectedRole,
        status: selectedStatus
      });

      if (response.success && response.data) {
        setMembers(response.data.members);
        setCurrentPage(response.data.pagination.page);
        setTotalPages(response.data.pagination.pages);
        setTotalMembers(response.data.pagination.total);
        setServerInfo(response.data.serverInfo);
      } else {
        toast.error('Failed to fetch server members', {
          style: {
            borderRadius: '12px',
            background: '#dc2626',
            color: '#fff',
          },
        });
      }
    } catch (error) {
      console.error('Error fetching members:', error);
      toast.error('Failed to fetch server members', {
        style: {
          borderRadius: '12px',
          background: '#dc2626',
          color: '#fff',
        },
      });
    } finally {
      setLoading(false);
    }
  }, [serverId, searchTerm, selectedRole, selectedStatus, itemsPerPage]);

  useEffect(() => {
    fetchMembers(1);
  }, [fetchMembers]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchMembers(1);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedRole('');
    setSelectedStatus('');
    setCurrentPage(1);
    setTimeout(() => fetchMembers(1), 100);
  };

  const handlePageChange = (page: number) => {
    fetchMembers(page);
  };

  const handleModerationAction = async (reason: string, extra?: any) => {
    if (!moderationModal.member || !serverId) return;

    try {
      setActionLoading(true);
      let response;

      switch (moderationModal.action) {
        case 'kick':
          response = await apiService.kickMember(serverId, moderationModal.member.id, reason);
          break;
        case 'ban':
          response = await apiService.banMember(serverId, moderationModal.member.id, reason, extra?.deleteMessageDays);
          break;
        case 'timeout':
          response = await apiService.timeoutMember(serverId, moderationModal.member.id, extra?.duration, reason);
          break;
        case 'warn':
          response = await apiService.warnMember(serverId, moderationModal.member.id, reason);
          break;
        default:
          throw new Error('Unknown action');
      }

      if (response.success) {
        toast.success(response.data?.message || 'Action completed successfully', {
          icon: '✅',
          style: {
            borderRadius: '12px',
            background: '#059669',
            color: '#fff',
          },
        });
        setModerationModal({ isOpen: false, member: null, action: 'warn' });
        // Refresh members list
        fetchMembers(currentPage);
      } else {
        toast.error(response.error || 'Action failed', {
          style: {
            borderRadius: '12px',
            background: '#dc2626',
            color: '#fff',
          },
        });
      }
    } catch (error) {
      console.error('Moderation action error:', error);
      toast.error('Failed to perform moderation action', {
        style: {
          borderRadius: '12px',
          background: '#dc2626',
          color: '#fff',
        },
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDMUser = (member: Member) => {
    if (member.isBot) {
      toast.error('Cannot send DM to bot accounts', {
        icon: '🤖',
        style: {
          borderRadius: '12px',
          background: '#1f2937',
          color: '#fff',
        },
      });
      return;
    }

    setDmModal({
      isOpen: true,
      member
    });
  };

  const handleSendDM = async (message: string) => {
    if (!serverId || !dmModal.member) return;

    try {
      setDmLoading(true);
      const response = await apiService.sendDM(serverId, dmModal.member.id, message);
      
      if (response.success) {
        toast.success(`DM sent successfully to ${dmModal.member.displayName}`, {
          icon: '✉️',
          style: {
            borderRadius: '12px',
            background: '#059669',
            color: '#fff',
          },
        });
        setDmModal({ isOpen: false, member: null });
      } else {
        toast.error(response.error || 'Failed to send DM', {
          style: {
            borderRadius: '12px',
            background: '#dc2626',
            color: '#fff',
          },
        });
      }
    } catch (error) {
      console.error('DM error:', error);
      toast.error('Failed to send DM', {
        style: {
          borderRadius: '12px',
          background: '#dc2626',
          color: '#fff',
        },
      });
    } finally {
      setDmLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    const statusClasses = {
      online: 'w-3 h-3 bg-green-500 rounded-full',
      idle: 'w-3 h-3 bg-yellow-500 rounded-full',
      dnd: 'w-3 h-3 bg-red-500 rounded-full',
      offline: 'w-3 h-3 bg-gray-400 rounded-full',
      invisible: 'w-3 h-3 bg-gray-400 rounded-full'
    };
    return <div className={statusClasses[status as keyof typeof statusClasses] || statusClasses.offline} />;
  };

  const getAvatarUrl = (member: Member) => {
    if (member.avatar) {
      return `https://cdn.discordapp.com/avatars/${member.id}/${member.avatar}.png?size=64`;
    }
    return `https://cdn.discordapp.com/embed/avatars/${parseInt(member.discriminator) % 5}.png`;
  };

  const formatJoinDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getRoleColor = (color: number) => {
    return color === 0 ? '#99AAB5' : `#${color.toString(16).padStart(6, '0')}`;
  };

  if (!serverId) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Invalid Server</h1>
          <p className="mt-2 text-gray-600">No server ID provided</p>
        </div>
      </div>
    );
  }

  return (
    <div className={classNames(
      "min-h-screen p-6 space-y-6",
      darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"
    )}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/servers')}
            className={classNames(
              "p-2 rounded-lg transition-colors",
              darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
            )}
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <div className="flex items-center space-x-3">
            {serverInfo?.icon && (
              <img
                src={`https://cdn.discordapp.com/icons/${serverId}/${serverInfo.icon}.png?size=64`}
                alt={serverInfo.name}
                className="w-8 h-8 rounded-full"
              />
            )}
            <div>
              <h1 className={classNames(
                "text-3xl font-bold",
                darkMode ? "text-white" : "text-gray-900"
              )}>
                {serverInfo?.name || 'Server'} Members
              </h1>
              <p className={classNames(
                "text-lg mt-1",
                darkMode ? "text-gray-300" : "text-gray-600"
              )}>
                Manage server members and perform moderation actions
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={classNames(
              "inline-flex items-center px-4 py-2 border font-medium rounded-lg transition-colors",
              darkMode 
                ? "bg-gray-700 border-gray-600 text-white hover:bg-gray-600" 
                : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
            )}
          >
            <FunnelIcon className="h-4 w-4 mr-2" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="content-area p-6">
        <div className="flex items-center">
          <div className="p-3 rounded-lg bg-primary/10">
            <UserGroupIcon className="h-6 w-6 text-primary" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-muted-foreground">Total Members</p>
            <p className="text-2xl font-bold text-foreground">
              {serverInfo?.memberCount || 0}
            </p>
          </div>
        </div>
      </Card>

        <Card className="content-area p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-success/10">
              <EyeIcon className="h-6 w-6 text-success" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Viewing</p>
              <p className="text-2xl font-bold text-foreground">
                {totalMembers}
              </p>
            </div>
          </div>
        </Card>

        <Card className="content-area p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-warning/10">
              <ExclamationTriangleIcon className="h-6 w-6 text-warning" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Members with Warnings</p>
              <p className="text-2xl font-bold text-foreground">
                {members.filter(m => m.warningCount > 0).length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="content-area p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className={classNames(
                "block text-sm font-medium mb-1",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>Search Members</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Username, nickname..."
                  className={classNames(
                    "w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
                    darkMode 
                      ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" 
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                  )}
                />
                <MagnifyingGlassIcon className={classNames(
                  "absolute left-3 top-2.5 h-5 w-5",
                  darkMode ? "text-gray-400" : "text-gray-500"
                )} />
              </div>
            </div>

            <div>
              <label className={classNames(
                "block text-sm font-medium mb-1",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className={classNames(
                  "w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
                  darkMode 
                    ? "bg-gray-700 border-gray-600 text-white" 
                    : "bg-white border-gray-300 text-gray-900"
                )}
              >
                <option value="">All Statuses</option>
                <option value="online">Online</option>
                <option value="idle">Idle</option>
                <option value="dnd">Do Not Disturb</option>
                <option value="offline">Offline</option>
              </select>
            </div>

            <div className="flex items-end space-x-2">
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Apply Filters
              </button>
              <button
                onClick={clearFilters}
                className={classNames(
                  "px-4 py-2 border rounded-lg transition-colors",
                  darkMode 
                    ? "border-gray-600 text-gray-300 hover:bg-gray-700" 
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                )}
              >
                Clear
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Members List */}
      <Card className="content-area overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <LoadingSpinner size="lg" className="text-blue-500" />
            <p className={classNames(
              "mt-4 text-lg",
              darkMode ? "text-gray-300" : "text-gray-600"
            )}>Loading members...</p>
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center">
            <UserIcon className={classNames(
              "mx-auto h-12 w-12 mb-4",
              darkMode ? "text-gray-500" : "text-gray-400"
            )} />
            <p className={classNames(
              "text-lg font-medium",
              darkMode ? "text-gray-300" : "text-gray-600"
            )}>No members found</p>
            <p className={classNames(
              "text-sm mt-1",
              darkMode ? "text-gray-500" : "text-gray-500"
            )}>Try adjusting your search criteria</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Member
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Roles
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Warnings
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {members.map((member) => (
                    <tr
                      key={member.id}
                      className="transition-colors hover:bg-muted/50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="relative">
                            <img
                              className="h-10 w-10 rounded-full"
                              src={getAvatarUrl(member)}
                              alt={member.displayName}
                            />
                            <div className="absolute -bottom-1 -right-1">
                              {getStatusIcon(member.status)}
                            </div>
                            {member.isBot && (
                              <div className="absolute -top-1 -right-1">
                                <div className="bg-blue-500 text-white text-xs px-1 rounded">BOT</div>
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className={classNames(
                              "text-sm font-medium",
                              "text-foreground"
                            )}>
                              {member.displayName}
                            </div>
                            <div className={classNames(
                              "text-sm flex items-center",
                              darkMode ? "text-gray-400" : "text-gray-500"
                            )}>
                              <AtSymbolIcon className="h-3 w-3 mr-1" />
                              {member.username}#{member.discriminator}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {member.roles.slice(0, 3).map((role) => (
                            <span
                              key={role.id}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                              style={{
                                backgroundColor: `${getRoleColor(role.color)}20`,
                                color: getRoleColor(role.color)
                              }}
                            >
                              {role.name}
                            </span>
                          ))}
                          {member.roles.length > 3 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                              +{member.roles.length - 3} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={classNames(
                          "text-sm flex items-center",
                          darkMode ? "text-gray-300" : "text-gray-600"
                        )}>
                          <CalendarIcon className="h-4 w-4 mr-1" />
                          {formatJoinDate(member.joinedAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {member.warningCount > 0 ? (
                            <span className={classNames(
                              "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                              member.warningCount >= 3 
                                ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                            )}>
                              <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                              {member.warningCount}
                            </span>
                          ) : (
                            <span className={classNames(
                              "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                              "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            )}>
                              Clean
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleDMUser(member)}
                            className={classNames(
                              "inline-flex items-center px-2 py-1 text-xs font-medium rounded border",
                              darkMode 
                                ? "border-purple-600 text-purple-400 hover:bg-purple-900/20" 
                                : "border-purple-600 text-purple-600 hover:bg-purple-50"
                            )}
                            title="Send Direct Message"
                          >
                            <ChatBubbleOvalLeftIcon className="h-3 w-3 mr-1" />
                            DM
                          </button>
                          <button
                            onClick={() => setModerationModal({
                              isOpen: true,
                              member,
                              action: 'warn'
                            })}
                            className={classNames(
                              "inline-flex items-center px-2 py-1 text-xs font-medium rounded border",
                              darkMode 
                                ? "border-blue-600 text-blue-400 hover:bg-blue-900/20" 
                                : "border-blue-600 text-blue-600 hover:bg-blue-50"
                            )}
                          >
                            <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                            Warn
                          </button>
                          <button
                            onClick={() => setModerationModal({
                              isOpen: true,
                              member,
                              action: 'timeout'
                            })}
                            className={classNames(
                              "inline-flex items-center px-2 py-1 text-xs font-medium rounded border",
                              darkMode 
                                ? "border-orange-600 text-orange-400 hover:bg-orange-900/20" 
                                : "border-orange-600 text-orange-600 hover:bg-orange-50"
                            )}
                          >
                            <ClockIcon className="h-3 w-3 mr-1" />
                            Timeout
                          </button>
                          <button
                            onClick={() => setModerationModal({
                              isOpen: true,
                              member,
                              action: 'kick'
                            })}
                            className={classNames(
                              "inline-flex items-center px-2 py-1 text-xs font-medium rounded border",
                              darkMode 
                                ? "border-yellow-600 text-yellow-400 hover:bg-yellow-900/20" 
                                : "border-yellow-600 text-yellow-600 hover:bg-yellow-50"
                            )}
                          >
                            <ShieldExclamationIcon className="h-3 w-3 mr-1" />
                            Kick
                          </button>
                          <button
                            onClick={() => setModerationModal({
                              isOpen: true,
                              member,
                              action: 'ban'
                            })}
                            className={classNames(
                              "inline-flex items-center px-2 py-1 text-xs font-medium rounded border",
                              darkMode 
                                ? "border-red-600 text-red-400 hover:bg-red-900/20" 
                                : "border-red-600 text-red-600 hover:bg-red-50"
                            )}
                          >
                            <NoSymbolIcon className="h-3 w-3 mr-1" />
                            Ban
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={classNames(
                "px-6 py-4 border-t",
                darkMode ? "border-gray-700" : "border-gray-200"
              )}>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalMembers}
                  itemsPerPage={itemsPerPage}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </>
        )}
      </Card>

      {/* Moderation Modal */}
      <ModerationModal
        isOpen={moderationModal.isOpen}
        onClose={() => setModerationModal({ isOpen: false, member: null, action: 'warn' })}
        onConfirm={handleModerationAction}
        member={moderationModal.member}
        action={moderationModal.action}
        loading={actionLoading}
      />

      {/* DM Modal */}
      <DMModal
        isOpen={dmModal.isOpen}
        onClose={() => setDmModal({ isOpen: false, member: null })}
        onSend={handleSendDM}
        member={dmModal.member}
        loading={dmLoading}
      />
    </div>
  );
};

export default Members; 