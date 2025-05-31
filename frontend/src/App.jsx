import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { FaSync, FaMoon, FaSun, FaExclamationTriangle, FaTimes } from 'react-icons/fa';

const API_URL = 'http://localhost:3001';

// Helper function to check if a value is truthy (handles both string and boolean)
const isTruthy = (value) => {
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return Boolean(value);
};

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [ws, setWs] = useState(null);
  const [globalError, setGlobalError] = useState(null);

  // Toggle dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Helper function to get latest state for each container
  const getLatestContainerStates = (containers) => {
    if (!containers) return [];
    
    // Group containers by name only, keeping the most recent state
    const containerMap = new Map();
    
    containers.forEach(container => {
      const key = container.name;
      const existing = containerMap.get(key);
      
      if (!existing || new Date(container.last_checked) > new Date(existing.last_checked)) {
        containerMap.set(key, container);
      }
    });
    
    return Array.from(containerMap.values());
  };

  // Fetch containers data
  const { data: containers, isLoading, error, refetch } = useQuery('containers', async () => {
    try {
      const response = await fetch(`${API_URL}/api/containers`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch containers');
      }
      setGlobalError(null);
      return response.json();
    } catch (err) {
      setGlobalError(err.message);
      console.error('Error fetching containers:', err);
      return [];
    }
  });

  const latestContainers = getLatestContainerStates(containers);

  // Handle update check
  const handleCheckUpdates = async () => {
    try {
      const response = await fetch(`${API_URL}/api/check-updates`, { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to check for updates');
      }
    } catch (error) {
      console.error('Error checking updates:', error);
      setGlobalError(error.message);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Global Error Banner */}
      {globalError && (
        <div className="bg-error-50 dark:bg-error-900/20 border-b border-error-200 dark:border-error-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FaExclamationTriangle className="h-5 w-5 text-error-400" />
                <p className="ml-3 text-sm font-medium text-error-800 dark:text-error-200">
                  {globalError}
                </p>
              </div>
              <div className="flex items-center">
                <button
                  onClick={() => refetch()}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-error-700 bg-error-100 hover:bg-error-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-error-500 mr-2"
                >
                  <FaSync className="h-4 w-4 mr-1" />
                  Retry
                </button>
                <button
                  onClick={() => setGlobalError(null)}
                  className="inline-flex items-center p-1.5 rounded-md text-error-400 hover:text-error-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-error-500"
                >
                  <FaTimes className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Docker Container Watch</h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              {darkMode ? <FaSun className="w-5 h-5" /> : <FaMoon className="w-5 h-5" />}
            </button>
            <button
              onClick={handleCheckUpdates}
              className="flex items-center px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              <FaSync className="w-5 h-5 mr-2" />
              Check for Updates
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Latest Version Containers */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-green-800 dark:text-green-200 mb-4">
              Containers on Latest Version
            </h2>
            <div className="space-y-4">
              {latestContainers.filter(c => isTruthy(c.latest)).map((container) => (
                <div
                  key={`${container.name}-${container.host}`}
                  className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-green-100 dark:border-green-800"
                >
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{container.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{container.host}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Last checked: {new Date(container.last_checked).toLocaleString()}
                    </p>
                  </div>
                  <span className="px-2 py-1 text-xs font-semibold text-green-600 bg-green-100 dark:bg-green-800 dark:text-green-200 rounded-full">
                    Latest
                  </span>
                </div>
              ))}
              {(!latestContainers || latestContainers.filter(c => isTruthy(c.latest)).length === 0) && (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  No containers on latest version
                </p>
              )}
            </div>
          </div>

          {/* Containers with Updates */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-blue-800 dark:text-blue-200 mb-4">
              Containers with Updates
            </h2>
            <div className="space-y-4">
              {latestContainers.filter(c => isTruthy(c.new)).map((container) => (
                <div
                  key={`${container.name}-${container.host}`}
                  className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-blue-100 dark:border-blue-800"
                >
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{container.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{container.host}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Last checked: {new Date(container.last_checked).toLocaleString()}
                    </p>
                  </div>
                  <span className="px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-100 dark:bg-blue-800 dark:text-blue-200 rounded-full">
                    Update Available
                  </span>
                </div>
              ))}
              {(!latestContainers || latestContainers.filter(c => isTruthy(c.new)).length === 0) && (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  No containers with updates available
                </p>
              )}
            </div>
          </div>

          {/* Containers with Errors */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-4">
              Containers with Errors
            </h2>
            <div className="space-y-4">
              {latestContainers.filter(c => isTruthy(c.error)).map((container) => (
                <div
                  key={`${container.name}-${container.host}`}
                  className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-red-100 dark:border-red-800"
                >
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{container.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{container.host}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Last checked: {new Date(container.last_checked).toLocaleString()}
                    </p>
                  </div>
                  <span className="px-2 py-1 text-xs font-semibold text-red-600 bg-red-100 dark:bg-red-800 dark:text-red-200 rounded-full">
                    Error
                  </span>
                </div>
              ))}
              {(!latestContainers || latestContainers.filter(c => isTruthy(c.error)).length === 0) && (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  No containers with errors
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App; 