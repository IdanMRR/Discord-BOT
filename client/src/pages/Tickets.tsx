import React, { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { useParams } from 'react-router-dom';
import { Ticket } from '../types';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Pagination from '../components/common/Pagination';
import PermissionGuard from '../components/common/PermissionGuard';
import SimpleFilter from '../components/common/SimpleFilter';
import SortableTableHeader, { SortConfig } from '../components/common/SortableTableHeader';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, ArrowPathIcon, CogIcon } from '@heroicons/react/24/outline';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import ChannelSelector from '../components/common/ChannelSelector';
import CategorySelector from '../components/common/CategorySelector';
import ActionButton from '../components/common/ActionButton';
import SettingsCard from '../components/common/SettingsCard';
import { TicketPanelConfigModal, TicketPanelConfig } from '../components/modals/TicketPanelConfigModal';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

const TicketsContent: React.FC = () => {
  const { darkMode } = useTheme();
  const { settings, registerAutoRefresh } = useSettings();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTickets, setTotalTickets] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed' | 'deleted'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig | undefined>();
  const { serverId } = useParams<{ serverId: string }>();
  const itemsPerPage = 20;
  
  // Modal states
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [isTranscriptModalOpen, setIsTranscriptModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [actionReason, setActionReason] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedAction, setSelectedAction] = useState<'close' | 'reopen' | 'delete' | null>(null);
  const [transcript, setTranscript] = useState<any[] | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [selectedTickets, setSelectedTickets] = useState<Set<number>>(new Set());
  
  // Ticket configuration states
  const [serverSettings, setServerSettings] = useState<any>(null);
  const [isTicketPanelModalOpen, setIsTicketPanelModalOpen] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const fetchTickets = useCallback(async (page: number = 1) => {
    try {
      setLoading(true);
      const options: any = {
        page,
        limit: itemsPerPage,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: searchTerm || undefined
      };
      
      if (serverId) {
        options.guildId = serverId;
        console.log(`[Tickets] Fetching tickets for server: ${serverId}`);
      } else {
        console.log('[Tickets] No serverId provided - will fetch all tickets');
      }
      
      console.log('[Tickets] API call options:', options);
      const response = await apiService.getTickets(options);

      if (response.success && response.data) {
        // Get tickets from response data based on structure
        const tickets = Array.isArray(response.data) ? response.data : response.data.tickets || [];
        // Don't filter out deleted tickets when 'all' is selected
        const filteredTickets = statusFilter === 'all' 
          ? tickets 
          : tickets.filter((ticket: Ticket) => ticket.status === statusFilter);
            
        setTickets(filteredTickets);
        setCurrentPage(page);
        
        // Handle different response formats
        if (response.data && typeof response.data === 'object') {
          if ('pagination' in response.data && response.data.pagination) {
            const pagination = response.data.pagination as { pages?: number; total?: number };
            setTotalPages(pagination.pages || 1);
            setTotalTickets(pagination.total || 0);
          } else if ('totalPages' in response.data) {
            setTotalPages(response.data.totalPages || 1);
            setTotalTickets(response.data.totalCount || 0);
          } else {
            setTotalPages(1);
            setTotalTickets(tickets.length);
          }
        } else {
          setTotalPages(1);
          setTotalTickets(tickets.length);
        }
      } else {
        toast.error('Failed to fetch tickets');
        setTickets([]);
        setTotalPages(1);
        setTotalTickets(0);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error('Failed to fetch tickets');
      setTickets([]);
      setTotalPages(1);
      setTotalTickets(0);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm, itemsPerPage, serverId]);

  // Fetch server settings for ticket configuration
  const fetchServerSettings = useCallback(async () => {
    if (!serverId) return;
    try {
      const response = await apiService.getServerSettings(serverId);
      if (response.success && response.data) {
        setServerSettings(response.data);
      }
    } catch (error) {
      console.error('Error fetching server settings:', error);
    }
  }, [serverId]);

  // Handle ticket panel creation
  const handleCreateTicketPanel = useCallback(async (channelId: string) => {
    if (!serverId) return;
    setSavingConfig(true);
    try {
      const response = await apiService.createTicketPanel(serverId, {
        channel_id: channelId,
        panel_type: 'default'
      });
      
      if (response.success) {
        toast.success('Ticket panel created successfully!');
        setServerSettings((prev: any) => ({
          ...prev,
          ticket_panel_channel_id: channelId,
          ticket_panel_message_id: response.data?.messageId
        }));
      } else {
        toast.error('Failed to create ticket panel');
      }
    } catch (error) {
      console.error('Error creating ticket panel:', error);
      toast.error('Failed to create ticket panel');
    } finally {
      setSavingConfig(false);
    }
  }, [serverId]);

  // Handle custom ticket panel config
  const handleSaveTicketPanelConfig = useCallback(async (config: TicketPanelConfig) => {
    if (!serverId || !serverSettings?.ticket_panel_channel_id) return;
    setSavingConfig(true);
    try {
      const response = await apiService.createCustomTicketPanelMessage(
        serverId, 
        serverSettings.ticket_panel_channel_id, 
        config
      );
      
      if (response.success) {
        toast.success('Custom ticket panel created successfully!');
        setServerSettings((prev: any) => ({
          ...prev,
          ticket_panel_message_id: response.data?.messageId
        }));
      } else {
        toast.error('Failed to create custom ticket panel');
      }
    } catch (error) {
      console.error('Error creating custom ticket panel:', error);
      toast.error('Failed to create custom ticket panel');
    } finally {
      setSavingConfig(false);
      setIsTicketPanelModalOpen(false);
    }
  }, [serverId, serverSettings?.ticket_panel_channel_id]);

  // Handle server setting change
  const handleServerChannelChange = useCallback(async (setting: string, value: string) => {
    if (!serverId) return;
    setSavingConfig(true);
    try {
      const response = await apiService.updateServerSettings(serverId, {
        [setting]: value
      });
      
      if (response.success) {
        toast.success('Setting updated successfully');
        setServerSettings((prev: any) => ({
          ...prev,
          [setting]: value
        }));
      } else {
        toast.error('Failed to update setting');
      }
    } catch (error) {
      console.error('Error updating setting:', error);
      toast.error('Failed to update setting');
    } finally {
      setSavingConfig(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchTickets(1);
    fetchServerSettings();
  }, [fetchTickets, fetchServerSettings]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm !== undefined) {
        setCurrentPage(1); // Reset to first page when searching
        fetchTickets(1);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]); // Only depend on searchTerm for debouncing

  // Effect for status filter changes (immediate)
  useEffect(() => {
    setCurrentPage(1);
    fetchTickets(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  // Client-side sorting of tickets
  const sortedTickets = useMemo(() => {
    if (!sortConfig || !tickets) return tickets;

    return [...tickets].sort((a, b) => {
      let aValue: any = a[sortConfig.key as keyof Ticket];
      let bValue: any = b[sortConfig.key as keyof Ticket];

      // Handle different data types
      if (sortConfig.key === 'created_at' || sortConfig.key === 'last_message_at') {
        aValue = new Date(aValue as string).getTime();
        bValue = new Date(bValue as string).getTime();
      } else if (sortConfig.key === 'ticket_number' || sortConfig.key === 'rating') {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
      } else if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [tickets, sortConfig]);

  // Register auto-refresh
  useEffect(() => {
    if (settings.autoRefresh) {
      const unregister = registerAutoRefresh('tickets-page', () => {
        console.log('Auto-refreshing tickets...');
        fetchTickets(currentPage);
      });

      return unregister;
    }
  }, [settings.autoRefresh, registerAutoRefresh, fetchTickets, currentPage]);

  const handlePageChange = (page: number) => {
    fetchTickets(page);
  };

  // Toggle ticket selection
  const toggleTicketSelection = (ticketId: number) => {
    setSelectedTickets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ticketId)) {
        newSet.delete(ticketId);
      } else {
        newSet.add(ticketId);
      }
      return newSet;
    });
  };

  // Select all tickets on current page
  const selectAllTickets = () => {
    if (selectedTickets.size === tickets.length) {
      // If all are selected, deselect all
      setSelectedTickets(new Set());
    } else {
      // Otherwise select all
      setSelectedTickets(new Set(tickets.map(t => t.id)));
    }
  };

  // Bulk delete selected tickets
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  
  const openBulkDeleteConfirm = () => {
    if (selectedTickets.size === 0) return;
    setIsBulkDeleteConfirmOpen(true);
  };
  
  const closeBulkDeleteConfirm = () => {
    setIsBulkDeleteConfirmOpen(false);
  };
  
  const confirmBulkDelete = async () => {
    if (selectedTickets.size === 0) {
      closeBulkDeleteConfirm();
      return;
    }
    
    try {
      // Filter out tickets that are already deleted
      const deletableTickets = Array.from(selectedTickets).filter(id => {
        const ticket = tickets.find(t => t.id === id);
        return ticket && ticket.status !== 'deleted';
      });
      
      const alreadyDeletedCount = selectedTickets.size - deletableTickets.length;
      
      if (deletableTickets.length === 0) {
        toast.error('All selected tickets are already deleted.');
        closeBulkDeleteConfirm();
        return;
      }
      
      const results = await Promise.allSettled(
        deletableTickets.map(id => 
          apiService.deleteTicket(id, 'Bulk deletion from dashboard')
        )
      );
      
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
      const errorCount = results.length - successCount;
      
      let message = `Successfully deleted ${successCount} tickets.`;
      if (errorCount > 0) {
        message += ` ${errorCount} failed to delete.`;
      }
      if (alreadyDeletedCount > 0) {
        message += ` ${alreadyDeletedCount} were already deleted.`;
      }
      
      if (errorCount > 0) {
        toast.error(message);
      } else {
        toast.success(message);
      }
      
      // Refresh the ticket list
      setSelectedTickets(new Set());
      fetchTickets(currentPage);
    } catch (error) {
      console.error('Error in bulk delete:', error);
      toast.error('An error occurred during bulk deletion');
    } finally {
      closeBulkDeleteConfirm();
    }
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

  const getStatusBadge = (ticket: Ticket) => {
    if (ticket.status === 'open') {
      return (
        <span className={classNames(
          "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold shadow-sm",
          darkMode ? "bg-green-900/30 text-green-300 ring-1 ring-green-500/50" : "bg-green-100 text-green-800 ring-1 ring-green-200"
        )}>
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
          🟢 Open
        </span>
      );
    } else if (ticket.status === 'deleted') {
      return (
        <span className={classNames(
          "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold shadow-sm",
          darkMode ? "bg-red-900/30 text-red-300 ring-1 ring-red-500/50" : "bg-red-100 text-red-800 ring-1 ring-red-200"
        )}>
          <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
          🗑️ Deleted
        </span>
      );
    } else {
      return (
        <span className={classNames(
          "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold shadow-sm",
          "bg-muted text-muted-foreground ring-1 ring-border"
        )}>
          <div className="w-2 h-2 bg-muted-foreground rounded-full mr-2"></div>
          ❌ Closed
        </span>
      );
    }
  };

  const openReasonModal = (ticket: Ticket, action: 'close' | 'reopen' | 'delete') => {
    setSelectedTicket(ticket);
    setSelectedAction(action);
    setActionReason('');
    setIsReasonModalOpen(true);
  };
  
  const handleTicketAction = async () => {
    if (!selectedTicket || !selectedAction || loadingAction) {
      return;
    }
    
    // Prevent spam clicking by setting loading state immediately
    setLoadingAction(true);
    
    // Validate reason before proceeding
    const trimmedReason = actionReason.trim();
    if (!trimmedReason) {
      // Dismiss any existing toasts first
      toast.dismiss();
      toast.error('❌ Reason cannot be empty. Please provide a valid reason.');
      setLoadingAction(false);
      return;
    }
    
    if (trimmedReason.length < 3) {
      toast.dismiss();
      toast.error('❌ Reason must be at least 3 characters long.');
      setLoadingAction(false);
      return;
    }
    
    // Check for meaningless content (must contain at least one letter)
    if (!/[a-zA-Z]/.test(trimmedReason)) {
      toast.dismiss();
      toast.error('❌ Please provide a meaningful reason with actual words.');
      setLoadingAction(false);
      return;
    }
    
    // Add a small delay to prevent rapid-fire clicks
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      let response;
      
      switch (selectedAction) {
        case 'close':
          response = await apiService.closeTicket(selectedTicket.id, trimmedReason);
          break;
        case 'reopen':
          response = await apiService.reopenTicket(selectedTicket.id, trimmedReason);
          break;
        case 'delete':
          setIsReasonModalOpen(false);
          setIsDeleteConfirmOpen(true);
          setLoadingAction(false);
          return;
      }
      
      if (response && response.success) {
        // Dismiss any existing toasts to prevent stacking
        toast.dismiss();
        toast.success(`✅ Ticket ${selectedAction === 'close' ? 'closed' : 'reopened'} successfully!`);
        await fetchTickets(currentPage);
        setIsReasonModalOpen(false);
        setActionReason(''); // Clear the reason
      } else if (response) {
        toast.dismiss();
        toast.error(`❌ Failed to ${selectedAction} ticket: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`Error ${selectedAction}ing ticket:`, error);
      toast.dismiss();
      toast.error(`❌ Failed to ${selectedAction} ticket due to network error`);
    } finally {
      setLoadingAction(false);
    }
  };
  
  const confirmDeleteTicket = async () => {
    if (!selectedTicket) return;
    
    try {
      const response = await apiService.deleteTicket(selectedTicket.id, actionReason);
      
      if (response.success) {
        toast.success('Ticket deleted successfully');
        fetchTickets(currentPage);
      } else {
        toast.error(`Failed to delete ticket: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting ticket:', error);
      toast.error('Failed to delete ticket');
    } finally {
      setIsDeleteConfirmOpen(false);
    }
  };
  
  // Automatically delete ticket without confirmation and send transcript to user
  const autoDeleteTicket = async (ticket: Ticket) => {
    try {
      // Generate a default reason
      const defaultReason = 'Ticket closed and deleted via dashboard';
      
      // First get the transcript to ensure we have it before deleting
      const transcriptResponse = await apiService.getTicketTranscript(ticket.id);
      
      if (!transcriptResponse.success) {
        toast.error('Failed to get transcript before deletion');
        return;
      }
      
      // Now delete the ticket
      const response = await apiService.deleteTicket(ticket.id, defaultReason);
      
      if (response.success) {
        toast.success('Ticket deleted successfully and transcript sent to user');
        fetchTickets(currentPage);
      } else {
        toast.error(`Failed to delete ticket: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error auto-deleting ticket:', error);
      toast.error('Failed to delete ticket');
    }
  };
  
  const viewTicketTranscript = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setLoadingTranscript(true);
    setIsTranscriptModalOpen(true);
    
    try {
      const response = await apiService.getTicketTranscript(ticket.id);
      
      if (response.success && response.data) {
        setTranscript(response.data.transcript);
      } else {
        toast.error('Failed to fetch ticket transcript');
        setTranscript([]);
      }
    } catch (error) {
      console.error('Error fetching ticket transcript:', error);
      toast.error('Failed to fetch ticket transcript');
      setTranscript([]);
    } finally {
      setLoadingTranscript(false);
    }
  };

  return (
    <div className="page-container p-6 space-y-6">
      <div className="space-y-8">
        {/* Header */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="card-title text-2xl font-bold">
                Support Tickets
              </h1>
          <p className="card-description text-base mt-1">
                Manage user support requests and ticket lifecycle
              </p>
        </div>
          </div>
          <div className="flex items-center justify-end space-x-4">
              <button
                onClick={() => fetchTickets(currentPage)}
                disabled={loading}
                className={classNames(
                  "btn-refresh",
                  loading ? "spinning" : ""
                )}
                title="Refresh tickets"
              >
                <ArrowPathIcon className="icon" />
                <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
              </button>
              <div className={classNames(
                'flex items-center px-3 py-1 rounded-lg text-sm',
                'bg-muted text-muted-foreground'
              )}>
                Total: {totalTickets}
              </div>
              <div className={classNames(
                'flex items-center px-3 py-1 rounded-lg text-sm',
                selectedTickets.size > 0 
                  ? (darkMode ? 'bg-primary-500/20 text-primary-400' : 'bg-primary-100 text-primary-600')
                  : (darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600')
              )}>
                Selected: {selectedTickets.size}
            </div>
          </div>
        </div>
      </div>

      {/* Ticket Configuration Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Ticket Configuration</h2>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors"
          >
            <CogIcon className="h-4 w-4" />
            <span>{showConfig ? 'Hide Config' : 'Show Config'}</span>
          </button>
        </div>
        
        {showConfig && (
          <SettingsCard
            title="Ticket System Setup"
            description="Configure channels and create ticket panels"
            icon="🎫"
            variant="compact"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Ticket Panel Channel */}
              <div className="p-3 rounded-lg border space-y-2 content-area">
                <div className="flex items-center">
                  <span className="text-purple-600 dark:text-purple-400 mr-2">📧</span>
                  <h4 className="font-medium text-foreground">
                    Ticket Panel Channel
                  </h4>
                </div>
                <ChannelSelector
                  value={serverSettings?.ticket_panel_channel_id}
                  onChange={(channelId) => handleServerChannelChange('ticket_panel_channel_id', channelId)}
                  disabled={savingConfig}
                  serverId={serverId!}
                  placeholder="-- Select Channel --"
                />
                <div className="flex items-center">
                  {serverSettings?.ticket_panel_channel_id ? (
                    <span className="text-green-600 dark:text-green-400 text-xs">✅ Configured</span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400 text-xs">❌ Not configured</span>
                  )}
                </div>
              </div>

              {/* Ticket Logs Channel */}
              <div className="p-3 rounded-lg border space-y-2 content-area">
                <div className="flex items-center">
                  <span className="text-green-600 dark:text-green-400 mr-2">📄</span>
                  <h4 className="font-medium text-foreground">
                    Ticket Logs Channel
                  </h4>
                </div>
                <ChannelSelector
                  value={serverSettings?.ticket_logs_channel_id}
                  onChange={(channelId) => handleServerChannelChange('ticket_logs_channel_id', channelId)}
                  disabled={savingConfig}
                  serverId={serverId!}
                  placeholder="-- Select Channel --"
                />
                <div className="flex items-center">
                  {serverSettings?.ticket_logs_channel_id ? (
                    <span className="text-green-600 dark:text-green-400 text-xs">✅ Configured</span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400 text-xs">❌ Not configured</span>
                  )}
                </div>
              </div>

              {/* Ticket Category */}
              <div className="p-3 rounded-lg border space-y-2 content-area">
                <div className="flex items-center">
                  <span className="text-gray-600 dark:text-gray-400 mr-2">📁</span>
                  <h4 className="font-medium text-foreground">
                    Ticket Category
                  </h4>
                </div>
                <CategorySelector
                  value={serverSettings?.ticket_category_id}
                  onChange={(categoryId) => handleServerChannelChange('ticket_category_id', categoryId)}
                  disabled={savingConfig}
                  serverId={serverId!}
                />
                <div className="flex items-center">
                  {serverSettings?.ticket_category_id ? (
                    <span className="text-green-600 dark:text-green-400 text-xs">✅ Configured</span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400 text-xs">❌ Not configured</span>
                  )}
                </div>
              </div>

              {/* Create Ticket Panel */}
              <div className="p-3 rounded-lg border space-y-2 content-area">
                <div className="flex items-center">
                  <span className="text-indigo-600 mr-2">🔧</span>
                  <h4 className="font-medium text-foreground">
                    Create Ticket Panel
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  Create a ticket panel message in your selected channel.
                </p>
                <div className="flex gap-2">
                  <ActionButton
                    onClick={() => {
                      if (serverSettings?.ticket_panel_channel_id) {
                        handleCreateTicketPanel(serverSettings.ticket_panel_channel_id);
                      } else {
                        toast.error('Please select a ticket panel channel first');
                      }
                    }}
                    disabled={savingConfig || !serverSettings?.ticket_panel_channel_id}
                    loading={savingConfig}
                    variant="primary"
                    size="sm"
                    className="flex-1"
                  >
                    🎫 Create Default Panel
                  </ActionButton>
                  <ActionButton
                    onClick={() => {
                      if (serverSettings?.ticket_panel_channel_id) {
                        setIsTicketPanelModalOpen(true);
                      } else {
                        toast.error('Please select a ticket panel channel first');
                      }
                    }}
                    disabled={savingConfig || !serverSettings?.ticket_panel_channel_id}
                    loading={savingConfig}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    🎨 Custom Panel
                  </ActionButton>
                </div>
              </div>
            </div>
          </SettingsCard>
        )}
      </div>

        <Card className="content-area shadow-xl border-0 rounded-xl overflow-hidden ring-1 ring-border">
        <div className="p-6 border-b border-border bg-muted/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className={classNames(
                "text-xl font-semibold",
                "text-foreground"
              )}>Tickets Overview</h3>
              <span className={classNames(
                "text-sm font-medium",
                "text-muted-foreground"
              )}>
                {totalTickets} total tickets • 
                {statusFilter === 'all' 
                  ? ` ${tickets.filter(t => t.status === 'open').length} open, ${tickets.filter(t => t.status === 'closed').length} closed, ${tickets.filter(t => t.status === 'deleted').length} deleted`
                  : ` ${tickets.length} ${statusFilter}`
                }
              </span>
            </div>
            {selectedTickets.size > 0 && (
              <div className="flex items-center space-x-4">
                <span className={classNames(
                  "text-sm font-medium px-3 py-1 rounded-full",
                  darkMode ? "text-blue-300 bg-blue-900/30" : "text-blue-700 bg-blue-100"
                )}>{selectedTickets.size} selected</span>
                <button
                  onClick={openBulkDeleteConfirm}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg shadow-sm transition-all duration-200 transform hover:scale-105 text-white bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
                >
                  🎫 Bulk Action
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filter Section */}
        <div className="p-6 border-b border-border">
          <SimpleFilter
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search tickets by subject, user, or ticket number..."
            selectValue={statusFilter}
            onSelectChange={(value) => setStatusFilter(value as any)}
            selectOptions={[
              { value: 'all', label: 'All Statuses' },
              { value: 'open', label: 'Open' },
              { value: 'closed', label: 'Closed' },
              { value: 'deleted', label: 'Deleted' }
            ]}
            onClear={() => {
              setSearchTerm('');
              setStatusFilter('all');
            }}
          />
        </div>

        <div className={classNames(
          "p-6",
          "bg-background"
        )}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <LoadingSpinner className="text-blue-500" size="lg" />
              <span className={classNames(
                "ml-3 text-lg",
                "text-muted-foreground"
              )}>Loading tickets...</span>
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-16">
              <div className={classNames(
                "text-6xl mb-4",
                darkMode ? "text-gray-600" : "text-gray-400"
              )}>🎫</div>
              <h3 className={classNames(
                "text-xl font-medium mb-2",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>No tickets found</h3>
              <p className={classNames(
                "text-sm",
                darkMode ? "text-gray-400" : "text-gray-500"
              )}>
                {statusFilter === 'all' 
                  ? "No support tickets have been created yet." 
                  : `No ${statusFilter} tickets found.`
                }
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto max-h-[65vh] overflow-auto rounded-lg">
                <table className={classNames(
                  "min-w-full divide-y-2",
                  darkMode ? "divide-gray-700" : "divide-gray-200"
                )}>
                  <thead className="sticky top-0 z-10 rounded-t-lg bg-muted/80 backdrop-blur supports-[backdrop-filter]:bg-muted/60">
                    <tr>
                      <th className="relative w-12 px-6 py-4 sm:w-16 sm:px-8">
                        <input
                          type="checkbox"
                          className="h-5 w-5 rounded border-2 text-primary border-input bg-background focus:ring-primary focus:ring-2 transition-all duration-200"
                          checked={selectedTickets.size > 0 && selectedTickets.size === tickets.length}
                          onChange={selectAllTickets}
                        />
                      </th>
                      <SortableTableHeader
                        label="🎫 Ticket"
                        sortKey="ticket_number"
                        currentSort={sortConfig}
                        onSort={setSortConfig}
                      />
                      <SortableTableHeader
                        label="🏠 Server"
                        sortKey="server_name"
                        currentSort={sortConfig}
                        onSort={setSortConfig}
                      />
                      <SortableTableHeader
                        label="👤 User"
                        sortKey="username"
                        currentSort={sortConfig}
                        onSort={setSortConfig}
                      />
                      <SortableTableHeader
                        label="📝 Subject"
                        sortKey="subject"
                        currentSort={sortConfig}
                        onSort={setSortConfig}
                      />
                      <SortableTableHeader
                        label="📊 Status"
                        sortKey="status"
                        currentSort={sortConfig}
                        onSort={setSortConfig}
                      />
                      <SortableTableHeader
                        label="📅 Created"
                        sortKey="created_at"
                        currentSort={sortConfig}
                        onSort={setSortConfig}
                      />
                      <SortableTableHeader
                        label="⏰ Last Activity"
                        sortKey="last_message_at"
                        currentSort={sortConfig}
                        onSort={setSortConfig}
                      />
                      <SortableTableHeader
                        label="⭐ Rating"
                        sortKey="rating"
                        currentSort={sortConfig}
                        onSort={setSortConfig}
                      />
                      <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        ⚙️ Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {sortedTickets.map((ticket) => (
                      <tr 
                        key={ticket.id} 
                        className={classNames(
                          "transition-all duration-200 hover:shadow-lg relative group odd:bg-muted/30",
                          selectedTickets.has(ticket.id) 
                            ? 'bg-primary/10 ring-1 ring-primary/30'
                            : 'hover:bg-muted/50'
                        )}
                      >
                        <td className="relative w-12 px-6 py-4 sm:w-16 sm:px-8">
                          {selectedTickets.has(ticket.id) && (
                            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-primary/80 rounded-r" />
                          )}
                          <input
                            type="checkbox"
                            className="h-5 w-5 rounded border-2 text-primary border-input bg-background focus:ring-primary focus:ring-2 transition-all duration-200"
                            checked={selectedTickets.has(ticket.id)}
                            onChange={() => toggleTicketSelection(ticket.id)}
                          />
                        </td>
                        <td className={classNames(
                          "px-6 py-4 whitespace-nowrap text-sm font-bold",
                          darkMode ? "text-blue-400" : "text-blue-600"
                        )}>
                          #{ticket.ticket_number || ticket.id}
                        </td>
                        <td className={classNames(
                          "px-6 py-4 whitespace-nowrap text-sm font-medium",
                          darkMode ? "text-gray-300" : "text-gray-700"
                        )}>
                          {(ticket as any).server_name || (ticket as any).guild_name || 'Unknown Server'}
                        </td>
                        <td className={classNames(
                          "px-6 py-4 whitespace-nowrap text-sm font-semibold",
                          darkMode ? "text-gray-100" : "text-gray-900"
                        )}>
                          <div className="flex items-center space-x-2">
                            <div className={classNames(
                              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                              darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"
                            )}>
                              {((ticket as any).username || `User ${ticket.user_id}`).charAt(0).toUpperCase()}
                            </div>
                            <span>{(ticket as any).username || `User ${ticket.user_id}`}</span>
                          </div>
                        </td>
                        <td className={classNames(
                          "px-6 py-4 text-sm max-w-xs",
                          darkMode ? "text-gray-200" : "text-gray-900"
                        )}>
                          <div className="truncate group-hover:whitespace-normal transition-all duration-200">
                            {ticket.subject}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(ticket)}
                        </td>
                        <td className={classNames(
                          "px-6 py-4 whitespace-nowrap text-sm",
                          darkMode ? "text-gray-400" : "text-gray-500"
                        )}>
                          {formatDate(ticket.created_at)}
                        </td>
                        <td className={classNames(
                          "px-6 py-4 whitespace-nowrap text-sm",
                          darkMode ? "text-gray-400" : "text-gray-500"
                        )}>
                          {(ticket.last_activity_at || ticket.last_message_at) ? formatDate(ticket.last_activity_at || ticket.last_message_at || '') : 'No activity'}
                        </td>
                        <td className={classNames(
                          "px-6 py-4 whitespace-nowrap text-sm",
                          "text-muted-foreground"
                        )}>
                          {ticket.rating ? (
                            <div className="flex items-center space-x-1">
                              <span className="text-yellow-500">
                                {'⭐'.repeat(ticket.rating)}
                              </span>
                              <span className={classNames(
                                "text-xs font-medium",
                                darkMode ? "text-gray-400" : "text-gray-500"
                              )}>
                                ({ticket.rating}/5)
                              </span>
                            </div>
                          ) : (
                            <span className={classNames(
                              "text-xs italic",
                              darkMode ? "text-gray-500" : "text-gray-400"
                            )}>
                              Not rated
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            {ticket.status === 'open' && (
                              <ActionButton
                                size="xs"
                                variant="danger"
                                onClick={() => openReasonModal(ticket, 'close')}
                              >
                                🔒 Close
                              </ActionButton>
                            )}
                            {ticket.status === 'closed' && (
                              <ActionButton
                                size="xs"
                                variant="success"
                                onClick={() => openReasonModal(ticket, 'reopen')}
                              >
                                🔄 Reopen
                              </ActionButton>
                            )}
                            <ActionButton
                              size="xs"
                              variant="primary"
                              onClick={() => viewTicketTranscript(ticket)}
                            >
                              📄 Transcript
                            </ActionButton>
                            {ticket.status === 'closed' && (
                              <ActionButton
                                size="xs"
                                variant="outline"
                                onClick={() => autoDeleteTicket(ticket)}
                              >
                                🗑️ Delete
                              </ActionButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="mt-6">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    itemsPerPage={itemsPerPage}
                    totalItems={totalTickets}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </Card>
      
      {/* Reason Modal */}
      <Transition appear show={isReasonModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => {
          setIsReasonModalOpen(false);
          setLoadingAction(false);
        }}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className={classNames(
              "fixed inset-0 bg-black/60 backdrop-blur-sm",
              darkMode ? "bg-gray-900/80" : "bg-black/50"
            )} />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className={classNames(
                  "w-full max-w-2xl transform overflow-hidden rounded-2xl p-8 text-left align-middle shadow-2xl transition-all",
                  "bg-card ring-1 ring-border"
                )}>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                      <div className={classNames(
                        "w-16 h-16 rounded-full flex items-center justify-center mr-6",
                        selectedAction === 'close' 
                          ? (darkMode ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-600")
                          : selectedAction === 'reopen'
                          ? (darkMode ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-600")
                          : (darkMode ? "bg-gray-700/50 text-gray-300" : "bg-gray-100 text-gray-600")
                      )}>
                        <span className="text-3xl">
                          {selectedAction === 'close' ? '🔒' : 
                           selectedAction === 'reopen' ? '🔄' : '🗑️'}
                        </span>
                      </div>
                      <div>
                        <Dialog.Title
                          as="h3"
                          className={classNames(
                            "text-2xl font-bold",
                            darkMode ? "text-gray-100" : "text-gray-900"
                          )}
                        >
                          {selectedAction === 'close' ? 'Close Ticket' : 
                           selectedAction === 'reopen' ? 'Reopen Ticket' : 'Delete Ticket'}
                        </Dialog.Title>
                        <p className={classNames(
                          "text-sm mt-1",
                          darkMode ? "text-gray-400" : "text-gray-600"
                        )}>
                          {selectedAction === 'close' ? 'This will close the ticket for the user' : 
                           selectedAction === 'reopen' ? 'This will reopen the ticket for continued support' : 
                           'This action cannot be undone'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={classNames(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200",
                        darkMode 
                          ? "text-gray-400 hover:text-gray-300 hover:bg-gray-700" 
                          : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                      )}
                      onClick={() => {
                        setIsReasonModalOpen(false);
                        setLoadingAction(false);
                      }}
                    >
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className={classNames(
                    "p-6 rounded-xl mb-6",
                    darkMode ? "bg-gray-700/30" : "bg-gray-50"
                  )}>
                    <p className={classNames(
                      "text-base leading-relaxed",
                      darkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                      {selectedAction === 'close' ? 'Please provide a reason for closing this ticket. The user will be notified and a transcript will be generated.' : 
                       selectedAction === 'reopen' ? 'Please provide a reason for reopening this ticket. The user will be notified that their ticket is active again.' : 
                       'Please provide a reason for deleting this ticket. This action will be logged for audit purposes.'}
                    </p>
                  </div>

                  {/* Form */}
                  <div className="mb-8">
                    <label className={classNames(
                      "block text-base font-semibold mb-4",
                      darkMode ? "text-gray-200" : "text-gray-700"
                    )}>
                      Reason for {selectedAction === 'close' ? 'closing' : selectedAction === 'reopen' ? 'reopening' : 'deleting'} this ticket
                      <span className={classNames(
                        "ml-2 text-sm font-normal",
                        darkMode ? "text-gray-400" : "text-gray-500"
                      )}>(required)</span>
                    </label>
                    <textarea
                      className={classNames(
                        "w-full px-6 py-4 rounded-xl border-2 shadow-sm focus:outline-none focus:ring-3 focus:border-blue-500 transition-all duration-200 text-base resize-none",
                        darkMode 
                          ? "bg-gray-700 text-gray-100 border-gray-600 placeholder-gray-400 focus:ring-blue-500/30" 
                          : "bg-white text-gray-900 border-gray-300 placeholder-gray-500 focus:ring-blue-500/30"
                      )}
                      rows={4}
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      placeholder={`Enter reason for ${selectedAction === 'close' ? 'closing' : selectedAction === 'reopen' ? 'reopening' : 'deleting'} this ticket...`}
                    />
                    <div className={classNames(
                      "mt-2 text-sm flex justify-between",
                      darkMode ? "text-gray-400" : "text-gray-500"
                    )}>
                      <span className={classNames(
                        actionReason.trim().length > 0 && actionReason.trim().length < 3 
                          ? (darkMode ? "text-red-400" : "text-red-600")
                          : ""
                      )}>
                        {actionReason.trim().length > 0 && actionReason.trim().length < 3 
                          ? "Minimum 3 characters required"
                          : actionReason.trim().length >= 3
                          ? "✓ Valid reason"
                          : "Enter a reason (minimum 3 characters)"}
                      </span>
                      <span>{actionReason.length}/500 characters</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-3 sm:space-y-0">
                    <button
                      type="button"
                      className={classNames(
                        "flex-1 px-8 py-4 text-base font-bold rounded-xl transition-all duration-300 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 shadow-lg border relative overflow-hidden group",
                        darkMode 
                          ? "bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900 hover:from-gray-600 hover:via-gray-700 hover:to-gray-800 text-gray-100 border-gray-600/50 focus:ring-gray-500/40 hover:shadow-gray-700/30" 
                          : "bg-gradient-to-r from-gray-100 via-gray-200 to-gray-300 hover:from-gray-200 hover:via-gray-300 hover:to-gray-400 text-gray-800 border-gray-300/50 focus:ring-gray-400/40 hover:shadow-gray-400/30"
                      )}
                      onClick={() => {
                        setIsReasonModalOpen(false);
                        setLoadingAction(false);
                      }}
                    >
                      <div className="relative z-10">❌ Cancel</div>
                      <div className="absolute inset-0 bg-white/10 transform translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>
                    </button>
                    <button
                      type="button"
                      className={classNames(
                        "flex-1 px-8 py-4 text-base font-bold rounded-xl shadow-xl transition-all duration-300 transform focus:outline-none focus:ring-4 relative overflow-hidden group",
                        selectedAction === 'close' 
                          ? 'bg-gradient-to-r from-red-500 via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 text-white focus:ring-red-500/40 border border-red-500/30 hover:shadow-red-500/30'
                          : selectedAction === 'reopen' 
                          ? 'bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-600 hover:via-emerald-700 hover:to-emerald-800 text-white focus:ring-emerald-500/40 border border-emerald-500/30 hover:shadow-emerald-500/30'
                          : 'bg-gradient-to-r from-gray-500 via-gray-600 to-gray-700 hover:from-gray-600 hover:via-gray-700 hover:to-gray-800 text-white focus:ring-gray-500/40 border border-gray-500/30 hover:shadow-gray-500/30',
                        loadingAction ? "animate-pulse cursor-not-allowed" : "hover:scale-105 active:scale-95",
                        (!actionReason.trim() || actionReason.trim().length < 3) ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                      )}
                      onClick={handleTicketAction}
                      disabled={!actionReason.trim() || actionReason.trim().length < 3 || loadingAction}
                    >
                      <div className="relative z-10">
                        {loadingAction ? (
                          <div className="flex items-center justify-center space-x-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>
                              {selectedAction === 'close' ? 'Closing...' : 
                               selectedAction === 'reopen' ? 'Reopening...' : 
                               'Processing...'}
                            </span>
                          </div>
                        ) : (
                          selectedAction === 'close' ? '🔒 Close Ticket' : 
                          selectedAction === 'reopen' ? '🔄 Reopen Ticket' : 
                          '🗑️ Delete Ticket'
                        )}
                      </div>
                      <div className="absolute inset-0 bg-white/10 transform translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
      
      {/* Delete Confirmation Modal */}
      <Transition appear show={isDeleteConfirmOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsDeleteConfirmOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className={classNames(
              "fixed inset-0 bg-black/60 backdrop-blur-sm",
              darkMode ? "bg-gray-900/80" : "bg-black/50"
            )} />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className={classNames(
                  "w-full max-w-2xl transform overflow-hidden rounded-2xl p-8 text-left align-middle shadow-2xl transition-all",
                  "bg-card ring-1 ring-border"
                )}>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                      <div className={classNames(
                        "w-16 h-16 rounded-full flex items-center justify-center mr-6",
                        darkMode ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-600"
                      )}>
                        <span className="text-3xl">⚠️</span>
                      </div>
                      <div>
                        <Dialog.Title
                          as="h3"
                          className={classNames(
                            "text-2xl font-bold",
                            darkMode ? "text-gray-100" : "text-gray-900"
                          )}
                        >
                          Confirm Delete
                        </Dialog.Title>
                        <p className={classNames(
                          "text-sm mt-1",
                          darkMode ? "text-gray-400" : "text-gray-600"
                        )}>
                          This action cannot be undone
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={classNames(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200",
                        darkMode 
                          ? "text-gray-400 hover:text-gray-300 hover:bg-gray-700" 
                          : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                      )}
                      onClick={() => setIsDeleteConfirmOpen(false)}
                    >
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className={classNames(
                    "p-6 rounded-xl mb-6",
                    darkMode ? "bg-red-900/10 border border-red-500/20" : "bg-red-50 border border-red-200"
                  )}>
                    <p className={classNames(
                      "text-base leading-relaxed mb-4",
                      darkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                      Are you sure you want to delete this ticket? This action cannot be undone and will permanently remove all ticket data.
                    </p>
                    <div className={classNames(
                      "p-4 rounded-lg",
                      darkMode ? "bg-gray-700/50" : "bg-white"
                    )}>
                      <p className={classNames(
                        "text-sm font-medium",
                        darkMode ? "text-gray-300" : "text-gray-700"
                      )}>
                        Reason: <span className="font-normal">{actionReason || 'No reason provided'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-3 sm:space-y-0">
                    <button
                      type="button"
                      className={classNames(
                        "flex-1 px-8 py-4 border-2 text-base font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-3 focus:ring-gray-500/30",
                        darkMode 
                          ? "border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500" 
                          : "border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                      )}
                      onClick={() => setIsDeleteConfirmOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="flex-1 px-8 py-4 border border-transparent text-base font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-3 focus:ring-red-500/30 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                      onClick={confirmDeleteTicket}
                    >
                      🗑️ Delete Ticket
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
      
      {/* Transcript Modal */}
      <Transition appear show={isTranscriptModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsTranscriptModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className={classNames(
              "fixed inset-0 bg-black/60 backdrop-blur-sm",
              darkMode ? "bg-gray-900/80" : "bg-black/50"
            )} />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="content-area w-full max-w-4xl transform overflow-hidden rounded-2xl p-6 text-left align-middle shadow-2xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className={classNames(
                      "text-xl font-semibold leading-6 flex items-center justify-between mb-4",
                      "text-foreground"
                    )}
                  >
                    <div className="flex items-center">
                      <div className={classNames(
                        "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
                        darkMode ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-600"
                      )}>
                        📄
                      </div>
                      <span>Ticket Transcript {selectedTicket && `#${selectedTicket.ticket_number}`}</span>
                    </div>
                    <button
                      type="button"
                      className={classNames(
                        "rounded-lg p-2 transition-all duration-200 hover:scale-105",
                        darkMode ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      )}
                      onClick={() => setIsTranscriptModalOpen(false)}
                    >
                      <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </Dialog.Title>
                  <div className="max-h-[70vh] overflow-y-auto rounded-lg border-2 border-border bg-muted/30">
                    {loadingTranscript ? (
                      <div className="flex justify-center py-16">
                        <div className="text-center">
                          <LoadingSpinner size="lg" className="text-blue-500" />
                          <p className={classNames(
                            "mt-4 text-lg",
                            "text-muted-foreground"
                          )}>Loading transcript...</p>
                        </div>
                      </div>
                    ) : transcript && transcript.length > 0 ? (
                      <div className="space-y-4 p-4">
                        {transcript.map((message) => (
                          <div key={message.id} className="content-area rounded-xl p-4 ring-1 ring-border transition-all duration-200 hover:shadow-lg">
                            <div className="flex items-center mb-3">
                              <div className={classNames(
                                "w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold",
                                message.author.bot 
                                  ? "bg-primary/20 text-primary"
                                  : "bg-muted text-muted-foreground"
                              )}>
                                {message.author.bot ? '🤖' : message.author.username.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center">
                                  <span className={classNames(
                                    "font-semibold",
                                    message.author.bot 
                                      ? "text-primary"
                                      : "text-foreground"
                                  )}>
                                    {message.author.username}
                                  </span>
                                  {message.author.bot && (
                                    <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-primary/20 text-primary">
                                      BOT
                                    </span>
                                  )}
                                  <span className="text-xs ml-2 text-muted-foreground">
                                    {new Date(message.timestamp).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{message.content}</div>
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="mt-3">
                                <p className="text-sm font-medium mb-2 text-foreground">📎 Attachments:</p>
                                <div className="flex flex-wrap gap-2">
                                  {message.attachments.map((att: any, index: number) => (
                                    <a
                                      key={index}
                                      href={att.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 bg-primary/20 text-primary hover:bg-primary/30"
                                    >
                                      🔗 {att.name || `Attachment ${index + 1}`}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                            {message.embeds && message.embeds.length > 0 && (
                              <div className="mt-3">
                                {message.embeds.map((embed: any, index: number) => (
                                  <div key={index} className="border-l-4 border-primary pl-4 py-2 rounded-r-lg bg-primary/10">
                                    {embed.title && (
                                      <p className="font-semibold mb-1 text-foreground">{embed.title}</p>
                                    )}
                                    {embed.description && (
                                      <p className="text-sm mb-2 text-foreground/80">{embed.description}</p>
                                    )}
                                    {embed.fields && embed.fields.length > 0 && (
                                      <div className="grid grid-cols-2 gap-2">
                                        {embed.fields.map((field: any, fieldIndex: number) => (
                                          <div key={fieldIndex} className="text-xs">
                                            <p className="font-medium mb-1 text-foreground/90">{field.name}</p>
                                            <p className="text-xs text-muted-foreground">{field.value}</p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-16">
                        <div className={classNames(
                          "text-6xl mb-4",
                          darkMode ? "text-gray-600" : "text-gray-400"
                        )}>📭</div>
                        <p className={classNames(
                          "text-lg font-medium",
                          darkMode ? "text-gray-300" : "text-gray-700"
                        )}>
                          No messages found in this ticket.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      className={classNames(
                        "inline-flex items-center px-8 py-3 text-base font-bold rounded-xl shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 relative overflow-hidden group border",
                        "bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 hover:from-blue-600 hover:via-blue-700 hover:to-blue-800",
                        "text-white border-blue-500/30 focus:ring-blue-500/40 hover:shadow-blue-500/30"
                      )}
                      onClick={() => setIsTranscriptModalOpen(false)}
                    >
                      <div className="relative z-10">✅ Close Transcript</div>
                      <div className="absolute inset-0 bg-white/10 transform translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Bulk Delete Confirmation Modal */}
      <Transition appear show={isBulkDeleteConfirmOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeBulkDeleteConfirm}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className={classNames(
              "fixed inset-0 bg-black/60 backdrop-blur-sm",
              darkMode ? "bg-gray-900/80" : "bg-black/50"
            )} />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className={classNames(
                  "w-full max-w-2xl transform overflow-hidden rounded-2xl p-8 text-left align-middle shadow-2xl transition-all",
                  "bg-card ring-1 ring-border"
                )}>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                      <div className={classNames(
                        "w-16 h-16 rounded-full flex items-center justify-center mr-6",
                        darkMode ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-600"
                      )}>
                        <span className="text-3xl">🗑️</span>
                      </div>
                      <div>
                        <Dialog.Title
                          as="h3"
                          className={classNames(
                            "text-2xl font-bold",
                            darkMode ? "text-gray-100" : "text-gray-900"
                          )}
                        >
                          Delete {selectedTickets.size} Tickets
                        </Dialog.Title>
                        <p className={classNames(
                          "text-sm mt-1",
                          darkMode ? "text-gray-400" : "text-gray-600"
                        )}>
                          This action cannot be undone
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={classNames(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200",
                        darkMode 
                          ? "text-gray-400 hover:text-gray-300 hover:bg-gray-700" 
                          : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                      )}
                      onClick={closeBulkDeleteConfirm}
                    >
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className={classNames(
                    "p-6 rounded-xl mb-6",
                    darkMode ? "bg-red-900/10 border border-red-500/20" : "bg-red-50 border border-red-200"
                  )}>
                    <p className={classNames(
                      "text-base leading-relaxed",
                      darkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                      Are you sure you want to delete <span className="font-semibold">{selectedTickets.size}</span> selected tickets? This action cannot be undone and will permanently remove all ticket data.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-3 sm:space-y-0">
                    <button
                      type="button"
                      className={classNames(
                        "flex-1 px-8 py-4 border-2 text-base font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-3 focus:ring-gray-500/30",
                        darkMode 
                          ? "border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500" 
                          : "border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                      )}
                      onClick={closeBulkDeleteConfirm}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="flex-1 px-8 py-4 border border-transparent text-base font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-3 focus:ring-red-500/30 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                      onClick={confirmBulkDelete}
                    >
                      🗑️ Delete {selectedTickets.size} Tickets
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Ticket Panel Config Modal */}
      <TicketPanelConfigModal
        isOpen={isTicketPanelModalOpen}
        onClose={() => setIsTicketPanelModalOpen(false)}
        onSave={handleSaveTicketPanelConfig}
      />
    </div>
  );
};

const Tickets: React.FC = () => {
  return (
    <PermissionGuard 
      requiredPermission={['view_tickets', 'manage_tickets', 'admin']}
      fallbackMessage="You need ticket management permissions to access this page."
    >
      <TicketsContent />
    </PermissionGuard>
  );
};

export default Tickets;
