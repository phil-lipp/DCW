import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { FaSync, FaMoon, FaSun } from 'react-icons/fa';

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [ws, setWs] = useState(null);

  // Toggle dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // WebSocket connection
  useEffect(() => {
    const websocket = new WebSocket('ws://localhost:8080');
    
    websocket.onopen = () => {
      console.log('WebSocket Connected');
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'update-check-started') {
        // Trigger refetch
        refetch();
      }
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, []);

  // Fetch containers data
  const { data: containers, isLoading, error, refetch } = useQuery('containers', async () => {
    const response = await fetch('/api/containers');
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  });

  // Handle update check
  const handleCheckUpdates = async () => {
    try {
      await fetch('/api/check-updates', { method: 'POST' });
    } catch (error) {
      console.error('Error checking updates:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-error-500">Error loading containers: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Latest Version Containers */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Containers on Latest Version
            </h2>
            <div className="space-y-4">
              {containers?.filter(c => c.latest === 'true').map((container) => (
                <div
                  key={container.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{container.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{container.host}</p>
                  </div>
                  <span className="px-2 py-1 text-xs font-semibold text-success-600 bg-success-100 rounded-full">
                    Latest
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Containers with Updates */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Containers with Updates
            </h2>
            <div className="space-y-4">
              {containers?.filter(c => c.new === 'true').map((container) => (
                <div
                  key={container.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{container.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{container.host}</p>
                  </div>
                  <span className="px-2 py-1 text-xs font-semibold text-primary-600 bg-primary-100 rounded-full">
                    Update Available
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Containers with Errors */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Containers with Errors
            </h2>
            <div className="space-y-4">
              {containers?.filter(c => c.error === 'true').map((container) => (
                <div
                  key={container.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{container.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{container.host}</p>
                  </div>
                  <span className="px-2 py-1 text-xs font-semibold text-error-600 bg-error-100 rounded-full">
                    Error
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App; 