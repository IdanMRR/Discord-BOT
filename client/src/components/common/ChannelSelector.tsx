import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface ChannelSelectorProps {
  value?: string;
  onChange: (channelId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  serverId: string;
}

const ChannelSelector: React.FC<ChannelSelectorProps> = ({ 
  value, 
  onChange, 
  disabled = false, 
  placeholder = "-- Select Channel --",
  serverId 
}) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadChannels = async () => {
      if (!serverId) return;
      
      try {
        const response = await apiService.getServerChannels(serverId);
        if (response.success && response.data) {
          // Filter for text channels only (type 0)
          const textChannels = response.data.filter((channel: Channel) => channel.type === 0);
          setChannels(textChannels);
        }
      } catch (error) {
        console.error('Failed to load channels:', error);
      } finally {
        setLoading(false);
      }
    };

    loadChannels();
  }, [serverId]);

  if (loading) {
    return (
      <select 
        disabled 
        className="w-full px-3 py-2 rounded-lg border transition-colors bg-background border-border text-foreground opacity-50"
      >
        <option>Loading channels...</option>
      </select>
    );
  }

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={classNames(
        "w-full px-3 py-2 rounded-lg border transition-colors bg-background border-border text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
        disabled ? "opacity-50 cursor-not-allowed" : ""
      )}
    >
      <option value="">{placeholder}</option>
      {channels.map((channel) => (
        <option key={channel.id} value={channel.id}>
          #{channel.name}
        </option>
      ))}
    </select>
  );
};

export default ChannelSelector;