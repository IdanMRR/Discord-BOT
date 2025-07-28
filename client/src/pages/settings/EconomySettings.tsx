import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import PermissionGuard from '../../components/common/PermissionGuard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  StarIcon,
  CurrencyDollarIcon,
  ShoppingCartIcon,
  GiftIcon,
  ChartBarIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

// Utility function for conditional class names
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

// Default settings helper
const getDefaultSettings = (serverId: string): EconomySettingsData => ({
  guild_id: serverId,
  enabled: false,
  currency_name: 'coins',
  currency_symbol: '🪙',
  starting_balance: 100,
  message_reward_min: 1,
  message_reward_max: 5,
  message_cooldown: 60,
  voice_reward_rate: 2,
  daily_reward: 100,
  weekly_reward: 500,
  shop_enabled: true,
  shop_items: '[]',
  role_shop_enabled: false,
  gambling_enabled: false,
  gambling_min_bet: 1,
  gambling_max_bet: 1000,
  gambling_games: '[]',
  interest_rate: 0,
  tax_rate: 0,
  transfer_enabled: true,
  leaderboard_enabled: true
});

interface EconomySettingsData {
  guild_id: string;
  enabled?: boolean;
  currency_name?: string;
  currency_symbol?: string;
  starting_balance?: number;
  message_reward_min?: number;
  message_reward_max?: number;
  message_cooldown?: number;
  voice_reward_rate?: number;
  daily_reward?: number;
  weekly_reward?: number;
  shop_enabled?: boolean;
  shop_items?: string;
  role_shop_enabled?: boolean;
  gambling_enabled?: boolean;
  gambling_min_bet?: number;
  gambling_max_bet?: number;
  gambling_games?: string;
  interest_rate?: number;
  tax_rate?: number;
  transfer_enabled?: boolean;
  leaderboard_enabled?: boolean;
}

interface ServerInfo {
  id: string;
  name: string;
  memberCount: number;
  icon?: string;
}

interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  type: 'role' | 'item' | 'custom';
  roleId?: string;
  stock?: number;
  enabled: boolean;
}

