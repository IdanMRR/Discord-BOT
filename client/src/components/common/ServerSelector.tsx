import React, { useState, useEffect } from 'react';
import { Server } from '../../types';
import { apiService } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  ServerIcon, 
  ChevronDownIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface ServerSelectorProps {
  selectedServerId: string | null;
  onServerSelect: (serverId: string | null) => void;
  placeholder?: string;
  showAllOption?: boolean;
}

const ServerSelector: React.FC<ServerSelectorProps> = ({
  selectedServerId,
  onServerSelect,
  placeholder = "Select a server",
  showAllOption = true
}) => {
  const { darkMode } = useTheme();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchServers = async () => {
      try {
        setLoading(true);
        const response = await apiService.getServerList();
        
        if (response && response.success && response.data && Array.isArray(response.data)) {
          setServers(response.data);
        } else if (response && Array.isArray(response)) {
          setServers(response);
        } else {
          setServers([]);
        }
      } catch (error) {
        console.error('Error fetching servers:', error);
        setServers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchServers();
  }, []);

  const selectedServer = selectedServerId ? servers.find(s => s.id === selectedServerId) : null;

  const options = [
    ...(showAllOption ? [{ id: null, name: 'All Servers', memberCount: 0, icon: null }] : []),
    ...servers
  ];

  return (
    <Listbox value={selectedServerId} onChange={onServerSelect}>
      <div className="relative">
        <Listbox.Button className={classNames(
          "relative w-full cursor-default rounded-lg py-2 pl-3 pr-10 text-left shadow-sm border focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm",
          darkMode 
            ? "bg-gray-800 border-gray-600 text-white" 
            : "bg-white border-gray-300 text-gray-900"
        )}>
          <span className="flex items-center">
            {loading ? (
              <div className="flex items-center">
                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
                <span>Loading servers...</span>
              </div>
            ) : selectedServer ? (
              <div className="flex items-center">
                {selectedServer.icon ? (
                  <img 
                    src={`https://cdn.discordapp.com/icons/${selectedServer.id}/${selectedServer.icon}.png`} 
                    alt={selectedServer.name} 
                    className="w-6 h-6 rounded mr-3"
                  />
                ) : (
                  <div className={classNames(
                    "w-6 h-6 rounded flex items-center justify-center text-xs font-bold mr-3",
                    darkMode 
                      ? "bg-gray-700 text-gray-300" 
                      : "bg-gray-200 text-gray-600"
                  )}>
                    {selectedServer.name.substring(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="block truncate font-medium">{selectedServer.name}</span>
                  {selectedServer.memberCount > 0 && (
                    <span className={classNames(
                      "block text-xs truncate",
                      darkMode ? "text-gray-400" : "text-gray-500"
                    )}>
                      {selectedServer.memberCount.toLocaleString()} members
                    </span>
                  )}
                </div>
              </div>
            ) : selectedServerId === null && showAllOption ? (
              <div className="flex items-center">
                <ServerIcon className="w-6 h-6 mr-3 text-gray-400" />
                <span className="block truncate font-medium">All Servers</span>
              </div>
            ) : (
              <span className={classNames(
                "block truncate",
                darkMode ? "text-gray-400" : "text-gray-500"
              )}>
                {placeholder}
              </span>
            )}
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronDownIcon
              className={classNames(
                "h-5 w-5",
                darkMode ? "text-gray-400" : "text-gray-400"
              )}
              aria-hidden="true"
            />
          </span>
        </Listbox.Button>

        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options className={classNames(
            "absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm",
            darkMode 
              ? "bg-gray-800 border-gray-600" 
              : "bg-white border-gray-300"
          )}>
            {loading ? (
              <div className="relative cursor-default select-none py-2 px-4">
                <div className="flex items-center">
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
                  <span>Loading servers...</span>
                </div>
              </div>
            ) : options.length === 0 ? (
              <div className={classNames(
                "relative cursor-default select-none py-2 px-4",
                darkMode ? "text-gray-400" : "text-gray-500"
              )}>
                No servers available
              </div>
            ) : (
              options.map((server) => (
                <Listbox.Option
                  key={server.id || 'all'}
                  className={({ active }) =>
                    classNames(
                      "relative cursor-default select-none py-2 pl-3 pr-9",
                      active 
                        ? darkMode 
                          ? "bg-primary-600 text-white" 
                          : "bg-primary-600 text-white"
                        : darkMode 
                          ? "text-gray-300" 
                          : "text-gray-900"
                    )
                  }
                  value={server.id}
                >
                  {({ selected, active }) => (
                    <>
                      <div className="flex items-center">
                        {server.id === null ? (
                          <ServerIcon className="w-6 h-6 mr-3 text-gray-400" />
                        ) : server.icon ? (
                          <img 
                            src={`https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png`} 
                            alt={server.name} 
                            className="w-6 h-6 rounded mr-3"
                          />
                        ) : (
                          <div className={classNames(
                            "w-6 h-6 rounded flex items-center justify-center text-xs font-bold mr-3",
                            active
                              ? "bg-white/20 text-white"
                              : darkMode 
                                ? "bg-gray-700 text-gray-300" 
                                : "bg-gray-200 text-gray-600"
                          )}>
                            {server.name.substring(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className={classNames(
                            "block truncate font-medium",
                            selected ? "font-semibold" : "font-normal"
                          )}>
                            {server.name}
                          </span>
                          {server.memberCount > 0 && (
                            <span className={classNames(
                              "block text-xs truncate",
                              active 
                                ? "text-white/80" 
                                : darkMode 
                                  ? "text-gray-400" 
                                  : "text-gray-500"
                            )}>
                              {server.memberCount.toLocaleString()} members
                            </span>
                          )}
                        </div>
                      </div>

                      {selected ? (
                        <span className={classNames(
                          "absolute inset-y-0 right-0 flex items-center pr-4",
                          active ? "text-white" : "text-primary-600"
                        )}>
                          <CheckIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                      ) : null}
                    </>
                  )}
                </Listbox.Option>
              ))
            )}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  );
};

export default ServerSelector; 