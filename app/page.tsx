import React, { useState } from 'react';
import { Clock, Users } from 'lucide-react';

interface ScriptItem {
  id: string;
  title: string;
  icon: 'history' | 'group';
}

const RobotSection: React.FC = () => {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const scripts: ScriptItem[] = [
    { id: '1', title: 'Demandes de jours de repos', icon: 'history' },
    { id: '2', title: 'Demandes de télétravail', icon: 'group' },
    { id: '3', title: 'Demandes ds pointage', icon: 'group' }
  ];

  const handleLaunch = async (scriptId: string): Promise<void> => {
    setLoadingStates(prev => ({ ...prev, [scriptId]: true }));
    
    try {
      // Remplacez cette simulation par votre véritable appel fetch
      const response = await fetch(`/api/launch-script/${scriptId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scriptId })
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors du lancement du script');
      }
      
      const data = await response.json();
      console.log(`Script ${scriptId} lancé avec succès:`, data);
    } catch (error) {
      console.error('Erreur lors du lancement:', error);
    } finally {
      setLoadingStates(prev => ({ ...prev, [scriptId]: false }));
    }
  };

  const getIcon = (iconType: 'history' | 'group'): React.ReactElement => {
    return iconType === 'history' ? 
      <Clock size={24} /> : 
      <Users size={24} />;
  };

  const Loader: React.FC = () => (
    <div style={{
      width: '36px',
      height: '36px',
      border: '4px solid #22c55e',
      borderTop: '4px solid transparent',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  return (
    <div style={{ margin: '32px 0' }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        padding: '24px'
      }}>
        <div style={{ textAlign: 'start' }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            textAlign: 'center',
            marginTop: '8px',
            marginBottom: '16px'
          }}>
            Robot Scripts
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {scripts.map((script) => (
              <li 
                key={script.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: '1px solid #f3f4f6'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <div style={{ marginRight: '16px', color: '#6b7280', padding: 0 }}>
                    {getIcon(script.icon)}
                  </div>
                  <span style={{ color: 'black', fontSize: '1rem' }}>
                    {script.title}
                  </span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', minWidth: '120px' }}>
                  {loadingStates[script.id] ? (
                    <Loader />
                  ) : (
                    <button
                      onClick={() => handleLaunch(script.id)}
                      style={{
                        backgroundColor: '#16a34a',
                        color: 'white',
                        fontWeight: 500,
                        padding: '8px 16px',
                        borderRadius: '4px',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#15803d';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#16a34a';
                      }}
                    >
                      Lancer
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RobotSection;
