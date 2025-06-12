import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { Server, ServerSettings } from '../types';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';
import {
  PaperAirplaneIcon,
  ShieldExclamationIcon
} from '@heroicons/react/24/outline';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useTheme } from '../contexts/ThemeContext';

// Utility function for conditional class names
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

// Define a channel type for the dropdown selections
interface Channel {
  id: string;
  name: string;
  type: string;
  position: number;
}

// Define role interface for verification
interface Role {
  id: string;
  name: string;
  color: string;
  position: number;
}

// Define ticket category interface
interface TicketCategory {
  id: string;
  label: string;
  description: string;
  emoji: string;
  color: number;
  priority: string;
  expectedResponseTime: string;
}

interface ServerDetailProps {}

  const ServerDetail: React.FC<ServerDetailProps> = () => {
  const { darkMode } = useTheme();
  const { user } = useAuth(); // Get logged-in Discord user
  const { canManageSettings, isAdmin } = usePermissions();
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const [server, setServer] = useState<Server | null>(null);
  const [loading, setLoading] = useState(true);

  // Add state for error message and channels
  const [error, setError] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Add state for ticket categories
  const [ticketCategories, setTicketCategories] = useState<TicketCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Add state for roles
  const [roles, setRoles] = useState<Role[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);

  // Add state for custom verification message modal
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  // Add state for custom ticket message modal
  const [showTicketModal, setShowTicketModal] = useState(false);

  // Add state for member events custom messages
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [customWelcomeMessage, setCustomWelcomeMessage] = useState({
    title: '👋 Welcome to {server}!',
    description: 'Welcome {user}! We\'re excited to have you in our community. We hope you enjoy your stay!',
    color: '#43b581',
    fields: [
      { name: '🔹 Server Rules', value: 'Please read our rules to get started.' },
      { name: '🔹 Get Roles', value: 'Visit our roles channel to get your roles.' },
      { name: '🔹 Member Count', value: 'You are member #{memberCount}!' }
    ]
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [customLeaveMessage, setCustomLeaveMessage] = useState({
    title: '👋 Goodbye!',
    description: 'Thanks for being part of our community. We hope to see you again soon!',
    color: '#e74c3c',
    fields: [
      { name: '🔹 Come Back Soon', value: 'You are always welcome to return.' },
      { name: '🔹 Feedback', value: 'Let us know how we can improve.' }
    ]
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [customInviteJoinMessage, setCustomInviteJoinMessage] = useState({
    title: '🎉 New Member Joined',
    description: 'A new member has joined through an invite!',
    color: '#43b581',
    fields: [
      { name: '🔹 Invitation Info', value: 'Invited by: {inviter}' },
      { name: '🔹 Server Stats', value: 'Total Members: {totalMembers}' }
    ]
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [customInviteLeaveMessage, setCustomInviteLeaveMessage] = useState({
    title: '📤 Member Left',
    description: 'A member has left the server.',
    color: '#e74c3c',
    fields: [
      { name: '🔹 Time in Server', value: 'Was here for: {timeInServer}' },
      { name: '🔹 Originally Invited By', value: 'Invited by: {inviter}' }
    ]
  });

  // Add state for modal visibility for member events
  const [showWelcomeMessageModal, setShowWelcomeMessageModal] = useState(false);
  const [showLeaveMessageModal, setShowLeaveMessageModal] = useState(false);
  const [showInviteJoinMessageModal, setShowInviteJoinMessageModal] = useState(false);
  const [showInviteLeaveMessageModal, setShowInviteLeaveMessageModal] = useState(false);
  const [showPlaceholders, setShowPlaceholders] = useState(false);

  // Add state for custom ticket panel message
  const [customTicketMessage, setCustomTicketMessage] = useState({
    title: '🎫 Support Tickets',
    description: 'Need help? Have a question? Want to report something? Create a ticket and our staff team will assist you as soon as possible.',
    color: '#3B82F6',
    buttonText: 'Create Ticket',
    fields: [
      { name: '🔹 How to Create a Ticket', value: 'Click the button below to create a new support ticket.' },
      { name: '🔹 Response Time', value: 'Our staff team typically responds within a few hours.' },
      { name: '🔹 Categories Available', value: 'Select the category that best matches your request when creating a ticket.' }
    ]
  });

  // Add state for custom verification message
  const [customVerificationMessage, setCustomVerificationMessage] = useState({
    title: '🔒 Server Verification',
    description: 'Welcome! Please verify yourself to access the server by clicking the button below.',
    color: '#22c55e',
    buttonText: 'Verify',
    fields: [
      { name: '🔹 Quick & Easy', value: 'Verification takes just one click!' },
      { name: '🔹 Stay Safe', value: 'This helps us keep the server secure for everyone.' }
    ]
  });

  // Helper function to safely get channels array
  const getSafeChannels = (): Channel[] => {
    return Array.isArray(channels) ? channels : [];
  };

  // Function to fetch server channels - wrapped in useCallback to prevent recreation on each render
  const fetchServerChannels = useCallback(async () => {
    if (!serverId || serverId === 'undefined') {
      console.warn('ServerDetail: Cannot fetch channels - serverId is:', serverId);
      return;
    }
    
    try {
      setLoadingChannels(true);
      console.log('ServerDetail: Fetching channels for server:', serverId);
      
      const response = await apiService.getServerChannels(serverId, 'text');
      
      if (response.success && response.data) {
        const channelsData = Array.isArray(response.data) ? response.data : [];
        setChannels(channelsData);
        console.log('ServerDetail: Successfully fetched', channelsData.length, 'channels for server', serverId);
      } else {
        const errorMessage = response.error || 'Unknown error occurred';
        console.error('ServerDetail: Failed to fetch server channels:', errorMessage);
        toast.error(`Failed to fetch server channels: ${errorMessage}`);
        setChannels([]); // Ensure channels is always an array
      }
    } catch (error: any) {
      console.error('ServerDetail: Error fetching server channels:', error);
      toast.error(`Error fetching server channels: ${error.message || 'Unknown error'}`);
      setChannels([]); // Ensure channels is always an array
    } finally {
      setLoadingChannels(false);
    }
  }, [serverId]);

  // Function to fetch ticket categories
  const fetchTicketCategories = useCallback(async () => {
    if (!serverId || serverId === 'undefined') {
      console.warn('ServerDetail: Cannot fetch categories - serverId is:', serverId);
      return;
    }
    
    try {
      setLoadingCategories(true);
      console.log('ServerDetail: Fetching ticket categories for server:', serverId);
      
      const response = await apiService.getTicketCategories(serverId);
      
      if (response.success && response.data) {
        setTicketCategories(response.data.categories || []);
        console.log('ServerDetail: Successfully fetched', (response.data.categories || []).length, 'ticket categories for server', serverId);
      } else {
        const errorMessage = response.error || 'Unknown error occurred';
        console.error('ServerDetail: Failed to fetch ticket categories:', errorMessage);
        toast.error(`Failed to fetch ticket categories: ${errorMessage}`);
      }
    } catch (error: any) {
      console.error('ServerDetail: Error fetching ticket categories:', error);
      toast.error(`Error fetching ticket categories: ${error.message || 'Unknown error'}`);
    } finally {
      setLoadingCategories(false);
    }
  }, [serverId]);

  // Function to fetch server roles
  const fetchServerRoles = useCallback(async () => {
    if (!serverId || serverId === 'undefined') {
      console.warn('ServerDetail: Cannot fetch roles - serverId is:', serverId);
      return;
    }
    
    try {
      setLoadingRoles(true);
      console.log('ServerDetail: Fetching roles for server:', serverId);
      
      const response = await apiService.getServerChannelsAndRoles(serverId);
      
      if (response.success && response.data) {
        setRoles(response.data.roles || []);
        console.log('ServerDetail: Successfully fetched', (response.data.roles || []).length, 'roles for server', serverId);
      } else {
        const errorMessage = response.error || 'Unknown error occurred';
        console.error('ServerDetail: Failed to fetch server roles:', errorMessage);
        toast.error(`Failed to fetch server roles: ${errorMessage}`);
      }
    } catch (error: any) {
      console.error('ServerDetail: Error fetching server roles:', error);
      toast.error(`Error fetching server roles: ${error.message || 'Unknown error'}`);
    } finally {
      setLoadingRoles(false);
    }
  }, [serverId]);
  
  // Function to update server settings
  const updateServerSettings = async (settings: Partial<ServerSettings>) => {
    if (!serverId || !server) return;
    
    try {
      setSaving(true);
      setSuccessMessage(null);
      
      const response = await apiService.updateServerSettings(serverId, settings);
      
      if (response.success && response.data) {
        // Update the local server state with the new settings
        setServer({
          ...server,
          settings: {
            ...(server.settings || { guild_id: serverId, language: 'en' }),
            ...settings
          } as ServerSettings
        });
        
        setSuccessMessage('Settings updated successfully');
        toast.success('Settings updated successfully');
      } else {
        console.error('Failed to update server settings:', response.error);
        toast.error('Failed to update server settings');
      }
    } catch (error) {
      console.error('Error updating server settings:', error);
      toast.error('Failed to update server settings');
    } finally {
      setSaving(false);
      
      // Clear success message after 3 seconds
      if (successMessage) {
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    }
  };
  
  // Function to handle channel selection change
  const handleChannelChange = (settingKey: string, channelId: string) => {
    if (!server) return;
    
    // Create an object with the setting key and new value
    const settings: Partial<ServerSettings> = {
      [settingKey]: channelId === 'none' ? null : channelId
    };
    
    // Update the server settings
    updateServerSettings(settings);
  };
  
  // Function to handle ticket category selection change
  const handleTicketCategoryChange = async (categoryId: string) => {
    if (!server || !serverId) return;
    
    try {
      setSaving(true);
      setSuccessMessage(null);
      
      // Use the specific ticket categories API
      const response = await apiService.updateTicketCategories(serverId, {
        categoryId: categoryId === 'none' ? undefined : categoryId
      });
      
      if (response.success) {
        // Update the local server state
        setServer({
          ...server,
          settings: {
            ...(server.settings || { guild_id: serverId, language: 'en' }),
            ticket_category_id: categoryId === 'none' ? undefined : categoryId
          } as ServerSettings
        });
        
        setSuccessMessage('Ticket category updated successfully');
        toast.success('Ticket category updated successfully');
      } else {
        console.error('Failed to update ticket category:', response.error);
        toast.error('Failed to update ticket category');
      }
    } catch (error) {
      console.error('Error updating ticket category:', error);
      toast.error('Failed to update ticket category');
    } finally {
      setSaving(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };
  // Function to load welcome message configuration
  const loadWelcomeMessageConfig = useCallback(async () => {
    if (!serverId || serverId === 'undefined') {
      return;
    }
    
    try {
      console.log('🔵 LOADING WELCOME MESSAGE CONFIG for server:', serverId);
      const response = await apiService.getWelcomeMessageConfig(serverId);
      console.log('🔵 Welcome config API response:', response);
      
      if (response.success && response.data) {
        // Transform the API response to match the component's state structure
        const configData = {
          title: response.data.title,
          description: response.data.description,
          color: response.data.color,
          fields: response.data.fields?.map(field => ({
            name: field.name,
            value: field.value
          })) || [
            { name: '🔹 Server Rules', value: 'Please read our rules to get started.' },
            { name: '🔹 Get Roles', value: 'Visit our roles channel to get your roles.' }
          ]
        };
        setCustomWelcomeMessage(configData);
        console.log('ServerDetail: Successfully loaded welcome message config:', configData);
      } else {
        console.log('ServerDetail: Using default welcome message config');
        // Reset to default template values
        const defaultConfig = {
          title: '👋 Welcome to {server}!',
          description: 'Welcome {user}! We\'re excited to have you in our community. We hope you enjoy your stay!',
          color: '#43b581',
          fields: [
            { name: '🔹 Server Rules', value: 'Please read our rules to get started.' },
            { name: '🔹 Get Roles', value: 'Visit our roles channel to get your roles.' },
            { name: '🔹 Member Count', value: 'You are member #{memberCount}!' }
          ]
        };
        console.log('ServerDetail: Setting default welcome config:', defaultConfig);
        setCustomWelcomeMessage(defaultConfig);
      }
    } catch (error: any) {
      console.error('ServerDetail: Error loading welcome message config:', error);
      // Reset to default template values on error
      const defaultConfig = {
        title: '👋 Welcome to {server}!',
        description: 'Welcome {user}! We\'re excited to have you in our community. We hope you enjoy your stay!',
        color: '#43b581',
        fields: [
          { name: '🔹 Server Rules', value: 'Please read our rules to get started.' },
          { name: '🔹 Get Roles', value: 'Visit our roles channel to get your roles.' },
          { name: '🔹 Member Count', value: 'You are member #{memberCount}!' }
        ]
              };
        console.log('ServerDetail: Setting default welcome config on error:', defaultConfig);
        setCustomWelcomeMessage(defaultConfig);
    }
  }, [serverId]);

  // Function to load goodbye message configuration
  const loadGoodbyeMessageConfig = useCallback(async () => {
    if (!serverId || serverId === 'undefined') {
      console.log('ServerDetail: loadGoodbyeMessageConfig - No serverId available');
      return;
    }
    
    try {
      console.log('🔵 LOADING GOODBYE MESSAGE CONFIG for server:', serverId);
      const response = await apiService.getGoodbyeMessageConfig(serverId);
      
      if (response.success && response.data) {
        const configData = {
          title: response.data.title,
          description: response.data.description,
          color: response.data.color,
          fields: response.data.fields?.map(field => ({
            name: field.name,
            value: field.value
          })) || []
        };
        setCustomLeaveMessage(configData);
        console.log('ServerDetail: Successfully loaded goodbye message config:', configData);
      } else {
        console.log('ServerDetail: Using default goodbye message config');
        const defaultConfig = {
          title: '👋 Goodbye {username}!',
          description: '{user} has left {server}. We\'ll miss you!',
          color: '#f04747',
          fields: [
            { name: '📊 Member Count', value: 'We now have {memberCount} members.' },
            { name: '🕐 Joined On', value: 'They were with us since {joinedDate}.' }
          ]
        };
        setCustomLeaveMessage(defaultConfig);
      }
    } catch (error: any) {
      console.error('ServerDetail: Error loading goodbye message config:', error);
      const defaultConfig = {
        title: '👋 Goodbye {username}!',
        description: '{user} has left {server}. We\'ll miss you!',
        color: '#f04747',
        fields: [
          { name: '📊 Member Count', value: 'We now have {memberCount} members.' },
          { name: '🕐 Joined On', value: 'They were with us since {joinedDate}.' }
        ]
      };
      setCustomLeaveMessage(defaultConfig);
    }
  }, [serverId]);

  // Function to load invite join message configuration
  const loadInviteJoinMessageConfig = useCallback(async () => {
    if (!serverId || serverId === 'undefined') {
      return;
    }
    
    try {
      console.log('ServerDetail: Loading invite join message config for server:', serverId);
      const response = await apiService.getInviteJoinMessageConfig(serverId);
      
      if (response.success && response.data) {
        const configData = {
          title: response.data.title,
          description: response.data.description,
          color: response.data.color,
          fields: response.data.fields?.map(field => ({
            name: field.name,
            value: field.value
          })) || []
        };
        setCustomInviteJoinMessage(configData);
        console.log('ServerDetail: Successfully loaded invite join message config:', configData);
      } else {
        console.log('ServerDetail: Using default invite join message config');
        const defaultConfig = {
          title: '🎯 {username} joined via invite!',
          description: 'Welcome {user}! You were invited by {inviter}.',
          color: '#5865f2',
          fields: [
            { name: '📨 Invited By', value: '{inviter}' },
            { name: '🔗 Invite Code', value: '{inviteCode}' },
            { name: '📊 Invite Uses', value: '{inviteUses} total uses' }
          ]
        };
        setCustomInviteJoinMessage(defaultConfig);
      }
    } catch (error: any) {
      console.error('ServerDetail: Error loading invite join message config:', error);
      const defaultConfig = {
        title: '🎯 {username} joined via invite!',
        description: 'Welcome {user}! You were invited by {inviter}.',
        color: '#5865f2',
        fields: [
          { name: '📨 Invited By', value: '{inviter}' },
          { name: '🔗 Invite Code', value: '{inviteCode}' },
          { name: '📊 Invite Uses', value: '{inviteUses} total uses' }
        ]
      };
      setCustomInviteJoinMessage(defaultConfig);
    }
  }, [serverId]);

  // Function to load invite leave message configuration
  const loadInviteLeaveMessageConfig = useCallback(async () => {
    if (!serverId || serverId === 'undefined') {
      return;
    }
    
    try {
      console.log('ServerDetail: Loading invite leave message config for server:', serverId);
      const response = await apiService.getInviteLeaveMessageConfig(serverId);
      
      if (response.success && response.data) {
        const configData = {
          title: response.data.title,
          description: response.data.description,
          color: response.data.color,
          fields: response.data.fields?.map(field => ({
            name: field.name,
            value: field.value
          })) || []
        };
        setCustomInviteLeaveMessage(configData);
        console.log('ServerDetail: Successfully loaded invite leave message config:', configData);
      } else {
        console.log('ServerDetail: Using default invite leave message config');
        const defaultConfig = {
          title: '👋 {username} left the server',
          description: '{user} has left {server}. They originally joined via {inviter}\'s invite.',
          color: '#f04747',
          fields: [
            { name: '📨 Originally Invited By', value: '{inviter}' },
            { name: '🔗 Invite Code Used', value: '{inviteCode}' },
            { name: '📊 Member Count', value: 'We now have {memberCount} members' }
          ]
        };
        setCustomInviteLeaveMessage(defaultConfig);
      }
    } catch (error: any) {
      console.error('ServerDetail: Error loading invite leave message config:', error);
      const defaultConfig = {
        title: '👋 {username} left the server',
        description: '{user} has left {server}. They originally joined via {inviter}\'s invite.',
        color: '#f04747',
        fields: [
          { name: '📨 Originally Invited By', value: '{inviter}' },
          { name: '🔗 Invite Code Used', value: '{inviteCode}' },
          { name: '📊 Member Count', value: 'We now have {memberCount} members' }
        ]
      };
      setCustomInviteLeaveMessage(defaultConfig);
    }
  }, [serverId]);
  
  useEffect(() => {
    const fetchServerDetails = async () => {
      if (!serverId) {
        navigate('/servers');
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await apiService.getServerById(serverId);
        
        if (response.success && response.data) {
          setServer(response.data);
          // Only fetch channels once after server is loaded
          fetchServerChannels();
          fetchTicketCategories();
          fetchServerRoles();
          
          // Load custom message configurations
          console.log('🔄 Loading custom message configurations...');
          loadWelcomeMessageConfig();
          loadGoodbyeMessageConfig();
          loadInviteJoinMessageConfig();
          loadInviteLeaveMessageConfig();
        } else {
          setError(response.error || 'Failed to fetch server details');
          toast.error('Failed to fetch server details');
        }
      } catch (error) {
        console.error('Error fetching server details:', error);
        setError('An error occurred while fetching server details');
        toast.error('Failed to fetch server details');
      } finally {
        setLoading(false);
      }
    };

    fetchServerDetails();
  }, [serverId, navigate, fetchServerChannels, fetchTicketCategories, fetchServerRoles, loadWelcomeMessageConfig, loadGoodbyeMessageConfig, loadInviteJoinMessageConfig, loadInviteLeaveMessageConfig]);
  
  // We don't need this separate useEffect as we're already calling fetchServerChannels in the main useEffect

  // Prevent body scrolling when modals are open
  useEffect(() => {
    if (showWelcomeMessageModal || showLeaveMessageModal || showInviteJoinMessageModal || showInviteLeaveMessageModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showWelcomeMessageModal, showLeaveMessageModal, showInviteJoinMessageModal, showInviteLeaveMessageModal]);

  if (loading) {
    return (
      <div className={classNames(
        "min-h-screen p-6",
        darkMode ? "bg-gray-900" : "bg-gray-50"
      )}>
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <LoadingSpinner size="lg" className="text-blue-500" />
            <p className={classNames(
              "mt-4 text-lg",
              darkMode ? "text-gray-300" : "text-gray-600"
            )}>Loading server details...</p>
          </div>
        </div>
      </div>
    );
  }

  // Check if user has permission to manage server settings
  if (!canManageSettings && !isAdmin) {
    return (
      <div className={classNames(
        "min-h-screen p-6",
        darkMode ? "bg-gray-900" : "bg-gray-50"
      )}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/servers')}
              className={classNames(
                "inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-105",
                darkMode 
                  ? "bg-gray-800 text-gray-300 hover:bg-gray-700 ring-1 ring-gray-600" 
                  : "bg-white text-gray-700 hover:bg-gray-50 ring-1 ring-gray-300"
              )}
            >
              ← Back
            </button>
            <div>
              <h1 className={classNames(
                "text-3xl font-bold",
                darkMode ? "text-white" : "text-gray-900"
              )}>{server?.name || 'Server Settings'}</h1>
              <p className={classNames(
                "text-lg",
                darkMode ? "text-gray-300" : "text-gray-600"
              )}>Access Denied</p>
            </div>
          </div>
        </div>
        
        <Card className={classNames(
          "shadow-xl border-0 rounded-xl",
          darkMode ? "bg-gray-800 ring-1 ring-gray-700" : "bg-white ring-1 ring-gray-200"
        )}>
          <div className="text-center py-16">
            <div className={classNames(
              "mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6",
              darkMode ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-600"
            )}>
              <ShieldExclamationIcon className="w-8 h-8" />
            </div>
            <h3 className={classNames(
              "text-2xl font-bold mb-4",
              darkMode ? "text-red-400" : "text-red-600"
            )}>🚫 Access Denied</h3>
            <p className={classNames(
              "text-lg mb-4 max-w-2xl mx-auto",
              darkMode ? "text-gray-300" : "text-gray-600"
            )}>
              You don't have permission to manage server settings.
            </p>
            <p className={classNames(
              "text-base mb-8 max-w-2xl mx-auto",
              darkMode ? "text-gray-400" : "text-gray-500"
            )}>
              Only users with <span className="font-semibold text-blue-500">manage_settings</span> or <span className="font-semibold text-red-500">admin</span> permissions can access this page.
              <br />
              Contact a server administrator to request access via the <span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm">/dashboard-perms</span> command.
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => navigate('/servers')}
                className={classNames(
                  "inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm transition-all duration-200 transform hover:scale-105",
                  "text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                  darkMode ? "focus:ring-offset-gray-800" : "focus:ring-offset-white"
                )}
              >
                ← Back to Servers
              </button>
              <button
                onClick={() => navigate('/profile')}
                className={classNames(
                  "inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm transition-all duration-200 transform hover:scale-105",
                  darkMode 
                    ? "text-gray-300 bg-gray-700 hover:bg-gray-600" 
                    : "text-gray-700 bg-gray-200 hover:bg-gray-300"
                )}
              >
                👤 View Profile
              </button>
            </div>
            <div className={classNames(
              "mt-8 pt-6 border-t",
              darkMode ? "border-gray-700" : "border-gray-200"
            )}>
              <p className={classNames(
                "text-sm",
                darkMode ? "text-gray-400" : "text-gray-500"
              )}>
                Current permissions: {user?.permissions?.length && user.permissions.length > 0 ? user.permissions.join(', ') : 'None'}
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={classNames(
        "min-h-screen p-6 space-y-6",
        darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/servers')}
              className={classNames(
                "inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-105",
                darkMode 
                  ? "bg-gray-800 text-gray-300 hover:bg-gray-700 ring-1 ring-gray-600" 
                  : "bg-white text-gray-700 hover:bg-gray-50 ring-1 ring-gray-300"
              )}
            >
              ← Back
            </button>
            <div>
              <h1 className={classNames(
                "text-3xl font-bold",
                darkMode ? "text-white" : "text-gray-900"
              )}>{server?.name || 'Server'}</h1>
              <p className={classNames(
                "text-lg",
                darkMode ? "text-gray-300" : "text-gray-600"
              )}>Server Configuration & Management</p>
            </div>
          </div>
        </div>
        
        <Card className={classNames(
          "shadow-xl border-0 rounded-xl",
          darkMode ? "bg-gray-800 ring-1 ring-gray-700" : "bg-white ring-1 ring-gray-200"
        )}>
          <div className="text-center py-16">
            <div className={classNames(
              "text-6xl mb-4",
              darkMode ? "text-gray-600" : "text-gray-400"
            )}>⚠️</div>
            <h3 className={classNames(
              "text-xl font-bold mb-4",
              darkMode ? "text-red-400" : "text-red-600"
            )}>Error: {error}</h3>
            <p className={classNames(
              "text-base mb-6 max-w-md mx-auto",
              darkMode ? "text-gray-400" : "text-gray-500"
            )}>
              There was a problem loading the server details. This could be due to network issues or the server may not exist.
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => window.location.reload()}
                className={classNames(
                  "inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm transition-all duration-200 transform hover:scale-105",
                  "text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                  darkMode ? "focus:ring-offset-gray-800" : "focus:ring-offset-white"
                )}
              >
                🔄 Retry
              </button>
              <button
                onClick={() => navigate('/servers')}
                className={classNames(
                  "inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm transition-all duration-200 transform hover:scale-105",
                  darkMode 
                    ? "text-gray-300 bg-gray-700 hover:bg-gray-600" 
                    : "text-gray-700 bg-gray-200 hover:bg-gray-300"
                )}
              >
                ← Back to Servers
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!server) {
    return (
      <div className={classNames(
        "min-h-screen p-6",
        darkMode ? "bg-gray-900" : "bg-gray-50"
      )}>
        <div className="text-center py-16">
          <div className={classNames(
            "text-6xl mb-4",
            darkMode ? "text-gray-600" : "text-gray-400"
          )}>🔍</div>
          <h2 className={classNames(
            "text-2xl font-bold mb-2",
            darkMode ? "text-white" : "text-gray-900"
          )}>Server not found</h2>
          <p className={classNames(
            "text-lg mb-6",
            darkMode ? "text-gray-400" : "text-gray-600"
          )}>The server you're looking for doesn't exist or you don't have access to it.</p>
          <button
            onClick={() => navigate('/servers')}
            className={classNames(
              "inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm transition-all duration-200 transform hover:scale-105",
              "text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              darkMode ? "focus:ring-offset-gray-900" : "focus:ring-offset-white"
            )}
          >
            ← Back to Servers
          </button>
        </div>
      </div>
    );
  }

  // Test invite message handlers
  const handleTestInviteJoinMessage = async () => {
    if (!user || !serverId) {
      toast.error('User data or server ID not available');
      return;
    }

    try {
      const testMessage = {
        title: customInviteJoinMessage.title || 'Welcome to the Server! 🎉',
        description: customInviteJoinMessage.description || 'A new member has joined via invite tracking!',
        color: customInviteJoinMessage.color || '#43B581',
        fields: customInviteJoinMessage.fields?.length ? customInviteJoinMessage.fields : [
          { name: '🔹 Invitation Info', value: 'Invited by: {inviter}' },
          { name: '🔹 Server Stats', value: 'Total Members: {totalMembers}' },
          { name: '🔹 Account Info', value: 'Account Age: {accountAge}' }
        ]
      };

      // Replace placeholders with real test data
      const processedMessage = {
        ...testMessage,
        title: testMessage.title
          .replace('{username}', user.username)
          .replace('{user}', `<@${user.id}>`)
          .replace('{userId}', user.id)
          .replace('{inviter}', `${user.username} (TEST)`)
          .replace('{totalMembers}', '100')
          .replace('{accountAge}', '365 days'),
        description: testMessage.description
          .replace('{username}', user.username)
          .replace('{user}', `<@${user.id}>`)
          .replace('{userId}', user.id)
          .replace('{inviter}', `${user.username} (TEST)`)
          .replace('{totalMembers}', '100')
          .replace('{accountAge}', '365 days'),
        fields: testMessage.fields.map(field => ({
          ...field,
          name: field.name
            .replace('{username}', user.username)
            .replace('{user}', `<@${user.id}>`)
            .replace('{userId}', user.id)
            .replace('{inviter}', `${user.username} (TEST)`)
            .replace('{totalMembers}', '100')
            .replace('{accountAge}', '365 days'),
          value: field.value
            .replace('{username}', user.username)
            .replace('{user}', `<@${user.id}>`)
            .replace('{userId}', user.id)
            .replace('{inviter}', `${user.username} (TEST)`)
            .replace('{totalMembers}', '100')
            .replace('{accountAge}', '365 days')
        }))
      };

      const response = await apiService.testInviteJoinMessage(serverId, processedMessage);
      
      if (response.success) {
        toast.success('Test invite join message sent successfully! 🎉');
      } else {
        toast.error('Failed to send test message: ' + (response.error || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Error sending test invite join message:', error);
      toast.error('Failed to send test message: ' + error.message);
    }
  };

  const handleTestInviteLeaveMessage = async () => {
    if (!user || !serverId) {
      toast.error('User data or server ID not available');
      return;
    }

    try {
      const testMessage = {
        title: customInviteLeaveMessage.title || 'Member Left the Server 👋',
        description: customInviteLeaveMessage.description || 'A member has left the server.',
        color: customInviteLeaveMessage.color || '#FF6347',
        fields: customInviteLeaveMessage.fields?.length ? customInviteLeaveMessage.fields : [
          { name: '🔹 Time in Server', value: 'Was here for: {timeInServer}' },
          { name: '🔹 Originally Invited By', value: 'Invited by: {inviter}' },
          { name: '🔹 Invite Stats', value: 'Fake Invites: {isFakeInvite}' }
        ]
      };

      // Replace placeholders with real test data
      const processedMessage = {
        ...testMessage,
        title: testMessage.title
          .replace('{username}', user.username)
          .replace('{user}', `<@${user.id}>`)
          .replace('{userId}', user.id)
          .replace('{inviter}', `${user.username} (TEST)`)
          .replace('{timeInServer}', '2 days, 4 hours')
          .replace('{isFakeInvite}', 'No'),
        description: testMessage.description
          .replace('{username}', user.username)
          .replace('{user}', `<@${user.id}>`)
          .replace('{userId}', user.id)
          .replace('{inviter}', `${user.username} (TEST)`)
          .replace('{timeInServer}', '2 days, 4 hours')
          .replace('{isFakeInvite}', 'No'),
        fields: testMessage.fields.map(field => ({
          ...field,
          name: field.name
            .replace('{username}', user.username)
            .replace('{user}', `<@${user.id}>`)
            .replace('{userId}', user.id)
            .replace('{inviter}', `${user.username} (TEST)`)
            .replace('{timeInServer}', '2 days, 4 hours')
            .replace('{isFakeInvite}', 'No'),
          value: field.value
            .replace('{username}', user.username)
            .replace('{user}', `<@${user.id}>`)
            .replace('{userId}', user.id)
            .replace('{inviter}', `${user.username} (TEST)`)
            .replace('{timeInServer}', '2 days, 4 hours')
            .replace('{isFakeInvite}', 'No')
        }))
      };

      const response = await apiService.testInviteLeaveMessage(serverId, processedMessage);
      
      if (response.success) {
        toast.success('Test invite leave message sent successfully! 👋');
      } else {
        toast.error('Failed to send test message: ' + (response.error || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Error sending test invite leave message:', error);
      toast.error('Failed to send test message: ' + error.message);
    }
  };

  // Helper function to replace placeholders with actual user data
  const replacePlaceholders = (text: string): string => {
    if (!text || !user) return text;
    
    const serverName = server?.name || 'Example Server';
    const memberCount = server?.memberCount || 150;
    const joinedDate = new Date().toLocaleDateString();
    
    return text
      .replace(/{user}/g, user.username)
      .replace(/{username}/g, user.username)
      .replace(/{mention}/g, `@${user.username}`)
      .replace(/{server}/g, serverName)
      .replace(/{memberCount}/g, memberCount.toString())
      .replace(/{accountAge}/g, '365 days')
      .replace(/{timeInServer}/g, '2 days, 5 hours')
      .replace(/{joinDate}/g, joinedDate)
      .replace(/{isFakeInvite}/g, 'No')
      .replace(/{inviter}/g, 'Staff Member')
      .replace(/{inviteCode}/g, 'discord.gg/example')
      .replace(/{inviteUses}/g, '5');
  };

  return (
    <div className={classNames(
      "min-h-screen p-6 space-y-6",
      darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/servers')}
            className={classNames(
              "inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-105",
              darkMode 
                ? "bg-gray-800 text-gray-300 hover:bg-gray-700 ring-1 ring-gray-600" 
                : "bg-white text-gray-700 hover:bg-gray-50 ring-1 ring-gray-300"
            )}
          >
            ← Back
          </button>
          <div>
            <h1 className={classNames(
              "text-3xl font-bold",
              darkMode ? "text-white" : "text-gray-900"
            )}>{server?.name}</h1>
            <p className={classNames(
              "text-lg",
              darkMode ? "text-gray-300" : "text-gray-600"
            )}>Server Configuration & Management</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Server Info Card */}
        <Card className={classNames(
          "shadow-xl border-0 rounded-xl overflow-hidden",
          darkMode ? "bg-gray-800 ring-1 ring-gray-700" : "bg-white ring-1 ring-gray-200"
        )}>
          <div className={classNames(
            "p-6 border-b",
            darkMode ? "border-gray-700" : "border-gray-200"
          )}>
            <h3 className={classNames(
              "text-xl font-semibold mb-4",
              darkMode ? "text-white" : "text-gray-900"
            )}>🖥️ Server Information</h3>
            <div className="flex items-center space-x-4 mb-6">
              {server?.icon ? (
                <img 
                  src={`https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png`} 
                  alt={server.name} 
                  className="w-16 h-16 rounded-full shadow-lg ring-2 ring-blue-500/20"
                />
              ) : (
                <div className={classNames(
                  "w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shadow-lg",
                  darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"
                )}>
                  {server?.name?.substring(0, 1).toUpperCase() || 'S'}
                </div>
              )}
              <div>
                <h4 className={classNames(
                  "font-semibold text-lg",
                  darkMode ? "text-white" : "text-gray-900"
                )}>{server?.name}</h4>
                <p className={classNames(
                  "text-sm",
                  darkMode ? "text-gray-400" : "text-gray-500"
                )}>ID: {server?.id}</p>
                {server?.memberCount && server.memberCount > 0 && (
                  <p className={classNames(
                    "text-sm font-medium",
                    darkMode ? "text-blue-400" : "text-blue-600"
                  )}>👥 {server.memberCount} members</p>
                )}
              </div>
            </div>
          </div>
          <div className={classNames(
            "p-6",
            darkMode ? "bg-gray-800" : "bg-gray-50"
          )}>
            <h4 className={classNames(
              "font-semibold mb-4",
              darkMode ? "text-white" : "text-gray-900"
            )}>⚡ Quick Actions</h4>
            <div className="grid grid-cols-1 gap-3">
              <button 
                className={classNames(
                  "w-full px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                  "text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg",
                  darkMode ? "focus:ring-offset-gray-800" : "focus:ring-offset-white"
                )}
                onClick={() => navigate(`/tickets?serverId=${server?.id}`)}
              >
                🎫 View Tickets
              </button>
              <button 
                className={classNames(
                  "w-full px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2",
                  "text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg",
                  darkMode ? "focus:ring-offset-gray-800" : "focus:ring-offset-white"
                )}
                onClick={() => navigate(`/warnings?serverId=${server?.id}`)}
              >
                ⚠️ View Warnings
              </button>
              <button 
                className={classNames(
                  "w-full px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2",
                  "text-white bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 shadow-lg",
                  darkMode ? "focus:ring-offset-gray-800" : "focus:ring-offset-white"
                )}
                onClick={() => navigate(`/servers/${server?.id}/members`)}
              >
                👥 Manage Members
              </button>
              <button 
                className={classNames(
                  "w-full px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2",
                  "text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg",
                  darkMode ? "focus:ring-offset-gray-800" : "focus:ring-offset-white"
                )}
                onClick={() => navigate(`/servers/${server?.id}/logs`)}
              >
                📊 Activity Logs
              </button>

            </div>
          </div>
        </Card>

        {/* Server Settings Card */}
        <Card className={classNames(
          "lg:col-span-2 shadow-xl border-0 rounded-xl overflow-hidden",
          darkMode ? "bg-gray-800 ring-1 ring-gray-700" : "bg-white ring-1 ring-gray-200"
        )}>
          <div className={classNames(
            "p-6 border-b flex justify-between items-center",
            darkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"
          )}>
            <h3 className={classNames(
              "text-xl font-semibold",
              darkMode ? "text-white" : "text-gray-900"
            )}>⚙️ Server Settings</h3>
            <div className="flex items-center space-x-3">
              {successMessage && (
                <div className={classNames(
                  "px-3 py-1 rounded-lg text-sm font-medium",
                  darkMode ? "bg-green-900/30 text-green-300" : "bg-green-100 text-green-800"
                )}>
                  ✅ {successMessage}
                </div>
              )}
              {saving && (
                <div className={classNames(
                  "text-sm flex items-center",
                  darkMode ? "text-blue-400" : "text-blue-600"
                )}>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </div>
              )}
            </div>
          </div>
          
          <div className={classNames(
            "p-6 space-y-8",
            darkMode ? "bg-gray-900" : "bg-white"
          )}>
            <div>
              <h4 className={classNames(
                "text-lg font-semibold mb-6 flex items-center",
                darkMode ? "text-white" : "text-gray-900"
              )}>
                📋 System Channels
              </h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Mod Logs */}
                <div className={classNames(
                  "rounded-xl p-5 ring-1 transition-all duration-200 hover:shadow-lg",
                  darkMode ? "bg-gray-800 ring-gray-600" : "bg-gray-50 ring-gray-200"
                )}>
                  <div className="flex items-center mb-3">
                    <div className={classNames(
                      "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
                      darkMode ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-600"
                    )}>
                      🛡️
                    </div>
                    <h5 className={classNames(
                      "font-semibold",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>Mod Logs</h5>
                  </div>
                  {loadingChannels ? (
                    <div className="flex items-center">
                      <LoadingSpinner size="sm" className="mr-2" />
                      <p className={classNames(
                        "text-sm",
                        darkMode ? "text-gray-400" : "text-gray-500"
                      )}>Loading channels...</p>
                    </div>
                  ) : (
                    <div>
                      <select 
                        className={classNames(
                          "w-full p-3 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200",
                          darkMode 
                            ? "bg-gray-700 text-gray-100 border-gray-600 hover:border-gray-500" 
                            : "bg-white text-gray-900 border-gray-300 hover:border-gray-400"
                        )}
                        value={server?.settings?.mod_log_channel_id || 'none'}
                        onChange={(e) => handleChannelChange('mod_log_channel_id', e.target.value)}
                        disabled={saving}
                      >
                        <option value="none">-- Select Channel --</option>
                        {(getSafeChannels() || []).map(channel => (
                          <option key={channel.id} value={channel.id}>
                            #{channel.name}
                          </option>
                        ))}
                      </select>
                      <p className={classNames(
                        "text-xs mt-2",
                        darkMode ? "text-gray-400" : "text-gray-500"
                      )}>
                        {server?.settings?.mod_log_channel_id ? 
                          `✅ Current: ${(getSafeChannels() || []).find(c => c.id === server.settings?.mod_log_channel_id)?.name || 'Unknown Channel'}` : 
                          '❌ Not configured'}
                      </p>
                    </div>
                  )}
                </div>

                {/* General Log Channel */}
                <div className={classNames(
                  "rounded-xl p-5 ring-1 transition-all duration-200 hover:shadow-lg",
                  darkMode ? "bg-gray-800 ring-gray-600" : "bg-gray-50 ring-gray-200"
                )}>
                  <div className="flex items-center mb-3">
                    <div className={classNames(
                      "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
                      darkMode ? "bg-gray-900/30 text-gray-400" : "bg-gray-100 text-gray-600"
                    )}>
                      📝
                    </div>
                    <h5 className={classNames(
                      "font-semibold",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>General Logs</h5>
                  </div>
                  {loadingChannels ? (
                    <div className="flex items-center">
                      <LoadingSpinner size="sm" className="mr-2" />
                      <p className={classNames(
                        "text-sm",
                        darkMode ? "text-gray-400" : "text-gray-500"
                      )}>Loading channels...</p>
                    </div>
                  ) : (
                    <div>
                      <select 
                        className={classNames(
                          "w-full p-3 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200",
                          darkMode 
                            ? "bg-gray-700 text-gray-100 border-gray-600 hover:border-gray-500" 
                            : "bg-white text-gray-900 border-gray-300 hover:border-gray-400"
                        )}
                        value={server?.settings?.log_channel_id || 'none'}
                        onChange={(e) => handleChannelChange('log_channel_id', e.target.value)}
                        disabled={saving}
                      >
                        <option value="none">-- Select Channel --</option>
                        {(getSafeChannels() || []).map(channel => (
                          <option key={channel.id} value={channel.id}>
                            #{channel.name}
                          </option>
                        ))}
                      </select>
                      <p className={classNames(
                        "text-xs mt-2",
                        darkMode ? "text-gray-400" : "text-gray-500"
                      )}>
                        {server?.settings?.log_channel_id ? 
                          `✅ Current: ${(getSafeChannels() || []).find(c => c.id === server.settings?.log_channel_id)?.name || 'Unknown Channel'}` : 
                          '❌ Not configured'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h4 className={classNames(
                "text-lg font-semibold mb-6 flex items-center",
                darkMode ? "text-white" : "text-gray-900"
              )}>
                🎫 Ticket System
              </h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Ticket Panel Channel */}
                <div className={classNames(
                  "rounded-xl p-5 ring-1 transition-all duration-200 hover:shadow-lg",
                  darkMode ? "bg-gray-800 ring-gray-600" : "bg-gray-50 ring-gray-200"
                )}>
                  <div className="flex items-center mb-3">
                    <div className={classNames(
                      "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
                      darkMode ? "bg-purple-900/30 text-purple-400" : "bg-purple-100 text-purple-600"
                    )}>
                      🎫
                    </div>
                    <h5 className={classNames(
                      "font-semibold",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>Ticket Panel Channel</h5>
                  </div>
                  {loadingChannels ? (
                    <div className="flex items-center">
                      <LoadingSpinner size="sm" className="mr-2" />
                      <p className={classNames(
                        "text-sm",
                        darkMode ? "text-gray-400" : "text-gray-500"
                      )}>Loading channels...</p>
                    </div>
                  ) : (
                    <div>
                      <select 
                        className={classNames(
                          "w-full p-3 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200",
                          darkMode 
                            ? "bg-gray-700 text-gray-100 border-gray-600 hover:border-gray-500" 
                            : "bg-white text-gray-900 border-gray-300 hover:border-gray-400"
                        )}
                        value={server?.settings?.ticket_panel_channel_id || 'none'}
                        onChange={(e) => handleChannelChange('ticket_panel_channel_id', e.target.value)}
                        disabled={saving}
                      >
                        <option value="none">-- Select Channel --</option>
                        {(getSafeChannels() || []).map(channel => (
                          <option key={channel.id} value={channel.id}>
                            #{channel.name}
                          </option>
                        ))}
                      </select>
                      <p className={classNames(
                        "text-xs mt-2",
                        darkMode ? "text-gray-400" : "text-gray-500"
                      )}>
                        {server?.settings?.ticket_panel_channel_id ? 
                          `✅ Current: ${(getSafeChannels() || []).find(c => c.id === server.settings?.ticket_panel_channel_id)?.name || 'Unknown Channel'}` : 
                          '❌ Not configured'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Ticket Logs Channel */}
                <div className={classNames(
                  "rounded-xl p-5 ring-1 transition-all duration-200 hover:shadow-lg",
                  darkMode ? "bg-gray-800 ring-gray-600" : "bg-gray-50 ring-gray-200"
                )}>
                  <div className="flex items-center mb-3">
                    <div className={classNames(
                      "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
                      darkMode ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-600"
                    )}>
                      📄
                    </div>
                    <h5 className={classNames(
                      "font-semibold",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>Ticket Logs Channel</h5>
                  </div>
                  {loadingChannels ? (
                    <div className="flex items-center">
                      <LoadingSpinner size="sm" className="mr-2" />
                      <p className={classNames(
                        "text-sm",
                        darkMode ? "text-gray-400" : "text-gray-500"
                      )}>Loading channels...</p>
                    </div>
                  ) : (
                    <div>
                      <select 
                        className={classNames(
                          "w-full p-3 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200",
                          darkMode 
                            ? "bg-gray-700 text-gray-100 border-gray-600 hover:border-gray-500" 
                            : "bg-white text-gray-900 border-gray-300 hover:border-gray-400"
                        )}
                        value={server?.settings?.ticket_logs_channel_id || 'none'}
                        onChange={(e) => handleChannelChange('ticket_logs_channel_id', e.target.value)}
                        disabled={saving}
                      >
                        <option value="none">-- Select Channel --</option>
                        {(getSafeChannels() || []).map(channel => (
                          <option key={channel.id} value={channel.id}>
                            #{channel.name}
                          </option>
                        ))}
                      </select>
                      <p className={classNames(
                        "text-xs mt-2",
                        darkMode ? "text-gray-400" : "text-gray-500"
                      )}>
                        {server?.settings?.ticket_logs_channel_id ? 
                          `✅ Current: ${(getSafeChannels() || []).find(c => c.id === server.settings?.ticket_logs_channel_id)?.name || 'Unknown Channel'}` : 
                          '❌ Not configured'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Ticket Category */}
                <div className={classNames(
                  "rounded-xl p-5 ring-1 transition-all duration-200 hover:shadow-lg",
                  darkMode ? "bg-gray-800 ring-gray-600" : "bg-gray-50 ring-gray-200"
                )}>
                  <div className="flex items-center mb-3">
                    <div className={classNames(
                      "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
                      darkMode ? "bg-yellow-900/30 text-yellow-400" : "bg-yellow-100 text-yellow-600"
                    )}>
                      📂
                    </div>
                    <h5 className={classNames(
                      "font-semibold",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>Ticket Category</h5>
                  </div>
                  {loadingCategories ? (
                    <div className="flex items-center">
                      <LoadingSpinner size="sm" className="mr-2" />
                      <p className={classNames(
                        "text-sm",
                        darkMode ? "text-gray-400" : "text-gray-500"
                      )}>Loading categories...</p>
                    </div>
                  ) : (
                    <div>
                      <select 
                        className={classNames(
                          "w-full p-3 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200",
                          darkMode 
                            ? "bg-gray-700 text-gray-100 border-gray-600 hover:border-gray-500" 
                            : "bg-white text-gray-900 border-gray-300 hover:border-gray-400"
                        )}
                        value={server?.settings?.ticket_category_id || 'none'}
                        onChange={(e) => handleTicketCategoryChange(e.target.value)}
                        disabled={saving}
                      >
                        <option value="none">-- Select Category --</option>
                        {(ticketCategories || []).map(category => (
                          <option key={category.id} value={category.id}>
                            {category.emoji} {category.label}
                          </option>
                        ))}
                      </select>
                      <p className={classNames(
                        "text-xs mt-2",
                        darkMode ? "text-gray-400" : "text-gray-500"
                      )}>
                        {server?.settings?.ticket_category_id ? 
                          `✅ Current: ${(ticketCategories || []).find(c => c.id === server.settings?.ticket_category_id)?.emoji} ${(ticketCategories || []).find(c => c.id === server.settings?.ticket_category_id)?.label || 'Unknown Category'}` : 
                          '❌ Not configured'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Create Ticket Panel Message */}
                <div className={classNames(
                  "rounded-xl p-5 ring-1 transition-all duration-200 hover:shadow-lg",
                  darkMode ? "bg-gray-800 ring-gray-600" : "bg-gray-50 ring-gray-200"
                )}>
                  <div className="flex items-center mb-3">
                    <div className={classNames(
                      "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
                      darkMode ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-600"
                    )}>
                      📬
                    </div>
                    <h5 className={classNames(
                      "font-semibold",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>Create Ticket Panel</h5>
                  </div>
                  <div className="space-y-3">
                    <p className={classNames(
                      "text-sm",
                      darkMode ? "text-gray-400" : "text-gray-500"
                    )}>
                      Create a ticket panel message in your selected channel.
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={async () => {
                          if (!server?.settings?.ticket_panel_channel_id) {
                            toast.error('Please select a ticket panel channel first');
                            return;
                          }
                          try {
                            setSaving(true);
                            const response = await apiService.createTicketPanelMessage(
                              serverId!,
                              server.settings.ticket_panel_channel_id
                            );
                            if (response.success) {
                              toast.success('Default ticket panel message created successfully!');
                            } else {
                              toast.error(response.error || 'Failed to create ticket panel message');
                            }
                          } catch (error) {
                            toast.error('Failed to create ticket panel message');
                          } finally {
                            setSaving(false);
                          }
                        }}
                        disabled={saving || !server?.settings?.ticket_panel_channel_id}
                        className={classNames(
                          "w-full px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm",
                          server?.settings?.ticket_panel_channel_id && !saving
                            ? darkMode
                              ? "bg-blue-600 hover:bg-blue-700 text-white"
                              : "bg-blue-500 hover:bg-blue-600 text-white"
                            : darkMode
                              ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                              : "bg-gray-300 text-gray-400 cursor-not-allowed"
                        )}
                      >
                        {saving ? 'Creating...' : 'Create Default Panel'}
                      </button>
                      
                      <button
                        onClick={() => {
                          if (!server?.settings?.ticket_panel_channel_id) {
                            toast.error('Please select a ticket panel channel first');
                            return;
                          }
                          // Open custom message modal
                          setShowTicketModal(true);
                        }}
                        disabled={!server?.settings?.ticket_panel_channel_id}
                        className={classNames(
                          "w-full px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm border-2",
                          server?.settings?.ticket_panel_channel_id
                            ? darkMode
                              ? "border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white"
                              : "border-blue-500 text-blue-600 hover:bg-blue-500 hover:text-white"
                            : darkMode
                              ? "border-gray-700 text-gray-500 cursor-not-allowed"
                              : "border-gray-300 text-gray-400 cursor-not-allowed"
                        )}
                      >
                        🎨 Customize Panel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className={classNames(
                "text-lg font-semibold mb-6 flex items-center",
                darkMode ? "text-white" : "text-gray-900"
              )}>
                👮 Staff Configuration
              </h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={classNames(
                  "rounded-xl p-5 ring-1 transition-all duration-200 hover:shadow-lg",
                  darkMode ? "bg-gray-800 ring-gray-600" : "bg-gray-50 ring-gray-200"
                )}>
                  <div className="flex items-center mb-3">
                    <div className={classNames(
                      "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
                      darkMode ? "bg-indigo-900/30 text-indigo-400" : "bg-indigo-100 text-indigo-600"
                    )}>
                      👮
                    </div>
                    <h5 className={classNames(
                      "font-semibold",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>Staff Roles</h5>
                  </div>
                  <p className={classNames(
                    "text-sm",
                    darkMode ? "text-gray-400" : "text-gray-500"
                  )}>
                    {server?.settings?.staff_role_ids ? 
                      `✅ Role IDs: ${server.settings?.staff_role_ids}` : 
                      '❌ Not configured'}
                  </p>
                </div>

                {/* Additional staff config can go here */}
              </div>
            </div>

            <div>
              <h4 className={classNames(
                "text-lg font-semibold mb-6 flex items-center",
                darkMode ? "text-white" : "text-gray-900"
              )}>
                🔒 Verification System
              </h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Verification Channel */}
                <div className={classNames(
                  "rounded-xl p-5 ring-1 transition-all duration-200 hover:shadow-lg",
                  darkMode ? "bg-gray-800 ring-gray-600" : "bg-gray-50 ring-gray-200"
                )}>
                  <div className="flex items-center mb-3">
                    <div className={classNames(
                      "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
                      darkMode ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-600"
                    )}>
                      📝
                    </div>
                    <h5 className={classNames(
                      "font-semibold",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>Verification Channel</h5>
                  </div>
                  {loadingChannels ? (
                    <div className="flex items-center">
                      <LoadingSpinner size="sm" className="mr-2" />
                      <p className={classNames(
                        "text-sm",
                        darkMode ? "text-gray-400" : "text-gray-500"
                      )}>Loading channels...</p>
                    </div>
                  ) : (
                    <div>
                      <select 
                        className={classNames(
                          "w-full p-3 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200",
                          darkMode 
                            ? "bg-gray-700 text-gray-100 border-gray-600 hover:border-gray-500" 
                            : "bg-white text-gray-900 border-gray-300 hover:border-gray-400"
                        )}
                        value={server?.settings?.verification_channel_id || 'none'}
                        onChange={(e) => handleChannelChange('verification_channel_id', e.target.value)}
                        disabled={saving}
                      >
                        <option value="none">-- Select Channel --</option>
                        {(getSafeChannels() || []).map(channel => (
                          <option key={channel.id} value={channel.id}>
                            #{channel.name}
                          </option>
                        ))}
                      </select>
                      <p className={classNames(
                        "text-xs mt-2",
                        darkMode ? "text-gray-400" : "text-gray-500"
                      )}>
                        {server?.settings?.verification_channel_id ? 
                          `✅ Current: ${(getSafeChannels() || []).find(c => c.id === server.settings?.verification_channel_id)?.name || 'Unknown Channel'}` : 
                          '❌ Not configured'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Verified Role */}
                <div className={classNames(
                  "rounded-xl p-5 ring-1 transition-all duration-200 hover:shadow-lg",
                  darkMode ? "bg-gray-800 ring-gray-600" : "bg-gray-50 ring-gray-200"
                )}>
                  <div className="flex items-center mb-3">
                    <div className={classNames(
                      "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
                      darkMode ? "bg-purple-900/30 text-purple-400" : "bg-purple-100 text-purple-600"
                    )}>
                      🏷️
                    </div>
                    <h5 className={classNames(
                      "font-semibold",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>Verified Role</h5>
                  </div>
                  {loadingRoles ? (
                    <div className="flex items-center">
                      <LoadingSpinner size="sm" className="mr-2" />
                      <p className={classNames(
                        "text-sm",
                        darkMode ? "text-gray-400" : "text-gray-500"
                      )}>Loading roles...</p>
                    </div>
                  ) : (
                    <div>
                      <select 
                        className={classNames(
                          "w-full p-3 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200",
                          darkMode 
                            ? "bg-gray-700 text-gray-100 border-gray-600 hover:border-gray-500" 
                            : "bg-white text-gray-900 border-gray-300 hover:border-gray-400"
                        )}
                        value={server?.settings?.verified_role_id || 'none'}
                        onChange={(e) => handleChannelChange('verified_role_id', e.target.value)}
                        disabled={saving}
                      >
                        <option value="none">-- Select Role --</option>
                        {(roles || []).map(role => (
                          <option key={role.id} value={role.id}>
                            @{role.name}
                          </option>
                        ))}
                      </select>
                      <p className={classNames(
                        "text-xs mt-2",
                        darkMode ? "text-gray-400" : "text-gray-500"
                      )}>
                        {server?.settings?.verified_role_id ? 
                          `✅ Current: ${(roles || []).find(r => r.id === server.settings?.verified_role_id)?.name || 'Unknown Role'}` : 
                          '❌ Not configured'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Verification Type */}
                <div className={classNames(
                  "rounded-xl p-5 ring-1 transition-all duration-200 hover:shadow-lg",
                  darkMode ? "bg-gray-800 ring-gray-600" : "bg-gray-50 ring-gray-200"
                )}>
                  <div className="flex items-center mb-3">
                    <div className={classNames(
                      "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
                      darkMode ? "bg-yellow-900/30 text-yellow-400" : "bg-yellow-100 text-yellow-600"
                    )}>
                      ⚙️
                    </div>
                    <h5 className={classNames(
                      "font-semibold",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>Verification Type</h5>
                  </div>
                  <div>
                    <select 
                      className={classNames(
                        "w-full p-3 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200",
                        darkMode 
                          ? "bg-gray-700 text-gray-100 border-gray-600 hover:border-gray-500" 
                          : "bg-white text-gray-900 border-gray-300 hover:border-gray-400"
                      )}
                      value={server?.settings?.verification_type || 'button'}
                      onChange={(e) => handleChannelChange('verification_type', e.target.value)}
                      disabled={saving}
                    >
                      <option value="button">🔘 Simple Button</option>
                      <option value="captcha">🔤 CAPTCHA</option>
                      <option value="custom_question">❓ Custom Question</option>
                      <option value="age_verification">🔞 Age Verification</option>
                    </select>
                    <p className={classNames(
                      "text-xs mt-2",
                      darkMode ? "text-gray-400" : "text-gray-500"
                    )}>
                      Current: {server?.settings?.verification_type || 'button'}
                    </p>
                  </div>
                </div>

                {/* Create Verification Message */}
                <div className={classNames(
                  "rounded-xl p-5 ring-1 transition-all duration-200 hover:shadow-lg",
                  darkMode ? "bg-gray-800 ring-gray-600" : "bg-gray-50 ring-gray-200"
                )}>
                  <div className="flex items-center mb-3">
                    <div className={classNames(
                      "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
                      darkMode ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-600"
                    )}>
                      📬
                    </div>
                    <h5 className={classNames(
                      "font-semibold",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>Create Message</h5>
                  </div>
                  <div className="space-y-3">
                    <p className={classNames(
                      "text-sm",
                      darkMode ? "text-gray-400" : "text-gray-500"
                    )}>
                      Create a verification message in your selected channel.
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={async () => {
                          if (!server?.settings?.verification_channel_id) {
                            toast.error('Please select a verification channel first');
                            return;
                          }
                          try {
                            setSaving(true);
                            // Use the custom verification message API to support custom fields and button text
                            const response = await apiService.createCustomVerificationMessage(
                              serverId!,
                              server.settings.verification_channel_id,
                              {
                                title: customVerificationMessage.title,
                                description: customVerificationMessage.description,
                                color: customVerificationMessage.color,
                                buttonText: customVerificationMessage.buttonText,
                                fields: customVerificationMessage.fields
                              }
                            );
                            if (response.success) {
                              toast.success('Custom verification message created successfully!');
                              setShowVerificationModal(false);
                            } else {
                              toast.error(response.error || 'Failed to create verification message');
                            }
                          } catch (error) {
                            console.error('Error creating verification message:', error);
                            toast.error('Failed to create verification message');
                          } finally {
                            setSaving(false);
                          }
                        }}
                        disabled={saving || !server?.settings?.verification_channel_id}
                        className={classNames(
                          "w-full px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm",
                          server?.settings?.verification_channel_id && !saving
                            ? darkMode
                              ? "bg-blue-600 hover:bg-blue-700 text-white"
                              : "bg-blue-500 hover:bg-blue-600 text-white"
                            : darkMode
                              ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                              : "bg-gray-300 text-gray-400 cursor-not-allowed"
                        )}
                      >
                        {saving ? '⏳ Creating...' : '🔒 Create Message'}
                      </button>
                      
                      <button
                        onClick={() => {
                          if (!server?.settings?.verification_channel_id) {
                            toast.error('Please select a verification channel first');
                            return;
                          }
                          // Open custom verification message modal
                          setShowVerificationModal(true);
                        }}
                        disabled={!server?.settings?.verification_channel_id}
                        className={classNames(
                          "w-full px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm border-2",
                          server?.settings?.verification_channel_id
                            ? darkMode
                              ? "border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white"
                              : "border-blue-500 text-blue-600 hover:bg-blue-500 hover:text-white"
                            : darkMode
                              ? "border-gray-700 text-gray-500 cursor-not-allowed"
                              : "border-gray-300 text-gray-400 cursor-not-allowed"
                        )}
                      >
                        🎨 Customize Message
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Member Events Configuration */}
        <Card className={classNames(
          "lg:col-span-3 shadow-xl border-0 rounded-xl overflow-hidden",
          darkMode ? "bg-gray-800 ring-1 ring-gray-700" : "bg-white ring-1 ring-gray-200"
        )}>
          <div className={classNames(
            "p-6 border-b",
            darkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"
          )}>
            <div className="flex items-center space-x-3">
              <span className="text-4xl">👋</span>
              <div>
            <h3 className={classNames(
              "text-xl font-semibold",
              darkMode ? "text-white" : "text-gray-900"
                )}>
                  Member Events Configuration
                </h3>
                  <p className={classNames(
                  "text-sm mt-1",
                    darkMode ? "text-gray-300" : "text-gray-600"
                )}>
                  Customize welcome and leave messages for your server
                </p>
                </div>
              </div>
          </div>

              <div className={classNames(
            "p-6 space-y-8",
            darkMode ? "bg-gray-900" : "bg-white"
          )}>
            {/* Channel Configuration Section */}
            <div>
              <h4 className={classNames(
                "text-lg font-semibold mb-6 flex items-center",
                  darkMode ? "text-white" : "text-gray-900"
              )}>
                📋 Message Channels
              </h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Welcome Channel */}
              <div className={classNames(
                  "rounded-xl p-5 ring-1 transition-all duration-200 hover:shadow-lg",
                darkMode ? "bg-gray-800 ring-gray-600" : "bg-gray-50 ring-gray-200"
              )}>
                  <div className="flex items-center mb-3">
                  <div className={classNames(
                    "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
                    darkMode ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-600"
                  )}>
                      👋
                  </div>
                    <h5 className={classNames(
                      "font-semibold",
                  darkMode ? "text-white" : "text-gray-900"
                    )}>Welcome Channel</h5>
              </div>
                  {loadingChannels ? (
                    <div className="flex items-center">
                      <LoadingSpinner size="sm" className="mr-2" />
                      <p className={classNames(
                        "text-sm",
                        darkMode ? "text-gray-400" : "text-gray-500"
                      )}>Loading channels...</p>
                      </div>
                  ) : (
                      <div>
                      <select 
                          className={classNames(
                          "w-full p-3 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200",
                          darkMode 
                            ? "bg-gray-700 text-gray-100 border-gray-600 hover:border-gray-500" 
                            : "bg-white text-gray-900 border-gray-300 hover:border-gray-400"
                        )}
                        value={server?.settings?.welcome_channel_id || 'none'}
                        onChange={(e) => handleChannelChange('welcome_channel_id', e.target.value)}
                        disabled={saving}
                      >
                        <option value="none">-- Select Channel --</option>
                        {(getSafeChannels() || []).map(channel => (
                          <option key={channel.id} value={channel.id}>
                            #{channel.name}
                          </option>
                        ))}
                      </select>
                        <p className={classNames(
                        "text-xs mt-2",
                        darkMode ? "text-gray-400" : "text-gray-500"
                        )}>
                        {server?.settings?.welcome_channel_id ? 
                          `✅ Current: ${(getSafeChannels() || []).find(c => c.id === server.settings?.welcome_channel_id)?.name || 'Unknown Channel'}` : 
                          '❌ Not configured'}
                        </p>
                      </div>
                  )}
                  </div>

                {/* Leave Channel */}
                <div className={classNames(
                  "rounded-xl p-5 ring-1 transition-all duration-200 hover:shadow-lg",
                  darkMode ? "bg-gray-800 ring-gray-600" : "bg-gray-50 ring-gray-200"
                )}>
                  <div className="flex items-center mb-3">
                            <div className={classNames(
                      "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
                      darkMode ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-600"
                            )}>
                      👋
                            </div>
                    <h5 className={classNames(
                      "font-semibold",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>Leave Channel</h5>
                          </div>
                  {loadingChannels ? (
                    <div className="flex items-center">
                      <LoadingSpinner size="sm" className="mr-2" />
                      <p className={classNames(
                        "text-sm",
                        darkMode ? "text-gray-400" : "text-gray-500"
                      )}>Loading channels...</p>
                          </div>
                  ) : (
                        <div>
                      <select 
                                className={classNames(
                          "w-full p-3 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200",
                          darkMode 
                            ? "bg-gray-700 text-gray-100 border-gray-600 hover:border-gray-500" 
                            : "bg-white text-gray-900 border-gray-300 hover:border-gray-400"
                        )}
                        value={server?.settings?.goodbye_channel_id || 'none'}
                        onChange={(e) => handleChannelChange('goodbye_channel_id', e.target.value)}
                        disabled={saving}
                      >
                        <option value="none">-- Select Channel --</option>
                        {(getSafeChannels() || []).map(channel => (
                          <option key={channel.id} value={channel.id}>
                            #{channel.name}
                          </option>
                        ))}
                      </select>
                      <p className={classNames(
                        "text-xs mt-2",
                        darkMode ? "text-gray-400" : "text-gray-500"
                      )}>
                        {server?.settings?.goodbye_channel_id ? 
                          `✅ Current: ${(getSafeChannels() || []).find(c => c.id === server.settings?.goodbye_channel_id)?.name || 'Unknown Channel'}` : 
                          '❌ Not configured'}
                      </p>
                              </div>
                  )}
                              </div>

                {/* Member Logs */}
                      <div className={classNames(
                  "rounded-xl p-5 ring-1 transition-all duration-200 hover:shadow-lg",
                  darkMode ? "bg-gray-800 ring-gray-600" : "bg-gray-50 ring-gray-200"
                      )}>
                  <div className="flex items-center mb-3">
                        <div className={classNames(
                      "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
                      darkMode ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-600"
                    )}>
                      👤
                              </div>
                    <h5 className={classNames(
                      "font-semibold",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>Member Logs</h5>
                              </div>
                  {loadingChannels ? (
                    <div className="flex items-center">
                      <LoadingSpinner size="sm" className="mr-2" />
                      <p className={classNames(
                        "text-sm",
                            darkMode ? "text-gray-400" : "text-gray-500"
                      )}>Loading channels...</p>
                          </div>
                  ) : (
                    <div>
                      <select 
                      className={classNames(
                          "w-full p-3 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200",
                        darkMode 
                            ? "bg-gray-700 text-gray-100 border-gray-600 hover:border-gray-500" 
                            : "bg-white text-gray-900 border-gray-300 hover:border-gray-400"
                        )}
                        value={server?.settings?.member_log_channel_id || 'none'}
                        onChange={(e) => handleChannelChange('member_log_channel_id', e.target.value)}
                      disabled={saving}
                    >
                        <option value="none">-- Select Channel --</option>
                        {(getSafeChannels() || []).map(channel => (
                          <option key={channel.id} value={channel.id}>
                            #{channel.name}
                          </option>
                        ))}
                      </select>
                        <p className={classNames(
                        "text-xs mt-2",
                        darkMode ? "text-gray-400" : "text-gray-500"
                        )}>
                        {server?.settings?.member_log_channel_id ? 
                          `✅ Current: ${(getSafeChannels() || []).find(c => c.id === server.settings?.member_log_channel_id)?.name || 'Unknown Channel'}` : 
                          '❌ Not configured'}
                        </p>
                      </div>
                  )}
                  </div>

                {/* Invite Tracking Channel */}
                <div className={classNames(
                  "rounded-xl p-5 ring-1 transition-all duration-200 hover:shadow-lg",
                  darkMode ? "bg-gray-800 ring-gray-600" : "bg-gray-50 ring-gray-200"
                )}>
                  <div className="flex items-center mb-3">
                            <div className={classNames(
                      "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
                      darkMode ? "bg-purple-900/30 text-purple-400" : "bg-purple-100 text-purple-600"
                            )}>
                      📊
                            </div>
                    <h5 className={classNames(
                      "font-semibold",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>Invite Tracking Channel</h5>
                          </div>
                  {loadingChannels ? (
                    <div className="flex items-center">
                      <LoadingSpinner size="sm" className="mr-2" />
                      <p className={classNames(
                        "text-sm",
                        darkMode ? "text-gray-400" : "text-gray-500"
                      )}>Loading channels...</p>
                          </div>
                  ) : (
                        <div>
                      <select 
                                className={classNames(
                          "w-full p-3 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200",
                          darkMode 
                            ? "bg-gray-700 text-gray-100 border-gray-600 hover:border-gray-500" 
                            : "bg-white text-gray-900 border-gray-300 hover:border-gray-400"
                        )}
                        value={server?.settings?.server_log_channel_id || 'none'}
                        onChange={(e) => handleChannelChange('server_log_channel_id', e.target.value)}
                        disabled={saving}
                      >
                        <option value="none">-- Select Channel --</option>
                        {(getSafeChannels() || []).map(channel => (
                          <option key={channel.id} value={channel.id}>
                            #{channel.name}
                          </option>
                        ))}
                      </select>
                      <p className={classNames(
                        "text-xs mt-2",
                        darkMode ? "text-gray-400" : "text-gray-500"
                      )}>
                        {server?.settings?.server_log_channel_id ? 
                          `✅ Current: ${(getSafeChannels() || []).find(c => c.id === server.settings?.server_log_channel_id)?.name || 'Unknown Channel'}` : 
                          '❌ Not configured'}
                      </p>
                            </div>
                  )}
                              </div>
                              </div>
                            </div>

                                <div>
              <div className="flex items-center justify-between mb-6">
                <h4 className={classNames(
                  "text-lg font-semibold flex items-center",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  🎉 Welcome & Leave Messages
                </h4>
                
                <button
                  onClick={() => setShowPlaceholders(!showPlaceholders)}
                  className={classNames(
                    "px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 border-2 border-dashed",
                    darkMode 
                      ? "bg-purple-900/20 border-purple-600/50 text-purple-300 hover:bg-purple-900/30 hover:border-purple-500" 
                      : "bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100 hover:border-purple-400",
                    darkMode ? "focus:ring-offset-gray-800" : "focus:ring-offset-white"
                  )}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">📝</span>
                    <span>Placeholders</span>
                    <span className={classNames(
                      "transform transition-transform duration-200",
                      showPlaceholders ? "rotate-180" : "rotate-0"
                    )}>
                      ▼
                    </span>
                  </div>
                </button>
              </div>
              
              {showPlaceholders && (
                <div className={classNames(
                  "mb-6 p-4 rounded-xl border-2 animate-in slide-in-from-top-2 duration-200",
                  darkMode ? "bg-gray-800/50 border-gray-600" : "bg-gray-50 border-gray-200"
                )}>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className={classNames(
                      "p-3 rounded-lg",
                      darkMode ? "bg-gray-700/50" : "bg-white"
                    )}>
                      <h6 className={classNames(
                        "font-semibold mb-2 text-sm flex items-center",
                        darkMode ? "text-blue-300" : "text-blue-700"
                      )}>
                        <span className="mr-2">👤</span>User Info
                      </h6>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <code className="bg-gray-600 text-white px-2 py-1 rounded">{'{user}'}</code>
                          <span className={classNames("ml-2", darkMode ? "text-gray-300" : "text-gray-600")}>Mentions user</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <code className="bg-gray-600 text-white px-2 py-1 rounded">{'{username}'}</code>
                          <span className={classNames("ml-2", darkMode ? "text-gray-300" : "text-gray-600")}>Username</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <code className="bg-gray-600 text-white px-2 py-1 rounded">{'{mention}'}</code>
                          <span className={classNames("ml-2", darkMode ? "text-gray-300" : "text-gray-600")}>@username</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className={classNames(
                      "p-3 rounded-lg",
                      darkMode ? "bg-gray-700/50" : "bg-white"
                    )}>
                      <h6 className={classNames(
                        "font-semibold mb-2 text-sm flex items-center",
                        darkMode ? "text-green-300" : "text-green-700"
                      )}>
                        <span className="mr-2">🏠</span>Server Info
                      </h6>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <code className="bg-gray-600 text-white px-2 py-1 rounded">{'{server}'}</code>
                          <span className={classNames("ml-2", darkMode ? "text-gray-300" : "text-gray-600")}>Server name</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <code className="bg-gray-600 text-white px-2 py-1 rounded">{'{memberCount}'}</code>
                          <span className={classNames("ml-2", darkMode ? "text-gray-300" : "text-gray-600")}>Total members</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className={classNames(
                      "p-3 rounded-lg",
                      darkMode ? "bg-gray-700/50" : "bg-white"
                    )}>
                      <h6 className={classNames(
                        "font-semibold mb-2 text-sm flex items-center",
                        darkMode ? "text-orange-300" : "text-orange-700"
                      )}>
                        <span className="mr-2">📊</span>Invite Info
                      </h6>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <code className="bg-gray-600 text-white px-2 py-1 rounded">{'{inviter}'}</code>
                          <span className={classNames("ml-2", darkMode ? "text-gray-300" : "text-gray-600")}>Who invited</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <code className="bg-gray-600 text-white px-2 py-1 rounded">{'{inviteCode}'}</code>
                          <span className={classNames("ml-2", darkMode ? "text-gray-300" : "text-gray-600")}>Invite code</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <code className="bg-gray-600 text-white px-2 py-1 rounded">{'{inviteUses}'}</code>
                          <span className={classNames("ml-2", darkMode ? "text-gray-300" : "text-gray-600")}>Total uses</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <code className="bg-gray-600 text-white px-2 py-1 rounded">{'{isFakeInvite}'}</code>
                          <span className={classNames("ml-2", darkMode ? "text-gray-300" : "text-gray-600")}>If fake invite</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className={classNames(
                      "p-3 rounded-lg",
                      darkMode ? "bg-gray-700/50" : "bg-white"
                    )}>
                      <h6 className={classNames(
                        "font-semibold mb-2 text-sm flex items-center",
                        darkMode ? "text-purple-300" : "text-purple-700"
                      )}>
                        <span className="mr-2">⏰</span>Time Info
                      </h6>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <code className="bg-gray-600 text-white px-2 py-1 rounded">{'{timeInServer}'}</code>
                          <span className={classNames("ml-2", darkMode ? "text-gray-300" : "text-gray-600")}>Time in server</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <code className="bg-gray-600 text-white px-2 py-1 rounded">{'{joinDate}'}</code>
                          <span className={classNames("ml-2", darkMode ? "text-gray-300" : "text-gray-600")}>Join date</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <code className="bg-gray-600 text-white px-2 py-1 rounded">{'{accountAge}'}</code>
                          <span className={classNames("ml-2", darkMode ? "text-gray-300" : "text-gray-600")}>Account age</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Welcome Messages */}
                              <div className={classNames(
                  "rounded-xl p-5 ring-1 transition-all duration-200 hover:shadow-lg",
                  darkMode ? "bg-gray-800 ring-gray-600" : "bg-gray-50 ring-gray-200"
                              )}>
                  <div className="flex items-center mb-3">
                              <div className={classNames(
                      "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
                      darkMode ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-600"
                              )}>
                      🎉
                              </div>
                    <h5 className={classNames(
                      "font-semibold",
              darkMode ? "text-white" : "text-gray-900"
                    )}>Welcome Messages</h5>
        </div>
            
            <div className="space-y-4">
              <button
                onClick={async () => {
                              console.log('🟢 WELCOME MODAL OPENING - JavaScript is working!');
                              setShowWelcomeMessageModal(true);
                              // Load configuration when modal opens
                              if (serverId) {
                                console.log('🔄 Loading welcome config on modal open...');
                                await loadWelcomeMessageConfig();
                              }
                            }}
                      className={classNames(
                        "w-full px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2",
                        "text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg",
                        darkMode ? "focus:ring-offset-gray-800" : "focus:ring-offset-white"
                      )}
              >
                Customize Welcome Message
              </button>
              

            </div>
          </div>

          {/* Leave Messages */}
          <div className={classNames(
                  "rounded-xl p-5 ring-1 transition-all duration-200 hover:shadow-lg",
                  darkMode ? "bg-gray-800 ring-gray-600" : "bg-gray-50 ring-gray-200"
                )}>
                  <div className="flex items-center mb-3">
                    <div className={classNames(
                      "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
                      darkMode ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-600"
                    )}>
                      👋
                    </div>
                    <h5 className={classNames(
                      "font-semibold",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>Leave Messages</h5>
                  </div>
            
            <div className="space-y-4">
              <button
                onClick={async () => {
                              console.log('🟢 GOODBYE MODAL OPENING - JavaScript is working!');
                              setShowLeaveMessageModal(true);
                              // Load configuration when modal opens
                              if (serverId) {
                                console.log('🔄 Loading goodbye config on modal open...');
                                await loadGoodbyeMessageConfig();
                              }
                            }}
                      className={classNames(
                        "w-full px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2",
                        "text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg",
                        darkMode ? "focus:ring-offset-gray-800" : "focus:ring-offset-white"
                      )}
              >
                Customize Leave Message
              </button>
              

              </div>
            </div>
          </div>
        </div>

            <div>
              <h4 className={classNames(
                "text-lg font-semibold mb-6 flex items-center",
                darkMode ? "text-white" : "text-gray-900"
              )}>
                📊 Invite Tracker Messages
              </h4>
          
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Invite Join Messages */}
            <div className={classNames(
                  "rounded-xl p-5 ring-1 transition-all duration-200 hover:shadow-lg",
                  darkMode ? "bg-gray-800 ring-gray-600" : "bg-gray-50 ring-gray-200"
                )}>
                  <div className="flex items-center mb-3">
                    <div className={classNames(
                      "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
                      darkMode ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-600"
                    )}>
                      📈
                    </div>
                    <h5 className={classNames(
                      "font-semibold",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>Join Tracking</h5>
                  </div>
              
              <div className="space-y-4">
                <button
                  onClick={() => setShowInviteJoinMessageModal(true)}
                      className={classNames(
                        "w-full px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                        "text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg",
                        darkMode ? "focus:ring-offset-gray-800" : "focus:ring-offset-white"
                      )}
                >
                  Customize Join Tracking
                </button>
              </div>
            </div>

            {/* Invite Leave Messages */}
            <div className={classNames(
                  "rounded-xl p-5 ring-1 transition-all duration-200 hover:shadow-lg",
                  darkMode ? "bg-gray-800 ring-gray-600" : "bg-gray-50 ring-gray-200"
                )}>
                  <div className="flex items-center mb-3">
                    <div className={classNames(
                      "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
                      darkMode ? "bg-orange-900/30 text-orange-400" : "bg-orange-100 text-orange-600"
                    )}>
                      📉
                    </div>
                    <h5 className={classNames(
                      "font-semibold",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>Leave Tracking</h5>
                  </div>
              
              <div className="space-y-4">
                <button
                  onClick={() => setShowInviteLeaveMessageModal(true)}
                      className={classNames(
                        "w-full px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2",
                        "text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg",
                        darkMode ? "focus:ring-offset-gray-800" : "focus:ring-offset-white"
                      )}
                >
                  Customize Leave Tracking
                </button>
              </div>
            </div>
          </div>
        </div>
          </div>
        </Card>

        {/* Server Statistics Card - moved to bottom */}
        <Card className={classNames(
          "lg:col-span-3 shadow-xl border-0 rounded-xl overflow-hidden",
          darkMode ? "bg-gray-800 ring-1 ring-gray-700" : "bg-white ring-1 ring-gray-200"
        )}>
          <div className={classNames(
            "p-6 border-b",
            darkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"
          )}>
            <h3 className={classNames(
              "text-xl font-semibold",
              darkMode ? "text-white" : "text-gray-900"
            )}>📊 Server Statistics</h3>
          </div>
          
          <div className={classNames(
            "p-6",
            darkMode ? "bg-gray-900" : "bg-white"
          )}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className={classNames(
                "rounded-xl p-6 ring-1 transition-all duration-200 hover:shadow-lg",
                darkMode ? "bg-gray-800 ring-gray-600" : "bg-gray-50 ring-gray-200"
              )}>
                <div className="flex items-center mb-2">
                  <div className={classNames(
                    "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
                    darkMode ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-600"
                  )}>
                    🎫
                  </div>
                  <p className={classNames(
                    "text-sm font-medium",
                    darkMode ? "text-gray-300" : "text-gray-600"
                  )}>Total Tickets</p>
                </div>
                <p className={classNames(
                  "text-3xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>-</p>
              </div>
              <div className={classNames(
                "rounded-xl p-6 ring-1 transition-all duration-200 hover:shadow-lg",
                darkMode ? "bg-gray-800 ring-gray-600" : "bg-gray-50 ring-gray-200"
              )}>
                <div className="flex items-center mb-2">
                  <div className={classNames(
                    "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
                    darkMode ? "bg-orange-900/30 text-orange-400" : "bg-orange-100 text-orange-600"
                  )}>
                    ⚠️
                  </div>
                  <p className={classNames(
                    "text-sm font-medium",
                    darkMode ? "text-gray-300" : "text-gray-600"
                  )}>Active Warnings</p>
                </div>
                <p className={classNames(
                  "text-3xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>-</p>
              </div>
              <div className={classNames(
                "rounded-xl p-6 ring-1 transition-all duration-200 hover:shadow-lg",
                darkMode ? "bg-gray-800 ring-gray-600" : "bg-gray-50 ring-gray-200"
              )}>
                <div className="flex items-center mb-2">
                  <div className={classNames(
                    "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
                    darkMode ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-600"
                  )}>
                    ⚡
                  </div>
                  <p className={classNames(
                    "text-sm font-medium",
                    darkMode ? "text-gray-300" : "text-gray-600"
                  )}>Commands Used</p>
                </div>
                <p className={classNames(
                  "text-3xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>-</p>
              </div>
            </div>
            
            <div className="mt-8 text-center">
              <div className={classNames(
                "inline-flex items-center px-4 py-2 rounded-lg",
                darkMode ? "bg-blue-900/20 text-blue-400" : "bg-blue-100 text-blue-600"
              )}>
                <div className={classNames(
                  "w-6 h-6 rounded-full flex items-center justify-center mr-2",
                  darkMode ? "bg-blue-800/30" : "bg-blue-200"
                )}>
                  ℹ️
                </div>
                <p className="text-sm font-medium">
                  Statistics will be available in a future update
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Welcome Message Modal */}
      <Transition appear show={showWelcomeMessageModal} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={() => setShowWelcomeMessageModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
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
                  "w-full max-w-4xl transform overflow-hidden rounded-2xl p-8 text-left align-middle shadow-2xl transition-all border",
                  darkMode ? "bg-gray-800/95 backdrop-blur-lg text-white border-gray-700" : "bg-white/95 backdrop-blur-lg text-gray-900 border-gray-200"
                )}>
                  <Dialog.Title
                    as="h3"
                    className="text-2xl font-bold leading-6 mb-6 flex items-center"
                  >
                    <span className="text-3xl mr-3">🎉</span>
                    Customize Welcome Message
                  </Dialog.Title>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Form */}
                    <div className="space-y-6">
                      <p className={classNames(
                        "text-sm",
                        darkMode ? "text-gray-300" : "text-gray-600"
                      )}>
                        Customize your welcome message for new members joining your server.
                      </p>
                      
                      {/* Available Placeholders */}
                      <div className={classNames(
                        "p-4 rounded-lg border",
                        darkMode ? "bg-blue-900/20 border-blue-700" : "bg-blue-50 border-blue-200"
                      )}>
                        <h4 className={classNames(
                          "text-sm font-semibold mb-2 flex items-center",
                          darkMode ? "text-blue-300" : "text-blue-700"
                        )}>
                          <span className="mr-2">📝</span>
                          Available Placeholders
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className={classNames(
                            "flex items-center",
                            darkMode ? "text-blue-200" : "text-blue-600"
                          )}>
                            <code className="bg-opacity-50 bg-gray-600 px-1 rounded mr-2">{"{user}"}</code>
                            <span>Mentions the user</span>
                          </div>
                          <div className={classNames(
                            "flex items-center",
                            darkMode ? "text-blue-200" : "text-blue-600"
                          )}>
                            <code className="bg-opacity-50 bg-gray-600 px-1 rounded mr-2">{"{server}"}</code>
                            <span>Server name</span>
                          </div>
                          <div className={classNames(
                            "flex items-center",
                            darkMode ? "text-blue-200" : "text-blue-600"
                          )}>
                            <code className="bg-opacity-50 bg-gray-600 px-1 rounded mr-2">{"{username}"}</code>
                            <span>User's username</span>
                          </div>
                          <div className={classNames(
                            "flex items-center",
                            darkMode ? "text-blue-200" : "text-blue-600"
                          )}>
                            <code className="bg-opacity-50 bg-gray-600 px-1 rounded mr-2">{"{memberCount}"}</code>
                            <span>Total members</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Basic Settings */}
                      <div className="space-y-5">
                      <div>
                        <label className={classNames(
                            "block text-sm font-semibold mb-3",
                          darkMode ? "text-gray-200" : "text-gray-700"
                        )}>
                            Message Title
                        </label>
                        <input
                          type="text"
                          value={customWelcomeMessage.title}
                          onChange={(e) => setCustomWelcomeMessage({
                            ...customWelcomeMessage,
                            title: e.target.value
                          })}
                          className={classNames(
                              "w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all duration-200 text-base",
                            darkMode 
                                ? "bg-gray-700/50 text-gray-100 border-gray-600 placeholder-gray-400" 
                                : "bg-white text-gray-900 border-gray-300 placeholder-gray-500"
                          )}
                            placeholder="Enter welcome title..."
                        />
                      </div>

                      <div>
                        <label className={classNames(
                            "block text-sm font-semibold mb-3",
                          darkMode ? "text-gray-200" : "text-gray-700"
                        )}>
                            Message Description
                        </label>
                        <textarea
                          value={customWelcomeMessage.description}
                          onChange={(e) => setCustomWelcomeMessage({
                            ...customWelcomeMessage,
                            description: e.target.value
                          })}
                          className={classNames(
                              "w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all duration-200 text-base resize-none",
                            darkMode 
                                ? "bg-gray-700/50 text-gray-100 border-gray-600 placeholder-gray-400" 
                                : "bg-white text-gray-900 border-gray-300 placeholder-gray-500"
                          )}
                            rows={4}
                            placeholder="Enter welcome description..."
                        />
                      </div>

                      <div>
                        <label className={classNames(
                            "block text-sm font-semibold mb-3",
                          darkMode ? "text-gray-200" : "text-gray-700"
                        )}>
                          Embed Color
                        </label>
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                          <input
                            type="color"
                            value={customWelcomeMessage.color}
                            onChange={(e) => setCustomWelcomeMessage({
                              ...customWelcomeMessage,
                              color: e.target.value
                            })}
                                className="w-16 h-12 rounded-xl border-2 border-gray-300 cursor-pointer shadow-lg"
                          />
                            </div>
                          <input
                            type="text"
                            value={customWelcomeMessage.color}
                              onChange={(e) => {
                                const value = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                                if (/^#[0-9A-F]{0,6}$/i.test(value)) {
                                  setCustomWelcomeMessage({
                              ...customWelcomeMessage,
                                    color: value
                                  });
                                }
                              }}
                            className={classNames(
                                "flex-1 px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all duration-200 text-base font-mono",
                              darkMode 
                                  ? "bg-gray-700/50 text-gray-100 border-gray-600" 
                                  : "bg-white text-gray-900 border-gray-300"
                            )}
                            placeholder="#43b581"
                              maxLength={7}
                          />
                          </div>
                        </div>
                      </div>

                      {/* Custom Fields */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                        <label className={classNames(
                            "block text-sm font-semibold",
                          darkMode ? "text-gray-200" : "text-gray-700"
                        )}>
                            Custom Fields
                        </label>
                          <button
                            onClick={() => setCustomWelcomeMessage({
                              ...customWelcomeMessage,
                              fields: [
                                ...customWelcomeMessage.fields,
                                { name: '🔹 New Field', value: 'Enter field description here...' }
                              ]
                            })}
                            className={classNames(
                              "px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 transform hover:scale-105",
                              darkMode 
                                ? "bg-green-600 text-white hover:bg-green-700 shadow-lg" 
                                : "bg-green-500 text-white hover:bg-green-600 shadow-lg"
                            )}
                          >
                            + Add Field
                          </button>
                        </div>

                        <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                          {customWelcomeMessage.fields.map((field, index) => (
                            <div key={index} className={classNames(
                              "p-4 border-2 rounded-xl transition-all duration-200",
                              darkMode ? "border-gray-600 bg-gray-700/30" : "border-gray-200 bg-gray-50/50"
                            )}>
                              <div className="flex items-center justify-between mb-3">
                                <span className={classNames(
                                  "text-sm font-semibold",
                                  darkMode ? "text-gray-200" : "text-gray-700"
                                )}>
                                  Field {index + 1}
                                </span>
                                  <button
                                  onClick={() => setCustomWelcomeMessage({
                                        ...customWelcomeMessage,
                                    fields: customWelcomeMessage.fields.filter((_, i) => i !== index)
                                  })}
                                  className="text-red-500 hover:text-red-600 text-sm font-semibold transition-colors"
                                >
                                  Remove
                                  </button>
                              </div>
                              <div className="space-y-3">
                                <input
                                  type="text"
                                  value={replacePlaceholders(field.name)}
                                  onChange={(e) => {
                                    const updatedFields = [...customWelcomeMessage.fields];
                                    updatedFields[index] = { ...updatedFields[index], name: e.target.value };
                                    setCustomWelcomeMessage({
                                      ...customWelcomeMessage,
                                      fields: updatedFields
                                    });
                                  }}
                                  className={classNames(
                                    "w-full px-3 py-2 text-sm border-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-500/50 transition-all",
                                    darkMode 
                                      ? "bg-gray-600/50 text-gray-100 border-gray-500" 
                                      : "bg-white text-gray-900 border-gray-300"
                                  )}
                                  placeholder="Field name..."
                                />
                                <textarea
                                  value={replacePlaceholders(field.value)}
                                  onChange={(e) => {
                                    const updatedFields = [...customWelcomeMessage.fields];
                                    updatedFields[index] = { ...updatedFields[index], value: e.target.value };
                                    setCustomWelcomeMessage({
                                      ...customWelcomeMessage,
                                      fields: updatedFields
                                    });
                                  }}
                                  className={classNames(
                                    "w-full px-3 py-2 text-sm border-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-500/50 transition-all resize-none",
                                    darkMode 
                                      ? "bg-gray-600/50 text-gray-100 border-gray-500" 
                                      : "bg-white text-gray-900 border-gray-300"
                                  )}
                                  rows={2}
                                  placeholder="Field description..."
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Preview */}
                    <div>
                      <h4 className={classNames(
                        "text-lg font-semibold mb-4",
                        darkMode ? "text-gray-200" : "text-gray-700"
                      )}>
                        Live Preview
                      </h4>
                      <div className={classNames(
                        "p-6 rounded-xl border-2 shadow-lg",
                        darkMode ? "bg-gray-800/50 border-gray-600" : "bg-white border-gray-200"
                      )}>
                        <div 
                          className="border-l-4 pl-4 py-4 rounded-r-lg"
                          style={{ 
                            borderLeftColor: customWelcomeMessage.color,
                            backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.3)' : 'rgba(249, 250, 251, 0.8)'
                          }}
                        >
                        <h5 className={classNames(
                            "font-bold text-xl mb-3",
                          darkMode ? "text-white" : "text-gray-900"
                        )}>
                            {replacePlaceholders(customWelcomeMessage.title)}
                        </h5>
                        <p className={classNames(
                            "text-sm mb-4 leading-relaxed",
                          darkMode ? "text-gray-300" : "text-gray-600"
                        )}>
                            {replacePlaceholders(customWelcomeMessage.description)}
                        </p>
                        
                          {customWelcomeMessage.fields.length > 0 && (
                            <div className="space-y-4 mb-4">
                        {customWelcomeMessage.fields.map((field, index) => (
                                <div key={index} className="pb-2">
                                  <p className={classNames(
                                    "font-semibold text-sm mb-2",
                                darkMode ? "text-gray-200" : "text-gray-700"
                              )}>
                                {replacePlaceholders(field.name)}
                                  </p>
                                  <p className={classNames(
                                    "text-sm leading-relaxed",
                                darkMode ? "text-gray-300" : "text-gray-600"
                              )}>
                                {replacePlaceholders(field.value)}
                                  </p>
                              </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end space-x-4">
                    <button
                      type="button"
                      className={classNames(
                        "px-6 py-3 border-2 text-base font-semibold rounded-xl transition-all duration-200 transform hover:scale-105",
                        darkMode 
                          ? "border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500" 
                          : "border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                      )}
                      onClick={() => setShowWelcomeMessageModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={classNames(
                        "px-6 py-3 border-2 text-base font-semibold rounded-xl transition-all duration-200 transform hover:scale-105",
                        "border-green-500 text-green-400 hover:bg-green-500/10",
                        darkMode ? "bg-gray-800" : "bg-gray-900"
                      )}
                      onClick={async () => {
                        if (!server?.settings?.welcome_channel_id) {
                          toast.error('Please select a welcome channel first');
                          return;
                        }
                        try {
                          setSaving(true);
                          const response = await apiService.testWelcomeMessage(
                            serverId!,
                            {
                              title: customWelcomeMessage.title,
                              description: customWelcomeMessage.description,
                              color: customWelcomeMessage.color,
                              fields: customWelcomeMessage.fields
                            }
                          );
                          if (response.success) {
                            toast.success('Test welcome message sent successfully! 🎉');
                          } else {
                            toast.error(response.error || 'Failed to send test message');
                          }
                        } catch (error) {
                          console.error('Error sending test welcome message:', error);
                          toast.error('Failed to send test message');
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                    >
                      {saving ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Testing...
                        </div>
                      ) : (
                        '🧪 Send Test'
                      )}
                    </button>
                    <button
                      type="button"
                      className={classNames(
                        "px-6 py-3 border-2 border-transparent text-base font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105",
                        darkMode 
                          ? "border-red-500 text-red-400 hover:bg-red-500/10 bg-gray-800" 
                          : "bg-red-500 text-white hover:bg-red-600"
                      )}
                      onClick={async () => {
                        try {
                          setSaving(true);
                          console.log('🔴 RESET BUTTON CLICKED - Starting reset process...');
                          
                          // Call the API to reset the configuration in the database
                          const response = await apiService.resetWelcomeMessageConfig(serverId!);
                          console.log('🔄 Reset API response:', response);
                          
                          if (response.success) {
                            // Directly set the default values to ensure immediate UI update
                            const defaultConfig = {
                              title: '👋 Welcome to {server}!',
                              description: 'Welcome {user}! We\'re excited to have you in our community. We hope you enjoy your stay!',
                              color: '#43b581',
                              fields: [
                                { name: '🔹 Server Rules', value: 'Please read our rules to get started.' },
                                { name: '🔹 Get Roles', value: 'Visit our roles channel to get your roles.' },
                                { name: '🔹 Member Count', value: 'You are member #{memberCount}!' }
                              ]
                            };
                            
                            console.log('✅ Setting default config:', defaultConfig);
                            setCustomWelcomeMessage(defaultConfig);
                            toast.success('Welcome message configuration reset to defaults! 🔄');
                          } else {
                            toast.error(response.error || 'Failed to reset configuration');
                          }
                        } catch (error) {
                          console.error('❌ Error resetting welcome message config:', error);
                          toast.error('Failed to reset configuration');
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                    >
                      {saving ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Resetting...
                        </div>
                      ) : (
                        '🔄 Reset to Defaults'
                      )}
                    </button>
                    <button
                      type="button"
                      className={classNames(
                        "px-6 py-3 border-2 border-transparent text-base font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105",
                        darkMode 
                          ? "border-green-500 text-green-400 hover:bg-green-500/10 bg-gray-800" 
                          : "bg-green-500 text-white hover:bg-green-600"
                      )}
                      onClick={async () => {
                        try {
                          setSaving(true);
                          const response = await apiService.saveWelcomeMessageConfig(
                            serverId!,
                            {
                              title: customWelcomeMessage.title,
                              description: customWelcomeMessage.description,
                              color: customWelcomeMessage.color,
                              fields: customWelcomeMessage.fields
                            }
                          );
                          if (response.success) {
                            toast.success('Welcome message configuration saved successfully! ✅');
                          } else {
                            toast.error(response.error || 'Failed to save configuration');
                          }
                        } catch (error) {
                          console.error('Error saving welcome message config:', error);
                          toast.error('Failed to save configuration');
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                    >
                      {saving ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </div>
                      ) : (
                        '💾 Save Configuration'
                      )}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Leave Message Modal */}
      <Transition appear show={showLeaveMessageModal} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={() => setShowLeaveMessageModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
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
                  "w-full max-w-4xl transform overflow-hidden rounded-2xl p-8 text-left align-middle shadow-2xl transition-all border",
                  darkMode ? "bg-gray-800/95 backdrop-blur-lg text-white border-gray-700" : "bg-white/95 backdrop-blur-lg text-gray-900 border-gray-200"
                )}>
                  <Dialog.Title
                    as="h3"
                    className="text-2xl font-bold leading-6 mb-6 flex items-center"
                  >
                    <span className="text-3xl mr-3">👋</span>
                    Customize Leave Message
                  </Dialog.Title>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Form */}
                    <div className="space-y-6">
                      <p className={classNames(
                        "text-sm",
                        darkMode ? "text-gray-300" : "text-gray-600"
                      )}>
                        Customize your leave message for members leaving your server.
                      </p>
                      
                      {/* Basic Settings */}
                      <div className="space-y-5">
                      <div>
                        <label className={classNames(
                            "block text-sm font-semibold mb-3",
                          darkMode ? "text-gray-200" : "text-gray-700"
                        )}>
                            Message Title
                        </label>
                        <input
                          type="text"
                          value={customLeaveMessage.title}
                          onChange={(e) => setCustomLeaveMessage({
                            ...customLeaveMessage,
                            title: e.target.value
                          })}
                          className={classNames(
                              "w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all duration-200 text-base",
                            darkMode 
                                ? "bg-gray-700/50 text-gray-100 border-gray-600 placeholder-gray-400" 
                                : "bg-white text-gray-900 border-gray-300 placeholder-gray-500"
                          )}
                            placeholder="Enter leave title..."
                        />
                      </div>

                      <div>
                        <label className={classNames(
                            "block text-sm font-semibold mb-3",
                          darkMode ? "text-gray-200" : "text-gray-700"
                        )}>
                            Message Description
                        </label>
                        <textarea
                          value={customLeaveMessage.description}
                          onChange={(e) => setCustomLeaveMessage({
                            ...customLeaveMessage,
                            description: e.target.value
                          })}
                          className={classNames(
                              "w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all duration-200 text-base resize-none",
                            darkMode 
                                ? "bg-gray-700/50 text-gray-100 border-gray-600 placeholder-gray-400" 
                                : "bg-white text-gray-900 border-gray-300 placeholder-gray-500"
                          )}
                            rows={4}
                            placeholder="Enter leave description..."
                        />
                      </div>

                      <div>
                        <label className={classNames(
                            "block text-sm font-semibold mb-3",
                          darkMode ? "text-gray-200" : "text-gray-700"
                        )}>
                          Embed Color
                        </label>
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                          <input
                            type="color"
                            value={customLeaveMessage.color}
                            onChange={(e) => setCustomLeaveMessage({
                              ...customLeaveMessage,
                              color: e.target.value
                            })}
                                className="w-16 h-12 rounded-xl border-2 border-gray-300 cursor-pointer shadow-lg"
                          />
                            </div>
                          <input
                            type="text"
                            value={customLeaveMessage.color}
                              onChange={(e) => {
                                const value = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                                if (/^#[0-9A-F]{0,6}$/i.test(value)) {
                                  setCustomLeaveMessage({
                              ...customLeaveMessage,
                                    color: value
                                  });
                                }
                              }}
                            className={classNames(
                                "flex-1 px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all duration-200 text-base font-mono",
                              darkMode 
                                  ? "bg-gray-700/50 text-gray-100 border-gray-600" 
                                  : "bg-white text-gray-900 border-gray-300"
                            )}
                            placeholder="#e74c3c"
                              maxLength={7}
                          />
                          </div>
                        </div>
                      </div>

                      {/* Custom Fields */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                        <label className={classNames(
                            "block text-sm font-semibold",
                          darkMode ? "text-gray-200" : "text-gray-700"
                        )}>
                            Custom Fields
                        </label>
                          <button
                            onClick={() => setCustomLeaveMessage({
                              ...customLeaveMessage,
                              fields: [
                                ...customLeaveMessage.fields,
                                { name: '🔹 New Field', value: 'Enter field description here...' }
                              ]
                            })}
                            className={classNames(
                              "px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 transform hover:scale-105",
                              darkMode 
                                ? "bg-red-600 text-white hover:bg-red-700 shadow-lg" 
                                : "bg-red-500 text-white hover:bg-red-600 shadow-lg"
                            )}
                          >
                            + Add Field
                          </button>
                        </div>

                        <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                          {customLeaveMessage.fields.map((field, index) => (
                            <div key={index} className={classNames(
                              "p-4 border-2 rounded-xl transition-all duration-200",
                              darkMode ? "border-gray-600 bg-gray-700/30" : "border-gray-200 bg-gray-50/50"
                            )}>
                              <div className="flex items-center justify-between mb-3">
                                <span className={classNames(
                                  "text-sm font-semibold",
                                  darkMode ? "text-gray-200" : "text-gray-700"
                                )}>
                                  Field {index + 1}
                                </span>
                                  <button
                                  onClick={() => setCustomLeaveMessage({
                                        ...customLeaveMessage,
                                    fields: customLeaveMessage.fields.filter((_, i) => i !== index)
                                  })}
                                  className="text-red-500 hover:text-red-600 text-sm font-semibold transition-colors"
                                >
                                  Remove
                                  </button>
                              </div>
                              <div className="space-y-3">
                                <input
                                  type="text"
                                  value={replacePlaceholders(field.name)}
                                  onChange={(e) => {
                                    const updatedFields = [...customLeaveMessage.fields];
                                    updatedFields[index] = { ...updatedFields[index], name: e.target.value };
                                    setCustomLeaveMessage({
                                      ...customLeaveMessage,
                                      fields: updatedFields
                                    });
                                  }}
                                  className={classNames(
                                    "w-full px-3 py-2 text-sm border-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500/50 transition-all",
                                    darkMode 
                                      ? "bg-gray-600/50 text-gray-100 border-gray-500" 
                                      : "bg-white text-gray-900 border-gray-300"
                                  )}
                                  placeholder="Field name..."
                                />
                                <textarea
                                  value={replacePlaceholders(field.value)}
                                  onChange={(e) => {
                                    const updatedFields = [...customLeaveMessage.fields];
                                    updatedFields[index] = { ...updatedFields[index], value: e.target.value };
                                    setCustomLeaveMessage({
                                      ...customLeaveMessage,
                                      fields: updatedFields
                                    });
                                  }}
                                  className={classNames(
                                    "w-full px-3 py-2 text-sm border-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500/50 transition-all resize-none",
                                    darkMode 
                                      ? "bg-gray-600/50 text-gray-100 border-gray-500" 
                                      : "bg-white text-gray-900 border-gray-300"
                                  )}
                                  rows={2}
                                  placeholder="Field description..."
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Preview */}
                    <div>
                      <h4 className={classNames(
                        "text-lg font-semibold mb-4",
                        darkMode ? "text-gray-200" : "text-gray-700"
                      )}>
                        Live Preview
                      </h4>
                      <div className={classNames(
                        "p-6 rounded-xl border-2 shadow-lg",
                        darkMode ? "bg-gray-800/50 border-gray-600" : "bg-white border-gray-200"
                      )}>
                        <div 
                          className="border-l-4 pl-4 py-4 rounded-r-lg"
                          style={{ 
                            borderLeftColor: customLeaveMessage.color,
                            backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.3)' : 'rgba(249, 250, 251, 0.8)'
                          }}
                        >
                        <h5 className={classNames(
                            "font-bold text-xl mb-3",
                          darkMode ? "text-white" : "text-gray-900"
                        )}>
                            {replacePlaceholders(customLeaveMessage.title)}
                        </h5>
                        <p className={classNames(
                            "text-sm mb-4 leading-relaxed",
                          darkMode ? "text-gray-300" : "text-gray-600"
                        )}>
                            {replacePlaceholders(customLeaveMessage.description)}
                        </p>
                        
                          {customLeaveMessage.fields.length > 0 && (
                            <div className="space-y-4 mb-4">
                        {customLeaveMessage.fields.map((field, index) => (
                                <div key={index} className="pb-2">
                                  <p className={classNames(
                                    "font-semibold text-sm mb-2",
                                darkMode ? "text-gray-200" : "text-gray-700"
                              )}>
                                {replacePlaceholders(field.name)}
                                  </p>
                                  <p className={classNames(
                                    "text-sm leading-relaxed",
                                darkMode ? "text-gray-300" : "text-gray-600"
                              )}>
                                {replacePlaceholders(field.value)}
                                  </p>
                              </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end space-x-4">
                    <button
                      type="button"
                      className={classNames(
                        "px-6 py-3 border-2 text-base font-semibold rounded-xl transition-all duration-200 transform hover:scale-105",
                        darkMode 
                          ? "border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500" 
                          : "border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                      )}
                      onClick={() => setShowLeaveMessageModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={classNames(
                        "px-6 py-3 border-2 text-base font-semibold rounded-xl transition-all duration-200 transform hover:scale-105",
                        "border-green-500 text-green-400 hover:bg-green-500/10",
                        darkMode ? "bg-gray-800" : "bg-gray-900"
                      )}
                      onClick={async () => {
                        if (!server?.settings?.goodbye_channel_id) {
                          toast.error('Please select a goodbye channel first');
                          return;
                        }
                        try {
                          setSaving(true);
                          const response = await apiService.testGoodbyeMessage(
                            serverId!,
                            {
                              title: customLeaveMessage.title,
                              description: customLeaveMessage.description,
                              color: customLeaveMessage.color,
                              fields: customLeaveMessage.fields
                            }
                          );
                          if (response.success) {
                            toast.success('Test goodbye message sent successfully! 👋');
                          } else {
                            toast.error(response.error || 'Failed to send test message');
                          }
                        } catch (error) {
                          console.error('Error sending test goodbye message:', error);
                          toast.error('Failed to send test message');
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                    >
                      {saving ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Testing...
                        </div>
                      ) : (
                        '🧪 Send Test'
                      )}
                    </button>
                    <button
                      type="button"
                      className={classNames(
                        "px-6 py-3 border-2 border-transparent text-base font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105",
                        darkMode 
                          ? "border-red-500 text-red-400 hover:bg-red-500/10 bg-gray-800" 
                          : "bg-red-500 text-white hover:bg-red-600"
                      )}
                      onClick={async () => {
                        try {
                          setSaving(true);
                          console.log('🔴 GOODBYE RESET BUTTON CLICKED!');
                          
                          const response = await apiService.resetGoodbyeMessageConfig(serverId!);
                          console.log('🔄 Reset API response:', response);
                          
                          if (response.success) {
                            // Directly set the default values to ensure immediate UI update
                            const defaultConfig = {
                              title: '👋 Goodbye {username}!',
                              description: '{user} has left {server}. We\'ll miss you!',
                              color: '#f04747',
                              fields: [
                                { name: '📊 Member Count', value: 'We now have {memberCount} members.' },
                                { name: '🕐 Joined On', value: 'They were with us since {joinedDate}.' }
                              ]
                            };
                            
                            console.log('✅ Setting default goodbye config:', defaultConfig);
                            setCustomLeaveMessage(defaultConfig);
                            toast.success('Goodbye message configuration reset to defaults! 🔄');
                          } else {
                            toast.error(response.error || 'Failed to reset configuration');
                          }
                        } catch (error) {
                          console.error('❌ Error resetting goodbye message config:', error);
                          toast.error('Failed to reset configuration');
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                    >
                      {saving ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Resetting...
                        </div>
                      ) : (
                        '🔄 Reset to Defaults'
                      )}
                    </button>
                    <button
                      type="button"
                      className={classNames(
                        "px-6 py-3 border-2 border-transparent text-base font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105",
                        darkMode 
                          ? "bg-red-600 text-white hover:bg-red-700" 
                          : "bg-red-500 text-white hover:bg-red-600"
                      )}
                      onClick={async () => {
                        try {
                          setSaving(true);
                          const response = await apiService.saveGoodbyeMessageConfig(
                            serverId!,
                            {
                              title: customLeaveMessage.title,
                              description: customLeaveMessage.description,
                              color: customLeaveMessage.color,
                              fields: customLeaveMessage.fields
                            }
                          );
                          if (response.success) {
                            toast.success('Goodbye message configuration saved successfully! ✅');
                          } else {
                            toast.error(response.error || 'Failed to save configuration');
                          }
                        } catch (error) {
                          console.error('Error saving goodbye message config:', error);
                          toast.error('Failed to save configuration');
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                    >
                      {saving ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </div>
                      ) : (
                        '💾 Save Configuration'
                      )}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Invite Leave Message Modal */}
      <Transition appear show={showInviteLeaveMessageModal} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={() => setShowInviteLeaveMessageModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
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
                  "w-full max-w-4xl transform overflow-hidden rounded-2xl p-8 text-left align-middle shadow-2xl transition-all border",
                  darkMode ? "bg-gray-800/95 backdrop-blur-lg text-white border-gray-700" : "bg-white/95 backdrop-blur-lg text-gray-900 border-gray-200"
                )}>
                  <Dialog.Title
                    as="h3"
                    className="text-2xl font-bold leading-6 mb-6 flex items-center"
                  >
                    <span className="text-3xl mr-3">📉</span>
                    Customize Leave Tracking
                  </Dialog.Title>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Form */}
                    <div className="space-y-6">
                      <p className={classNames(
                        "text-sm",
                        darkMode ? "text-gray-300" : "text-gray-600"
                      )}>
                        Customize your invite leave tracking message for when members leave your server.
                      </p>
                      
                      {/* Basic Settings */}
                      <div className="space-y-5">
                      <div>
                        <label className={classNames(
                            "block text-sm font-semibold mb-3",
                          darkMode ? "text-gray-200" : "text-gray-700"
                        )}>
                            Message Title
                        </label>
                        <input
                          type="text"
                          value={replacePlaceholders(customInviteLeaveMessage.title)}
                          onChange={(e) => setCustomInviteLeaveMessage({
                            ...customInviteLeaveMessage,
                            title: e.target.value
                          })}
                          className={classNames(
                              "w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all duration-200 text-base",
                            darkMode 
                                ? "bg-gray-700/50 text-gray-100 border-gray-600 placeholder-gray-400" 
                                : "bg-white text-gray-900 border-gray-300 placeholder-gray-500"
                          )}
                            placeholder="Enter leave tracking title..."
                        />
                      </div>

                      <div>
                        <label className={classNames(
                            "block text-sm font-semibold mb-3",
                          darkMode ? "text-gray-200" : "text-gray-700"
                        )}>
                            Message Description
                        </label>
                        <textarea
                          value={replacePlaceholders(customInviteLeaveMessage.description)}
                          onChange={(e) => setCustomInviteLeaveMessage({
                            ...customInviteLeaveMessage,
                            description: e.target.value
                          })}
                          className={classNames(
                              "w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all duration-200 text-base resize-none",
                            darkMode 
                                ? "bg-gray-700/50 text-gray-100 border-gray-600 placeholder-gray-400" 
                                : "bg-white text-gray-900 border-gray-300 placeholder-gray-500"
                          )}
                            rows={4}
                            placeholder="Enter leave tracking description..."
                        />
                      </div>

                      <div>
                        <label className={classNames(
                            "block text-sm font-semibold mb-3",
                          darkMode ? "text-gray-200" : "text-gray-700"
                        )}>
                          Embed Color
                        </label>
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                          <input
                            type="color"
                            value={customInviteLeaveMessage.color}
                            onChange={(e) => setCustomInviteLeaveMessage({
                              ...customInviteLeaveMessage,
                              color: e.target.value
                            })}
                                className="w-16 h-12 rounded-xl border-2 border-gray-300 cursor-pointer shadow-lg"
                          />
                            </div>
                          <input
                            type="text"
                            value={customInviteLeaveMessage.color}
                              onChange={(e) => {
                                const value = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                                if (/^#[0-9A-F]{0,6}$/i.test(value)) {
                                  setCustomInviteLeaveMessage({
                              ...customInviteLeaveMessage,
                                    color: value
                                  });
                                }
                              }}
                            className={classNames(
                                "flex-1 px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all duration-200 text-base font-mono",
                              darkMode 
                                  ? "bg-gray-700/50 text-gray-100 border-gray-600" 
                                  : "bg-white text-gray-900 border-gray-300"
                            )}
                            placeholder="#e74c3c"
                              maxLength={7}
                          />
                          </div>
                        </div>
                      </div>

                      {/* Custom Fields */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                        <label className={classNames(
                            "block text-sm font-semibold",
                          darkMode ? "text-gray-200" : "text-gray-700"
                        )}>
                            Custom Fields
                        </label>
                          <button
                            onClick={() => setCustomInviteLeaveMessage({
                              ...customInviteLeaveMessage,
                              fields: [
                                ...customInviteLeaveMessage.fields,
                                { name: '🔹 New Field', value: 'Enter field description here...' }
                              ]
                            })}
                            className={classNames(
                              "px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 transform hover:scale-105",
                              darkMode 
                                ? "bg-orange-600 text-white hover:bg-orange-700 shadow-lg" 
                                : "bg-orange-500 text-white hover:bg-orange-600 shadow-lg"
                            )}
                          >
                            + Add Field
                          </button>
                        </div>

                        <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                          {customInviteLeaveMessage.fields.map((field, index) => (
                            <div key={index} className={classNames(
                              "p-4 border-2 rounded-xl transition-all duration-200",
                              darkMode ? "border-gray-600 bg-gray-700/30" : "border-gray-200 bg-gray-50/50"
                            )}>
                              <div className="flex items-center justify-between mb-3">
                                <span className={classNames(
                                  "text-sm font-semibold",
                                  darkMode ? "text-gray-200" : "text-gray-700"
                                )}>
                                  Field {index + 1}
                                </span>
                                  <button
                                  onClick={() => setCustomInviteLeaveMessage({
                                        ...customInviteLeaveMessage,
                                    fields: customInviteLeaveMessage.fields.filter((_, i) => i !== index)
                                  })}
                                  className="text-red-500 hover:text-red-600 text-sm font-semibold transition-colors"
                                >
                                  Remove
                                  </button>
                              </div>
                              <div className="space-y-3">
                                <input
                                  type="text"
                                  value={replacePlaceholders(field.name)}
                                  onChange={(e) => {
                                    const updatedFields = [...customInviteLeaveMessage.fields];
                                    updatedFields[index] = { ...updatedFields[index], name: e.target.value };
                                    setCustomInviteLeaveMessage({
                                      ...customInviteLeaveMessage,
                                      fields: updatedFields
                                    });
                                  }}
                                  className={classNames(
                                    "w-full px-3 py-2 text-sm border-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all",
                                    darkMode 
                                      ? "bg-gray-600/50 text-gray-100 border-gray-500" 
                                      : "bg-white text-gray-900 border-gray-300"
                                  )}
                                  placeholder="Field name..."
                                />
                                <textarea
                                  value={replacePlaceholders(field.value)}
                                  onChange={(e) => {
                                    const updatedFields = [...customInviteLeaveMessage.fields];
                                    updatedFields[index] = { ...updatedFields[index], value: e.target.value };
                                    setCustomInviteLeaveMessage({
                                      ...customInviteLeaveMessage,
                                      fields: updatedFields
                                    });
                                  }}
                                  className={classNames(
                                    "w-full px-3 py-2 text-sm border-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all resize-none",
                                    darkMode 
                                      ? "bg-gray-600/50 text-gray-100 border-gray-500" 
                                      : "bg-white text-gray-900 border-gray-300"
                                  )}
                                  rows={2}
                                  placeholder="Field description..."
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Preview */}
                    <div>
                      <h4 className={classNames(
                        "text-lg font-semibold mb-4",
                        darkMode ? "text-gray-200" : "text-gray-700"
                      )}>
                        Live Preview
                      </h4>
                      <div className={classNames(
                        "p-6 rounded-xl border-2 shadow-lg",
                        darkMode ? "bg-gray-800/50 border-gray-600" : "bg-white border-gray-200"
                      )}>
                        <div 
                          className="border-l-4 pl-4 py-4 rounded-r-lg"
                          style={{ 
                            borderLeftColor: customInviteLeaveMessage.color,
                            backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.3)' : 'rgba(249, 250, 251, 0.8)'
                          }}
                        >
                        <h5 className={classNames(
                            "font-bold text-xl mb-3",
                          darkMode ? "text-white" : "text-gray-900"
                        )}>
                            {replacePlaceholders(customInviteLeaveMessage.title)}
                        </h5>
                        <p className={classNames(
                            "text-sm mb-4 leading-relaxed",
                          darkMode ? "text-gray-300" : "text-gray-600"
                        )}>
                            {replacePlaceholders(customInviteLeaveMessage.description)}
                        </p>
                        
                          {customInviteLeaveMessage.fields.length > 0 && (
                            <div className="space-y-4 mb-4">
                        {customInviteLeaveMessage.fields.map((field, index) => (
                                <div key={index} className="pb-2">
                                  <p className={classNames(
                                    "font-semibold text-sm mb-2",
                                    "font-semibold text-sm mb-2",
                                darkMode ? "text-gray-200" : "text-gray-700"
                              )}>
                                {replacePlaceholders(field.name)}
                                  </p>
                                  <p className={classNames(
                                    "text-xs",
                                darkMode ? "text-gray-400" : "text-gray-600"
                              )}>
                                {replacePlaceholders(field.value)}
                                  </p>
                              </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      

                    </div>
                  </div>

                  <div className="mt-8 flex justify-end space-x-4">
                    <button
                      type="button"
                      onClick={handleTestInviteLeaveMessage}
                      className={classNames(
                        "px-6 py-3 border-2 border-transparent text-base font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105",
                        "border-green-500 text-green-400 hover:bg-green-500/10 bg-gray-800"
                      )}
                    >
                      <PaperAirplaneIcon className="h-5 w-5 mr-2 inline" />
                      Send Test
                    </button>
                    <button
                      type="button"
                      className={classNames(
                        "px-6 py-3 border-2 text-base font-semibold rounded-xl transition-all duration-200 transform hover:scale-105",
                        darkMode 
                          ? "border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500" 
                          : "border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                      )}
                      onClick={() => setShowInviteLeaveMessageModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={classNames(
                        "px-6 py-3 border-2 border-transparent text-base font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105",
                        darkMode 
                          ? "bg-orange-600 text-white hover:bg-orange-700" 
                          : "bg-orange-500 text-white hover:bg-orange-600"
                      )}
                      onClick={async () => {
                        if (!server?.settings?.server_log_channel_id) {
                          toast.error('Please select an invite tracking channel first');
                            return;
                          }
                        try {
                          setSaving(true);
                          const response = await apiService.createCustomInviteLeaveMessage(
                            serverId!,
                            server.settings.server_log_channel_id,
                            {
                              title: customInviteLeaveMessage.title,
                              description: customInviteLeaveMessage.description,
                              color: customInviteLeaveMessage.color,
                              fields: customInviteLeaveMessage.fields
                            }
                          );
                          if (response.success) {
                            toast.success('Custom invite leave tracking message created successfully!');
                            setShowInviteLeaveMessageModal(false);
                          } else {
                            toast.error(response.error || 'Failed to create invite leave message');
                          }
                        } catch (error) {
                          console.error('Error creating invite leave message:', error);
                          toast.error('Failed to create invite leave message');
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                    >
                      {saving ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Creating...
                        </div>
                      ) : (
                        '📤 Create Leave Tracking'
                      )}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Verification Message Modal */}
      <Transition appear show={showVerificationModal} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={() => setShowVerificationModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
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
                  "w-full max-w-4xl transform overflow-hidden rounded-2xl p-8 text-left align-middle shadow-2xl transition-all border",
                  darkMode ? "bg-gray-800/95 backdrop-blur-lg text-white border-gray-700" : "bg-white/95 backdrop-blur-lg text-gray-900 border-gray-200"
                )}>
                  <Dialog.Title
                    as="h3"
                    className="text-2xl font-bold leading-6 mb-6 flex items-center"
                  >
                    <span className="text-3xl mr-3">🔒</span>
                    Customize Verification Message
                  </Dialog.Title>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Form */}
                    <div className="space-y-6">
                      <p className={classNames(
                        "text-sm",
                        darkMode ? "text-gray-300" : "text-gray-600"
                      )}>
                        Customize your verification message and button design.
                      </p>
                      
                      {/* Basic Settings */}
                      <div className="space-y-5">
                      <div>
                        <label className={classNames(
                            "block text-sm font-semibold mb-3",
                          darkMode ? "text-gray-200" : "text-gray-700"
                        )}>
                            Message Title
                        </label>
                        <input
                          type="text"
                            value={customVerificationMessage.title}
                            onChange={(e) => setCustomVerificationMessage({
                              ...customVerificationMessage,
                            title: e.target.value
                          })}
                          className={classNames(
                              "w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all duration-200 text-base",
                            darkMode 
                                ? "bg-gray-700/50 text-gray-100 border-gray-600 placeholder-gray-400" 
                                : "bg-white text-gray-900 border-gray-300 placeholder-gray-500"
                          )}
                            placeholder="Enter message title..."
                        />
                      </div>

                      <div>
                        <label className={classNames(
                            "block text-sm font-semibold mb-3",
                          darkMode ? "text-gray-200" : "text-gray-700"
                        )}>
                            Message Description
                        </label>
                        <textarea
                            value={customVerificationMessage.description}
                            onChange={(e) => setCustomVerificationMessage({
                              ...customVerificationMessage,
                            description: e.target.value
                          })}
                          className={classNames(
                              "w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all duration-200 text-base resize-none",
                            darkMode 
                                ? "bg-gray-700/50 text-gray-100 border-gray-600 placeholder-gray-400" 
                                : "bg-white text-gray-900 border-gray-300 placeholder-gray-500"
                          )}
                            rows={4}
                            placeholder="Enter message description..."
                        />
                      </div>

                      <div>
                        <label className={classNames(
                            "block text-sm font-semibold mb-3",
                          darkMode ? "text-gray-200" : "text-gray-700"
                        )}>
                          Embed Color
                        </label>
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                          <input
                            type="color"
                                value={customVerificationMessage.color}
                                onChange={(e) => setCustomVerificationMessage({
                                  ...customVerificationMessage,
                              color: e.target.value
                            })}
                                className="w-16 h-12 rounded-xl border-2 border-gray-300 cursor-pointer shadow-lg"
                          />
                            </div>
                          <input
                            type="text"
                              value={customVerificationMessage.color}
                              onChange={(e) => {
                                const value = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                                if (/^#[0-9A-F]{0,6}$/i.test(value)) {
                                  setCustomVerificationMessage({
                                    ...customVerificationMessage,
                                    color: value
                                  });
                                }
                              }}
                              className={classNames(
                                "flex-1 px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all duration-200 text-base font-mono",
                                darkMode 
                                  ? "bg-gray-700/50 text-gray-100 border-gray-600" 
                                  : "bg-white text-gray-900 border-gray-300"
                              )}
                              placeholder="#22c55e"
                              maxLength={7}
                            />
                          </div>
                        </div>

                        <div>
                          <label className={classNames(
                            "block text-sm font-semibold mb-3",
                            darkMode ? "text-gray-200" : "text-gray-700"
                          )}>
                            Button Text
                          </label>
                          <input
                            type="text"
                            value={customVerificationMessage.buttonText}
                            onChange={(e) => setCustomVerificationMessage({
                              ...customVerificationMessage,
                              buttonText: e.target.value
                            })}
                            className={classNames(
                              "w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all duration-200 text-base",
                              darkMode 
                                ? "bg-gray-700/50 text-gray-100 border-gray-600 placeholder-gray-400" 
                                : "bg-white text-gray-900 border-gray-300 placeholder-gray-500"
                            )}
                            placeholder="Enter button text..."
                          />
                        </div>
                      </div>

                      {/* Custom Fields */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                        <label className={classNames(
                            "block text-sm font-semibold",
                          darkMode ? "text-gray-200" : "text-gray-700"
                        )}>
                            Custom Fields
                        </label>
                          <button
                            onClick={() => setCustomVerificationMessage({
                              ...customVerificationMessage,
                              fields: [
                                ...customVerificationMessage.fields,
                                { name: '🔹 New Field', value: 'Enter field description here...' }
                              ]
                            })}
                            className={classNames(
                              "px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 transform hover:scale-105",
                              darkMode 
                                ? "bg-green-600 text-white hover:bg-green-700 shadow-lg" 
                                : "bg-green-500 text-white hover:bg-green-600 shadow-lg"
                            )}
                          >
                            + Add Field
                          </button>
                        </div>

                        <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                          {customVerificationMessage.fields.map((field, index) => (
                            <div key={index} className={classNames(
                              "p-4 border-2 rounded-xl transition-all duration-200",
                              darkMode ? "border-gray-600 bg-gray-700/30" : "border-gray-200 bg-gray-50/50"
                            )}>
                              <div className="flex items-center justify-between mb-3">
                                <span className={classNames(
                                  "text-sm font-semibold",
                                  darkMode ? "text-gray-200" : "text-gray-700"
                                )}>
                                  Field {index + 1}
                                </span>
                                  <button
                                  onClick={() => setCustomVerificationMessage({
                                    ...customVerificationMessage,
                                    fields: customVerificationMessage.fields.filter((_, i) => i !== index)
                                  })}
                                  className="text-red-500 hover:text-red-600 text-sm font-semibold transition-colors"
                                >
                                  Remove
                                  </button>
                              </div>
                              <div className="space-y-3">
                                <input
                                  type="text"
                                  value={replacePlaceholders(field.name)}
                                  onChange={(e) => {
                                    const updatedFields = [...customVerificationMessage.fields];
                                    updatedFields[index] = { ...updatedFields[index], name: e.target.value };
                                    setCustomVerificationMessage({
                                      ...customVerificationMessage,
                                      fields: updatedFields
                                    });
                                  }}
                                  className={classNames(
                                    "w-full px-3 py-2 text-sm border-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-500/50 transition-all",
                                    darkMode 
                                      ? "bg-gray-600/50 text-gray-100 border-gray-500" 
                                      : "bg-white text-gray-900 border-gray-300"
                                  )}
                                  placeholder="Field name..."
                                />
                                <textarea
                                  value={replacePlaceholders(field.value)}
                                  onChange={(e) => {
                                    const updatedFields = [...customVerificationMessage.fields];
                                    updatedFields[index] = { ...updatedFields[index], value: e.target.value };
                                    setCustomVerificationMessage({
                                      ...customVerificationMessage,
                                      fields: updatedFields
                                    });
                                  }}
                                  className={classNames(
                                    "w-full px-3 py-2 text-sm border-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-500/50 transition-all resize-none",
                                    darkMode 
                                      ? "bg-gray-600/50 text-gray-100 border-gray-500" 
                                      : "bg-white text-gray-900 border-gray-300"
                                  )}
                                  rows={2}
                                  placeholder="Field description..."
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Preview */}
                    <div>
                      <h4 className={classNames(
                        "text-lg font-semibold mb-4",
                        darkMode ? "text-gray-200" : "text-gray-700"
                      )}>
                        Live Preview
                      </h4>
                      <div className={classNames(
                        "p-6 rounded-xl border-2 shadow-lg",
                        darkMode ? "bg-gray-800/50 border-gray-600" : "bg-white border-gray-200"
                      )}>
                        <div 
                          className="border-l-4 pl-4 py-4 rounded-r-lg"
                          style={{ 
                            borderLeftColor: customVerificationMessage.color,
                            backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.3)' : 'rgba(249, 250, 251, 0.8)'
                          }}
                        >
                        <h5 className={classNames(
                            "font-bold text-xl mb-3",
                          darkMode ? "text-white" : "text-gray-900"
                        )}>
                            {customVerificationMessage.title}
                        </h5>
                        <p className={classNames(
                            "text-sm mb-6 leading-relaxed",
                          darkMode ? "text-gray-300" : "text-gray-600"
                        )}>
                            {customVerificationMessage.description}
                          </p>
                          
                          {customVerificationMessage.fields.length > 0 && (
                            <div className="space-y-4 mb-4">
                              {customVerificationMessage.fields.map((field, index) => (
                                <div key={index} className="pb-2">
                                  <p className={classNames(
                                    "font-semibold text-sm mb-2",
                                    darkMode ? "text-gray-200" : "text-gray-700"
                                  )}>
                                    {replacePlaceholders(field.name)}
                                  </p>
                                  <p className={classNames(
                                    "text-sm leading-relaxed",
                                    darkMode ? "text-gray-300" : "text-gray-600"
                                  )}>
                                    {replacePlaceholders(field.value)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}

                          <div 
                            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold shadow-lg"
                            style={{ backgroundColor: customVerificationMessage.color, color: 'white' }}
                          >
                            🔒 {customVerificationMessage.buttonText}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end space-x-4">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!server?.settings?.verification_channel_id) {
                          toast.error('Please select a verification channel first');
                          return;
                        }
                        try {
                          setSaving(true);
                          const response = await apiService.testVerificationMessage(
                            serverId!,
                            {
                              title: customVerificationMessage.title,
                              description: customVerificationMessage.description,
                              color: customVerificationMessage.color,
                              buttonText: customVerificationMessage.buttonText,
                              fields: customVerificationMessage.fields
                            }
                          );
                          if (response.success) {
                            toast.success('Test verification message sent successfully! 🎉');
                          } else {
                            toast.error(response.error || 'Failed to send test message');
                          }
                        } catch (error) {
                          console.error('Error sending test verification message:', error);
                          toast.error('Failed to send test message');
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                      className={classNames(
                        "px-6 py-3 border-2 border-transparent text-base font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105",
                        darkMode 
                          ? "border-green-500 text-green-400 hover:bg-green-500/10 bg-gray-800" 
                          : "bg-green-500 text-white hover:bg-green-600"
                      )}
                    >
                      {saving ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Testing...
                        </div>
                      ) : (
                        '🧪 Send Test'
                      )}
                    </button>
                    <button
                      type="button"
                      className={classNames(
                        "px-6 py-3 border-2 text-base font-semibold rounded-xl transition-all duration-200 transform hover:scale-105",
                        darkMode 
                          ? "border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500" 
                          : "border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                      )}
                      onClick={() => setShowVerificationModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={classNames(
                        "px-6 py-3 border-2 border-transparent text-base font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105",
                        darkMode 
                          ? "border-green-500 text-green-400 hover:bg-green-500/10 bg-gray-800" 
                          : "border-green-500 text-green-400 hover:bg-green-500/10 bg-gray-900"
                      )}
                      onClick={async () => {
                        try {
                          setSaving(true);
                          const response = await apiService.saveVerificationConfig(
                            serverId!,
                            {
                              title: customVerificationMessage.title,
                              description: customVerificationMessage.description,
                              color: customVerificationMessage.color,
                              buttonText: customVerificationMessage.buttonText,
                              fields: customVerificationMessage.fields
                            }
                          );
                          if (response.success) {
                            toast.success('Verification configuration saved successfully! ✅');
                          } else {
                            toast.error(response.error || 'Failed to save configuration');
                          }
                        } catch (error) {
                          console.error('Error saving verification config:', error);
                          toast.error('Failed to save configuration');
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                    >
                      {saving ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </div>
                      ) : (
                        '💾 Save Configuration'
                      )}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Ticket Message Modal */}
      <Transition appear show={showTicketModal} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={() => setShowTicketModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
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
                  "w-full max-w-4xl transform overflow-hidden rounded-2xl p-8 text-left align-middle shadow-2xl transition-all border",
                  darkMode ? "bg-gray-800/95 backdrop-blur-lg text-white border-gray-700" : "bg-white/95 backdrop-blur-lg text-gray-900 border-gray-200"
                )}>
                  <Dialog.Title
                    as="h3"
                    className="text-2xl font-bold leading-6 mb-6 flex items-center"
                  >
                    <span className="text-3xl mr-3">🎫</span>
                    Customize Ticket Panel
                  </Dialog.Title>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Form */}
                    <div className="space-y-6">
                      <p className={classNames(
                        "text-sm",
                        darkMode ? "text-gray-300" : "text-gray-600"
                      )}>
                        Customize your ticket panel message and embed design.
                      </p>
                      
                      {/* Basic Settings */}
                      <div className="space-y-5">
                      <div>
                        <label className={classNames(
                            "block text-sm font-semibold mb-3",
                          darkMode ? "text-gray-200" : "text-gray-700"
                        )}>
                            Panel Title
                        </label>
                        <input
                          type="text"
                            value={customTicketMessage.title}
                            onChange={(e) => setCustomTicketMessage({
                              ...customTicketMessage,
                            title: e.target.value
                          })}
                          className={classNames(
                              "w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-base",
                            darkMode 
                                ? "bg-gray-700/50 text-gray-100 border-gray-600 placeholder-gray-400" 
                                : "bg-white text-gray-900 border-gray-300 placeholder-gray-500"
                          )}
                            placeholder="Enter panel title..."
                        />
                      </div>

                      <div>
                        <label className={classNames(
                            "block text-sm font-semibold mb-3",
                          darkMode ? "text-gray-200" : "text-gray-700"
                        )}>
                            Panel Description
                        </label>
                        <textarea
                            value={customTicketMessage.description}
                            onChange={(e) => setCustomTicketMessage({
                              ...customTicketMessage,
                            description: e.target.value
                          })}
                          className={classNames(
                              "w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-base resize-none",
                            darkMode 
                                ? "bg-gray-700/50 text-gray-100 border-gray-600 placeholder-gray-400" 
                                : "bg-white text-gray-900 border-gray-300 placeholder-gray-500"
                          )}
                            rows={4}
                            placeholder="Enter panel description..."
                        />
                      </div>

                      <div>
                        <label className={classNames(
                            "block text-sm font-semibold mb-3",
                          darkMode ? "text-gray-200" : "text-gray-700"
                        )}>
                          Embed Color
                        </label>
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                          <input
                            type="color"
                                value={customTicketMessage.color}
                                onChange={(e) => setCustomTicketMessage({
                                  ...customTicketMessage,
                              color: e.target.value
                            })}
                                className="w-16 h-12 rounded-xl border-2 border-gray-300 cursor-pointer shadow-lg"
                          />
                            </div>
                          <input
                            type="text"
                              value={customTicketMessage.color}
                              onChange={(e) => {
                                const value = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                                if (/^#[0-9A-F]{0,6}$/i.test(value)) {
                                  setCustomTicketMessage({
                                    ...customTicketMessage,
                                    color: value
                                  });
                                }
                              }}
                              className={classNames(
                                "flex-1 px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-base font-mono",
                                darkMode 
                                  ? "bg-gray-700/50 text-gray-100 border-gray-600" 
                                  : "bg-white text-gray-900 border-gray-300"
                              )}
                              placeholder="#3B82F6"
                              maxLength={7}
                            />
                          </div>
                        </div>

                        <div>
                          <label className={classNames(
                            "block text-sm font-semibold mb-3",
                            darkMode ? "text-gray-200" : "text-gray-700"
                          )}>
                            Button Text
                          </label>
                          <input
                            type="text"
                            value={customTicketMessage.buttonText}
                            onChange={(e) => setCustomTicketMessage({
                              ...customTicketMessage,
                              buttonText: e.target.value
                            })}
                            className={classNames(
                              "w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-base",
                              darkMode 
                                ? "bg-gray-700/50 text-gray-100 border-gray-600 placeholder-gray-400" 
                                : "bg-white text-gray-900 border-gray-300 placeholder-gray-500"
                            )}
                            placeholder="Enter button text..."
                          />
                        </div>
                      </div>

                      {/* Custom Fields */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                        <label className={classNames(
                            "block text-sm font-semibold",
                          darkMode ? "text-gray-200" : "text-gray-700"
                        )}>
                            Custom Fields
                        </label>
                          <button
                            onClick={() => setCustomTicketMessage({
                              ...customTicketMessage,
                              fields: [
                                ...customTicketMessage.fields,
                                { name: '🔹 New Field', value: 'Enter field description here...' }
                              ]
                            })}
                            className={classNames(
                              "px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 transform hover:scale-105",
                              darkMode 
                                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-lg" 
                                : "bg-blue-500 text-white hover:bg-blue-600 shadow-lg"
                            )}
                          >
                            + Add Field
                          </button>
                        </div>

                        <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                          {customTicketMessage.fields.map((field, index) => (
                            <div key={index} className={classNames(
                              "p-4 border-2 rounded-xl transition-all duration-200",
                              darkMode ? "border-gray-600 bg-gray-700/30" : "border-gray-200 bg-gray-50/50"
                            )}>
                              <div className="flex items-center justify-between mb-3">
                                <span className={classNames(
                                  "text-sm font-semibold",
                                  darkMode ? "text-gray-200" : "text-gray-700"
                                )}>
                                  Field {index + 1}
                                </span>
                                  <button
                                  onClick={() => setCustomTicketMessage({
                                    ...customTicketMessage,
                                    fields: customTicketMessage.fields.filter((_, i) => i !== index)
                                  })}
                                  className="text-red-500 hover:text-red-600 text-sm font-semibold transition-colors"
                                >
                                  Remove
                                  </button>
                              </div>
                              <div className="space-y-3">
                                <input
                                  type="text"
                                  value={replacePlaceholders(field.name)}
                                  onChange={(e) => {
                                    const updatedFields = [...customTicketMessage.fields];
                                    updatedFields[index] = { ...updatedFields[index], name: e.target.value };
                                    setCustomTicketMessage({
                                      ...customTicketMessage,
                                      fields: updatedFields
                                    });
                                  }}
                                  className={classNames(
                                    "w-full px-3 py-2 text-sm border-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all",
                                    darkMode 
                                      ? "bg-gray-600/50 text-gray-100 border-gray-500" 
                                      : "bg-white text-gray-900 border-gray-300"
                                  )}
                                  placeholder="Field name..."
                                />
                                <textarea
                                  value={replacePlaceholders(field.value)}
                                  onChange={(e) => {
                                    const updatedFields = [...customTicketMessage.fields];
                                    updatedFields[index] = { ...updatedFields[index], value: e.target.value };
                                    setCustomTicketMessage({
                                      ...customTicketMessage,
                                      fields: updatedFields
                                    });
                                  }}
                                  className={classNames(
                                    "w-full px-3 py-2 text-sm border-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all resize-none",
                                    darkMode 
                                      ? "bg-gray-600/50 text-gray-100 border-gray-500" 
                                      : "bg-white text-gray-900 border-gray-300"
                                  )}
                                  rows={2}
                                  placeholder="Field description..."
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Preview */}
                    <div>
                      <h4 className={classNames(
                        "text-lg font-semibold mb-4",
                        darkMode ? "text-gray-200" : "text-gray-700"
                      )}>
                        Live Preview
                      </h4>
                      <div className={classNames(
                        "p-6 rounded-xl border-2 shadow-lg",
                        darkMode ? "bg-gray-800/50 border-gray-600" : "bg-white border-gray-200"
                      )}>
                        <div 
                          className="border-l-4 pl-4 py-4 rounded-r-lg"
                          style={{ 
                            borderLeftColor: customTicketMessage.color,
                            backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.3)' : 'rgba(249, 250, 251, 0.8)'
                          }}
                        >
                        <h5 className={classNames(
                            "font-bold text-xl mb-3",
                          darkMode ? "text-white" : "text-gray-900"
                        )}>
                            {customTicketMessage.title}
                        </h5>
                        <p className={classNames(
                            "text-sm mb-4 leading-relaxed",
                          darkMode ? "text-gray-300" : "text-gray-600"
                        )}>
                            {customTicketMessage.description}
                          </p>
                          
                          {customTicketMessage.fields.length > 0 && (
                            <div className="space-y-4 mb-4">
                              {customTicketMessage.fields.map((field, index) => (
                                <div key={index} className="pb-2">
                                  <p className={classNames(
                                    "font-semibold text-sm mb-2",
                                    darkMode ? "text-gray-200" : "text-gray-700"
                                  )}>
                                    {replacePlaceholders(field.name)}
                                  </p>
                                  <p className={classNames(
                                    "text-sm leading-relaxed",
                                    darkMode ? "text-gray-300" : "text-gray-600"
                                  )}>
                                    {replacePlaceholders(field.value)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}

                          <div 
                            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold shadow-lg"
                            style={{ backgroundColor: customTicketMessage.color, color: 'white' }}
                          >
                            🎫 {customTicketMessage.buttonText}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end space-x-4">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!server?.settings?.ticket_panel_channel_id) {
                          toast.error('Please select a ticket panel channel first');
                          return;
                        }
                        try {
                          setSaving(true);
                          const response = await apiService.testTicketPanelMessage(
                            serverId!,
                            {
                              title: customTicketMessage.title,
                              description: customTicketMessage.description,
                              color: customTicketMessage.color,
                              footer: 'Made by Soggra • Support Ticket System',
                              buttonText: customTicketMessage.buttonText,
                              fields: customTicketMessage.fields
                            }
                          );
                          if (response.success) {
                            toast.success('Test ticket panel message sent successfully! 🎉');
                          } else {
                            toast.error(response.error || 'Failed to send test message');
                          }
                        } catch (error) {
                          console.error('Error sending test ticket panel message:', error);
                          toast.error('Failed to send test message');
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                      className={classNames(
                        "px-6 py-3 border-2 border-transparent text-base font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105",
                        darkMode 
                          ? "border-green-500 text-green-400 hover:bg-green-500/10 bg-gray-800" 
                          : "bg-green-500 text-white hover:bg-green-600"
                      )}
                    >
                      {saving ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Testing...
                        </div>
                      ) : (
                        '🧪 Send Test'
                      )}
                    </button>
                    <button
                      type="button"
                      className={classNames(
                        "px-6 py-3 border-2 text-base font-semibold rounded-xl transition-all duration-200 transform hover:scale-105",
                        darkMode 
                          ? "border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500" 
                          : "border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                      )}
                      onClick={() => setShowTicketModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={classNames(
                        "px-6 py-3 border-2 border-transparent text-base font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105",
                        darkMode 
                          ? "bg-blue-600 text-white hover:bg-blue-700" 
                          : "bg-blue-500 text-white hover:bg-blue-600"
                      )}
                      onClick={async () => {
                        try {
                          setSaving(true);
                          const response = await apiService.saveTicketPanelConfig(
                            serverId!,
                            {
                              title: customTicketMessage.title,
                              description: customTicketMessage.description,
                              color: customTicketMessage.color,
                              footer: 'Made by Soggra • Support Ticket System',
                              buttonText: customTicketMessage.buttonText,
                              fields: customTicketMessage.fields
                            }
                          );
                          if (response.success) {
                            toast.success('Ticket panel configuration saved successfully! ✅');
                          } else {
                            toast.error(response.error || 'Failed to save configuration');
                          }
                        } catch (error) {
                          console.error('Error saving ticket panel config:', error);
                          toast.error('Failed to save configuration');
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                    >
                      {saving ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </div>
                      ) : (
                        '💾 Save Configuration'
                      )}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Invite Join Tracking Message Modal */}
      <Transition appear show={showInviteJoinMessageModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowInviteJoinMessageModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" />
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
                  "w-full max-w-4xl transform overflow-hidden rounded-2xl p-8 text-left align-middle shadow-2xl transition-all border",
                  darkMode ? "bg-gray-800/95 backdrop-blur-lg text-white border-gray-700" : "bg-white/95 backdrop-blur-lg text-gray-900 border-gray-200"
                )}>
                  <Dialog.Title
                    as="h3"
                    className="text-2xl font-bold leading-6 mb-6 flex items-center"
                  >
                    <span className="text-3xl mr-3">📈</span>
                    Customize Join Tracking Message
                  </Dialog.Title>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Form */}
                    <div className="space-y-6">
                      <p className={classNames(
                        "text-sm",
                        darkMode ? "text-gray-300" : "text-gray-600"
                      )}>
                        Customize your invite join tracking message and embed design.
                      </p>
                      
                      {/* Basic Settings */}
                      <div className="space-y-5">
                        <div>
                          <label className={classNames(
                            "block text-sm font-semibold mb-3",
                            darkMode ? "text-gray-200" : "text-gray-700"
                          )}>
                            Message Title
                          </label>
                          <input
                            type="text"
                            value={customInviteJoinMessage.title}
                            onChange={(e) => setCustomInviteJoinMessage({
                              ...customInviteJoinMessage,
                              title: e.target.value
                            })}
                            className={classNames(
                              "w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-base",
                              darkMode 
                                ? "bg-gray-700/50 text-gray-100 border-gray-600 placeholder-gray-400" 
                                : "bg-white text-gray-900 border-gray-300 placeholder-gray-500"
                            )}
                            placeholder="Enter message title..."
                          />
                        </div>

                        <div>
                          <label className={classNames(
                            "block text-sm font-semibold mb-3",
                            darkMode ? "text-gray-200" : "text-gray-700"
                          )}>
                            Message Description
                          </label>
                          <textarea
                            value={customInviteJoinMessage.description}
                            onChange={(e) => setCustomInviteJoinMessage({
                              ...customInviteJoinMessage,
                              description: e.target.value
                            })}
                            className={classNames(
                              "w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-base resize-none",
                              darkMode 
                                ? "bg-gray-700/50 text-gray-100 border-gray-600 placeholder-gray-400" 
                                : "bg-white text-gray-900 border-gray-300 placeholder-gray-500"
                            )}
                            rows={4}
                            placeholder="Enter message description..."
                          />
                        </div>

                        <div>
                          <label className={classNames(
                            "block text-sm font-semibold mb-3",
                            darkMode ? "text-gray-200" : "text-gray-700"
                          )}>
                            Embed Color
                          </label>
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                              <input
                                type="color"
                                value={customInviteJoinMessage.color}
                                onChange={(e) => setCustomInviteJoinMessage({
                                  ...customInviteJoinMessage,
                                  color: e.target.value
                                })}
                                className="w-16 h-12 rounded-xl border-2 border-gray-300 cursor-pointer shadow-lg"
                              />
                            </div>
                            <input
                              type="text"
                              value={customInviteJoinMessage.color}
                              onChange={(e) => {
                                const value = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                                if (/^#[0-9A-F]{0,6}$/i.test(value)) {
                                  setCustomInviteJoinMessage({
                                    ...customInviteJoinMessage,
                                    color: value
                                  });
                                }
                              }}
                              className={classNames(
                                "flex-1 px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-base font-mono",
                                darkMode 
                                  ? "bg-gray-700/50 text-gray-100 border-gray-600" 
                                  : "bg-white text-gray-900 border-gray-300"
                              )}
                              placeholder="#43B581"
                              maxLength={7}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Custom Fields */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <label className={classNames(
                            "block text-sm font-semibold",
                            darkMode ? "text-gray-200" : "text-gray-700"
                          )}>
                            Custom Fields
                          </label>
                          <button
                            onClick={() => setCustomInviteJoinMessage({
                              ...customInviteJoinMessage,
                              fields: [
                                ...customInviteJoinMessage.fields,
                                { name: '🔹 New Field', value: 'Enter field description here...' }
                              ]
                            })}
                            className={classNames(
                              "px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 transform hover:scale-105",
                              darkMode 
                                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-lg" 
                                : "bg-blue-500 text-white hover:bg-blue-600 shadow-lg"
                            )}
                          >
                            + Add Field
                          </button>
                        </div>

                        <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                          {customInviteJoinMessage.fields.map((field, index) => (
                            <div key={index} className={classNames(
                              "p-4 border-2 rounded-xl transition-all duration-200",
                              darkMode ? "border-gray-600 bg-gray-700/30" : "border-gray-200 bg-gray-50/50"
                            )}>
                              <div className="flex items-center justify-between mb-3">
                                <span className={classNames(
                                  "text-sm font-semibold",
                                  darkMode ? "text-gray-200" : "text-gray-700"
                                )}>
                                  Field {index + 1}
                                </span>
                                <button
                                  onClick={() => setCustomInviteJoinMessage({
                                    ...customInviteJoinMessage,
                                    fields: customInviteJoinMessage.fields.filter((_, i) => i !== index)
                                  })}
                                  className="text-red-500 hover:text-red-600 text-sm font-semibold transition-colors"
                                >
                                  Remove
                                </button>
                              </div>
                              <div className="space-y-3">
                                <input
                                  type="text"
                                  value={replacePlaceholders(field.name)}
                                  onChange={(e) => {
                                    const updatedFields = [...customInviteJoinMessage.fields];
                                    updatedFields[index] = { ...updatedFields[index], name: e.target.value };
                                    setCustomInviteJoinMessage({
                                      ...customInviteJoinMessage,
                                      fields: updatedFields
                                    });
                                  }}
                                  className={classNames(
                                    "w-full px-3 py-2 text-sm border-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all",
                                    darkMode 
                                      ? "bg-gray-600/50 text-gray-100 border-gray-500" 
                                      : "bg-white text-gray-900 border-gray-300"
                                  )}
                                  placeholder="Field name..."
                                />
                                <textarea
                                  value={replacePlaceholders(field.value)}
                                  onChange={(e) => {
                                    const updatedFields = [...customInviteJoinMessage.fields];
                                    updatedFields[index] = { ...updatedFields[index], value: e.target.value };
                                    setCustomInviteJoinMessage({
                                      ...customInviteJoinMessage,
                                      fields: updatedFields
                                    });
                                  }}
                                  className={classNames(
                                    "w-full px-3 py-2 text-sm border-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all resize-none",
                                    darkMode 
                                      ? "bg-gray-600/50 text-gray-100 border-gray-500" 
                                      : "bg-white text-gray-900 border-gray-300"
                                  )}
                                  rows={2}
                                  placeholder="Field description..."
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Preview */}
                    <div>
                      <h4 className={classNames(
                        "text-lg font-semibold mb-4",
                        darkMode ? "text-gray-200" : "text-gray-700"
                      )}>
                        Live Preview
                      </h4>
                      <div className={classNames(
                        "p-6 rounded-xl border-2 shadow-lg",
                        darkMode ? "bg-gray-800/50 border-gray-600" : "bg-white border-gray-200"
                      )}>
                        <div 
                          className="border-l-4 pl-4 py-4 rounded-r-lg"
                          style={{ 
                            borderLeftColor: customInviteJoinMessage.color,
                            backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.3)' : 'rgba(249, 250, 251, 0.8)'
                          }}
                        >
                          <h5 className={classNames(
                            "font-bold text-xl mb-3",
                            darkMode ? "text-white" : "text-gray-900"
                          )}>
                            {replacePlaceholders(customInviteJoinMessage.title)}
                          </h5>
                          <p className={classNames(
                            "text-sm mb-4 leading-relaxed",
                            darkMode ? "text-gray-300" : "text-gray-600"
                          )}>
                            {replacePlaceholders(customInviteJoinMessage.description)}
                          </p>
                          
                          {customInviteJoinMessage.fields.length > 0 && (
                            <div className="space-y-4 mb-4">
                              {customInviteJoinMessage.fields.map((field, index) => (
                                <div key={index} className="pb-2">
                                  <p className={classNames(
                                    "font-semibold text-sm mb-2",
                                    darkMode ? "text-gray-200" : "text-gray-700"
                                  )}>
                                    {replacePlaceholders(field.name)}
                                  </p>
                                  <p className={classNames(
                                    "text-sm leading-relaxed",
                                    darkMode ? "text-gray-300" : "text-gray-600"
                                  )}>
                                    {replacePlaceholders(field.value)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end space-x-4">
                    <button
                      type="button"
                      className={classNames(
                        "px-6 py-3 border-2 text-base font-semibold rounded-xl transition-all duration-200 transform hover:scale-105",
                        darkMode 
                          ? "border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500" 
                          : "border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                      )}
                      onClick={() => setShowInviteJoinMessageModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleTestInviteJoinMessage}
                      className={classNames(
                        "px-6 py-3 border-2 border-transparent text-base font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105",
                        "border-green-500 text-green-400 hover:bg-green-500/10 bg-gray-800"
                      )}
                    >
                      <PaperAirplaneIcon className="h-5 w-5 mr-2 inline" />
                      Send Test
                    </button>
                    <button
                      type="button"
                      className={classNames(
                        "px-6 py-3 border-2 border-transparent text-base font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105",
                        darkMode 
                          ? "border-red-500 text-red-400 hover:bg-red-500/10 bg-gray-800" 
                          : "bg-red-500 text-white hover:bg-red-600"
                      )}
                      onClick={async () => {
                        try {
                          setSaving(true);
                          const response = await apiService.resetInviteJoinMessageConfig(serverId!);
                          if (response.success) {
                            toast.success('Invite join tracking configuration reset to defaults! 🔄');
                            // Reset the form to defaults
                            setCustomInviteJoinMessage({
                              title: '📈 Member Joined via Invite',
                              description: '{user} joined using {inviter}\'s invite!',
                              color: '#43b581',
                              fields: [
                                { name: '🔹 Inviter', value: '{inviter}' },
                                { name: '🔹 Invite Code', value: '{inviteCode}' },
                                { name: '🔹 Member Count', value: 'Total members: {memberCount}' }
                              ]
                            });
                          } else {
                            toast.error(response.error || 'Failed to reset configuration');
                          }
                        } catch (error) {
                          console.error('Error resetting invite join message config:', error);
                          toast.error('Failed to reset configuration');
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                    >
                      {saving ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Resetting...
                        </div>
                      ) : (
                        '🔄 Reset to Defaults'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setSaving(true);
                          
                          // Save the custom embed to member_events_config
                          const currentConfig = server?.settings?.member_events_config 
                            ? JSON.parse(server.settings.member_events_config) 
                            : {};
                          
                          await updateServerSettings({
                            member_events_config: JSON.stringify({
                              ...currentConfig,
                              custom_invite_join_embed: {
                                title: customInviteJoinMessage.title,
                                description: customInviteJoinMessage.description,
                                color: customInviteJoinMessage.color,
                                fields: customInviteJoinMessage.fields
                              }
                            })
                          });
                          
                          toast.success('Invite join tracking message saved successfully!');
                          setShowInviteJoinMessageModal(false);
                        } catch (error) {
                          console.error('Error saving invite join message:', error);
                          toast.error('Failed to save invite join tracking message');
                        } finally {
                          setSaving(false);
                        }
                      }}
                      className={classNames(
                        "px-6 py-3 border-2 border-transparent text-base font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105",
                        darkMode 
                          ? "bg-blue-600 text-white hover:bg-blue-700" 
                          : "bg-blue-500 text-white hover:bg-blue-600"
                      )}
                      disabled={saving}
                    >
                      {saving ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </div>
                      ) : (
                        '💾 Save Configuration'
                      )}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Invite Leave Tracking Message Modal */}
      <Transition appear show={showInviteLeaveMessageModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowInviteLeaveMessageModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" />
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
                  "w-full max-w-4xl transform overflow-hidden rounded-2xl p-8 text-left align-middle shadow-2xl transition-all border",
                  darkMode ? "bg-gray-800/95 backdrop-blur-lg text-white border-gray-700" : "bg-white/95 backdrop-blur-lg text-gray-900 border-gray-200"
                )}>
                  <Dialog.Title
                    as="h3"
                    className="text-2xl font-bold leading-6 mb-6 flex items-center"
                  >
                    <span className="text-3xl mr-3">📉</span>
                    Customize Leave Tracking Message
                  </Dialog.Title>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Form */}
                    <div className="space-y-6">
                      <p className={classNames(
                        "text-sm",
                        darkMode ? "text-gray-300" : "text-gray-600"
                      )}>
                        Customize your invite leave tracking message and embed design.
                      </p>
                      
                      {/* Basic Settings */}
                      <div className="space-y-5">
                        <div>
                          <label className={classNames(
                            "block text-sm font-semibold mb-3",
                            darkMode ? "text-gray-200" : "text-gray-700"
                          )}>
                            Message Title
                          </label>
                          <input
                            type="text"
                            value={replacePlaceholders(customInviteLeaveMessage.title)}
                            onChange={(e) => setCustomInviteLeaveMessage({
                              ...customInviteLeaveMessage,
                              title: e.target.value
                            })}
                            className={classNames(
                              "w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all duration-200 text-base",
                              darkMode 
                                ? "bg-gray-700/50 text-gray-100 border-gray-600 placeholder-gray-400" 
                                : "bg-white text-gray-900 border-gray-300 placeholder-gray-500"
                            )}
                            placeholder="Enter message title..."
                          />
                        </div>

                        <div>
                          <label className={classNames(
                            "block text-sm font-semibold mb-3",
                            darkMode ? "text-gray-200" : "text-gray-700"
                          )}>
                            Message Description
                          </label>
                          <textarea
                            value={replacePlaceholders(customInviteLeaveMessage.description)}
                            onChange={(e) => setCustomInviteLeaveMessage({
                              ...customInviteLeaveMessage,
                              description: e.target.value
                            })}
                            className={classNames(
                              "w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all duration-200 text-base resize-none",
                              darkMode 
                                ? "bg-gray-700/50 text-gray-100 border-gray-600 placeholder-gray-400" 
                                : "bg-white text-gray-900 border-gray-300 placeholder-gray-500"
                            )}
                            rows={4}
                            placeholder="Enter message description..."
                          />
                        </div>

                        <div>
                          <label className={classNames(
                            "block text-sm font-semibold mb-3",
                            darkMode ? "text-gray-200" : "text-gray-700"
                          )}>
                            Embed Color
                          </label>
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                              <input
                                type="color"
                                value={customInviteLeaveMessage.color}
                                onChange={(e) => setCustomInviteLeaveMessage({
                                  ...customInviteLeaveMessage,
                                  color: e.target.value
                                })}
                                className="w-16 h-12 rounded-xl border-2 border-gray-300 cursor-pointer shadow-lg"
                              />
                            </div>
                            <input
                              type="text"
                              value={customInviteLeaveMessage.color}
                              onChange={(e) => {
                                const value = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                                if (/^#[0-9A-F]{0,6}$/i.test(value)) {
                                  setCustomInviteLeaveMessage({
                                    ...customInviteLeaveMessage,
                                    color: value
                                  });
                                }
                              }}
                              className={classNames(
                                "flex-1 px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all duration-200 text-base font-mono",
                                darkMode 
                                  ? "bg-gray-700/50 text-gray-100 border-gray-600" 
                                  : "bg-white text-gray-900 border-gray-300"
                              )}
                              placeholder="#F97316"
                              maxLength={7}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Custom Fields */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <label className={classNames(
                            "block text-sm font-semibold",
                            darkMode ? "text-gray-200" : "text-gray-700"
                          )}>
                            Custom Fields
                          </label>
                          <button
                            onClick={() => setCustomInviteLeaveMessage({
                              ...customInviteLeaveMessage,
                              fields: [
                                ...customInviteLeaveMessage.fields,
                                { name: '🔹 New Field', value: 'Enter field description here...' }
                              ]
                            })}
                            className={classNames(
                              "px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 transform hover:scale-105",
                              darkMode 
                                ? "bg-orange-600 text-white hover:bg-orange-700 shadow-lg" 
                                : "bg-orange-500 text-white hover:bg-orange-600 shadow-lg"
                            )}
                          >
                            + Add Field
                          </button>
                        </div>

                        <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                          {customInviteLeaveMessage.fields.map((field, index) => (
                            <div key={index} className={classNames(
                              "p-4 border-2 rounded-xl transition-all duration-200",
                              darkMode ? "border-gray-600 bg-gray-700/30" : "border-gray-200 bg-gray-50/50"
                            )}>
                              <div className="flex items-center justify-between mb-3">
                                <span className={classNames(
                                  "text-sm font-semibold",
                                  darkMode ? "text-gray-200" : "text-gray-700"
                                )}>
                                  Field {index + 1}
                                </span>
                                <button
                                  onClick={() => setCustomInviteLeaveMessage({
                                    ...customInviteLeaveMessage,
                                    fields: customInviteLeaveMessage.fields.filter((_, i) => i !== index)
                                  })}
                                  className="text-red-500 hover:text-red-600 text-sm font-semibold transition-colors"
                                >
                                  Remove
                                </button>
                              </div>
                              <div className="space-y-3">
                                <input
                                  type="text"
                                  value={replacePlaceholders(field.name)}
                                  onChange={(e) => {
                                    const updatedFields = [...customInviteLeaveMessage.fields];
                                    updatedFields[index] = { ...updatedFields[index], name: e.target.value };
                                    setCustomInviteLeaveMessage({
                                      ...customInviteLeaveMessage,
                                      fields: updatedFields
                                    });
                                  }}
                                  className={classNames(
                                    "w-full px-3 py-2 text-sm border-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all",
                                    darkMode 
                                      ? "bg-gray-600/50 text-gray-100 border-gray-500" 
                                      : "bg-white text-gray-900 border-gray-300"
                                  )}
                                  placeholder="Field name..."
                                />
                                <textarea
                                  value={replacePlaceholders(field.value)}
                                  onChange={(e) => {
                                    const updatedFields = [...customInviteLeaveMessage.fields];
                                    updatedFields[index] = { ...updatedFields[index], value: e.target.value };
                                    setCustomInviteLeaveMessage({
                                      ...customInviteLeaveMessage,
                                      fields: updatedFields
                                    });
                                  }}
                                  className={classNames(
                                    "w-full px-3 py-2 text-sm border-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all resize-none",
                                    darkMode 
                                      ? "bg-gray-600/50 text-gray-100 border-gray-500" 
                                      : "bg-white text-gray-900 border-gray-300"
                                  )}
                                  rows={2}
                                  placeholder="Field description..."
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Preview */}
                    <div>
                      <h4 className={classNames(
                        "text-lg font-semibold mb-4",
                        darkMode ? "text-gray-200" : "text-gray-700"
                      )}>
                        Live Preview
                      </h4>
                      <div className={classNames(
                        "p-6 rounded-xl border-2 shadow-lg",
                        darkMode ? "bg-gray-800/50 border-gray-600" : "bg-white border-gray-200"
                      )}>
                        <div 
                          className="border-l-4 pl-4 py-4 rounded-r-lg"
                          style={{ 
                            borderLeftColor: customInviteLeaveMessage.color,
                            backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.3)' : 'rgba(249, 250, 251, 0.8)'
                          }}
                        >
                          <h5 className={classNames(
                            "font-bold text-xl mb-3",
                            darkMode ? "text-white" : "text-gray-900"
                          )}>
                            {replacePlaceholders(customInviteLeaveMessage.title)}
                          </h5>
                          <p className={classNames(
                            "text-sm mb-4 leading-relaxed",
                            darkMode ? "text-gray-300" : "text-gray-600"
                          )}>
                            {replacePlaceholders(customInviteLeaveMessage.description)}
                          </p>
                          
                          {customInviteLeaveMessage.fields.length > 0 && (
                            <div className="space-y-4 mb-4">
                              {customInviteLeaveMessage.fields.map((field, index) => (
                                <div key={index} className="pb-2">
                                  <p className={classNames(
                                    "font-semibold text-sm mb-2",
                                    darkMode ? "text-gray-200" : "text-gray-700"
                                  )}>
                                    {replacePlaceholders(field.name)}
                                  </p>
                                  <p className={classNames(
                                    "text-xs",
                                    darkMode ? "text-gray-400" : "text-gray-600"
                                  )}>
                                    {replacePlaceholders(field.value)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end space-x-4">
                    <button
                      type="button"
                      className={classNames(
                        "px-6 py-3 border-2 text-base font-semibold rounded-xl transition-all duration-200 transform hover:scale-105",
                        darkMode 
                          ? "border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500" 
                          : "border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                      )}
                      onClick={() => setShowInviteLeaveMessageModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleTestInviteLeaveMessage}
                      className={classNames(
                        "px-6 py-3 border-2 border-transparent text-base font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105",
                        "border-green-500 text-green-400 hover:bg-green-500/10 bg-gray-800"
                      )}
                    >
                      <PaperAirplaneIcon className="h-5 w-5 mr-2 inline" />
                      Send Test
                    </button>
                    <button
                      type="button"
                      className={classNames(
                        "px-6 py-3 border-2 border-transparent text-base font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105",
                        darkMode 
                          ? "border-red-500 text-red-400 hover:bg-red-500/10 bg-gray-800" 
                          : "bg-red-500 text-white hover:bg-red-600"
                      )}
                      onClick={async () => {
                        try {
                          setSaving(true);
                          const response = await apiService.resetInviteLeaveMessageConfig(serverId!);
                          if (response.success) {
                            toast.success('Invite leave tracking configuration reset to defaults! 🔄');
                            // Reset the form to defaults
                            setCustomInviteLeaveMessage({
                              title: '📉 Member Left',
                              description: '{user} left the server.',
                              color: '#e74c3c',
                              fields: [
                                { name: '🔹 Total Members', value: '{memberCount}' },
                                { name: '🔹 Account Age', value: '{accountAge}' },
                                { name: '🔹 Time in Server', value: '{timeInServer}' }
                              ]
                            });
                          } else {
                            toast.error(response.error || 'Failed to reset configuration');
                          }
                        } catch (error) {
                          console.error('Error resetting invite leave message config:', error);
                          toast.error('Failed to reset configuration');
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                    >
                      {saving ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Resetting...
                        </div>
                      ) : (
                        '🔄 Reset to Defaults'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setSaving(true);
                          
                          // Save the custom embed to member_events_config
                          const currentConfig = server?.settings?.member_events_config 
                            ? JSON.parse(server.settings.member_events_config) 
                            : {};
                          
                          await updateServerSettings({
                            member_events_config: JSON.stringify({
                              ...currentConfig,
                              custom_invite_leave_embed: {
                                title: customInviteLeaveMessage.title,
                                description: customInviteLeaveMessage.description,
                                color: customInviteLeaveMessage.color,
                                fields: customInviteLeaveMessage.fields
                              }
                            })
                          });
                          
                          toast.success('Invite leave tracking message saved successfully!');
                          setShowInviteLeaveMessageModal(false);
                        } catch (error) {
                          console.error('Error saving invite leave message:', error);
                          toast.error('Failed to save invite leave tracking message');
                        } finally {
                          setSaving(false);
                        }
                      }}
                      className={classNames(
                        "px-6 py-3 border-2 border-transparent text-base font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105",
                        darkMode 
                          ? "bg-orange-600 text-white hover:bg-orange-700" 
                          : "bg-orange-500 text-white hover:bg-orange-600"
                      )}
                      disabled={saving}
                    >
                      {saving ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </div>
                      ) : (
                        '💾 Save Configuration'
                      )}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default ServerDetail;