const EconomySettingsContent: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [settings, setSettings] = useState<EconomySettingsData | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<EconomySettingsData | null>(null);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);

  // Available gambling games
  const gamblingGames = [
    { id: 'coinflip', name: 'Coin Flip', description: 'Double or nothing coin flip' },
    { id: 'dice', name: 'Dice Roll', description: 'Roll dice for different multipliers' },
    { id: 'slots', name: 'Slot Machine', description: 'Classic slot machine game' },
    { id: 'blackjack', name: 'Blackjack', description: 'Card game against the house' },
    { id: 'roulette', name: 'Roulette', description: 'Spin the wheel of fortune' }
  ];

  // Load data
  useEffect(() => {
    if (!serverId) return;

    const loadData = async () => {
      try {
        setLoading(true);

        // Load server info and settings
        const [serverResponse, settingsResponse] = await Promise.all([
          apiService.getServerInfo(serverId),
          fetch(`/api/settings/${serverId}/economy`)
        ]);

        if (serverResponse.success && serverResponse.data) {
          setServerInfo(serverResponse.data);
        }

        if (settingsResponse.ok) {
          const settingsData = await settingsResponse.json();
          if (settingsData.success && settingsData.data) {
            const loadedSettings = settingsData.data;
            setSettings(loadedSettings);
            setOriginalSettings(JSON.parse(JSON.stringify(loadedSettings)));
            
            // Parse shop items
            try {
              const items = JSON.parse(loadedSettings.shop_items || '[]');
              setShopItems(items);
            } catch {
              setShopItems([]);
            }
          } else {
            const defaultSettings = getDefaultSettings(serverId!);
            setSettings(defaultSettings);
            setOriginalSettings(JSON.parse(JSON.stringify(defaultSettings)));
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Failed to load settings');
        const defaultSettings = getDefaultSettings(serverId!);
        setSettings(defaultSettings);
        setOriginalSettings(JSON.parse(JSON.stringify(defaultSettings)));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [serverId]);

  // Check for changes
  useEffect(() => {
    if (!settings || !originalSettings) return;
    
    const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    setHasChanges(changed);
  }, [settings, originalSettings]);


  const updateSetting = (key: keyof EconomySettingsData, value: any) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      [key]: value
    });
  };

  const isGamblingGameEnabled = (gameId: string): boolean => {
    if (!settings?.gambling_games) return false;
    
    try {
      const enabledGames = JSON.parse(settings.gambling_games);
      return enabledGames.includes(gameId);
    } catch {
      return false;
    }
  };

  const toggleGamblingGame = (gameId: string) => {
    if (!settings) return;
    
    try {
      const enabledGames = JSON.parse(settings.gambling_games || '[]');
      const isEnabled = enabledGames.includes(gameId);
      
      const updatedGames = isEnabled
        ? enabledGames.filter((id: string) => id !== gameId)
        : [...enabledGames, gameId];
      
      updateSetting('gambling_games', JSON.stringify(updatedGames));
    } catch (error) {
      console.error('Error toggling gambling game:', error);
    }
  };

  const addShopItem = (item: Omit<ShopItem, 'id'>) => {
    const newItem: ShopItem = {
      ...item,
      id: Date.now().toString()
    };
    
    const updatedItems = [...shopItems, newItem];
    setShopItems(updatedItems);
    updateSetting('shop_items', JSON.stringify(updatedItems));
    setShowAddItem(false);
    toast.success('Shop item added');
  };

  const updateShopItem = (updatedItem: ShopItem) => {
    const updatedItems = shopItems.map(item => 
      item.id === updatedItem.id ? updatedItem : item
    );
    setShopItems(updatedItems);
    updateSetting('shop_items', JSON.stringify(updatedItems));
    setEditingItem(null);
    toast.success('Shop item updated');
  };

  const removeShopItem = (itemId: string) => {
    const updatedItems = shopItems.filter(item => item.id !== itemId);
    setShopItems(updatedItems);
    updateSetting('shop_items', JSON.stringify(updatedItems));
    toast.success('Shop item removed');
  };

  const handleSave = async () => {
    if (!settings || !serverId) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/settings/${serverId}/economy`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_API_KEY}`
        },
        body: JSON.stringify(settings)
      });

      const result = await response.json();

      if (result.success) {
        setOriginalSettings(JSON.parse(JSON.stringify(settings)));
        setHasChanges(false);
        toast.success('Economy settings saved successfully!');
      } else {
        toast.error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!originalSettings) return;
    setSettings(JSON.parse(JSON.stringify(originalSettings)));
    
    // Reset shop items
    try {
      const items = JSON.parse(originalSettings.shop_items || '[]');
      setShopItems(items);
    } catch {
      setShopItems([]);
    }
    
    toast.success('Settings reset to last saved state');
  };

  const ToggleSwitch: React.FC<{
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
  }> = ({ checked, onChange, disabled = false }) => (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={classNames(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2",
        checked ? "bg-yellow-600" : (darkMode ? "bg-gray-600" : "bg-gray-300"),
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        darkMode ? "focus:ring-offset-gray-800" : "focus:ring-offset-white"
      )}
    >
      <span
        className={classNames(
          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );

  const ShopItemForm: React.FC<{
    item?: ShopItem;
    onSave: (item: any) => void;
    onCancel: () => void;
  }> = ({ item, onSave, onCancel }) => {
    const [formData, setFormData] = useState<Partial<ShopItem>>(
      item || { name: '', description: '', price: 0, type: 'item', enabled: true }
    );

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name || !formData.price) {
        toast.error('Please fill in all required fields');
        return;
      }
      onSave(formData as any);
    };

    return (
      <div className={classNames(
        "p-4 rounded-lg border-2",
        darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-300"
      )}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Item Name *</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Premium Role"
                className={classNames(
                  "w-full px-3 py-2 rounded border",
                  darkMode ? "bg-gray-600 border-gray-500 text-white" : "bg-white border-gray-300"
                )}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Price *</label>
              <input
                type="number"
                min="1"
                value={formData.price || ''}
                onChange={(e) => setFormData({...formData, price: parseInt(e.target.value)})}
                placeholder="100"
                className={classNames(
                  "w-full px-3 py-2 rounded border",
                  darkMode ? "bg-gray-600 border-gray-500 text-white" : "bg-white border-gray-300"
                )}
                required
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="A special role with unique privileges"
              rows={2}
              className={classNames(
                "w-full px-3 py-2 rounded border",
                darkMode ? "bg-gray-600 border-gray-500 text-white" : "bg-white border-gray-300"
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                value={formData.type || 'item'}
                onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                className={classNames(
                  "w-full px-3 py-2 rounded border",
                  darkMode ? "bg-gray-600 border-gray-500 text-white" : "bg-white border-gray-300"
                )}
              >
                <option value="item">Virtual Item</option>
                <option value="role">Discord Role</option>
                <option value="custom">Custom Reward</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Stock (optional)</label>
              <input
                type="number"
                min="0"
                value={formData.stock || ''}
                onChange={(e) => setFormData({...formData, stock: parseInt(e.target.value) || undefined})}
                placeholder="Unlimited"
                className={classNames(
                  "w-full px-3 py-2 rounded border",
                  darkMode ? "bg-gray-600 border-gray-500 text-white" : "bg-white border-gray-300"
                )}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.enabled || false}
                onChange={(e) => setFormData({...formData, enabled: e.target.checked})}
                className="h-4 w-4 text-yellow-600 rounded"
              />
              <span className="text-sm font-medium">Item Enabled</span>
            </label>
            
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
              >
                {item ? 'Update' : 'Add'} Item
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!settings) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className={classNames(
          "text-center p-8 rounded-lg border",
          darkMode ? "bg-gray-800 border-gray-700 text-gray-300" : "bg-white border-gray-200 text-gray-600"
        )}>
          <StarIcon className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
          <h3 className="text-lg font-semibold mb-2">Failed to Load Settings</h3>
          <p>Unable to load economy settings. Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={() => navigate(`/servers/${serverId}/settings/advanced`)}
            className={classNames(
              "p-2 rounded-lg transition-colors",
              darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
            )}
          >
            <ArrowLeftIcon className="h-6 w-6" />
          </button>
          
          <div className={classNames(
            "p-3 rounded-lg",
            darkMode ? "bg-yellow-900/20" : "bg-yellow-100"
          )}>
            <StarIcon className={classNames(
              "h-8 w-8",
              darkMode ? "text-yellow-400" : "text-yellow-600"
            )} />
          </div>
          
          <div>
            <h1 className={classNames(
              "text-4xl font-bold",
              darkMode ? "text-white" : "text-gray-900"
            )}>
              Economy System
            </h1>
            {serverInfo && (
              <p className={classNames(
                "text-lg font-medium mt-2",
                darkMode ? "text-gray-400" : "text-gray-600"
              )}>
                {serverInfo.name} • Virtual Currency & Rewards
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Master Enable/Disable */}
        <div className={classNames(
          "rounded-lg border p-6",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <CurrencyDollarIcon className="h-6 w-6 mr-3 text-yellow-500" />
              <div>
                <h2 className={classNames(
                  "text-2xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Economy System
                </h2>
                <p className={classNames(
                  "text-sm mt-1",
                  darkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Enable virtual currency and economic features for your server
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.enabled || false}
              onChange={(checked) => updateSetting('enabled', checked)}
            />
          </div>

          {settings.enabled && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={classNames(
                    "block text-sm font-medium mb-2",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    Currency Name
                  </label>
                  <input
                    type="text"
                    value={settings.currency_name || ''}
                    onChange={(e) => updateSetting('currency_name', e.target.value)}
                    placeholder="coins"
                    className={classNames(
                      "w-full px-3 py-2 rounded-lg border transition-colors",
                      darkMode 
                        ? "bg-gray-700 border-gray-600 text-white" 
                        : "bg-white border-gray-300 text-gray-900"
                    )}
                  />
                </div>

                <div>
                  <label className={classNames(
                    "block text-sm font-medium mb-2",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    Currency Symbol
                  </label>
                  <input
                    type="text"
                    value={settings.currency_symbol || ''}
                    onChange={(e) => updateSetting('currency_symbol', e.target.value)}
                    placeholder="🪙"
                    maxLength={5}
                    className={classNames(
                      "w-full px-3 py-2 rounded-lg border transition-colors",
                      darkMode 
                        ? "bg-gray-700 border-gray-600 text-white" 
                        : "bg-white border-gray-300 text-gray-900"
                    )}
                  />
                </div>

                <div>
                  <label className={classNames(
                    "block text-sm font-medium mb-2",
                    darkMode ? "text-gray-300" : "text-gray-700"
                  )}>
                    Starting Balance
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={settings.starting_balance || 0}
                    onChange={(e) => updateSetting('starting_balance', parseInt(e.target.value))}
                    className={classNames(
                      "w-full px-3 py-2 rounded-lg border transition-colors",
                      darkMode 
                        ? "bg-gray-700 border-gray-600 text-white" 
                        : "bg-white border-gray-300 text-gray-900"
                    )}
                  />
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <ToggleSwitch
                      checked={settings.transfer_enabled || false}
                      onChange={(checked) => updateSetting('transfer_enabled', checked)}
                    />
                    <span className={classNames(
                      "text-sm font-medium",
                      darkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                      User Transfers
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <ToggleSwitch
                      checked={settings.leaderboard_enabled || false}
                      onChange={(checked) => updateSetting('leaderboard_enabled', checked)}
                    />
                    <span className={classNames(
                      "text-sm font-medium",
                      darkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                      Leaderboard
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {settings.enabled && (
          <>
            {/* Earning Settings */}
            <div className={classNames(
              "rounded-lg border p-6",
              darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className="flex items-center mb-6">
                <ChartBarIcon className="h-6 w-6 mr-3 text-blue-500" />
                <h3 className={classNames(
                  "text-xl font-bold",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  Earning Settings
                </h3>
              </div>

              <div className="space-y-6">
                {/* Message Rewards */}
                <div>
                  <h4 className={classNames(
                    "text-lg font-semibold mb-4",
                    darkMode ? "text-white" : "text-gray-900"
                  )}>
                    Message Rewards
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Min Reward</label>
                      <input
                        type="number"
                        min="0"
                        value={settings.message_reward_min || 0}
                        onChange={(e) => updateSetting('message_reward_min', parseInt(e.target.value))}
                        className={classNames(
                          "w-full px-3 py-2 rounded border",
                          darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Max Reward</label>
                      <input
                        type="number"
                        min="1"
                        value={settings.message_reward_max || 0}
                        onChange={(e) => updateSetting('message_reward_max', parseInt(e.target.value))}
                        className={classNames(
                          "w-full px-3 py-2 rounded border",
                          darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Cooldown (seconds)</label>
                      <input
                        type="number"
                        min="0"
                        value={settings.message_cooldown || 0}
                        onChange={(e) => updateSetting('message_cooldown', parseInt(e.target.value))}
                        className={classNames(
                          "w-full px-3 py-2 rounded border",
                          darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* Voice & Time Rewards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Voice Reward Rate</label>
                    <input
                      type="number"
                      min="0"
                      value={settings.voice_reward_rate || 0}
                      onChange={(e) => updateSetting('voice_reward_rate', parseInt(e.target.value))}
                      className={classNames(
                        "w-full px-3 py-2 rounded border",
                        darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                      )}
                    />
                    <p className="text-xs text-gray-500 mt-1">Per minute in voice channels</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Daily Reward</label>
                    <input
                      type="number"
                      min="0"
                      value={settings.daily_reward || 0}
                      onChange={(e) => updateSetting('daily_reward', parseInt(e.target.value))}
                      className={classNames(
                        "w-full px-3 py-2 rounded border",
                        darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                      )}
                    />
                    <p className="text-xs text-gray-500 mt-1">Once per day</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Weekly Reward</label>
                    <input
                      type="number"
                      min="0"
                      value={settings.weekly_reward || 0}
                      onChange={(e) => updateSetting('weekly_reward', parseInt(e.target.value))}
                      className={classNames(
                        "w-full px-3 py-2 rounded border",
                        darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                      )}
                    />
                    <p className="text-xs text-gray-500 mt-1">Once per week</p>
                  </div>
                </div>

                {/* Advanced Economy */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Interest Rate (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={settings.interest_rate || 0}
                      onChange={(e) => updateSetting('interest_rate', parseFloat(e.target.value))}
                      className={classNames(
                        "w-full px-3 py-2 rounded border",
                        darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                      )}
                    />
                    <p className="text-xs text-gray-500 mt-1">Daily interest on bank balances</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Tax Rate (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={settings.tax_rate || 0}
                      onChange={(e) => updateSetting('tax_rate', parseFloat(e.target.value))}
                      className={classNames(
                        "w-full px-3 py-2 rounded border",
                        darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                      )}
                    />
                    <p className="text-xs text-gray-500 mt-1">Tax on all transactions</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Shop System */}
            <div className={classNames(
              "rounded-lg border p-6",
              darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <ShoppingCartIcon className="h-6 w-6 mr-3 text-green-500" />
                  <div>
                    <h3 className={classNames(
                      "text-xl font-bold",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>
                      Shop System
                    </h3>
                    <p className={classNames(
                      "text-sm mt-1",
                      darkMode ? "text-gray-400" : "text-gray-600"
                    )}>
                      Let users purchase items and roles with currency
                    </p>
                  </div>
                </div>
                <ToggleSwitch
                  checked={settings.shop_enabled || false}
                  onChange={(checked) => updateSetting('shop_enabled', checked)}
                />
              </div>

              {settings.shop_enabled && (
                <div className="space-y-6">
                  {/* Add Item Button */}
                  {!showAddItem && (
                    <button
                      onClick={() => setShowAddItem(true)}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                    >
                      <PlusIcon className="h-4 w-4" />
                      <span>Add Shop Item</span>
                    </button>
                  )}

                  {/* Add Item Form */}
                  {showAddItem && (
                    <ShopItemForm
                      onSave={addShopItem}
                      onCancel={() => setShowAddItem(false)}
                    />
                  )}

                  {/* Edit Item Form */}
                  {editingItem && (
                    <ShopItemForm
                      item={editingItem}
                      onSave={updateShopItem}
                      onCancel={() => setEditingItem(null)}
                    />
                  )}

                  {/* Shop Items List */}
                  {shopItems.length > 0 && (
                    <div>
                      <h4 className={classNames(
                        "text-lg font-semibold mb-4",
                        darkMode ? "text-white" : "text-gray-900"
                      )}>
                        Shop Items ({shopItems.length})
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {shopItems.map((item) => (
                          <div
                            key={item.id}
                            className={classNames(
                              "p-4 rounded-lg border-2 transition-all",
                              item.enabled
                                ? darkMode
                                  ? "bg-gray-700 border-gray-600"
                                  : "bg-white border-gray-300"
                                : darkMode
                                  ? "bg-gray-800 border-gray-700 opacity-60"
                                  : "bg-gray-100 border-gray-200 opacity-60"
                            )}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h5 className={classNames(
                                "font-semibold",
                                darkMode ? "text-white" : "text-gray-900"
                              )}>
                                {item.name}
                              </h5>
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => setEditingItem(item)}
                                  className="p-1 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded"
                                >
                                  <PencilIcon className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => removeShopItem(item.id)}
                                  className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            
                            <p className={classNames(
                              "text-sm mb-3",
                              darkMode ? "text-gray-400" : "text-gray-600"
                            )}>
                              {item.description || 'No description'}
                            </p>
                            
                            <div className="flex items-center justify-between">
                              <span className={classNames(
                                "text-lg font-bold",
                                darkMode ? "text-yellow-400" : "text-yellow-600"
                              )}>
                                {settings.currency_symbol} {item.price}
                              </span>
                              
                              <div className="flex items-center space-x-2">
                                <span className={classNames(
                                  "text-xs px-2 py-1 rounded-full",
                                  item.type === 'role' 
                                    ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
                                    : item.type === 'item'
                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                                    : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                                )}>
                                  {item.type}
                                </span>
                                
                                {item.stock && (
                                  <span className={classNames(
                                    "text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                                  )}>
                                    {item.stock} left
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Gambling System */}
            <div className={classNames(
              "rounded-lg border p-6",
              darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <GiftIcon className="h-6 w-6 mr-3 text-purple-500" />
                  <div>
                    <h3 className={classNames(
                      "text-xl font-bold",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>
                      Gambling System
                    </h3>
                    <p className={classNames(
                      "text-sm mt-1",
                      darkMode ? "text-gray-400" : "text-gray-600"
                    )}>
                      Risk and reward games for your server
                    </p>
                  </div>
                </div>
                <ToggleSwitch
                  checked={settings.gambling_enabled || false}
                  onChange={(checked) => updateSetting('gambling_enabled', checked)}
                />
              </div>

              {settings.gambling_enabled && (
                <div className="space-y-6">
                  {/* Betting Limits */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Minimum Bet</label>
                      <input
                        type="number"
                        min="1"
                        value={settings.gambling_min_bet || 1}
                        onChange={(e) => updateSetting('gambling_min_bet', parseInt(e.target.value))}
                        className={classNames(
                          "w-full px-3 py-2 rounded border",
                          darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                        )}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Maximum Bet</label>
                      <input
                        type="number"
                        min="1"
                        value={settings.gambling_max_bet || 1000}
                        onChange={(e) => updateSetting('gambling_max_bet', parseInt(e.target.value))}
                        className={classNames(
                          "w-full px-3 py-2 rounded border",
                          darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                        )}
                      />
                    </div>
                  </div>

                  {/* Available Games */}
                  <div>
                    <h4 className={classNames(
                      "text-lg font-semibold mb-4",
                      darkMode ? "text-white" : "text-gray-900"
                    )}>
                      Available Games
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {gamblingGames.map((game) => (
                        <div
                          key={game.id}
                          className={classNames(
                            "p-4 rounded-lg border-2 cursor-pointer transition-all",
                            isGamblingGameEnabled(game.id)
                              ? darkMode
                                ? "bg-purple-900/20 border-purple-500"
                                : "bg-purple-50 border-purple-500"
                              : darkMode
                                ? "bg-gray-700 border-gray-600 hover:border-gray-500"
                                : "bg-white border-gray-300 hover:border-gray-400"
                          )}
                          onClick={() => toggleGamblingGame(game.id)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h5 className={classNames(
                              "font-semibold",
                              darkMode ? "text-white" : "text-gray-900"
                            )}>
                              {game.name}
                            </h5>
                            {isGamblingGameEnabled(game.id) && (
                              <CheckIcon className="h-5 w-5 text-purple-500" />
                            )}
                          </div>
                          <p className={classNames(
                            "text-sm",
                            darkMode ? "text-gray-400" : "text-gray-600"
                          )}>
                            {game.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-6">
          <button
            onClick={handleReset}
            disabled={!hasChanges}
            className={classNames(
              "px-6 py-2 rounded-lg border-2 transition-all",
              hasChanges
                ? darkMode
                  ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                  : "border-gray-300 text-gray-700 hover:bg-gray-100"
                : "border-gray-400 text-gray-400 cursor-not-allowed"
            )}
          >
            Reset Changes
          </button>
          
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={classNames(
              "px-8 py-2 rounded-lg font-medium transition-all flex items-center space-x-2",
              hasChanges && !saving
                ? "bg-yellow-500 text-white hover:bg-yellow-600"
                : darkMode
                  ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
            )}
          >
            {saving && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            <span>{saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const EconomySettings: React.FC = () => {
  return (
    <PermissionGuard 
      requiredPermission={['admin', 'system_admin', 'manage_servers']}
      fallbackMessage="You need administrator privileges to access economy settings."
    >
      <EconomySettingsContent />
    </PermissionGuard>
  );
};

export default EconomySettings;